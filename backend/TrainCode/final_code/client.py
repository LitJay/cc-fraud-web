
import sys
from pathlib import Path
from lightgbm import LGBMClassifier
import flwr as fl
import joblib
import pandas as pd
from imblearn.ensemble import BalancedRandomForestClassifier
from sklearn.model_selection import GridSearchCV
from sklearn.base import clone
from sklearn.metrics import accuracy_score, log_loss
from sklearn.pipeline import Pipeline
from sklearn.utils.validation import check_is_fitted
from features import build_features
from sklearn.exceptions import NotFittedError
from xgboost import XGBClassifier
# ------------------------------------------------------------------
# 1）载入中央 artefact（预处理管道 + encoder + fraud-rate lookup）
# ------------------------------------------------------------------
artifact       = joblib.load("models/fraud_rf.joblib")
te_template    = artifact["target_encoder"]
preproc = artifact["prep"]
merchant_rate  = artifact["merchant_rate"]
state_rate     = artifact["state_rate"]
global_rate    = artifact["global_rate"]


rf = BalancedRandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    sampling_strategy='auto',  # Auto-undersample majority
    replacement=False,
    random_state=42,
    n_jobs=-1,
)
pipe_template = Pipeline([("prep", preproc), ("clf", rf)])

# ------------------------------------------------------------------
# 2）Flower Client
# ------------------------------------------------------------------
class FraudClient(fl.client.NumPyClient):

    def __init__(self, state_code: str):
     self.state = state_code
     self.local_round = 0

    # Load artifact for state rates
     artifact = joblib.load("models/fraud_rf.joblib")
     state_rate = artifact["state_rate"]
     global_rate = artifact["global_rate"]

    # Load state data
     df = pd.read_parquet(Path("data/clean/fed") / f"{state_code}.parquet")
     if "merchant" in df.columns:
        df["merchant_te"] = te_template.transform(df[["merchant"]]) 
        df = df.drop(columns=["merchant"])
    # Convert state to risk score if needed
     if 'state' in df.columns and 'state_risk' not in df.columns:
        df['state_risk'] = df['state'].map(state_rate).fillna(global_rate)
        df = df.drop(columns=['state'])
    # Ensure required columns exist
     X = df.drop("is_fraud", axis=1).reset_index(drop=True)
     y = df["is_fraud"].reset_index(drop=True)
     print(f"[{self.state}] X columns: {X.columns.tolist()}")
    # Memory optimization
     num_cols = X.select_dtypes("number").columns
     X[num_cols] = X[num_cols].astype("float32")

     self.X = X
     self.y = y
     self.pipe = clone(pipe_template)
     self.eval_pipe = pipe_template

    # ========== Flower 回调 ==========
    def get_parameters(self, config):        
        return []                             
    def fit(self, parameters, config):
     if self.y.nunique() < 2:
        print(f"[{self.state}] only one class ({self.y.unique()[0]}) present, skipping fit")
        return [], len(self.X), {}
    
     param_grid = {
        'clf__max_depth': [5, 10, 15],
        'clf__sampling_strategy': [0.5, 0.8, 'auto'],
        'clf__max_samples': [0.5, 0.8, 1.0]
    }
     grid_search = GridSearchCV(self.pipe, param_grid, cv=5, scoring='precision')
     
     if len(self.X) > 10000: 
        sample_idx = self.X.sample(n=10000, random_state=42).index
        X_sub, y_sub = self.X.loc[sample_idx], self.y.loc[sample_idx]
     else:
        X_sub, y_sub = self.X, self.y
    
     grid_search.fit(X_sub, y_sub)
     self.pipe = grid_search.best_estimator_
     print(f"[{self.state}] Best params: {grid_search.best_params_}")
    
     self.is_fitted = True
    

     self.local_round += 1
     MODEL_DIR = Path("models"); MODEL_DIR.mkdir(exist_ok=True)
     path = MODEL_DIR / f"fed_round{self.local_round}_{self.state}.joblib"
     joblib.dump({"target_encoder": te_template, "pipeline": self.pipe}, path)
     print(f"[{self.state}] model saved ➜ {path}")

     return [], len(self.X), {}

    def evaluate(self, parameters, config):
        """Flower 可能在第一次训练前就调用 evaluate。"""
        try:
           
            check_is_fitted(self.pipe)
        except NotFittedError:
          
            return 0.0, len(self.y), {"accuracy": 0.0}

        y_pred = self.pipe.predict(self.X)
        y_prob = self.pipe.predict_proba(self.X)
        loss   = log_loss(self.y, y_prob)
        acc    = accuracy_score(self.y, y_pred)
        return loss, len(self.y), {"accuracy": acc}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python client.py <STATE_CODE>")
    state_code = sys.argv[1]

    fl.client.start_client(
        server_address="0.0.0.0:8080",
        client=FraudClient(state_code).to_client(),
    )

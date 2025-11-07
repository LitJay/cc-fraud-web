import sys
from pathlib import Path
import flwr as fl
import joblib
import pandas as pd
import optuna 
from sklearn.model_selection import cross_val_score
from sklearn.base import clone
from sklearn.metrics import accuracy_score, log_loss, f1_score
from sklearn.pipeline import Pipeline
from sklearn.utils.validation import check_is_fitted

from sklearn.exceptions import NotFittedError
from xgboost import XGBClassifier

artifact = joblib.load("models/fraud_rf.joblib")
te_template = artifact["target_encoder"]
preproc = artifact["prep"]


y_train_full = pd.read_parquet(Path("data/clean/train_sampled.parquet"))["is_fraud"]
scale_pos_weight = y_train_full.value_counts()[0] / y_train_full.value_counts()[1]


xgb = XGBClassifier(
    objective='binary:logistic',
    eval_metric='aucpr',
    use_label_encoder=False,
    random_state=42,
    n_jobs=-1,
    scale_pos_weight=scale_pos_weight
)
pipe_template = Pipeline([("prep", preproc), ("clf", xgb)])

class FraudClient(fl.client.NumPyClient):

    def __init__(self, state_code: str):
        self.state = state_code
        self.local_round = 0
        df = pd.read_parquet(Path("data/clean/fed") / f"{state_code}.parquet")
        self.X = df.drop("is_fraud", axis=1)
        self.y = df["is_fraud"]
        self.pipe = clone(pipe_template)
        print(f"[{self.state}] Loaded {len(df)} samples. X columns: {self.X.columns.tolist()}")

    def get_parameters(self, config):
        return []

    def fit(self, parameters, config):
        if self.y.nunique() < 2:
            print(f"[{self.state}] only one class ({self.y.unique()[0]}) present, skipping fit")
            return [], len(self.X), {}
        if len(self.X) > 10000:
            sample_idx = self.X.sample(n=10000, random_state=42).index
            X_sub, y_sub = self.X.loc[sample_idx], self.y.loc[sample_idx]
        else:
            X_sub, y_sub = self.X, self.y

        def objective(trial):
            """Optuna objective function to find the best hyperparameters."""
            params = {
                'clf__max_depth': trial.suggest_int('clf__max_depth', 4, 15),
                'clf__n_estimators': trial.suggest_int('clf__n_estimators', 100, 500),
                'clf__learning_rate': trial.suggest_float('clf__learning_rate', 0.01, 0.3, log=True),
                'clf__subsample': trial.suggest_float('clf__subsample', 0.6, 1.0),
                'clf__colsample_bytree': trial.suggest_float('clf__colsample_bytree', 0.6, 1.0),
                'clf__gamma': trial.suggest_float('clf__gamma', 0, 5),
                'clf__min_child_weight': trial.suggest_int('clf__min_child_weight', 1, 10),
            }    
            # Set the parameters on a fresh clone of the pipeline
            self.pipe.set_params(**params)     
            # Evaluate the model using cross-validation, optimizing for F1 score
            score = cross_val_score(self.pipe, X_sub, y_sub, n_jobs=-1, cv=3, scoring='f1').mean()
            return score

  
        study = optuna.create_study(direction='maximize')
        study.optimize(objective, n_trials=50) 

        print(f"[{self.state}] Best trial found by Optuna:")
        print(f"  F1-Score: {study.best_value:.4f}")
        print(f"  Params: {study.best_params}")
        self.pipe.set_params(**study.best_params) 
        self.pipe.fit(self.X, self.y)
        self.is_fitted = True
        self.local_round += 1
        MODEL_DIR = Path("models")
        MODEL_DIR.mkdir(exist_ok=True)
        path = MODEL_DIR / f"fed_round{self.local_round}_{self.state}.joblib"
        
        joblib.dump({"pipeline": self.pipe}, path)
        print(f"[{self.state}] model saved ➜ {path}")

        return [], len(self.X), {}

    def evaluate(self, parameters, config):
        try:
            check_is_fitted(self.pipe)
        except NotFittedError:
            return 0.0, len(self.y), {"accuracy": 0.0, "f1_score": 0.0}

        y_pred = self.pipe.predict(self.X)
        y_prob = self.pipe.predict_proba(self.X)[:, 1]
        loss = log_loss(self.y, y_prob)
        acc = accuracy_score(self.y, y_pred)
        f1 = f1_score(self.y, y_pred)
        
        return loss, len(self.y), {"accuracy": acc, "f1_score": f1}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Error: Please provide the state code as an argument.")
        print("Usage: python client.py <STATE_CODE>")
        sys.exit(1) 
        
    state_code = sys.argv[1]

    fl.client.start_client(
        server_address="0.0.0.0:8080",
        client=FraudClient(state_code).to_client(),
    )

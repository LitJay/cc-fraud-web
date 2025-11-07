# client_smote.py

import sys
from pathlib import Path
import pandas as pd
import joblib

import flwr as fl
from flwr.client import NumPyClient

from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score

class FraudClient(NumPyClient):
    def __init__(self, state_code: str):
        # 加载该 state 分组后的平衡数据
        df = pd.read_parquet(Path("data/Smote/fed") / f"{state_code}.parquet")
        self.X = df.drop(columns=["is_fraud"])
        self.y = df["is_fraud"].values
        
        # 定义 pipeline：StandardScaler + XGBoost
        self.pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", XGBClassifier(
                use_label_encoder=False,
                eval_metric="logloss",
                random_state=42
            )),
        ])
        
        self.local_round = 0
        self.state = state_code

    def get_parameters(self, config):
        # 不进行参数同步，返回空列表
        return []

    def fit(self, parameters, config):
        # 在本地数据上训练模型
        self.pipe.fit(self.X, self.y)
        self.local_round += 1

        # 保存本地模型快照（可选）
        MODEL_DIR = Path("data/Smote/models")
        MODEL_DIR.mkdir(exist_ok=True)
        joblib.dump(
            self.pipe,
            MODEL_DIR / f"round{self.local_round}_{self.state}.joblib"
        )

        # 返回本地参数列表及样本数量
        return self.get_parameters(config), len(self.X), {}

    def evaluate(self, parameters, config):
        # 在本地数据上评估性能
        y_pred = self.pipe.predict(self.X)
        loss = 1 - accuracy_score(self.y, y_pred)
        metrics = {
            "accuracy": accuracy_score(self.y, y_pred),
            "precision": precision_score(self.y, y_pred),
            "recall": recall_score(self.y, y_pred),
            "auc": roc_auc_score(self.y, self.pipe.predict_proba(self.X)[:, 1]),
        }
        return float(loss), len(self.X), metrics

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python client_smote.py <state_code>")
        sys.exit(1)
    state_code = sys.argv[1]
    
    # 启动 Flower 客户端
    fl.client.start_client(
        server_address="localhost:8080",
        client=FraudClient(state_code).to_client(),
    )

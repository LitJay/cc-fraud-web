# make_artifact.py  —  生成预处理 artefact 供联邦学习和 API 使用
# ================================================================
from pathlib import Path
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy  import DummyClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OrdinalEncoder
from category_encoders import TargetEncoder

RAW_CSV   = Path("dataManage/fraudTrain.csv")
SAMPLED   = Path("data/Smote/train_sampled.parquet")   # ← rosrus_sampler 产物
MODEL_DIR = Path("models"); MODEL_DIR.mkdir(exist_ok=True)
MODEL_OUT = MODEL_DIR / "smote_fraud_rf.joblib"

# ------------------------------------------------------------------
# 1) 先用 **原始 CSV** 做 lookup + TargetEncoder
# ------------------------------------------------------------------
raw = pd.read_csv(RAW_CSV, low_memory=False)

merchant_rate = (
    raw.groupby("merchant")["is_fraud"].mean().to_dict()
)
state_rate = (
    raw.groupby("state")["is_fraud"].mean().to_dict()
)
global_rate = float(raw["is_fraud"].mean())

te = TargetEncoder(cols=["merchant"]).fit(
    raw[["merchant"]], raw["is_fraud"]
)

# ------------------------------------------------------------------
# 2) 用采样好的特征化训练集来确定列 & 预处理
# ------------------------------------------------------------------
df = pd.read_parquet(SAMPLED)
X, y = df.drop("is_fraud", axis=1), df["is_fraud"]

num_cols = X.select_dtypes("number").columns.tolist()
cat_cols = X.select_dtypes("object").columns.tolist()

preproc = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), num_cols),
        ("cat", OrdinalEncoder(),  cat_cols),
    ],
    remainder="drop",
)

pipe = Pipeline([
    ("prep", preproc),
    ("clf", DummyClassifier(strategy="most_frequent")),   # 先占位
])

# ------------------------------------------------------------------
# 3) 打包 artefact
# ------------------------------------------------------------------
artifact = {
    "pipeline":       pipe,         
    "target_encoder": te,            
    "merchant_rate":  merchant_rate,
    "state_rate":     state_rate,
    "global_rate":    global_rate,
}

joblib.dump(artifact, MODEL_OUT)
print(f"✅  artefact saved to {MODEL_OUT}")
print(f"   num_cols={len(num_cols)} | cat_cols={len(cat_cols)} | rows={len(X)}")

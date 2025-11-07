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

RAW_CSV   = Path("data/fraudTrain.csv")
SAMPLED   = Path("data/clean/train_sampled.parquet")   # ← rosrus_sampler 产物
MODEL_DIR = Path("models"); MODEL_DIR.mkdir(exist_ok=True)
MODEL_OUT = MODEL_DIR / "fraud_rf.joblib"

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
print(f"Columns in df: {df.columns.tolist()}")  # 新增: 检查列
print(f"Has 'state': {'state' in df.columns}, Has 'state_risk': {'state_risk' in df.columns}")

if "state" in df.columns and "state_risk" not in df.columns:
    print("Triggering state_risk addition...")  # 新增
    df['state_risk'] = df['state'].map(state_rate).fillna(global_rate)
    df = df.drop(columns=['state'])
    
X, y = df.drop("is_fraud", axis=1), df["is_fraud"]
if "merchant" in df.columns:
    df["merchant_te"] = te.transform(df[["merchant"]])
    df = df.drop(columns=["merchant"])
    
    
num_cols = X.select_dtypes("number").columns.tolist()
cat_cols = X.select_dtypes("object").columns.tolist()
print(f"num_cols: {num_cols}")  # 新增
print(f"cat_cols: {cat_cols}")
if cat_cols:
    transformers = [
        ("num", "passthrough", num_cols),
        ("cat", OrdinalEncoder(), cat_cols),
    ]
else:
    transformers = [("num", "passthrough", num_cols)]

preproc = ColumnTransformer(
    transformers,
    remainder="drop",
)
preproc.fit(X)
pipe = Pipeline([
    ("prep", preproc),
    ("clf", DummyClassifier(strategy="most_frequent")),   # 先占位
])

# ------------------------------------------------------------------
# 3) 打包 artefact
# ------------------------------------------------------------------
artifact = {
    "pipeline":       pipe, 
    "prep": preproc,        
    "target_encoder": te,            
    "merchant_rate":  merchant_rate,
    "state_rate":     state_rate,
    "global_rate":    global_rate,
}

joblib.dump(artifact, MODEL_OUT)
print(f"✅  artefact saved to {MODEL_OUT}")
print(f"   num_cols={len(num_cols)} | cat_cols={len(cat_cols)} | rows={len(X)}")

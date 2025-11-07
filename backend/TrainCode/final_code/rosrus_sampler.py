from __future__ import annotations

import gc
import numpy as np
import pandas as pd
import scipy.sparse
import time
from category_encoders import TargetEncoder
from datetime import timedelta
from features2 import build_features
from imblearn.over_sampling import RandomOverSampler
from imblearn.pipeline import make_pipeline
from imblearn.under_sampling import RandomUnderSampler
from pathlib import Path
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import LabelEncoder

RAW_CSV = Path("data/fraudTrain.csv")
TEST_CSV = Path("data/fraudTest.csv")
OUT_DIR = Path("data/clean")
OUT_DIR.mkdir(parents=True, exist_ok=True)

N_COMPONENTS = 100
RANDOM_STATE = 42

start_time = time.time()

print("▶ Loading training data …")
df_train_raw = pd.concat(pd.read_csv(RAW_CSV, low_memory=False, chunksize=100000))
print(f"Train data memory usage: {df_train_raw.memory_usage(deep=True).sum() / (1024**2):.2f} MB")
merchant_rate = df_train_raw.groupby("merchant")["is_fraud"].mean().to_dict()
te = TargetEncoder(cols=["merchant"]).fit(
    df_train_raw[["merchant"]], df_train_raw["is_fraud"]
)

X, y, _, preproc, cat_encoder = build_features(
    df_train_raw,
    training=True,
    te=te,
    return_preprocessor=True,
    return_cat_encoder=True,
)
print(f"   X shape = {X.shape}")

le_state = LabelEncoder()
state_enc = le_state.fit_transform(df_train_raw["state"]).reshape(-1, 1)
X_concat = np.hstack([X, state_enc])

print("▶ Running ROS followed by RUS for balanced sampling …")
print(f"   Original class distribution: {dict(zip(*np.unique(y, return_counts=True)))}")

ros = RandomOverSampler(sampling_strategy=1.0, random_state=RANDOM_STATE)
rus = RandomUnderSampler(sampling_strategy=1.0, random_state=RANDOM_STATE)
sampler_pipeline = make_pipeline(ros, rus)

X_bal_concat, y_bal = sampler_pipeline.fit_resample(X_concat, y)
print("   After ROS + RUS:", dict(zip(*np.unique(y_bal, return_counts=True))))

state_bal_enc = X_bal_concat[:, -1].astype(int)
state_bal = le_state.inverse_transform(state_bal_enc)
X_bal = X_bal_concat[:, :-1]

feature_cols = preproc.get_feature_names_out().tolist()
train_df = pd.DataFrame(X_bal, columns=feature_cols)
train_df["state"] = state_bal
train_df["is_fraud"] = y_bal
print(f"Train output memory usage: {train_df.memory_usage(deep=True).sum() / (1024**2):.2f} MB")

print("▶ Processing test data …")
df_test_raw = pd.concat(pd.read_csv(TEST_CSV, low_memory=False, chunksize=100000))
X_test, _, _ = build_features(
    df_test_raw,
    training=False,
    preprocessor=preproc,
    te=te,
    cat_encoder=cat_encoder,
)
test_df = pd.DataFrame(X_test, columns=preproc.get_feature_names_out())
test_df["state"] = df_test_raw["state"].to_numpy()
test_df["is_fraud"] = df_test_raw["is_fraud"].to_numpy()
print(f"Test output memory usage: {test_df.memory_usage(deep=True).sum() / (1024**2):.2f} MB")

train_df.to_parquet(OUT_DIR / "train_sampled.parquet", index=False, compression='snappy', engine='pyarrow')
print("✓ Saved →", OUT_DIR / "train_sampled.parquet")
test_df.to_parquet(OUT_DIR / "test.parquet", index=False, compression='snappy', engine='pyarrow')
print("✓ Saved →", OUT_DIR / "test.parquet")
import joblib
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)
joblib.dump(preproc, MODEL_DIR / "feature_preprocessor.joblib")
joblib.dump(cat_encoder, MODEL_DIR / "cat_encoder.joblib")
print("✓ Saved feature_preprocessor.joblib and cat_encoder.joblib")

elapsed = time.time() - start_time
print(f"\n⏱️  Total execution time: {timedelta(seconds=elapsed)}")
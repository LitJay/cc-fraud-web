import glob
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pathlib
from ensemble import EnsembleClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    roc_auc_score, average_precision_score,
    precision_recall_curve, classification_report,
)
from sklearn.pipeline import Pipeline

MODEL_DIR = pathlib.Path("models")
STATE_MODELS = sorted(glob.glob(str(MODEL_DIR / "fed_round10_*.joblib")))
ARTIFACT_PATH = MODEL_DIR / "fraud_rf.joblib"
OUT_PATH = MODEL_DIR / "global_rf.joblib"
TEST_PATH = pathlib.Path("data/clean/test.parquet")

weights = []
for p in STATE_MODELS:
    state_data = pd.read_parquet(f"data/clean/fed/{pathlib.Path(p).stem.split('_')[-1]}.parquet")
    weights.append(len(state_data))
weights = np.array(weights) / sum(weights)

template_pipe = joblib.load(STATE_MODELS[0])["pipeline"]
fitted_prep = joblib.load(ARTIFACT_PATH)["prep"]

aux_art = joblib.load(ARTIFACT_PATH)
merchant_rate = aux_art["merchant_rate"]
state_rate = aux_art["state_rate"]
global_rate = aux_art["global_rate"]

global_clfs = []
for p in STATE_MODELS:
    c = joblib.load(p)["pipeline"].named_steps["clf"]
    global_clfs.append(c)

global_rf = EnsembleClassifier(global_clfs, weights)

print(f"Combined {len(STATE_MODELS)} states → {len(global_clfs)} models")

te = joblib.load(ARTIFACT_PATH)["target_encoder"]

df_test = pd.read_parquet(TEST_PATH)
print(f"Test columns before processing: {df_test.columns.tolist()}")
X_test, y_test = df_test.drop("is_fraud", axis=1), df_test["is_fraud"]

expected_cols = [col for _, _, cols in fitted_prep.transformers_ for col in cols]

if "merchant" in X_test.columns:
    X_test["merchant_te"] = te.transform(X_test[["merchant"]])
    X_test = X_test.drop(columns=["merchant"])
if "state" in X_test.columns:
    X_test["state_risk"] = X_test["state"].map(state_rate).fillna(global_rate)
    X_test = X_test.drop(columns=["state"])

print(f"Expected columns (from preprocessor): {sorted(expected_cols)}")
print(f"Actual X_test columns (after state_risk): {sorted(X_test.columns.tolist())}")

missing = [c for c in expected_cols if c not in X_test.columns]
extra = [c for c in X_test.columns if c not in expected_cols]
if missing:
    print(f"⚠️ Adding missing columns: {missing}")
    for col in missing:
        X_test[col] = np.nan
if extra:
    print(f"⚠️ Dropping extra columns: {extra}")
    X_test = X_test.drop(columns=extra)
print(f"X_test columns after processing: {X_test.columns.tolist()}")

X_test_enc = fitted_prep.transform(X_test)

y_prob = global_rf.predict_proba(X_test_enc)[:, 1]
precision, recall, thr = precision_recall_curve(y_test, y_prob)
f1 = 2 * precision * recall / (precision + recall + 1e-9)
opt_thr = thr[np.argmax(f1)]
# opt_thr = 0.60
y_pred = (y_prob >= opt_thr)

print(f"\nBest F1={f1.max():.3f} at threshold={opt_thr:.4f}")
print("\n=== Offline metrics on nationwide test set ===")
print(f"Accuracy : {accuracy_score(y_test, y_pred):.4f}")
print(f"Precision: {precision_score(y_test, y_pred):.4f}")
print(f"Recall   : {recall_score(y_test, y_pred):.4f}")
print(f"AUROC    : {roc_auc_score(y_test, y_prob):.4f}")
print(f"AUPRC    : {average_precision_score(y_test, y_prob):.4f}")
print("\nDetailed classification report:\n")
print(classification_report(y_test, y_pred, digits=3))

plt.hist(y_prob[y_test==1], bins=50, alpha=0.6, label="fraud")
plt.hist(y_prob[y_test==0], bins=50, alpha=0.6, label="legit")
plt.legend()
plt.title("Probability distribution")
plt.savefig('prob_dist.png')

full_pipe = Pipeline([
    ("target_encoder", te),
    ("prep", fitted_prep),
    ("clf", global_rf),
])

artifact = {
    "pipeline": full_pipe,
    "target_encoder": te,
    "merchant_rate": merchant_rate,
    "state_rate": state_rate,
    "global_rate": global_rate,
}
joblib.dump(artifact, OUT_PATH)
print(f"\n✓ Global pipeline saved to {OUT_PATH}")
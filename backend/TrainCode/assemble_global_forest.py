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
    ConfusionMatrixDisplay, RocCurveDisplay, PrecisionRecallDisplay
)
from sklearn.pipeline import Pipeline

MODEL_DIR = pathlib.Path("models")
# Assuming 10 rounds of training, adjust if necessary
STATE_MODELS = sorted(glob.glob(str(MODEL_DIR / "fed_round*_*.joblib")))
ARTIFACT_PATH = MODEL_DIR / "fraud_rf.joblib"
OUT_PATH = MODEL_DIR / "global_rf.joblib"
TEST_PATH = pathlib.Path("data/clean/test.parquet")

weights = []
for p in STATE_MODELS:
    state_data = pd.read_parquet(f"data/clean/fed/{pathlib.Path(p).stem.split('_')[-1]}.parquet")
    weights.append(len(state_data))
weights = np.array(weights) / sum(weights)

artifact = joblib.load(ARTIFACT_PATH)
fitted_prep = artifact["prep"]
te = artifact["target_encoder"]
merchant_rate = artifact["merchant_rate"]
state_rate = artifact["state_rate"]
global_rate = artifact["global_rate"]

global_clfs = []
for p in STATE_MODELS:
    c = joblib.load(p)["pipeline"].named_steps["clf"]
    global_clfs.append(c)

global_rf = EnsembleClassifier(global_clfs, weights)

print(f"Combined {len(STATE_MODELS)} states → {len(global_clfs)} models")
try:
    num_features = fitted_prep.transformers_[0][2]
    cat_features_raw = fitted_prep.transformers_[1][1].get_feature_names_out(fitted_prep.transformers_[1][2])
    feature_names = num_features + list(cat_features_raw)
except Exception:
    try:
        feature_names = fitted_prep.get_feature_names_out()
    except Exception:
        print("Could not automatically determine feature names for importance plot.")
        feature_names = None

if feature_names is not None:
    importances = [clf.feature_importances_ for clf in global_clfs]
    avg_importance = np.mean(importances, axis=0)
    
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': avg_importance
    }).sort_values('importance', ascending=False).head(20) 
    
    plt.figure(figsize=(10, 12))
    plt.barh(importance_df['feature'], importance_df['importance'])
    plt.gca().invert_yaxis()
    plt.title('Average Feature Importance Across All Clients')
    plt.xlabel('Importance Score')
    plt.tight_layout()
    plt.savefig('feature_importance.png')
    print("✓ Saved feature_importance.png")

df_test = pd.read_parquet(TEST_PATH)
X_test, y_test = df_test.drop("is_fraud", axis=1), df_test["is_fraud"]

print("Transforming test data with the fitted preprocessor...")
X_test_enc = fitted_prep.transform(X_test)

y_prob = global_rf.predict_proba(X_test_enc)[:, 1]
precision, recall, thr = precision_recall_curve(y_test, y_prob)
f1 = 2 * precision * recall / (precision + recall + 1e-9)

f1 = np.nan_to_num(f1)

opt_thr = thr[np.argmax(f1)]
y_pred = (y_prob >= opt_thr)
print(f"AUPRC    : {average_precision_score(y_test, y_prob):.4f}")


fig, ax = plt.subplots(figsize=(8, 8))

best_f1_idx = np.argmax(f1)
best_precision = precision[best_f1_idx]
best_recall = recall[best_f1_idx]

display = PrecisionRecallDisplay(precision=precision, recall=recall)
display.plot(ax=ax, label=f'AUPRC = {average_precision_score(y_test, y_prob):.3f}')
ax.scatter(best_recall, best_precision, marker='o', color='red', s=100, zorder=10, label=f'Best F1-Score Point (Threshold≈{opt_thr:.2f})')
ax.set_title('Precision-Recall Curve')
plt.legend()
plt.savefig('precision_recall_curve.png')
print("✓ Saved precision_recall_curve.png")
print(f"\nBest F1={f1.max():.3f} at threshold={opt_thr:.4f}")
print("\n=== Offline metrics on nationwide test set ===")
print(f"Accuracy : {accuracy_score(y_test, y_pred):.4f}")
print(f"Precision: {precision_score(y_test, y_pred):.4f}")
print(f"Recall   : {recall_score(y_test, y_pred):.4f}")
print(f"AUROC    : {roc_auc_score(y_test, y_prob):.4f}")
print(f"AUPRC    : {average_precision_score(y_test, y_prob):.4f}")
print("\nDetailed classification report:\n")
print(classification_report(y_test, y_pred, digits=3))
fig, ax = plt.subplots(figsize=(8, 6))
ConfusionMatrixDisplay.from_predictions(
    y_test,
    y_pred,
    ax=ax,
    cmap='Blues',
    values_format='d' 
)
ax.set_title('Confusion Matrix for Global Model')
plt.savefig('confusion_matrix.png')
print("✓ Saved confusion_matrix.png")

fig, ax = plt.subplots(figsize=(8, 8))
RocCurveDisplay.from_predictions(y_test, y_prob, ax=ax)
ax.plot([0, 1], [0, 1], 'k--', label='No Skill') 
ax.set_title('ROC Curve for Global Model')
plt.legend()
plt.savefig('roc_curve.png')
print("✓ Saved roc_curve.png")
plt.hist(y_prob[y_test==1], bins=50, alpha=0.6, label="fraud")
plt.hist(y_prob[y_test==0], bins=50, alpha=0.6, label="legit")
plt.legend()
plt.title("Probability distribution")
plt.savefig('prob_dist.png')

# The final pipeline for deployment should only contain the preprocessor and the classifier
final_deployment_pipeline = Pipeline([
    ("prep", fitted_prep),
    ("clf", global_rf),
])

# Save the final deployable artifact
joblib.dump({
    "pipeline": final_deployment_pipeline,
    "target_encoder": te, # The TE is still needed for new, unseen merchants
    "state_rate": state_rate,
    "global_rate": global_rate,
}, OUT_PATH)

print(f"\n✓ Global pipeline saved to {OUT_PATH}")

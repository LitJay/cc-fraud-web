from pathlib import Path
import pandas as pd
import joblib

SRC  = Path("data/clean/train_sampled.parquet")
DEST = Path("data/clean/fed")
DEST.mkdir(parents=True, exist_ok=True)

print("→ Loading", SRC)
df = pd.read_parquet(SRC)

# Check if we're using state or state_risk
if 'state' in df.columns:
    group_col = 'state'
elif 'state_risk' in df.columns:
    # If using state_risk, we need to map back to state codes
    artifact = joblib.load("models/fraud_rf.joblib")
    state_rate = artifact["state_rate"]
    # Create inverse mapping from risk to state code
    risk_to_state = {v: k for k, v in state_rate.items()}
    df['state'] = df['state_risk'].map(risk_to_state)
    group_col = 'state'
else:
    raise ValueError("Neither 'state' nor 'state_risk' column found in data")

cnt = 0
for st, g in df.groupby(group_col):
    fn = DEST / f"{st}.parquet"
    g.to_parquet(fn, index=False)
    print(f"  • {st:<2}  {len(g):>7,d} rows  →  {fn}")
    cnt += 1

print(f"✓ {cnt} states saved in {DEST}")
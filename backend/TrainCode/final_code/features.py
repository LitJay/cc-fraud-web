"""
features.py
-----------
Enhanced to allow a **single preprocessor** (ColumnTransformer) to be
fit on the training set and reused unchanged for the test set.  This
keeps the one‑hot feature space identical, preventing the column‑count
mismatch you just hit in TruncatedSVD.

API CHANGES
===========
1. build_features(df, *, training=True, preprocessor=None,
                  return_preprocessor=False)
   • training=True  & preprocessor=None  → fit + return features.
   • training=False & preprocessor=<fitted CT> → transform only.
   • Set return_preprocessor=True to get the fitted object back.

Return signatures:
==================
training=True,  return_preprocessor=False → X, y, (X_test, y_test)
training=True,  return_preprocessor=True  → X, y, (X_test, y_test), preprocessor
training=False → X, None, None  (preprocessor already supplied)
"""

from __future__ import annotations

import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from category_encoders import TargetEncoder

# ---------------------------------------------------------------------------
# Helpers (same parse_best & timestamp logic you already have) --------------
# ---------------------------------------------------------------------------
import re
from typing import Optional, Tuple, Union
from pandas import DataFrame, Series


def parse_best(series: Series, candidate_fmts, col_name):
    raw = (
        series.astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    )
    best = None
    best_na = len(raw) + 1
    for fmt in candidate_fmts:
        parsed = pd.to_datetime(raw, format=fmt, errors="coerce")
        na_cnt = parsed.isna().sum()
        if na_cnt < best_na:
            best, best_na = parsed, na_cnt
        if na_cnt <= 0.05 * len(raw):
            break
    if best_na == len(raw):
        best = pd.to_datetime(
            raw, 
            errors='coerce', 
            infer_datetime_format=True,
            utc=True
        )
    print(
        f"{col_name}: parsed {len(best) - best.isna().sum()} of {len(best)} rows with "
        f"{'fallback' if best_na == len(raw) else 'fmt match'}."
    )
    return best


# ---------------------------------------------------------------------------
# Main function -------------------------------------------------------------
# ---------------------------------------------------------------------------

def build_features(
   df: DataFrame,
    *,
    training: bool = True,
    preprocessor: ColumnTransformer | None = None,
    te: TargetEncoder | None = None,  
    return_te: bool = False,  
    return_preprocessor: bool = False,
):
    """Feature‑engineering pipeline with reusable preprocessor."""
    df = df.copy()

    # 1. Timestamp parsing -------------------------------------------------
    if "trans_date_trans_time" in df.columns:
        df["trans_date_trans_time"] = parse_best(
            df["trans_date_trans_time"],
            [
                "%m/%d/%y %H:%M",
                "%m/%d/%y %H:%M:%S",
                "%m/%d/%Y %H:%M",
                "%m/%d/%Y %H:%M:%S",
                "%m/%d/%Y %I:%M:%S %p",
                "%m/%d/%Y %I:%M %p",
            ],
            "trans_date_trans_time",
        )

    if "dob" in df.columns:
        df["dob"] = parse_best(
            df["dob"],
            ["%m/%d/%y", "%m/%d/%Y", "%Y-%m-%d"],
            "dob",
        )

    # drop bad rows
    df = df.dropna(subset=["trans_date_trans_time", "dob"])
    if df.empty:
        raise ValueError("All rows dropped after timestamp parsing.")

    # 2. Derived features --------------------------------------------------
    df["age"] = (df["trans_date_trans_time"] - df["dob"]).dt.days // 365
    df["txn_hour"] = df["trans_date_trans_time"].dt.hour
    df["txn_dow"] = df["trans_date_trans_time"].dt.dayofweek
    df["txn_month"] = df["trans_date_trans_time"].dt.month

    df = df.drop(columns=["trans_date_trans_time", "dob"])
    if "merchant" in df.columns:
        if te is None: 
            if not training:
                raise ValueError("te must be provided for non-training mode if 'merchant' exists.")
    
            te = TargetEncoder(cols=["merchant"]).fit(
                df[["merchant"]], 
                df["is_fraud"] if training else df["is_fraud"]
            )
    
        df["merchant_te"] = te.transform(df[["merchant"]])['merchant']
        df = df.drop(columns=["merchant"])
    target_col = "is_fraud"
    if 'txn_hour' in df.columns and 'category' in df.columns:
        txn_hour_scaled = (df['txn_hour'] - df['txn_hour'].mean()) / df['txn_hour'].std()  # 标准化
    for i, col in enumerate(cat_cols_onehot):
        df[f'txn_hour_x_{col}'] = txn_hour_scaled * cat_onehot[:, i]
            
            
    if all(c in df.columns for c in ['amt', 'merch_lat', 'merch_long', 'lat', 'long']):
        df['amt_log'] = np.log1p(df['amt'])  # amt 对数，基准常用
        df['distance'] = np.sqrt((df['merch_lat'] - df['lat'])**2 + (df['merch_long'] - df['long'])**2)  # 交易距离
        df = df.drop(columns=['amt', 'lat', 'long', 'merch_lat', 'merch_long'])
        
    if 'category' in df.columns and 'amt_log' in df.columns:
        cat_encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        cat_onehot = cat_encoder.fit_transform(df[['category']]) if training else cat_encoder.transform(df[['category']])
        cat_cols_onehot = cat_encoder.get_feature_names_out(['category'])
        for i, col in enumerate(cat_cols_onehot):
            df[f'amt_x_{col}'] = df['amt_log'] * cat_onehot[:, i]
    y = None
    if training:
        if target_col not in df.columns:
            raise ValueError("Target column 'is_fraud' missing.")
        y = df[target_col].astype(int)
        df = df.drop(columns=[target_col])

    # 3. Preprocessor (fit or use existing) --------------------------------
    if preprocessor is None:
        # We must fit a new one (training=True path)
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        numeric_tf = Pipeline(
            steps=[("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]
        )
        categorical_tf = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OneHotEncoder(handle_unknown="ignore")),  # sparse_output=True by default
            ]
        )
        preprocessor = ColumnTransformer(
            transformers=[("num", numeric_tf, num_cols), ("cat", categorical_tf, cat_cols)]
        )
        X_proc = preprocessor.fit_transform(df)
    else:
        expected_cols = []
        for _, _, cols in preprocessor.transformers_:
            if cols in (None, "remainder"):
                continue
            expected_cols.extend(cols)

        missing = [c for c in expected_cols if c not in df.columns]
        if missing:
            print(f"⚠️  Adding missing columns in test set: {missing}")
            for col in missing:
                df[col] = np.nan
        # Use the provided, already‑fitted transformer
        X_proc = preprocessor.transform(df)

    # 4. Train / test split only when training=True -----------------------
    if training:
     output = (X_proc, y, None)
    else:
     output = (X_proc, None, None)

    if return_preprocessor:
     output = (*output, preprocessor)
    if return_te:
     output = (*output, te)
    
    return output

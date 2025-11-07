from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import joblib
import numpy as np
import os
import pandas as pd
import uuid
import io
import base64
from bson.binary import Binary, UUID_SUBTYPE
from dotenv import load_dotenv, find_dotenv
from ensemble import EnsembleClassifier
from bson.objectid import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Header, Path as ParamPath, Query
from fastapi.middleware.cors import CORSMiddleware
from features2 import build_features
from jose import jwt
from joblib import load as joblib_load
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pydantic import BaseModel, Field
from sklearn.pipeline import Pipeline
from fastapi.responses import StreamingResponse



_orig_isnan = np.isnan

def _safe_isnan(x):
    try:
        return _orig_isnan(x)
    except TypeError:
        return np.zeros(np.shape(x), dtype=bool)

np.isnan = _safe_isnan

MODEL_PATH = Path(__file__).parent / "model/global_rf.joblib"

ART_PATH = Path(__file__).parent / "model" / "global_rf.joblib"
initial_art_path = Path(__file__).parent / "model" / "fraud_rf.joblib"
initial_art = joblib.load(initial_art_path)
_art = joblib_load(ART_PATH)

raw_pipe = _art["pipeline"]
enc = _art["target_encoder"]
merchant_rate = _art["merchant_rate"]
state_rate = _art["state_rate"]
global_rate = _art["global_rate"]
feature_preproc = joblib.load(Path(__file__).parent / "model" / "feature_preprocessor.joblib")
cat_ohe = joblib.load(Path(__file__).parent / "model" / "cat_encoder.joblib")

fitted_prep = initial_art["prep"]

if "target_encoder" in raw_pipe.named_steps:
    steps_wo_te = [(n, s) for n, s in raw_pipe.steps if n != "target_encoder"]
    fraud_model = Pipeline(steps_wo_te)
else:
    fraud_model = raw_pipe

FRAUD_IDX = list(fraud_model.named_steps["clf"].classes_).index(1)
THRESHOLD = float(os.getenv("FRAUD_THRESH", "0.31"))

load_dotenv(find_dotenv())
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "cc-fraud-web")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]
STAFF_COLL = db["staff_user"]
NEW_TRANS_COLL = db["new_transaction"]
ALL_TRANS_COLL = db["all_transaction"]
FRAUD_TRANS_COLL = db["fraud_transaction"]
CASE_COLL = db["cases"]
COUNTERS_COLL = db["counters"]
app = FastAPI(title="Credit-Card Fraud API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.1.13:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/setup-database", tags=["Database Setup"])
async def setup_database():

    collections_to_create = [
        "all_transaction",
        "cases",
        "counters",
        "fraud_transaction",
        "new_transaction",
        "staff_user"
    ]
    
    try:
       
        existing_collections = await db.list_collection_names()
        
        created_list = []
        existing_list = []
        
        print(f"--- 1. Checking '{DB_NAME}' collections ---")

        for coll_name in collections_to_create:
            if coll_name not in existing_collections:
                await db.create_collection(coll_name)
                print(f"Created collection: {coll_name}")
                created_list.append(coll_name)
            else:
                print(f"Collection '{coll_name}' already exists.")
                existing_list.append(coll_name)
        print("--- 2. Seeding initial data ---")
        seed_results = []
        
        staff_doc = {
            "_id": ObjectId("68d1974c1e6998b25c922bae"),
            "email": "admin@gmail.com",
            "password": "admin123", 
            "user_name": "admin",
            "role": "admin",
            "id": 1
        }
        if await STAFF_COLL.find_one({"id": 1}) is None:
            await STAFF_COLL.insert_one(staff_doc)
            seed_results.append("Created initial staff_user (id: 1)")
        else:
            seed_results.append("staff_user (id: 1) already exists")
        all_trans_doc = {
            "_id": ObjectId("688a4a8488fcb6e12f1e3a3c"),
            "trans_num": Binary(base64.b64decode("VQ6EAOKbQdSnFkRmVUQAAA=="), UUID_SUBTYPE),
            "cc_num": 5454545454545454,
            "amt": 200,
            "merchant": "AMAZON",
            "category": "shopping_net",
            "trans_date_trans_time": datetime(2025, 7, 10, 14, 30, 0),
            "first": "John",
            "last": "Doe",
            "gender": "M",
            "street": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "zip": 94105,
            "lat": 37.789,
            "long": -122.401,
            "city_pop": 884363,
            "job": "Engineer",
            "dob": "1990-07-01",
            "unix_time": 1752138600,
            "merch_lat": 37.7895,
            "merch_long": -122.4007,
            "is_fraud": 0,
            "fraud_score": 0.92,
            "record_id": 1
        }
        if await ALL_TRANS_COLL.find_one({"record_id": 1}) is None:
            await ALL_TRANS_COLL.insert_one(all_trans_doc)
            seed_results.append("Created initial all_transaction (record_id: 1)")
        else:
            seed_results.append("all_transaction (record_id: 1) already exists")

        new_trans_doc = {
            "_id": ObjectId("688a4a8488fcb6e12f1e3a3e"),
            "trans_num": Binary(base64.b64decode("VQ6EAOKbQdSnFkRmVUQAAA=="), UUID_SUBTYPE),
            "cc_num": 5454545454545454,
            "amt": 200,
            "merchant": "AMAZON",
            "category": "shopping_net",
            "trans_date_trans_time": datetime(2025, 7, 10, 14, 30, 0),
            "first": "John",
            "last": "Doe",
            "gender": "M",
            "street": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "zip": 94105,
            "lat": 37.789,
            "long": -122.401,
            "city_pop": 884363,
            "job": "Engineer",
            "dob": "1990-07-01",
            "unix_time": 1752138600,
            "merch_lat": 37.7895,
            "merch_long": -122.4007,
            "is_fraud": 0,
            "fraud_score": 0.92,
            "record_id": 1
        }
        if await NEW_TRANS_COLL.find_one({"record_id": 1}) is None:
            await NEW_TRANS_COLL.insert_one(new_trans_doc)
            seed_results.append("Created initial new_transaction (record_id: 1)")
        else:
            seed_results.append("new_transaction (record_id: 1) already exists")

        # --- Initial fraud_transaction (check by record_id: 9) ---
        fraud_trans_doc = {
            "_id": ObjectId("688b3b51b551362e4bca14bd"),
            "trans_num": "50e840-e29b-41d4-a716-446655440000",
            "cc_num": 5454545454545454,
            "amt": 200,
            "merchant": "AMAZON",
            "category": "shopping_net",
            "trans_date_trans_time": datetime(2025, 7, 10, 14, 30, 0),
            "first": "John",
            "last": "Doe",
            "gender": "M",
            "street": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "zip": 94105,
            "lat": 37.789,
            "long": -122.401,
            "city_pop": 884363,
            "job": "Engineer",
            "dob": "1990-07-01",
            "unix_time": 1752138600,
            "merch_lat": 37.7895,
            "merch_long": -122.4007,
            "is_fraud": 1,
            "fraud_score": 0.92,
            "record_id": 9
        }
        if await FRAUD_TRANS_COLL.find_one({"record_id": 9}) is None:
            await FRAUD_TRANS_COLL.insert_one(fraud_trans_doc)
            seed_results.append("Created initial fraud_transaction (record_id: 9)")
        else:
            seed_results.append("fraud_transaction (record_id: 9) already exists")

        # --- Initial cases (check by case_id: 1) ---
        case_doc = {
            "_id": ObjectId("688a4a8488fcb6e12f1e3a3f"),
            "trans_num": Binary(base64.b64decode("VQ6EAOKbQdSnFkRmVUQAAA=="), UUID_SUBTYPE),
            "cc_num": 5454545454545454,
            "amt": 200,
            "merchant": "AMAZON",
            "category": "shopping_net",
            "trans_date_trans_time": datetime(2025, 7, 10, 14, 30, 0),
            "first": "John",
            "last": "Doe",
            "gender": "M",
            "street": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "zip": 94105,
            "lat": 37.789,
            "long": -122.401,
            "city_pop": 884363,
            "job": "Engineer",
            "dob": "1990-07-01",
            "unix_time": 1752138600,
            "merch_lat": 37.7895,
            "merch_long": -122.4007,
            "is_fraud": 0,
            "fraud_score": 0.92,
            "txn_ids": ["550e8400-e29b-41d4-a716-446655440000"],
            "case_id": 1,
            "status": "closed",
            "created_at": datetime(2025, 7, 30, 16, 38, 28, 282000, tzinfo=timezone.utc)
        }
        if await CASE_COLL.find_one({"case_id": 1}) is None:
            await CASE_COLL.insert_one(case_doc)
            seed_results.append("Created initial case (case_id: 1)")
        else:
            seed_results.append("case (case_id: 1) already exists")
        return {
            "message": "Database setup check completed!",
            "database": DB_NAME,
            "collections_created": created_list,
            "collections_already_exist": existing_list,
            "seeding_results": seed_results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
def create_token(uid: str) -> str:
    payload = {"uid": uid, "exp": datetime.now(timezone.utc) + timedelta(minutes=60)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def _uuid_binary(txn_id: str):
    try:
        return Binary(uuid.UUID(txn_id).bytes, UUID_SUBTYPE)
    except Exception:
        return None

async def current_user(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])["uid"]
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

async def next_seq(name: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc["seq"]


class TxnIn(BaseModel):
    trans_date_trans_time: str
    cc_num: int
    merchant: str
    category: str
    amt: float
    first: str
    last: str
    gender: str
    street: str
    city: str
    state: str
    zip: int
    lat: float
    long: float
    city_pop: int
    job: str
    dob: str
    unix_time: int
    merch_lat: float
    merch_long: float

class StaffUserBase(BaseModel):
    email: str
    password: str
    user_name: str
    role: str

class CaseListOut(BaseModel):
    items: List[Case]
    total: int

class StaffListOut(BaseModel):
    items: List[StaffUserOut]
    total: int
    
class TxnListOut(BaseModel):
    items: List[TxnFull]
    total: int
    
class StaffUserCreate(StaffUserBase):
    pass

class StaffUserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    user_name: Optional[str] = None

class StaffUserOut(BaseModel):
    id: int
    email: str
    user_name: str
    role: str

STAFF_COLL = db.staff_user

class DetectOut(BaseModel):
    is_fraud: int
    score: Optional[float] = None

class TxnFull(BaseModel):
    id: Optional[int] = None
    txn_id: str = Field(alias="trans_num")
    card_id: int = Field(alias="cc_num")
    amount: float = Field(alias="amt")
    merchant: str
    category: str
    trans_time: str = Field(alias="trans_date_trans_time")
    first: str
    last: str
    gender: str
    street: str
    city: str
    state: str
    zip: int
    lat: float
    long: float
    city_pop: int
    job: str
    dob: str
    unix_time: int
    merch_lat: float
    merch_long: float
    is_fraud: int = 0
    fraud_score: Optional[float] = None

    class Config:
        populate_by_name = True
        extra = "ignore"

class StaffUserIn(BaseModel):
    email: str
    password: str

class Case(BaseModel):
    case_id: Optional[int] = None
    txn_ids: List[str]
    status: Literal["open", "investigating", "closed"] = "open"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    trans_num: Optional[str] = None
    trans_date_trans_time: str
    cc_num: int
    merchant: str
    category: str
    amt: float
    first: str
    last: str
    gender: str
    street: str
    city: str
    state: str
    zip: int
    lat: float
    long: float
    city_pop: int
    job: str
    dob: str
    unix_time: int
    merch_lat: float
    merch_long: float
    is_fraud: Literal[0, 1]
    fraud_score: Optional[float] = None

    class Config:
        extra = "ignore"

class AuthOut(BaseModel):
    token: str
    user_name: str
    role: str

COLL_MAP = {
    "all": db.all_transaction,
    "new": db.new_transaction,
    "fraud": db.fraud_transaction,
}

# --- API ENDPOINTS ---

@app.post("/auth/login", response_model=AuthOut)
async def login(body: StaffUserIn):
    # This endpoint remains unprotected
    user = await db.staff_user.find_one({
        "email": body.email,
        "password": body.password,
    })
    if not user:
        raise HTTPException(status_code=401, detail="Bad credentials")

    token = create_token(str(user["_id"]))
    return {
        "token": token,
        "user_name": user["user_name"],
        "role": user["role"]
    }

@app.post("/detect", response_model=DetectOut)
async def detect(txn: TxnIn, uid=Depends(current_user)):
   
    df_raw = pd.DataFrame([txn.model_dump()])
    df_raw["is_fraud"] = 0
    X_proc, _, _ = build_features(
        df_raw,
        training=False,
        preprocessor=feature_preproc,
        te=enc,
        cat_encoder=cat_ohe,
    )
    df_proc = pd.DataFrame(X_proc, columns=feature_preproc.get_feature_names_out())
    df_proc["state"] = df_raw["state"].values
    df_proc["state_risk"] = df_proc["state"].map(state_rate).fillna(global_rate)
    df_proc = df_proc.drop(columns=["state"])
    expected_cols = [col for _, _, cols in fitted_prep.transformers_ for col in cols]
    missing = [c for c in expected_cols if c not in df_proc.columns]
    extra = [c for c in df_proc.columns if c not in expected_cols]
    if missing:
        for col in missing:
            df_proc[col] = np.nan
    if extra:
        df_proc = df_proc.drop(columns=extra)
    df_proc = df_proc[expected_cols]
    proba = fraud_model.predict_proba(df_proc)[0, FRAUD_IDX]
    y_pred = int(proba >= 0.64)
    doc = txn.model_dump()
    doc.update(
        id=await next_seq("transactions"),
        trans_num=Binary(uuid.uuid4().bytes, UUID_SUBTYPE),
        is_fraud=y_pred,
        fraud_score=proba,
        user_id=uid,
    )
    return {"is_fraud": y_pred, "score": proba}


@app.post("/cases", response_model=Case)
async def create_case(body: Case, uid=Depends(current_user)): 
    doc = body.model_dump(exclude={"case_id", "status", "created_at"})
    doc["case_id"] = await next_seq("cases")
    doc["status"] = "open"
    doc["created_at"] = datetime.now(timezone.utc)
    await db.cases.insert_one(doc)
    return Case(**doc)

@app.get("/cases/timeseries", response_model=list[dict])
async def cases_timeseries(
    granularity: str = Query("month", enum=["day", "month", "year"]),
    uid=Depends(current_user) 
):
    cursor = db.cases.find({}, {"trans_date_trans_time": 1, "is_fraud": 1})
    counts = defaultdict(lambda: {"fraud_count": 0, "non_fraud_count": 0})
    async for doc in cursor:
        dt_str = doc.get("trans_date_trans_time")
        if not dt_str:
            continue
        try:
            dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                dt = datetime.fromisoformat(dt_str)
            except Exception:
                continue
        if granularity == "day":
            key = dt.strftime("%Y-%m-%d")
        elif granularity == "month":
            key = dt.strftime("%Y-%m")
        elif granularity == "year":
            key = dt.strftime("%Y")
        else:
            continue
        if doc.get("is_fraud", 0) == 1:
            counts[key]["fraud_count"] += 1
        else:
            counts[key]["non_fraud_count"] += 1
    result = [
        {"period": k, **v}
        for k, v in sorted(counts.items())
    ]
    return result

@app.get("/cases", response_model=CaseListOut)
async def list_cases(
    txn_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    uid=Depends(current_user)
):
    q: dict = {}
    if txn_id:
        q["txn_ids"] = txn_id
    
    if status:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        if status == "open":
            q["status"] = "open"
            q["created_at"] = {"$gte": today_start}
        elif status == "investigating":
            q["$or"] = [
                {"status": "investigating"},
                {"status": "open", "created_at": {"$lt": today_start}}
            ]
        else:
    
            q["status"] = status

    total_count = await db.cases.count_documents(q)
    cursor = db.cases.find(q).sort("created_at", -1).skip(offset).limit(limit)
    out: list[Case] = []
    
    async for doc in cursor:
        doc.pop("_id", None)
        if isinstance(doc.get("trans_num"), Binary):
            doc["trans_num"] = uuid.UUID(bytes=doc["trans_num"]).hex
        
        out.append(Case(**doc))
        
    return {"items": out, "total": total_count}

@app.post("/cases/rollback/{txn_id}/", response_model=dict)
async def rollback_case_and_transaction(
    txn_id: str, 
    status: Literal["open", "investigating", "closed"],
    uid=Depends(current_user) 
):
    bin_id = _uuid_binary(txn_id)
    for bucket in ("all", "new"):
        await COLL_MAP[bucket].update_many(
            {"trans_num": {"$in": [txn_id, bin_id] if bin_id else [txn_id]}},
            {"$set": {"is_fraud": 0}}
        )
    await COLL_MAP["fraud"].delete_many(
        {"trans_num": {"$in": [txn_id, bin_id] if bin_id else [txn_id]}}
    )
    res = await db.cases.update_many(
        {"txn_ids": txn_id},
        {"$set": {"status": status, "is_fraud": 0}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, f"No case found for txn {txn_id}")
    return {"ok": 1}

@app.patch("/cases/by-txn/{txn_id}", response_model=dict)
async def set_case_status_by_txn(
    txn_id: str,
    status: Literal["open", "investigating", "closed"],
    uid=Depends(current_user) 
):
    res = await db.cases.update_many(
        {"txn_ids": txn_id},
        {"$set": {"status": status}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, f"No case contains txn {txn_id}")
    return {"ok": 1}

@app.post("/transactions/{bucket}", response_model=dict)
async def add_txn(
    bucket: Literal["all", "new", "fraud"], 
    txn: TxnFull, 
    uid=Depends(current_user)
):
    raw = txn.model_dump(by_alias=True, exclude={"id"})
    trans_num_str = raw["trans_num"]
    try:
        raw["trans_num"] = Binary(uuid.UUID(trans_num_str).bytes, UUID_SUBTYPE)
    except Exception:
        pass
    target_buckets = {"all", "new"}
    if txn.is_fraud == 1:
        target_buckets.add("fraud")
    for b in target_buckets:
        await insert_with_seq(f"{b}_transaction", raw)
    if txn.is_fraud == 1:
        case_doc = {
            **raw,
            "txn_ids": [trans_num_str],
            "case_id": await next_seq("cases"),
            "status": "open",
            "created_at": datetime.now(timezone.utc),
        }
        await db.cases.insert_one(case_doc)
    return {"ok": 1}

@app.get("/transactions/{bucket}", response_model=TxnListOut)
async def list_txn(
    bucket: Literal["all", "new", "fraud"],
    limit: int = 50,
    offset: int = 0, 
    uid=Depends(current_user) 
):
    cursor = COLL_MAP[bucket].find().sort("trans_time", -1).skip(offset).limit(limit)
    docs: List[TxnFull] = []
    async for doc in cursor:
        doc.pop("_id", None)
        if isinstance(doc.get("trans_num"), Binary):
            doc["trans_num"] = uuid.UUID(bytes=doc["trans_num"]).hex
        docs.append(TxnFull(**doc))
    total_count = await COLL_MAP[bucket].count_documents({})
    return {"items": docs, "total": total_count}

@app.get("/transactions/export/{category}")
async def export_transactions(category: str, limit: int = 1000, uid=Depends(current_user)): # EDITED: Added protection
    if category not in COLL_MAP:
        raise HTTPException(status_code=400, detail="Invalid category")
    # ... (rest of the function remains the same)
    cursor = COLL_MAP[category].find().limit(limit)
    transactions = []
    async for doc in cursor:
        doc.pop("_id", None)
        if isinstance(doc.get("trans_num"), Binary):
            doc["trans_num"] = uuid.UUID(bytes=doc["trans_num"]).hex
        transactions.append(doc)
    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found")
    df = pd.DataFrame(transactions)
    csv_data = df.to_csv(index=False)
    buffer = io.StringIO(csv_data)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={category}_transactions.csv"})

@app.get("/fraud/successRate", response_model=dict)
async def get_fraud_success_rate(uid=Depends(current_user)): 
    fraud_count = await db.cases.count_documents({"is_fraud": 1})
    non_fraud_count = await db.cases.count_documents({"is_fraud": 0})
    total_cases = fraud_count + non_fraud_count
    if total_cases == 0:
        return {"success_rate": 0.0, "total_cases": 0}
    fraud_percentage = (fraud_count / total_cases) * 100
    non_fraud_percentage = (non_fraud_count / total_cases) * 100
    return {
        "fraud_percentage": fraud_percentage,
        "non_fraud_percentage": non_fraud_percentage,
        "total_cases": total_cases,
        "fraud_count": fraud_count,
        "non_fraud_count": non_fraud_count,
    }


@app.get("/transactions/fraud/analysis", response_model=List[TxnFull])
async def get_fraud_analysis(
    merchant: Optional[str] = Query(None, description="Filter by merchant name"),
    category: Optional[str] = Query(None, description="Filter by transaction category"),
    state: Optional[str] = Query(None, description="Filter by state"),
    min_amount: Optional[float] = Query(None, description="Minimum transaction amount"),
    max_amount: Optional[float] = Query(None, description="Maximum transaction amount"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(1000, description="Maximum number of records to return"),
    uid=Depends(current_user) 
):
    query_filter = {}
    if merchant:
        query_filter["merchant"] = {"$regex": merchant, "$options": "i"}
    if category:
        query_filter["category"] = {"$regex": category, "$options": "i"}
    if state:
        query_filter["state"] = {"$regex": state, "$options": "i"}
    if min_amount is not None:
        query_filter["amt"] = {"$gte": min_amount}
    if max_amount is not None:
        if "amt" in query_filter:
            query_filter["amt"]["$lte"] = max_amount
        else:
            query_filter["amt"] = {"$lte": max_amount}
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query_filter["trans_date_trans_time"] = {"$gte": start_dt.strftime("%Y-%m-%d %H:%M:%S")}
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            if "trans_date_trans_time" in query_filter:
                query_filter["trans_date_trans_time"]["$lte"] = end_dt.strftime("%Y-%m-%d %H:%M:%S")
            else:
                query_filter["trans_date_trans_time"] = {"$lte": end_dt.strftime("%Y-%m-%d %H:%M:%S")}
        except ValueError:
            pass
    cursor = db.fraud_transaction.find(query_filter).sort("trans_date_trans_time", -1).limit(limit)
    docs: List[TxnFull] = []
    async for doc in cursor:
        doc.pop("_id", None)
        if isinstance(doc.get("trans_num"), Binary):
            doc["trans_num"] = uuid.UUID(bytes=doc["trans_num"]).hex
        docs.append(TxnFull(**doc))
    return docs

async def next_seq(coll_name: str) -> int:
    res = await db.counters.find_one_and_update(
        {"_id": coll_name}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return int(res["seq"])

async def insert_with_seq(coll_name: str, doc: dict):
    row = deepcopy(doc)
    row["record_id"] = await next_seq(coll_name)
    await db[coll_name].insert_one(row)

@app.get("/staff", response_model=StaffListOut) 
async def list_staff(
    offset: int = 0,
    limit: int = 20,
    uid=Depends(current_user) 
):
    total_count = await STAFF_COLL.count_documents({})
    cursor = STAFF_COLL.find({}, {"_id": 0, "password": 0})
    docs = await cursor.skip(offset).limit(limit).to_list(length=limit)
    items = [StaffUserOut(**doc) for doc in docs]
    return {"items": items, "total": total_count}

@app.get("/staff/{staff_id}", response_model=StaffUserOut)
async def get_staff(
    staff_id: int,
    uid=Depends(current_user)
):

    doc = await STAFF_COLL.find_one({"id": staff_id}, {"_id": 0, "password": 0})
    if not doc:
        raise HTTPException(404, f"Staff user {staff_id} not found")
    return StaffUserOut(**doc)

@app.post("/staff", response_model=StaffUserOut)
async def create_staff(body: StaffUserCreate, uid=Depends(current_user)): 
    doc = body.model_dump()
 
    doc["id"] = await next_seq("staff_user")
    await STAFF_COLL.insert_one(doc)
    return StaffUserOut(**doc)

@app.patch("/staff/{staff_id}", response_model=StaffUserOut)
async def edit_staff(
    staff_id: int,
    body: StaffUserUpdate,
    uid=Depends(current_user) # EDITED: Added protection
):
    update_dict = {k: v for k, v in body.model_dump().items() if v is not None}

    if not update_dict:
        raise HTTPException(400, "No fields provided for update")
    res = await STAFF_COLL.find_one_and_update(
        {"id": staff_id},
        {"$set": update_dict},
        return_document=ReturnDocument.AFTER,
    )
    if not res:
        raise HTTPException(404, f"Staff user {staff_id} not found")
    return StaffUserOut(**res)

@app.delete("/staff/{staff_id}", response_model=dict)
async def delete_staff(staff_id: int, uid=Depends(current_user)):
    result = await STAFF_COLL.delete_one({"id": staff_id})
    if staff_id == 0:
        raise HTTPException(400, "User cannot be deleted")
    if result.deleted_count == 0:
        raise HTTPException(404, f"Staff user {staff_id} not found")
    return {"ok": 1}


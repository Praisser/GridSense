from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import pandas as pd

from .models import Reading, Alert
from .data_loader import data_loader

app = FastAPI(title="GridSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    data_loader.load_data()

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/feeder/{feeder_id}/readings", response_model=List[Reading])
def get_feeder_readings(feeder_id: str, start: Optional[str] = None, end: Optional[str] = None):
    if data_loader.feeder_df is None or data_loader.feeder_df.empty:
        raise HTTPException(status_code=404, detail="No data available")
        
    df = data_loader.feeder_df
    
    if feeder_id not in df['feeder_id'].unique() and feeder_id != "F001":
        raise HTTPException(status_code=404, detail="Feeder not found")
        
    df_filtered = df[df['feeder_id'] == feeder_id].copy()
    
    if start or end:
        df_filtered['ts_dt'] = pd.to_datetime(df_filtered['timestamp'])
        if start:
            try:
                start_dt = pd.to_datetime(start)
                df_filtered = df_filtered[df_filtered['ts_dt'] >= start_dt]
            except Exception:
                raise HTTPException(status_code=422, detail="Invalid start date format")
        if end:
            try:
                end_dt = pd.to_datetime(end)
                df_filtered = df_filtered[df_filtered['ts_dt'] < end_dt]
            except Exception:
                raise HTTPException(status_code=422, detail="Invalid end date format")
        df_filtered = df_filtered.drop(columns=['ts_dt'])

    return df_filtered.to_dict(orient="records")

@app.get("/api/alerts", response_model=List[Alert])
def get_alerts():
    return []

from pydantic import BaseModel
from typing import Optional, List

class Reading(BaseModel):
    timestamp: str
    meter_id: Optional[str] = None
    feeder_id: Optional[str] = None
    kwh: float
    lat: Optional[float] = None
    lng: Optional[float] = None

class Alert(BaseModel):
    id: str
    timestamp: str
    type: str
    severity: str
    description: str

class Meter(BaseModel):
    meter_id: str
    lat: float
    lng: float

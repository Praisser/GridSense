from pydantic import BaseModel, Field
from typing import Literal, Optional


class Reading(BaseModel):
    timestamp: str
    meter_id: Optional[str] = None
    feeder_id: Optional[str] = None
    kwh: float
    lat: Optional[float] = None
    lng: Optional[float] = None


class Alert(BaseModel):
    meter_id: str
    lat: float
    lng: float
    loss_type: str
    confidence: float
    reasoning: str
    last_anomaly_at: str
    total_kwh_lost: float
    composite_score: float
    status: str = "open"


class Meter(BaseModel):
    meter_id: str
    lat: float
    lng: float


class SimulationRequest(BaseModel):
    meter_id: str
    type: Literal["bypass", "tampering", "faulty"]
    intensity: float = Field(ge=0.3, le=0.9)

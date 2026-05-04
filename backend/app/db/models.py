from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import UserDefinedType


class Base(DeclarativeBase):
    pass


class Geography(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **_kw: Any) -> str:
        return "GEOGRAPHY(POINT, 4326)"


class MeterReadingModel(Base):
    __tablename__ = "meter_readings"

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    meter_id: Mapped[str] = mapped_column(String, primary_key=True)
    feeder_id: Mapped[str] = mapped_column(String, index=True)
    kwh: Mapped[float] = mapped_column(Float)
    quality_flag: Mapped[int] = mapped_column(SmallInteger, default=0)


class FeederReadingModel(Base):
    __tablename__ = "feeder_readings"

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    feeder_id: Mapped[str] = mapped_column(String, primary_key=True)
    kwh: Mapped[float] = mapped_column(Float)


class MeterModel(Base):
    __tablename__ = "meters"

    meter_id: Mapped[str] = mapped_column(String, primary_key=True)
    feeder_id: Mapped[str] = mapped_column(String, ForeignKey("feeders.feeder_id"))
    location: Mapped[Any | None] = mapped_column(Geography(), nullable=True)
    installed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class FeederModel(Base):
    __tablename__ = "feeders"

    feeder_id: Mapped[str] = mapped_column(String, primary_key=True)
    substation_location: Mapped[Any | None] = mapped_column(Geography(), nullable=True)
    capacity_kwh: Mapped[float | None] = mapped_column(Float)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)


class AlertModel(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    meter_id: Mapped[str | None] = mapped_column(String, ForeignKey("meters.meter_id"))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    loss_type: Mapped[str | None] = mapped_column(String)
    confidence: Mapped[float | None] = mapped_column(Float)
    composite_score: Mapped[float | None] = mapped_column(Float)
    iso_score: Mapped[float | None] = mapped_column(Float)
    lstm_score: Mapped[float | None] = mapped_column(Float)
    gap_score: Mapped[float | None] = mapped_column(Float)
    reasoning: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="open")
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

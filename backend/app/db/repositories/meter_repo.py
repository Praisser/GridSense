from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FeederReadingModel, MeterModel, MeterReadingModel


async def get_meter(session: AsyncSession, meter_id: str) -> MeterModel | None:
    result = await session.execute(
        select(MeterModel).where(MeterModel.meter_id == meter_id)
    )
    return result.scalar_one_or_none()


def _bounded_readings_query(
    stmt: Select[tuple[MeterReadingModel]] | Select[tuple[FeederReadingModel]],
    model: type[MeterReadingModel] | type[FeederReadingModel],
    start: datetime | None,
    end: datetime | None,
):
    if start is not None:
        stmt = stmt.where(model.timestamp >= start)
    if end is not None:
        stmt = stmt.where(model.timestamp < end)
    return stmt.order_by(model.timestamp)


async def get_meter_readings(
    session: AsyncSession,
    meter_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[MeterReadingModel]:
    stmt = select(MeterReadingModel).where(MeterReadingModel.meter_id == meter_id)
    stmt = _bounded_readings_query(stmt, MeterReadingModel, start, end)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_feeder_readings(
    session: AsyncSession,
    feeder_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[FeederReadingModel]:
    stmt = select(FeederReadingModel).where(FeederReadingModel.feeder_id == feeder_id)
    stmt = _bounded_readings_query(stmt, FeederReadingModel, start, end)
    result = await session.execute(stmt)
    return list(result.scalars().all())

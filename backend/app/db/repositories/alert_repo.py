from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AlertModel


async def list_alerts(
    session: AsyncSession,
    limit: int = 50,
    status: str | None = None,
) -> list[AlertModel]:
    stmt = select(AlertModel).order_by(AlertModel.composite_score.desc().nullslast())
    if status is not None:
        stmt = stmt.where(AlertModel.status == status)
    stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_alert_for_meter(
    session: AsyncSession,
    meter_id: str,
) -> AlertModel | None:
    result = await session.execute(
        select(AlertModel)
        .where(AlertModel.meter_id == meter_id)
        .order_by(AlertModel.detected_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def update_alert_status(
    session: AsyncSession,
    alert_id: str,
    status: str,
) -> AlertModel | None:
    alert = await session.get(AlertModel, alert_id)
    if alert is None:
        return None
    alert.status = status
    await session.commit()
    await session.refresh(alert)
    return alert

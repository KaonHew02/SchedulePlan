"""Schedule item CRUD."""

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ScheduleItem
from ..schemas import ScheduleItemCreate, ScheduleItemOut, ScheduleItemUpdate

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


def _get_or_404(db: Session, item_id: int) -> ScheduleItem:
    item = db.get(ScheduleItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="That schedule item no longer exists.")
    return item


@router.get("", response_model=list[ScheduleItemOut])
def list_items(
    db: Session = Depends(get_db),
    start: dt.date | None = Query(None, description="First date to include (inclusive)."),
    end: dt.date | None = Query(None, description="Last date to include (inclusive)."),
) -> list[ScheduleItem]:
    """Items in a date range, ordered as they appear on the timeline.

    The day, week and month views all use this with a different range.
    """
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="The end date is before the start date.")

    stmt = select(ScheduleItem)
    if start:
        stmt = stmt.where(ScheduleItem.date >= start)
    if end:
        stmt = stmt.where(ScheduleItem.date <= end)
    stmt = stmt.order_by(ScheduleItem.date, ScheduleItem.start_time, ScheduleItem.id)
    return list(db.scalars(stmt))


@router.get("/{item_id}", response_model=ScheduleItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)) -> ScheduleItem:
    return _get_or_404(db, item_id)


@router.post("", response_model=ScheduleItemOut, status_code=201)
def create_item(payload: ScheduleItemCreate, db: Session = Depends(get_db)) -> ScheduleItem:
    item = ScheduleItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ScheduleItemOut)
def update_item(
    item_id: int, payload: ScheduleItemUpdate, db: Session = Depends(get_db)
) -> ScheduleItem:
    item = _get_or_404(db, item_id)
    changes = payload.model_dump(exclude_unset=True)

    start = changes.get("start_time", item.start_time)
    end = changes.get("end_time", item.end_time)
    if end is not None and end <= start:
        raise HTTPException(status_code=400, detail="End time must be after the start time.")

    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)) -> None:
    db.delete(_get_or_404(db, item_id))
    db.commit()

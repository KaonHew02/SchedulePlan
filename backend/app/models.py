"""SQLAlchemy models.

Phase 1 only defines ScheduleItem. Later phases add Expense, Attachment, etc.
"""

import datetime as dt

from sqlalchemy import Date, DateTime, Index, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

# Optional tags a schedule item can carry. Kept deliberately short.
TAGS = ("personal", "work", "travel", "food", "sports", "event", "other")


class ScheduleItem(Base):
    __tablename__ = "schedule_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    end_time: Mapped[dt.time | None] = mapped_column(Time, nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    tag: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


# Day / week / month views all query a date range ordered by time.
Index("ix_schedule_items_date_start", ScheduleItem.date, ScheduleItem.start_time)

"""Request / response shapes for the API."""

import datetime as dt

from pydantic import BaseModel, ConfigDict, field_serializer, field_validator, model_validator

from .models import TAGS


def _clean(value: str | None) -> str | None:
    """Trim a text field and treat blank input as 'not set'."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def _normalize_tag(value: str | None) -> str | None:
    value = _clean(value)
    if value is None:
        return None
    value = value.lower()
    if value not in TAGS:
        raise ValueError(f"'{value}' is not one of: {', '.join(TAGS)}.")
    return value


class ScheduleItemCreate(BaseModel):
    date: dt.date
    start_time: dt.time
    end_time: dt.time | None = None
    title: str
    location: str | None = None
    notes: str | None = None
    tag: str | None = None

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Please give this a title.")
        return value

    @field_validator("location", "notes")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("tag")
    @classmethod
    def known_tag(cls, value: str | None) -> str | None:
        return _normalize_tag(value)

    @model_validator(mode="after")
    def end_after_start(self) -> "ScheduleItemCreate":
        if self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("End time must be after the start time.")
        return self


class ScheduleItemUpdate(BaseModel):
    """Partial update. Only the fields actually sent are applied."""

    date: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    title: str | None = None
    location: str | None = None
    notes: str | None = None
    tag: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Please give this a title.")
        return value

    @field_validator("location", "notes")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("tag")
    @classmethod
    def known_tag(cls, value: str | None) -> str | None:
        return _normalize_tag(value)


class ScheduleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt.date
    start_time: dt.time
    end_time: dt.time | None
    title: str
    location: str | None
    notes: str | None
    tag: str | None

    @field_serializer("start_time", "end_time")
    def hhmm(self, value: dt.time | None) -> str | None:
        # The UI only ever deals in HH:MM.
        return value.strftime("%H:%M") if value else None

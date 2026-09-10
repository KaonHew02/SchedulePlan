"""SchedulePlan API — Phase 1 (Schedule)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .database import init_db
from .routers import schedule


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="SchedulePlan", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# The UI shows `message` verbatim, so keep every error human-readable.
@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"message": _readable(exc)})


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)})


def _readable(exc: RequestValidationError) -> str:
    first = exc.errors()[0]
    field = str(first["loc"][-1]).replace("_", " ") if first.get("loc") else "input"
    message = first.get("msg", "is not valid")
    message = message.removeprefix("Value error, ")
    if first["type"] in {"date_from_datetime_parsing", "date_parsing", "date_type"}:
        return f"'{field.capitalize()}' needs to be a real date."
    if first["type"] in {"time_parsing", "time_type"}:
        return f"'{field.capitalize()}' needs to be a time like 18:30."
    if first["type"] == "missing":
        return f"'{field.capitalize()}' is required."
    return message if message.endswith(".") else f"{field.capitalize()}: {message}."


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(schedule.router)

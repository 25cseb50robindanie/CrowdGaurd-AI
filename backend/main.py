"""
CrowdGuard AI — Person C Backend (FastAPI)

Serves the combined crowd-safety feed (density from Person A + risk
evaluation/warnings from Person B) to the frontend, and logs operator
actions (dispatches, verification reviews).

Run:
    uvicorn main:app --port 8000 --reload
"""

from datetime import datetime
from typing import List, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CrowdGuard AI Backend")

# Allow the React frontend (Vite dev server on port 5173) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class Zone(BaseModel):
    zone_id: str
    status: Literal["red", "amber", "green"]
    density: float
    message: str


class ZonesResponse(BaseModel):
    zones: List[Zone]


class DispatchInput(BaseModel):
    zone_id: str
    timestamp: str
    message: str


class Dispatch(DispatchInput):
    pass


class ReviewInput(BaseModel):
    is_accurate: bool
    notes: str


class Review(ReviewInput):
    pass


# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
# TODO(Person A): replace hardcoded density with live density calculations.
# TODO(Person B): replace hardcoded status/message with live risk evaluation.

_zones: List[Zone] = [
    Zone(zone_id="gate4", status="red", density=4.2, message="Avoid — expected unsafe in 8 min"),
    Zone(zone_id="courtyard", status="green", density=1.8, message="Safe"),
    Zone(zone_id="mainpath", status="amber", density=2.9, message="Caution — increasing density"),
]

_dispatches: List[Dispatch] = []
_reviews: List[Review] = []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/zones", response_model=ZonesResponse)
def get_zones() -> ZonesResponse:
    """Polled by the frontend every ~2 seconds for live crowd data."""
    return ZonesResponse(zones=_zones)


@app.post("/api/dispatch", response_model=Dispatch, status_code=201)
def create_dispatch(payload: DispatchInput) -> Dispatch:
    """Logs an operator's 'Dispatch Force' action."""
    dispatch = Dispatch(**payload.model_dump())
    _dispatches.append(dispatch)
    return dispatch


@app.post("/api/reviews", response_model=Review, status_code=201)
def create_review(payload: ReviewInput) -> Review:
    """Logs an operator's verification review submitted from the Reports page."""
    review = Review(**payload.model_dump())
    _reviews.append(review)
    return review


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.utcnow().isoformat()}
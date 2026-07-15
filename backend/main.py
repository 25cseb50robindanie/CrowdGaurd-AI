"""
CrowdGuard AI — Person C Backend (FastAPI)

Serves the combined crowd-safety feed (density from Person A + risk
evaluation/warnings from Person B) to the frontend, and logs operator
actions (dispatches, verification reviews).

Run:
    uvicorn main:app --port 8000 --reload
"""

import os
import json
import logging
import requests
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

app = FastAPI(title="CrowdGuard AI Backend")

# Allow the React frontends (ports 5173 and 5174) to call this API.
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
# In-memory state & helpers
# ---------------------------------------------------------------------------
_dispatches: List[Dispatch] = []
_reviews: List[Review] = []

# Path to Vikas's YOLO CV output file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CV_OUTPUT_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "cv-detection", "cv_output.json"))

def get_live_zones_data() -> List[Zone]:
    """
    Reads the raw coordinates from Person A's YOLO detector, sends them
    to Person B's agent service (port 8001) for safety analysis, and merges them.
    Falls back gracefully to rule-based statuses if the Agent service is offline.
    """
    # Baseline fallback zones structure matching the design specification
    fallback_zones = [
        Zone(zone_id="gate4", status="red", density=4.2, message="Avoid — expected unsafe in 8 min"),
        Zone(zone_id="courtyard", status="green", density=1.8, message="Safe"),
        Zone(zone_id="mainpath", status="amber", density=2.9, message="Caution — increasing density"),
        Zone(zone_id="pier1", status="green", density=1.2, message="Safe"),
        Zone(zone_id="seafoodmarket", status="amber", density=3.1, message="Caution — busy vendor area"),
        Zone(zone_id="fountaingrade", status="green", density=1.5, message="Safe"),
        Zone(zone_id="meadoweast", status="green", density=0.8, message="Safe")
    ]
    # Path to Vikas's YOLO CV output files (separate platforms)
    gate4_path = os.path.abspath(os.path.join(BASE_DIR, "..", "cv-detection", "cv_output_gate4.json"))
    courtyard_path = os.path.abspath(os.path.join(BASE_DIR, "..", "cv-detection", "cv_output_courtyard.json"))
    
    cv_zones = []

    # Try reading from Platform 1 (gate4) file
    if os.path.exists(gate4_path):
        try:
            with open(gate4_path, 'r') as f:
                data = json.load(f)
                zones = data.get("zones", [])
                gate4_zone = next((z for z in zones if z["zone_id"] == "gate4"), None)
                if gate4_zone:
                    cv_zones.append(gate4_zone)
        except Exception as e:
            logger.error(f"Error reading gate4 output: {e}")
            
    # Try reading from Platform 2 (courtyard) file
    if os.path.exists(courtyard_path):
        try:
            with open(courtyard_path, 'r') as f:
                data = json.load(f)
                zones = data.get("zones", [])
                courtyard_zone = next((z for z in zones if z["zone_id"] == "courtyard"), None)
                if courtyard_zone:
                    cv_zones.append(courtyard_zone)
        except Exception as e:
            logger.error(f"Error reading courtyard output: {e}")
            
    # Fallback to standard cv_output.json if separate files don't exist
    if not cv_zones and os.path.exists(CV_OUTPUT_PATH):
        try:
            with open(CV_OUTPUT_PATH, 'r') as f:
                data = json.load(f)
                cv_zones.extend(data.get("zones", []))
        except Exception as e:
            logger.error(f"Error reading cv_output: {e}")

    if not cv_zones:
        return fallback_zones

    try:
            
        # Attempt to fetch AI analysis from Person B's Agent server (port 8001)
        agent_url = "http://127.0.0.1:8001/analyze/zones"
        try:
            agent_payload = []
            for z in cv_zones:
                agent_payload.append({
                    "zone_id": z["zone_id"],
                    "person_count": z["person_count"],
                    "density": z["density"],
                    "trend": z["trend"]
                })
                
            response = requests.post(agent_url, json=agent_payload, timeout=2.0)
            if response.status_code == 200:
                analyzed_zones = response.json()
                
                merged_zones = []
                for analysis in analyzed_zones:
                    z_id = analysis["zone_id"]
                    risk = analysis["risk_level"]
                    pred = analysis["prediction"]
                    rec = analysis["recommendation"]
                    exp = analysis["explanation"]
                    
                    # Map risk level to frontend status (red/amber/green)
                    status = "green"
                    if risk == "high":
                        status = "red"
                    elif risk == "medium":
                        status = "amber"
                        
                    # Find matching density from CV data
                    density_val = next((z["density"] for z in cv_zones if z["zone_id"] == z_id), 0.0)
                    
                    # Combine explanation & recommendation into the message shown on maps
                    message_str = f"{exp} Recommendation: {rec}"
                    
                    merged_zones.append(Zone(
                        zone_id=z_id,
                        status=status,
                        density=density_val,
                        message=message_str
                    ))
                
                # Fill in any baseline zones that are missing from the current active camera frame
                active_ids = [mz.zone_id for mz in merged_zones]
                for fz in fallback_zones:
                    if fz.zone_id not in active_ids:
                        merged_zones.append(fz)
                        
                return merged_zones
                
            else:
                logger.warning(f"Agent server returned status {response.status_code}. Using local rules fallback.")
        except Exception as agent_err:
            logger.warning(f"Agent server connection failed: {agent_err}. Using local rules fallback.")
            
        # Local Rule-based Fallback (if Agent service is offline)
        merged_zones = []
        for z in cv_zones:
            status = "green"
            message = "Safe"
            
            if z["density"] >= 3.5:
                status = "red"
                message = "Avoid — density threshold exceeded"
            elif z["density"] >= 2.2:
                status = "amber"
                message = "Caution — increasing density"
                
            if z["zone_id"] == "gate4" and status == "red":
                message = "Avoid — expected unsafe in 8 min"
            elif z["zone_id"] == "seafoodmarket" and status == "amber":
                message = "Caution — busy vendor area"
                
            merged_zones.append(Zone(
                zone_id=z["zone_id"],
                status=status,
                density=z["density"],
                message=message
            ))
            
        # Fill in missing baseline zones
        active_ids = [mz.zone_id for mz in merged_zones]
        for fz in fallback_zones:
            if fz.zone_id not in active_ids:
                merged_zones.append(fz)
                
        return merged_zones
        
    except Exception as e:
        logger.error(f"Error parsing CV output: {e}. Serving default mock zones.")
        return fallback_zones


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/zones", response_model=ZonesResponse)
def get_zones() -> ZonesResponse:
    """Polled by the frontend every ~2 seconds for live crowd data."""
    return ZonesResponse(zones=get_live_zones_data())


@app.post("/api/dispatch", response_model=Dispatch, status_code=201)
def create_dispatch(payload: DispatchInput) -> Dispatch:
    """Logs an operator's 'Dispatch Force' action."""
    dispatch = Dispatch(**payload.model_dump())
    _dispatches.append(dispatch)
    logger.info(f"Operator dispatch logged: {dispatch}")
    return dispatch


@app.post("/api/reviews", response_model=Review, status_code=201)
def create_review(payload: ReviewInput) -> Review:
    """Logs an operator's verification review submitted from the Reports page."""
    review = Review(**payload.model_dump())
    _reviews.append(review)
    logger.info(f"Operator report review logged: {review}")
    return review


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.utcnow().isoformat()}
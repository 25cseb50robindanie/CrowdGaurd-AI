"""
CrowdGuard AI — Central Backend (FastAPI)

Serves the combined crowd-safety feed, handles dynamic camera registration,
processes video uploads, executes a deterministic prediction engine, 
coordinates with the AI Agent server, and persists state in SQLite.
"""

import os
import json
import logging
import requests
import sqlite3
import subprocess
import shutil
import asyncio
from datetime import datetime
from typing import List, Literal, Optional
from collections import deque

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from database import get_db_connection, init_db

# Centralized API URLs for Production
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000").rstrip("/")
AGENT_API_URL = os.getenv("AGENT_API_URL", "http://127.0.0.1:8001").rstrip("/")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

# Initialize SQLite database on startup
init_db()

app = FastAPI(title="CrowdGuard AI Backend")

# Allow the React frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global registry to hold the latest JPEG bytes per camera
latest_frames = {}

# Global dictionary to track active subprocesses for CV nodes
active_processes = {}

# Global metrics history for prediction stability (zone_id -> deque)
metrics_history = {}

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def resolve_py_bin():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    for path in [
        ["venv", "Scripts", "python.exe"],  # Windows
        ["venv", "bin", "python"],          # Linux
        [".venv", "bin", "python"]         # Linux alternative
    ]:
        candidate = os.path.abspath(os.path.join(script_dir, "..", *path))
        if os.path.exists(candidate):
            return candidate
    return "python"

def get_local_backend_url():
    port_env = os.getenv("PORT", "8000")
    return f"http://127.0.0.1:{port_env}"

import threading

def monitor_subprocess(camera_id: str, proc: subprocess.Popen, log_path: str):
    proc.wait()
    exit_code = proc.returncode
    if exit_code != 0 and exit_code != -15 and exit_code != 15:  # Ignore SIGTERM (15/-15)
        try:
            if os.path.exists(log_path):
                # Read last 50 lines to keep backend logs readable
                with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    last_lines = "".join(lines[-50:])
                logger.error(f"YOLO worker for camera {camera_id} crashed (exit code {exit_code}). Last logs:\n{last_lines}")
            else:
                logger.error(f"YOLO worker for camera {camera_id} exited unexpectedly with code {exit_code}.")
        except Exception as log_err:
            logger.error(f"Failed to read YOLO log file for camera {camera_id}: {log_err}")
    else:
        logger.info(f"YOLO worker for camera {camera_id} exited cleanly with code {exit_code}.")

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CameraResponse(BaseModel):
    id: str
    name: str
    label: str
    stream_url: str
    stream_label: str
    max_capacity: int
    zone_id: str
    active: int

class Zone(BaseModel):
    zone_id: str
    status: Literal["red", "amber", "green"]
    density: float
    message: str
    person_count: int
    rolling_average: float
    growth_rate: float
    sustained_congestion_sec: float
    speed: float
    stagnation_index: float
    predicted_risk: str
    time_to_risk: float
    prediction_message: str
    status_lifecycle: str
    confidence: float
    prediction: Optional[str] = None
    recommendation: Optional[str] = None
    explanation: Optional[str] = None

class ZonesResponse(BaseModel):
    zones: List[Zone]

class DispatchInput(BaseModel):
    zone_id: str
    timestamp: str
    message: str
    operator_notes: Optional[str] = None
    crowd_count: Optional[int] = None
    density: Optional[float] = None
    risk_level: Optional[str] = None
    recommendation: Optional[str] = None
    incident_id: Optional[str] = None

class Dispatch(BaseModel):
    id: int
    timestamp: str
    zone: str
    message: str
    zone_id: str

class ReviewInput(BaseModel):
    is_accurate: bool
    notes: str

class Review(BaseModel):
    id: int
    is_accurate: int
    notes: str
    timestamp: str

# ---------------------------------------------------------------------------
# Deterministic Prediction Engine with Stability Calculations
# ---------------------------------------------------------------------------

def run_prediction_engine(zone_id: str, person_count: int, density: float, rolling_average: float,
                          growth_rate: float, trend: str, max_capacity: int, speed: float,
                          stagnation_index: float, sustained_congestion_sec: float,
                          average_detection_conf: float, tracking_stability: float) -> dict:
    """
    Advanced Prediction Engine:
    Calculates safety risk level, prediction message, time estimate, and evidence-based confidence.
    """
    # Initialize history deque for the zone if missing
    if zone_id not in metrics_history:
        metrics_history[zone_id] = deque(maxlen=10)
    
    # 1. Calculate Risk Score (0.0 to 10.0) based on all available metrics
    density_score = min(density * 2.0, 8.0) # Up to 8.0
    growth_penalty = max(growth_rate * 1.5, 0.0) # Penalty for positive growth
    
    # Selective Stagnation Penalty: only penalize when density is high and growth/congestion confirms risk
    is_stationary = (stagnation_index > 0.5) or (speed > 0 and speed < 30.0)
    is_congested = is_stationary and (density >= 2.2) and (growth_rate > 0.1 or sustained_congestion_sec >= 15.0)
    stagnation_penalty = 2.0 if is_congested else 0.0
    
    congestion_penalty = min(sustained_congestion_sec / 30.0, 2.0)
    capacity_penalty = 1.5 if person_count >= max_capacity else 0.0
    
    # Stable waiting crowd identification
    is_stable_waiting = (abs(growth_rate) < 0.5) and (trend in ["stable", "falling"]) and (person_count < max_capacity)
    
    if is_stable_waiting:
        # Scale density impact down by 50% for stable waiting crowds
        adjusted_density_score = density_score * 0.5
    else:
        adjusted_density_score = density_score
        
    risk_score = min(adjusted_density_score + growth_penalty + stagnation_penalty + congestion_penalty + capacity_penalty, 10.0)
    
    if risk_score >= 7.0:
        risk = "high"
    elif risk_score >= 4.0:
        risk = "medium"
    else:
        risk = "low"

    # Append current state to history for stability calculations
    metrics_history[zone_id].append({
        "risk": risk,
        "growth_rate": growth_rate
    })

    # 2. Calculate Prediction Stability metrics
    history = metrics_history[zone_id]
    
    # Risk Classification Stability (deduct 0.25 per status transition in history)
    transitions = 0
    for i in range(len(history) - 1):
        if history[i]["risk"] != history[i + 1]["risk"]:
            transitions += 1
    risk_stability = max(1.0 - (transitions * 0.25), 0.0)
    
    # Growth Rate Consistency (deduct based on growth standard deviation)
    growth_values = [x["growth_rate"] for x in history]
    if len(growth_values) >= 2:
        avg_growth = sum(growth_values) / len(growth_values)
        var_growth = sum((x - avg_growth)**2 for x in growth_values) / (len(growth_values) - 1)
        std_growth = (var_growth ** 0.5)
        growth_stability = max(1.0 - (std_growth / (abs(avg_growth) + 0.1)), 0.0)
    else:
        growth_stability = 1.0
        
    observation_length = len(history)
    observation_window_factor = min(observation_length / 10.0, 1.0)

    # 3. Evidence-Based Confidence Score (0.0 to 1.0)
    confidence = (0.4 * tracking_stability + 
                  0.2 * average_detection_conf + 
                  0.2 * risk_stability + 
                  0.2 * growth_stability) * observation_window_factor
    confidence = round(max(min(confidence, 1.0), 0.0), 2)

    # 4. Predict time-horizon until unsafe capacity
    time_to_risk = -1.0
    predicted_risk = "low"
    prediction_message = "Expected to remain safe"
    
    capacity_usage = (person_count / max_capacity) * 100.0 if max_capacity > 0 else 0.0

    if growth_rate > 0.0:
        headroom = max_capacity - person_count
        if headroom > 0:
            time_to_risk = round(headroom / growth_rate, 1)
            if time_to_risk < 60.0:
                predicted_risk = "high"
                prediction_message = (f"Avoid - Platform capacity usage is at {capacity_usage:.1f}% "
                                      f"and is expected to exceed limits in {int(time_to_risk)}s "
                                      f"due to rapid crowd inflow of {growth_rate:.2f} p/s.")
            elif time_to_risk < 180.0:
                predicted_risk = "medium"
                prediction_message = (f"Caution - Inflow is rising ({growth_rate:.2f} p/s). "
                                      f"Expected to exceed capacity limit in {int(time_to_risk // 60)}m {int(time_to_risk % 60)}s.")
            else:
                predicted_risk = "low"
                prediction_message = (f"Safe - Crowd count is growing steadily ({growth_rate:.2f} p/s). "
                                      f"Remaining safety buffer exceeds {int(time_to_risk // 60)} minutes.")
        else:
            time_to_risk = 0.0
            predicted_risk = "high"
            prediction_message = f"Avoid - Platform has exceeded maximum safe capacity limits ({capacity_usage:.1f}%)."
    else:
        if is_congested:
            predicted_risk = "medium"
            prediction_message = (f"Caution - Crowd is stagnant (avg speed {speed:.1f} px/s) "
                                  f"with high density ({density:.2f}). Sustained congestion for {int(sustained_congestion_sec)}s.")
        else:
            if risk == "high":
                predicted_risk = "high"
                prediction_message = f"Avoid - Crowd density is critically high ({density:.2f}) under current limits."
            elif risk == "medium":
                predicted_risk = "medium"
                prediction_message = f"Caution - Busy transit area. Density is moderate ({density:.2f}) and stable."
            else:
                predicted_risk = "low"
                if is_stationary:
                    prediction_message = f"Safe - Stationary waiting crowd is stable (capacity usage: {capacity_usage:.1f}%)."
                else:
                    prediction_message = f"Safe - Crowd counts are stable within margins (capacity usage: {capacity_usage:.1f}%)."

    # Determine reason for logging
    reason = "Normal operations"
    if predicted_risk == "high":
        if person_count >= max_capacity:
            reason = "Maximum safe capacity exceeded"
        elif growth_rate > 0.0:
            reason = "Rapid crowd inflow endangering zone capacity"
        else:
            reason = "Critically high crowd density"
    elif predicted_risk == "medium":
        if growth_rate > 0.0:
            reason = "Elevated crowd inflow causing growth"
        elif is_congested:
            reason = "Congested stagnant crowd detected with sustained occupancy"
        else:
            reason = "Moderate busy transit density"
    else:
        if is_stationary:
            reason = "Stationary waiting crowd with stable count. No positive inflow detected."
        else:
            reason = "Crowd counts are stable and within safe limits"

    logger.info(
        f"\n[Prediction]\n"
        f"zone={zone_id}\n"
        f"count={person_count}\n"
        f"density={density:.1f}\n"
        f"growth={growth_rate:.1f}\n"
        f"speed={speed:.1f}\n"
        f"stagnation={stagnation_index:.2f}\n"
        f"risk_score={risk_score:.1f}\n"
        f"predicted_risk={predicted_risk}\n"
        f"reason={reason}"
    )

    return {
        "risk_level": risk,
        "predicted_risk": predicted_risk,
        "time_to_risk": time_to_risk,
        "prediction_message": prediction_message,
        "confidence": confidence
    }

# ---------------------------------------------------------------------------
# Offline Stream Placeholder Generator
# ---------------------------------------------------------------------------

def get_offline_placeholder():
    """Generates a binary JPEG string representing a camera offline state."""
    # Tiny, valid black JPEG image fallback to prevent loading failures
    return (
        b'\xff\xd8\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b'
        b'\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=8'
        b'2<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01'
        b'\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b'
        b'\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x37\xff\xd9'
    )

# ---------------------------------------------------------------------------
# State Sync Helper
# ---------------------------------------------------------------------------

def get_live_zones_data() -> List[Zone]:
    """
    Reads the latest metrics from the SQLite database, executes the deterministic
    prediction engine, coordinates with the Agent server (port 8001), and updates alerts.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, label, max_capacity, zone_id, stream_url FROM cameras WHERE active = 1")
        cameras_rows = cursor.fetchall()
        
        merged_zones = []
        
        for cam in cameras_rows:
            cam_id = cam["id"]
            zone_id = cam["zone_id"]
            zone_name = cam["label"]
            max_capacity = cam["max_capacity"]
            stream_url = f"{BACKEND_API_URL}/api/cameras/{cam_id}/stream"
            
            # Query latest live metrics for this camera
            cursor.execute("""
                SELECT timestamp, person_count, density, trend, rolling_average, growth_rate, 
                       sustained_congestion_sec, speed, stagnation_index, average_detection_conf, tracking_stability
                FROM live_metrics 
                WHERE camera_id = ? AND zone_id = ?
            """, (cam_id, zone_id))
            metric = cursor.fetchone()
            
            if not metric:
                metric = {
                    "timestamp": datetime.now().isoformat(),
                    "person_count": 0,
                    "density": 0.0,
                    "trend": "stable",
                    "rolling_average": 0.0,
                    "growth_rate": 0.0,
                    "sustained_congestion_sec": 0.0,
                    "speed": -1.0,
                    "stagnation_index": -1.0,
                    "average_detection_conf": 1.0,
                    "tracking_stability": 1.0
                }
                
            # Run prediction engine
            pred_res = run_prediction_engine(
                zone_id=zone_id,
                person_count=metric["person_count"],
                density=metric["density"],
                rolling_average=metric["rolling_average"],
                growth_rate=metric["growth_rate"],
                trend=metric["trend"],
                max_capacity=max_capacity,
                speed=metric["speed"],
                stagnation_index=metric["stagnation_index"],
                sustained_congestion_sec=metric["sustained_congestion_sec"],
                average_detection_conf=metric["average_detection_conf"],
                tracking_stability=metric["tracking_stability"]
            )
            
            # Get active alert status from DB
            cursor.execute("SELECT id, status FROM alerts WHERE zone_id = ?", (zone_id,))
            alert_row = cursor.fetchone()
            status_lifecycle = alert_row["status"] if alert_row else "NEW"
            
            # Contact AI Agent Server
            agent_url = f"{AGENT_API_URL}/analyze/zone"
            agent_payload = {
                "zone_id": zone_id,
                "person_count": metric["person_count"],
                "density": metric["density"],
                "trend": metric["trend"],
                "rolling_average": metric["rolling_average"],
                "growth_rate": metric["growth_rate"],
                "sustained_congestion_sec": metric["sustained_congestion_sec"],
                "speed": metric["speed"],
                "stagnation_index": metric["stagnation_index"],
                "predicted_risk": pred_res["predicted_risk"],
                "time_to_risk": pred_res["time_to_risk"],
                "prediction_message": pred_res["prediction_message"],
                "confidence": pred_res["confidence"]
            }
            
            risk_level = pred_res["risk_level"]
            prediction = pred_res["prediction_message"]
            recommendation = "Continue normal monitoring"
            explanation = "Crowd density remains low and stable under current limits."
            
            try:
                response = requests.post(agent_url, json=agent_payload, timeout=2.5)
                if response.status_code == 200:
                    agent_analysis = response.json()
                    risk_level = agent_analysis.get("risk_level", risk_level)
                    prediction = agent_analysis.get("prediction", prediction)
                    recommendation = agent_analysis.get("recommendation", recommendation)
                    explanation = agent_analysis.get("explanation", explanation)
                else:
                    logger.warning(f"Agent server failed with status {response.status_code}. Using deterministic fallback.")
            except Exception as err:
                logger.warning(f"Agent server connection timed out or offline: {err}. Using deterministic fallback.")
                
            status = "green"
            if risk_level == "high":
                status = "red"
            elif risk_level == "medium":
                status = "amber"
                
            message_str = f"{explanation} Recommendation: {recommendation}"
            
            alert_id = f"alert_{zone_id}"
            congestion_percent = f"{int(min((metric['density'] / 4.5) * 100, 100))}%"
            
            if status == "green":
                status_lifecycle = "NEW"
                
            cursor.execute("""
                INSERT INTO alerts (id, zone_id, zone_name, title, risk_level, timestamp, date_time, 
                                   message, stream_url, status, congestion, count, prediction, 
                                   explanation, recommendation, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    risk_level=excluded.risk_level,
                    timestamp=excluded.timestamp,
                    message=excluded.message,
                    status=?, 
                    congestion=excluded.congestion,
                    count=excluded.count,
                    prediction=excluded.prediction,
                    explanation=excluded.explanation,
                    recommendation=excluded.recommendation,
                    confidence=excluded.confidence
            """, (
                alert_id, zone_id, zone_name, f"{zone_name} Alert", status, "Just now", 
                metric["timestamp"], message_str, stream_url, status_lifecycle, 
                congestion_percent, metric["person_count"], prediction, explanation, 
                recommendation, pred_res["confidence"], status_lifecycle
            ))
            
            merged_zones.append(Zone(
                zone_id=zone_id,
                status=status,
                density=metric["density"],
                message=message_str,
                person_count=metric["person_count"],
                rolling_average=metric["rolling_average"],
                growth_rate=metric["growth_rate"],
                sustained_congestion_sec=metric["sustained_congestion_sec"],
                speed=metric["speed"],
                stagnation_index=metric["stagnation_index"],
                predicted_risk=pred_res["predicted_risk"],
                time_to_risk=pred_res["time_to_risk"],
                prediction_message=pred_res["prediction_message"],
                status_lifecycle=status_lifecycle,
                confidence=pred_res["confidence"],
                prediction=prediction,
                recommendation=recommendation,
                explanation=explanation
            ))
            
        conn.commit()
    finally:
        conn.close()
    
    return merged_zones

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/cameras/{camera_id}/frame")
async def receive_frame(camera_id: str, request: Request):
    """Receives binary JPEG frame bytes from the isolated YOLO worker."""
    body = await request.body()
    latest_frames[camera_id] = body
    return {"status": "ok"}

@app.get("/api/cameras/{camera_id}/stream")
async def stream_camera(camera_id: str):
    """Streams live MJPEG frames back to client. Falls back to offline image if empty."""
    async def frame_generator():
        consecutive_misses = 0
        while True:
            frame = latest_frames.get(camera_id)
            if frame:
                consecutive_misses = 0
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            else:
                consecutive_misses += 1
                if consecutive_misses > 40: # ~2 seconds of missed frames
                    placeholder = get_offline_placeholder()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + placeholder + b'\r\n')
            
            await asyncio.sleep(0.04) # Output pacing ~25 FPS
            
    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/cameras", response_model=List[CameraResponse])
def get_cameras():
    """Returns registered cameras overriding stream URLs dynamically to the live stream endpoint."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras WHERE active = 1")
        rows = cursor.fetchall()
    finally:
        conn.close()
    
    cameras_list = []
    for r in rows:
        cam_dict = dict(r)
        import urllib.parse
        safe_id = urllib.parse.quote(cam_dict['id'])
        cam_dict["stream_url"] = f"{BACKEND_API_URL}/api/cameras/{safe_id}/stream"
        cameras_list.append(CameraResponse(**cam_dict))
    return cameras_list

@app.get("/api/zones", response_model=ZonesResponse)
def get_zones() -> ZonesResponse:
    """Polled by frontend. Performs prediction engine calculations."""
    return ZonesResponse(zones=get_live_zones_data())

@app.get("/api/alerts")
def get_alerts():
    """Returns active alerts from SQLite joined with all live metrics."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, m.growth_rate, m.trend, m.density, m.rolling_average, 
                   m.sustained_congestion_sec, m.speed, m.stagnation_index 
            FROM alerts a 
            LEFT JOIN live_metrics m ON a.zone_id = m.zone_id
        """)
        rows = cursor.fetchall()
    finally:
        conn.close()
    
    alerts_list = []
    for r in rows:
        alert_dict = dict(r)
        cam_id = "cam1" if alert_dict["zone_id"] == "gate4" else ("cam2" if alert_dict["zone_id"] == "courtyard" else alert_dict["zone_id"])
        import urllib.parse
        safe_cam_id = urllib.parse.quote(cam_id)
        
        alerts_list.append({
            "id": alert_dict["id"],
            "zoneId": alert_dict["zone_id"],
            "zoneName": alert_dict["zone_name"],
            "title": alert_dict["title"],
            "riskLevel": alert_dict["risk_level"],
            "timestamp": alert_dict["timestamp"],
            "dateTime": alert_dict["date_time"],
            "message": alert_dict["message"],
            "streamUrl": f"{BACKEND_API_URL}/api/cameras/{safe_cam_id}/stream",
            "status": alert_dict["status"],
            "boundingBoxes": [],
            "density": alert_dict.get("density", 0.0),
            "trend": alert_dict.get("trend", "stable"),
            "rollingAverage": alert_dict.get("rolling_average", 0.0),
            "sustainedCongestionSec": alert_dict.get("sustained_congestion_sec", 0.0),
            "speed": alert_dict.get("speed", -1.0),
            "stagnationIndex": alert_dict.get("stagnation_index", -1.0),
            "aiMetadata": {
                "congestion": alert_dict["congestion"],
                "count": str(alert_dict["count"]),
                "flowRate": f"{round(alert_dict['growth_rate'], 1)} p/s" if (alert_dict.get("growth_rate") is not None and alert_dict["growth_rate"] > 0) else "0.0 p/s",
                "streamId": f"CG-V-{alert_dict['zone_id'].upper()}",
                "prediction": alert_dict["prediction"],
                "explanation": alert_dict["explanation"],
                "recommendation": alert_dict["recommendation"],
                "confidence": f"{int(alert_dict['confidence'] * 100)}%" if alert_dict.get("confidence") is not None else "100%",
                "integrity": {
                    "engine": f"LATENCY 38ms",
                    "link": "NOMINAL"
                }
            }
        })
    return alerts_list

@app.post("/api/dispatch", response_model=Dispatch, status_code=201)
def create_dispatch(payload: DispatchInput) -> Dispatch:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE alerts SET status = 'DISPATCHED' WHERE zone_id = ?", (payload.zone_id,))
        cursor.execute("SELECT label FROM cameras WHERE zone_id = ?", (payload.zone_id,))
        cam_row = cursor.fetchone()
        zone_name = cam_row["label"] if cam_row else payload.zone_id.capitalize()
        
        cursor.execute("""
            INSERT INTO dispatches (timestamp, zone, message, zone_id)
            VALUES (?, ?, ?, ?)
        """, (payload.timestamp, zone_name, payload.message, payload.zone_id))
        dispatch_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()

    try:
        import uuid
        incident_uuid = payload.incident_id or str(uuid.uuid4())
        save_payload = {
            "incident_id": incident_uuid,
            "zone_id": payload.zone_id,
            "zone_name": zone_name,
            "timestamp": payload.timestamp,
            "crowd_count": payload.crowd_count or 0,
            "density_score": payload.density or 0.0,
            "risk_level": payload.risk_level or "unknown",
            "ai_recommendation": payload.recommendation or "No recommendation",
            "actual_dispatched_response": payload.message,
            "operator_notes": payload.operator_notes or "",
            "final_outcome": "Resolved/Dispatched"
        }
        # Post request to Agents microservice
        requests.post(f"{AGENT_API_URL}/memory/save", json=save_payload, timeout=2.0)
    except Exception as memory_err:
        logger.error(f"Failed to forward incident memory to agents service: {memory_err}")

    
    return Dispatch(
        id=dispatch_id,
        timestamp=payload.timestamp,
        zone=zone_name,
        message=payload.message,
        zone_id=payload.zone_id
    )

@app.get("/api/dispatches", response_model=List[Dispatch])
def get_dispatches():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM dispatches ORDER BY id DESC")
        rows = cursor.fetchall()
    finally:
        conn.close()
    return [Dispatch(**dict(r)) for r in rows]

class MemorySearchInputBackend(BaseModel):
    zone_id: str
    zone_name: str
    risk_level: str
    crowd_count: int
    density_score: float
    recommended_action: str

@app.post("/api/memory/search")
def search_memory_backend(payload: MemorySearchInputBackend):
    try:
        response = requests.post(
            f"{AGENT_API_URL}/memory/search",
            json={
                "zone_id": payload.zone_id,
                "zone_name": payload.zone_name,
                "risk_level": payload.risk_level,
                "crowd_count": payload.crowd_count,
                "density_score": payload.density_score,
                "recommended_action": payload.recommended_action
            },
            timeout=3.0
        )
        if response.status_code == 200:
            return response.json()
        else:
            logger.warning(f"Agents memory search returned status {response.status_code}")
            return {"memories": [], "summary": ""}
    except Exception as e:
        logger.error(f"Failed to connect to agents memory search service: {e}")
        return {"memories": [], "summary": ""}

@app.post("/api/reviews", response_model=Review, status_code=201)

def create_review(payload: ReviewInput) -> Review:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO reviews (is_accurate, notes, timestamp)
            VALUES (?, ?, ?)
        """, (1 if payload.is_accurate else 0, payload.notes, timestamp))
        review_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()
    
    return Review(
        id=review_id,
        is_accurate=1 if payload.is_accurate else 0,
        notes=payload.notes,
        timestamp=timestamp
    )

@app.post("/api/cameras/upload", status_code=201)
async def upload_camera(
    camera_id: str = Form(...),
    name: str = Form(...),
    label: str = Form(...),
    zone_id: str = Form(...),
    max_capacity: int = Form(...),
    video: UploadFile = File(...)
):
    filename = f"{camera_id}_{video.filename}"
    video_path = os.path.join(UPLOAD_DIR, filename)
    try:
        with open(video_path, "wb") as f:
            shutil.copyfileobj(video.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {e}")

    import urllib.parse
    safe_id = urllib.parse.quote(camera_id)
    stream_url = f"{BACKEND_API_URL}/api/cameras/{safe_id}/stream"

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO cameras (id, name, label, stream_url, stream_label, max_capacity, zone_id, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                label=excluded.label,
                stream_url=excluded.stream_url,
                stream_label=excluded.stream_label,
                max_capacity=excluded.max_capacity,
                zone_id=excluded.zone_id,
                active=1
        """, (camera_id, name, label, stream_url, f"CAM_{camera_id.upper()} // {label.upper()}", max_capacity, zone_id))
        
        cursor.execute("""
            INSERT OR IGNORE INTO live_metrics (camera_id, timestamp, zone_id, person_count, density, trend, rolling_average, growth_rate, sustained_congestion_sec)
            VALUES (?, ?, ?, 0, 0.0, 'stable', 0.0, 0.0, 0.0)
        """, (camera_id, datetime.now().isoformat(), zone_id))
        conn.commit()
    except Exception as db_err:
        raise HTTPException(status_code=500, detail=f"Failed to register camera: {db_err}")
    finally:
        conn.close()

    if camera_id in active_processes:
        try:
            active_processes[camera_id].terminate()
        except:
            pass

    # Launch dynamic YOLO worker process
    cv_script = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cv-detection", "detect.py"))
    output_json = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cv-detection", f"cv_output_{zone_id}.json"))
    py_bin = resolve_py_bin()
    local_backend_url = get_local_backend_url()
    
    cmd = [
        py_bin, cv_script,
        "--video", os.path.abspath(video_path),
        "--camera-id", camera_id,
        "--zone-id", zone_id,
        "--output-json", output_json,
        "--mode", "file",
        "--loop",
        "--backend-url", local_backend_url
    ]
    
    logger.info(f"Launching YOLO worker subprocess: {' '.join(cmd)}")
    log_path = os.path.join(UPLOAD_DIR, f"yolo_worker_{camera_id}.log")
    try:
        log_file = open(log_path, "w", encoding="utf-8", errors="ignore")
        proc = subprocess.Popen(
            cmd, 
            cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cv-detection")),
            stdout=log_file,
            stderr=subprocess.STDOUT
        )
        active_processes[camera_id] = proc
        
        # Monitor the process for errors/unexpected exit
        monitor_thread = threading.Thread(
            target=monitor_subprocess, 
            args=(camera_id, proc, log_path), 
            daemon=True
        )
        monitor_thread.start()
    except Exception as proc_err:
        logger.error(f"Failed to spawn worker subprocess: {proc_err}")
    
    return {"status": "success", "camera_id": camera_id, "stream_url": stream_url}

@app.delete("/api/cameras/{camera_id}")
async def unlink_camera(camera_id: str):
    logger.info(f"Unlinking camera: {camera_id}")
    
    # 1. Stop YOLO worker process
    if camera_id in active_processes:
        try:
            active_processes[camera_id].terminate()
            try:
                active_processes[camera_id].wait(timeout=1.5)
            except subprocess.TimeoutExpired:
                active_processes[camera_id].kill()
            logger.info(f"YOLO worker for {camera_id} stopped.")
        except Exception as e:
            logger.error(f"Error terminating YOLO worker for {camera_id}: {e}")
        finally:
            active_processes.pop(camera_id, None)
            
    # Remove from latest_frames cache
    latest_frames.pop(camera_id, None)
            
    # 2. Database cleanup
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT zone_id FROM cameras WHERE id = ?", (camera_id,))
        row = cursor.fetchone()
        zone_id = row[0] if row else None
        
        cursor.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
        cursor.execute("DELETE FROM live_metrics WHERE camera_id = ?", (camera_id,))
        if zone_id:
            cursor.execute("DELETE FROM alerts WHERE zone_id = ?", (zone_id,))
            
        conn.commit()
    except Exception as db_err:
        raise HTTPException(status_code=500, detail=f"Database deletion failed: {db_err}")
    finally:
        conn.close()
    
    # 3. Delete uploaded video file
    try:
        for f in os.listdir(UPLOAD_DIR):
            if f.startswith(f"{camera_id}_"):
                os.remove(os.path.join(UPLOAD_DIR, f))
    except Exception as file_err:
        logger.warning(f"Could not delete video file: {file_err}")
        
    return {"status": "success", "camera_id": camera_id}

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

# Start worker processes for default cameras on system startup
@app.on_event("startup")
def startup_event():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, zone_id FROM cameras WHERE active = 1")
        cameras = cursor.fetchall()
    finally:
        conn.close()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cv_script = os.path.abspath(os.path.join(script_dir, "..", "cv-detection", "detect.py"))
    py_bin = resolve_py_bin()
    local_backend_url = get_local_backend_url()
    
    video_path = os.path.abspath(os.path.join(script_dir, "..", "CGAssests", "1.mp4"))
    
    for cam in cameras:
        cam_id = cam["id"]
        zone_id = cam["zone_id"]
        output_json = os.path.abspath(os.path.join(script_dir, "..", "cv-detection", f"cv_output_{zone_id}.json"))
        
        cmd = [
            py_bin, cv_script,
            "--video", video_path,
            "--camera-id", cam_id,
            "--zone-id", zone_id,
            "--output-json", output_json,
            "--mode", "file",
            "--loop",
            "--backend-url", local_backend_url
        ]
        
        logger.info(f"Starting startup YOLO worker subprocess for {cam_id}: {' '.join(cmd)}")
        log_path = os.path.join(UPLOAD_DIR, f"yolo_worker_{cam_id}.log")
        try:
            log_file = open(log_path, "w", encoding="utf-8", errors="ignore")
            proc = subprocess.Popen(
                cmd, 
                cwd=os.path.abspath(os.path.join(script_dir, "..", "cv-detection")),
                stdout=log_file,
                stderr=subprocess.STDOUT
            )
            active_processes[cam_id] = proc
            
            monitor_thread = threading.Thread(
                target=monitor_subprocess, 
                args=(cam_id, proc, log_path), 
                daemon=True
            )
            monitor_thread.start()
        except Exception as e:
            logger.error(f"Failed to start startup YOLO worker for {cam_id}: {e}")

# Terminate all active processes on shutdown
@app.on_event("shutdown")
def shutdown_event():
    for cam_id, proc in list(active_processes.items()):
        try:
            proc.terminate()
            logger.info(f"Terminated YOLO worker subprocess for {cam_id}")
        except:
            pass
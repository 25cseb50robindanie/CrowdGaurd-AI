import os
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent_chain import run_agent_chain

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent_app")

app = FastAPI(title="CrowdGuard AI - Multi-Agent Analysis Service")

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas matching Data Contracts
class ZoneInput(BaseModel):
    zone_id: str
    person_count: int
    density: float
    trend: str
    rolling_average: float
    growth_rate: float
    sustained_congestion_sec: float
    speed: float
    stagnation_index: float
    predicted_risk: str
    time_to_risk: float
    prediction_message: str
    confidence: float

class CameraInput(BaseModel):
    camera_id: str
    timestamp: str
    zones: List[ZoneInput]

class ZoneAnalysisOutput(BaseModel):
    zone_id: str
    risk_level: str  # "high", "medium", "low"
    prediction: str
    recommendation: str
    explanation: str
    fallback: Optional[bool] = None

class CameraAnalysisOutput(BaseModel):
    camera_id: str
    timestamp: str
    zones: List[ZoneAnalysisOutput]

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "CrowdGuardAI Crowd Prediction Multi-Agent Service",
        "endpoints": {
            "POST /analyze/camera": "Analyze camera data with multiple zones",
            "POST /analyze/zones": "Analyze a list of zones",
            "POST /analyze/zone": "Analyze a single zone"
        }
    }

@app.post("/analyze/camera", response_model=CameraAnalysisOutput)
async def analyze_camera(data: CameraInput):
    logger.info(f"Received camera analysis request for {data.camera_id} at {data.timestamp}")
    analyzed_zones = []
    for zone in data.zones:
        try:
            analysis = run_agent_chain(
                zone_id=zone.zone_id,
                person_count=zone.person_count,
                density=zone.density,
                trend=zone.trend,
                rolling_average=zone.rolling_average,
                growth_rate=zone.growth_rate,
                sustained_congestion_sec=zone.sustained_congestion_sec,
                speed=zone.speed,
                stagnation_index=zone.stagnation_index,
                predicted_risk=zone.predicted_risk,
                time_to_risk=zone.time_to_risk,
                prediction_message=zone.prediction_message,
                confidence=zone.confidence
            )
            analyzed_zones.append(analysis)
        except Exception as e:
            logger.error(f"Error analyzing zone {zone.zone_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to analyze zone {zone.zone_id}: {str(e)}")
            
    return CameraAnalysisOutput(
        camera_id=data.camera_id,
        timestamp=data.timestamp,
        zones=analyzed_zones
    )

@app.post("/analyze/zones", response_model=List[ZoneAnalysisOutput])
async def analyze_zones(zones: List[ZoneInput]):
    logger.info(f"Received analysis request for {len(zones)} zones")
    analyzed_zones = []
    for zone in zones:
        try:
            analysis = run_agent_chain(
                zone_id=zone.zone_id,
                person_count=zone.person_count,
                density=zone.density,
                trend=zone.trend,
                rolling_average=zone.rolling_average,
                growth_rate=zone.growth_rate,
                sustained_congestion_sec=zone.sustained_congestion_sec,
                speed=zone.speed,
                stagnation_index=zone.stagnation_index,
                predicted_risk=zone.predicted_risk,
                time_to_risk=zone.time_to_risk,
                prediction_message=zone.prediction_message,
                confidence=zone.confidence
            )
            analyzed_zones.append(analysis)
        except Exception as e:
            logger.error(f"Error analyzing zone {zone.zone_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to analyze zone {zone.zone_id}: {str(e)}")
            
    return analyzed_zones

@app.post("/analyze/zone", response_model=ZoneAnalysisOutput)
async def analyze_single_zone(zone: ZoneInput):
    logger.info(f"Received analysis request for single zone {zone.zone_id}")
    try:
        analysis = run_agent_chain(
            zone_id=zone.zone_id,
            person_count=zone.person_count,
            density=zone.density,
            trend=zone.trend,
            rolling_average=zone.rolling_average,
            growth_rate=zone.growth_rate,
            sustained_congestion_sec=zone.sustained_congestion_sec,
            speed=zone.speed,
            stagnation_index=zone.stagnation_index,
            predicted_risk=zone.predicted_risk,
            time_to_risk=zone.time_to_risk,
            prediction_message=zone.prediction_message,
            confidence=zone.confidence
        )
        return analysis
    except Exception as e:
        logger.error(f"Error analyzing zone {zone.zone_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze zone {zone.zone_id}: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)

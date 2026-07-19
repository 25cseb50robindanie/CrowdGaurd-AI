# CrowdGuard AI — Predictive Crowd Safety Platform

Link to the Authority Dashnoard -[Authority Dashboard](https://crowdgaurd-ai-2.onrender.com)
Link to the Tourist Dashboard - [Tourist Dashboard](https://crowdgaurd-ai-3.onrender.com)

**Built for [Build in AI for India](https://buildinai4india.com/) — a 7-day nationwide AI hackathon**
 
CrowdGuard AI is a multi-agent, computer-vision-powered platform that predicts dangerous crowd density **before** it becomes critical — giving authorities minutes of early warning instead of reacting after a crowd crush has already begun.
 
---
 
## ⚠️ Known Issue — Please Read Before Testing the Live Demo
 
Our deployed version runs on **Render's free tier**, which provides CPU-only compute. Locally, our YOLOv8 detection pipeline runs on GPU and performs in real time. On Render's free CPU instance, detection is significantly slower:
 
- When a video is added, it can take **up to ~5 minutes** before the interface reflects it.
- Detection continues processing in the background even when the page looks idle — it is working, just slow, not broken.
- Returning to the site after a few minutes will show the detection results catching up.
**This is a hosting/hardware limitation of the free tier, not a flaw in the detection logic itself.** The underlying pipeline is fully functional, as demonstrated in our local run and demo video. With GPU-backed hosting (or a paid Render tier), this runs in real time as intended.
 
For the most accurate impression of actual performance, please refer to our **demo video**, which was recorded using local GPU inference.
 
---
 
## The Problem
 
India's mega-gatherings — temple festivals, railway platforms, religious pilgrimages, concerts, political rallies — pack millions of people into small spaces every year. Crowd disasters rarely happen simply because there are "too many people" in one place; they happen because of **rapid, localized changes in crowd movement**: sudden surges at gates, panic, barricades, train arrivals, or bottlenecks that develop faster than a human operator can notice.
 
Existing crowd safety infrastructure — CCTV monitored by human operators — is **purely reactive**. By the time overcrowding is visually obvious to a person watching a screen, the situation is often already dangerous, and evacuation becomes difficult. Stampedes and crowd crushes in India have repeatedly caused deaths and injuries, and current systems offer no predictive intelligence — they observe, they do not anticipate.
 
## Our Solution
 
CrowdGuard AI turns raw video into an early-warning system using a real multi-agent AI pipeline:
 
1. **Detect** — YOLOv8 computer vision tracks people and crowd density in real time across defined zones.
2. **Predict** — AI agents (Google Gemini) analyze density trends and forecast unsafe congestion **5–15 minutes ahead**.
3. **Recommend** — The system suggests a concrete action (e.g. "Open Gate 6, redirect incoming queue").
4. **Alert** — Authorities receive a plain-language explanation of the risk, never a black-box alarm.
The same prediction engine powers **two interfaces**: a detailed Authority Dashboard for police and disaster management, and a simplified Tourist Portal so the public can check crowd safety before they travel.
 
---
 
## 📸 Product Screenshots & Live Interface

### 1. Authority Command Center — Live YOLOv8 Stream & AI Risk Alerts
![Authority Command Center Live Detection](./docs/Screenshot%202026-07-19%20112632.png)
*Real-time YOLOv8 person tracking overlay, live density metrics, optical flow speed tracking, and instant Gemini AI risk alert stream with emergency force dispatching.*

### 2. Critical Risk Alert & Emergency Force Dispatch Modal
![Critical Risk Alert & Dispatch Modal](./docs/Screenshot%202026-07-19%20112601.png)
*Instant critical risk pop-up notification triggering emergency response action protocols and security staff dispatch logging.*

---

## System Architecture
 
![CrowdGuard AI System Architecture](./docs/architecture-diagram.png?v=2)
 
*(Diagram: Tourist Portal and Authority Dashboard both communicate with the FastAPI Backend over REST/MJPEG. The Backend spawns the YOLOv8 CV subprocess, persists state to SQLite, and forwards structured metrics to the AI Agent Service, which queries Mem0 for historical context and calls the Gemini LLM chain.)*
 
### High-Level Data Flow
 
```
[Video File / Stream]
       │
       ▼
[YOLOv8 Subprocess (detect.py)] ──(Annotated Frames)──▶ [MJPEG Streaming Endpoint]
       │ (JSON Metrics Payload)
       ▼
[FastAPI Backend (/api/cv/metrics)]
       │
       ▼
[Deterministic Prediction Engine]  (risk score, velocity, time-to-surge)
       │
       ▼
[SQLite DB Persistence]  (live_metrics & alerts tables)
       │
       ▼
[AI Agent Service (/analyze/camera)]
       │
       ▼
[Mem0 Context Retrieval]  (searches past similar incidents)
       │
       ▼
[Gemini LLM Multi-Agent Chain]  (prediction & recommendation)
       │
       ▼
[Dashboard / Tourist Portal]  (updates via polling / MJPEG stream)
```
 
---
 
## Computer Vision Pipeline
 
![Computer Vision Detection Architecture](./docs/cv-detection-diagram.png?v=1)
 
Built on **YOLOv8s** + OpenCV, chosen for the balance between inference speed and detection accuracy in dense crowds.
 
| Stage | What Happens |
|---|---|
| Frame Ingestion | Captures frames via `cv2.VideoCapture` from an uploaded video or camera feed |
| YOLOv8 Detection | Runs inference at confidence threshold `0.25`, targeting class `0` (person), to capture partially occluded individuals in tight crowds |
| Density Calculation | `density = person_count / zone_area (m²)` |
| Optical Flow & Speed | Farneback Dense Optical Flow measures pixel displacement between frames to estimate crowd movement speed and a stagnation index |
| Frame Encoding | Annotates the frame with bounding boxes and metrics, encodes as JPEG for MJPEG streaming |
| Metrics Dispatch | Posts structured JSON metrics via `HTTP POST /api/cv/metrics` to the backend |
 
---
 
## AI Agent System
 
![AI Agent System Architecture](./docs/agents-diagram.png?v=1)
 
A **three-agent chain** built with Google Gemini, orchestrated to turn raw metrics into human-readable, actionable guidance:
 
1. **Prediction Agent** — converts quantitative metrics (count, density, speed, growth rate) into a concise risk summary.
2. **Recommendation Agent** — combines the prediction with historical incident memory (via Mem0) to generate clear operator actions, e.g. *"Open Gate B, deploy 2 units to Sector 4."*
3. **Executive / Summary Agent** — synthesizes everything into a structured JSON response: `risk_level`, `prediction`, `explanation`, `recommendation`.
**Fallback mechanism:** if the Gemini API is unavailable or rate-limited, a rule-based deterministic engine generates structured risk output locally, so the system keeps working even without a live LLM connection.
 
---
 
## 🧠 Partner Spotlight: Mem0
 
CrowdGuard AI uses **[Mem0](https://mem0.ai)** as its long-term memory layer — one of the confirmed partners of Build in AI for India.
 
Standard LLM calls are stateless: each prediction is made in isolation, with no memory of what happened before. Mem0 solves this by giving our agent pipeline **persistent, contextual memory** across incidents:
 
- When a high-density alert is triggered, `agents/memory.py` queries Mem0 for similar past incidents at that zone.
- Mem0 returns relevant historical context — for example, *"Gate 3 experienced a 3.5 people/m² bottleneck during a previous Friday peak, resolved by opening the bypass corridor."*
- The Recommendation Agent incorporates this history directly into its live advice, so recommendations improve with experience rather than treating every alert as a first-time event.
This is what allows CrowdGuard AI to move beyond one-off predictions toward a system that **learns from its own operational history**.
 
---
 
## Backend Architecture
 
![FastAPI Backend Architecture](./docs/backend-diagram.png?v=1)
 
Built with **FastAPI** (async, non-blocking), backed by SQLite for the MVP.
 
**Responsibilities:**
- Camera registry and video upload handling (`/cameras`, `/upload`)
- Spawning and managing the YOLOv8 detection subprocess per camera
- Persisting live metrics, alerts, dispatches, and operator reviews to SQLite
- Running the deterministic prediction engine (risk scores, time-to-surge estimates)
- Streaming annotated video to the dashboard via MJPEG (`/stream/{camera_id}`)
- Proxying structured zone metrics to the AI Agent Service (`/analyze/camera`)
### Key Endpoints
 
| Endpoint | Method | Purpose |
|---|---|---|
| `/cameras` | GET | List all registered cameras and their status |
| `/cameras/register` | POST | Register a new camera stream or local video file |
| `/upload` | POST | Upload a video file (MP4/AVI/MOV) |
| `/api/cv/metrics` | POST | Ingestion endpoint for detection metrics from `detect.py` |
| `/stream/{camera_id}` | GET | MJPEG live video stream |
| `/zones/live` | GET | Aggregated live zone metrics + prediction + AI insights |
| `/dispatches` | POST | Log a field operator dispatch |
 
### Database Schema (SQLite)
 
- **cameras** — id, name, label, stream_url, max_capacity, zone_id, active
- **live_metrics** — camera_id, zone_id, timestamp, person_count, density, trend, rolling_average, growth_rate, speed, stagnation_index
- **alerts** — id, zone_id, zone_name, risk_level, timestamp, message, prediction, explanation, recommendation, confidence
- **dispatches** — id, timestamp, zone, message, zone_id
- **reviews** — id, is_accurate, notes, timestamp
---
 
## Frontend Applications
 
### Authority Dashboard (`dashboard-frontend/`)
Command-center interface for security officers and venue managers.
- **Overview** — global metrics, system status, active alert banner
- **Live Monitoring** — multi-camera grid with live MJPEG streams and risk gauges
- **Alerts** — filterable alert log with AI explanations and response actions
- **Dispatch Center** — unit dispatch form with historical dispatch logs
- **Analytics** — historical density trends and incident review logs
- **Camera Management** — register streams or upload recorded video
### Tourist Portal (`tourist-frontend/`)
Mobile-first public safety interface.
- **Live Heatmap / Zone Map** — color-coded risk levels (Green = Safe, Amber = Moderate, Red = Congested)
- **Safe Route Finder** — recommends less congested gates/pathways
- **Emergency Broadcasts** — public safety notifications from operator dispatches
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Computer Vision | YOLOv8 (Ultralytics), OpenCV, PyTorch |
| Backend | FastAPI, Uvicorn, Pydantic, SQLite |
| AI & Reasoning | Google Gemini (1.5 / 2.0 Flash) |
| Long-Term Memory | Mem0 |
| Frontend | React 18, Vite, Tailwind CSS |
| Languages | Python 3.10+, JavaScript (ES6+) |
| Deployment | Render |
 
---
 
## Project Structure
 
```
CrowdGuardAI/
├─ agents/                  # AI agent microservice (port 8001)
│   ├─ app.py               # FastAPI entry point
│   ├─ agent_chain.py       # Gemini multi-agent chain
│   ├─ memory.py            # Mem0 integration
│   └─ requirements.txt
├─ backend/                 # Core API server (port 8000)
│   ├─ main.py
│   ├─ database.py
│   └─ requirements.txt
├─ cv-detection/            # YOLOv8 computer vision engine
│   ├─ detect.py
│   ├─ requirements.txt
│   └─ yolov8n.pt / yolov8s.pt
├─ dashboard-frontend/      # Authority Dashboard (React + Vite)
├─ tourist-frontend/        # Tourist Portal (React + Vite)
├─ docs/                    # Architecture diagrams, documentation assets
└─ README.md
```
 
---
 
## Setup & Installation
 
### Prerequisites
- Python 3.10+
- Node.js and npm
- Git
### 1. Clone the Repository
 
```bash
git clone <YOUR-REPO-URL>
cd CrowdGuardAI
```
 
### 2. Set Up the Computer Vision Engine
 
```bash
cd cv-detection
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```
 
### 3. Set Up the Backend
 
```bash
cd ../backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
 
### 4. Set Up the AI Agents Service
 
```bash
cd ../agents
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
 
Create a `.env` file inside `agents/` with your API keys:
 
```
GEMINI_API_KEY=your_gemini_api_key_here
MEM0_API_KEY=your_mem0_api_key_here
```
 
> Both keys are optional — the system falls back to deterministic, rule-based logic if either is missing or unavailable, so it still runs without them.
 
### 5. Set Up Both Frontends
 
```bash
cd ../dashboard-frontend
npm install
 
cd ../tourist-frontend
npm install
```
 
### 6. Run Everything Locally
 
Open four separate terminals:
 
```bash
# Terminal 1 — Backend
cd backend && python main.py
 
# Terminal 2 — AI Agents
cd agents && python app.py
 
# Terminal 3 — Authority Dashboard
cd dashboard-frontend && npm run dev
 
# Terminal 4 — Tourist Portal
cd tourist-frontend && npm run dev
```
 
By default:
- Backend runs on `http://localhost:8000`
- AI Agent Service runs on `http://127.0.0.1:8001`
- Dashboard runs on `http://localhost:5173`
- Tourist Portal runs on `http://localhost:5174`

> 💡 **Sample Video Feeds for Testing**: Pre-loaded sample crowd video files (`1.mp4` and `4.mp4`) are included in the `CGAssests/` directory. You can upload these videos directly through the Authority Dashboard camera management UI to test real-time computer vision detection, crowd density tracking, and AI risk alert generation.

### Environment Variables Reference
 
| Variable | Required? | Behavior if Missing |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Falls back to rule-based deterministic prediction |
| `MEM0_API_KEY` | Optional | Memory search degrades gracefully; system still functions |
| `BACKEND_API_URL` | Optional | Defaults to `http://localhost:8000` |
| `AGENT_API_URL` | Optional | Defaults to `http://127.0.0.1:8001` |
 
---
 
## Performance Notes
 
- **Local (GPU):** ~15–30ms per frame, ~30 FPS
- **Local (CPU):** ~70–120ms per frame, ~8–12 FPS
- **Render free tier (CPU-only):** Significantly slower — see the Known Issue notice at the top of this document
**Optimizations already implemented:** downscaled processing frames (640×360), frame-skipping for optical flow, and asynchronous subprocess decoupling to prevent blocking the main API thread.
 
---
 
## Team
 
Built by **Team Catalyst** for Build in AI for India (7-day national AI hackathon).
 
## Future Roadmap
 
- Multi-camera re-identification (ReID) to track individuals across zones
- WebSockets/SSE to replace HTTP polling for true real-time updates
- Native RTSP hardware decoding (NVIDIA DeepStream / TensorRT) for production deployments
- Automated SMS/WhatsApp public alerts via Twilio
- GPU-backed hosting to eliminate the current free-tier performance limitation
---
 
## License
 
Built for the Build in AI for India hackathon. See repository for license details.
 

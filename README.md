# CrowdGuard AI: Real-Time Crowd Safety & Analytics Platform

CrowdGuard AI is an advanced, real-time safety monitoring and risk-prediction system designed for high-density transit environments such as railway stations and transit hubs. By integrating computer vision (YOLOv8) with a multi-agent LLM analysis engine (powered by Google Gemini), CrowdGuard AI monitors transit zones, predicts potential congestion risks, and recommends operational interventions to station managers and passengers.

---

## 🏗️ System Architecture

CrowdGuard AI is split into five primary modules that communicate via lightweight HTTP REST APIs and stream interfaces:

```
                  ┌──────────────────────────────────────────────┐
                  │           Authority Dashboard (React)        │
                  └──────┬────────────────────────────────┬──────┘
                         │                                │
                         ▼ (HTTP API Calls)               ▼ (MJPEG Stream)
  ┌──────────────────────────────────────────────────────────────┐
  │                   Core Backend API (FastAPI)                 │
  │                      [Port: 8000]                            │
  └──────┬───────────────────┬───────────────────┬───────────────┘
         │                   │                   │
         ▼ (Subprocess /     ▼ (HTTP Post)       ▼ (HTTP POST /
            Local Filesystem)   [Port: 8001]        DB Connection)
  ┌──────────────┐   ┌───────────────────┐   ┌───────────────────┐
  │ YOLO Worker  │   │ AI Agent Server   │   │ SQLite/PostgreSQL │
  │ (detect.py)  │   │ (Gemini Chain)    │   │ Database          │
  └──────────────┘   └─────────┬─────────┘   └───────────────────┘
                               │
                               ▼ (Google API)
                     ┌───────────────────┐
                     │ Google Gemini LLM │
                     └───────────────────┘
```

1. **Authority Dashboard (`dashboard-frontend`)**: A React (Vite) application used by transit operators to view live safety feeds, congestion metrics, register cameras, and dispatch response forces.
2. **Tourist Dashboard (`tourist-frontend`)**: A React (Vite) application used by passengers to view live platform safety statuses, rolling passenger counts, and transit safety advisories.
3. **Core Backend (`backend`)**: A FastAPI service that orchestrates camera feeds, processes uploaded videos, calculates deterministic prediction metrics, tracks dispatch events, and manages the database.
4. **AI Agent Server (`agents`)**: A FastAPI microservice coordinating a chain of three LLM agents (Prediction, Recommendation, and Explanation) using the Google Gemini SDK.
5. **Computer Vision Node (`cv-detection`)**: A YOLOv8-based computer vision script launched dynamically as a subprocess for each active camera. It processes frames, tracks passenger count, calculates density/speed, and pushes MJPEG bytes to the Core Backend.

---

## 📁 Repository Structure

```
CrowdGaurdAI/
├── agents/                  # FastAPI Multi-Agent Service (Gemini API)
│   ├── app.py               # Microservice Entry Point (Port 8001)
│   ├── agent_chain.py       # Chain logic for Prediction, Recommendation & Explanation
│   ├── requirements.txt     # Python dependencies for the Agent Server
│   └── .env.example         # Example configuration file for Gemini API Key
├── backend/                 # Core Backend REST API
│   ├── main.py              # Main REST API and Subprocess Orchestration (Port 8000)
│   ├── database.py          # SQLite connection and schema definition
│   ├── crowdguard.db        # SQLite Local Database File (created automatically)
│   └── uploads/             # Directory where uploaded camera streams (videos) are stored
├── cv-detection/            # Computer Vision Node
│   ├── detect.py            # YOLOv8 passenger tracking & speed measurement worker
│   ├── requirements.txt     # CV specific dependencies (OpenCV, Ultralytics, etc.)
│   └── yolov8n.pt           # Pre-trained YOLOv8 Nano model weights
├── dashboard-frontend/      # Authority Web Interface (Vite / React)
│   ├── src/                 # Application codebase (App.jsx, pages, components)
│   ├── package.json         # React NPM configurations
│   └── vite.config.js       # Vite build configurations (Port 5173)
├── tourist-frontend/        # Tourist Passenger Web Interface (Vite / React)
│   ├── src/                 # Passenger dashboard components and routing
│   ├── package.json         # NPM configurations
│   └── vite.config.js       # Vite build configurations (Port 5174)
└── CGAssests/               # Contains sample video feeds for camera registration
```

---

## 🚀 Local Installation & Setup

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.10 or higher)
* A **Google Gemini API Key** (for agent explanations)

### 1. Set Up Python Virtual Environment
From the root directory:
```bash
# Create a virtual environment named "venv"
python -m venv venv

# Activate the virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate
```

### 2. Configure Environment Variables
Inside the `agents/` folder, create a `.env` file containing your Gemini API key:
```env
GEMINI_API_KEY="your-actual-api-key-here"
```
> ⚠️ **Important:** Never commit the `.env` file containing your secret API key. It is included in the project `.gitignore`.

### 3. Run the AI Agent Server
Navigate to the `agents/` directory, install packages, and start the server:
```bash
cd agents
pip install -r requirements.txt
python app.py
```
*The Agent Server will run at `http://localhost:8001`.*

### 4. Run the Core Backend API
Navigate to the `backend/` directory, install the dependencies, and start the FastAPI uvicorn server:
```bash
cd ../backend
# Use the same virtual environment
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```
*The Core Backend will run at `http://localhost:8000`.*

### 5. Start the Authority Dashboard
In a new terminal window, navigate to the `dashboard-frontend/` directory, install dependencies, and launch Vite:
```bash
cd dashboard-frontend
npm install
npm run dev
```
*Access the Authority Dashboard at `http://localhost:5173`.*

### 6. Start the Tourist Dashboard
In another terminal window, navigate to the `tourist-frontend/` directory, install dependencies, and launch Vite:
```bash
cd tourist-frontend
npm install
npm run dev
```
*Access the Tourist Dashboard at `http://localhost:5174`.*

---

## 🐳 Deployment Guide (Production Readiness)

To deploy CrowdGuard AI to cloud hosting services (e.g., Render, Heroku, AWS, or GCP), make the following adjustments to transition from local development:

### 1. Database Migration (PostgreSQL)
SQLite works locally but is ephemeral on containerized hosts. Modify `backend/database.py` to support PostgreSQL:
* Install `psycopg2-binary` or `asyncpg`.
* Use the environment variable `DATABASE_URL` for the database connection string.

### 2. Move YOLO to a Dedicated Worker
Spawning YOLO subprocesses inside a web dyno/service is unstable and lacks GPU performance.
* Run `cv-detection/detect.py` inside a dedicated GPU instance (e.g., AWS EC2 G-type or a Dockerized background worker).
* Replace the local video upload mechanism with external cloud storage (e.g., AWS S3).
* Configure the YOLO worker to read from S3 and send metadata / frame streams to the Backend API via HTTP calls.

### 3. Replace Hardcoded `localhost` in Frontends
Both frontend applications call API endpoints at `http://localhost:8000` by default.
* Replace the hardcoded base URLs in `dashboard-frontend/src/App.jsx` and `tourist-frontend/src/App.jsx` with Vite environment variables:
  ```javascript
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  ```
* Set `VITE_API_BASE_URL` to your production backend URL during your frontend build process.

---

## 🔒 Security & Best Practices
* **API Key Safety:** Always verify that `.env` is listed in your `.gitignore` to prevent leaking API keys to public repositories.
* **CORS Policy:** Restrict CORS allowed origins in `backend/main.py` and `agents/app.py` to your custom domains in production.

# CrowdGuardAI - Computer Vision Detection Node

This directory contains the Computer Vision (CV) detection component for **CrowdGuardAI**, a real-time CCTV crowd density and crush prevention system.

The CV system processes video files (or camera feeds), runs person detection, tracks counts and densities across multiple zones, calculates crowd trends, and writes structured JSON outputs to be consumed by upstream AI agents and dashboards.

---

## Features

- **Object Detection**: Leverages YOLOv8-nano (`yolov8n.pt`) optimized for person tracking.
- **Zone Counting & Density**: Supports rectangle boundary zones (`gate4`, `courtyard`, `mainpath`) with calculations of person density.
- **Rolling Trend Analysis**: Uses a 20-frame queue to determine if density is `"rising"`, `"falling"`, or `"stable"` (with a noise deadband to avoid flickering).
- **Safe Concurrent Writing**: Updates `cv_output.json` atomically using a temporary file rename pattern to prevent read-write race conditions.
- **Exposed Local API**: Hosts a daemon FastAPI server offering a GET endpoint at `/status` to return the current detection state.
- **Continuous Execution**: Supports automatic video looping for continuous demo presentations.
- **Validation Snaps**: Regularly writes annotated frames to `sample_frames/` to verify coordinates and detection accuracy.

---

## Installation & Setup

1. **Create and Activate Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Check GPU Availability**:
   The script automatically leverages an NVIDIA GPU if CUDA is configured. Run the following check:
   ```bash
   python -c "import torch; print('CUDA Available:', torch.cuda.is_available())"
   ```

---

## How to Run

### 1. Default Mode (Both File & API)
Runs the detection loop, updates `cv_output.json` continuously, and starts a local FastAPI server:
```bash
python detect.py
```
- **Local API Endpoint**: [http://127.0.0.1:8000/status](http://127.0.0.1:8000/status)
- **JSON File Output**: `cv-detection/cv_output.json`

### 2. Standalone Test Mode (Stdout Verification)
To test the pipeline without any downstream services running and view live JSON payloads directly in your terminal:
```bash
python detect.py --test-mode
```

### 3. File-Only Mode
If you do not want to run the background web server and only want to update the JSON file:
```bash
python detect.py --mode file
```

### 4. API-Only Mode
If you only want to serve the data over the API and not write the JSON file to disk:
```bash
python detect.py --mode api
```

### 5. Options and Arguments
Custom parameters can be provided at startup:
```bash
python detect.py --video path/to/video.mp4 --camera-id cam2 --port 8080 --no-loop
```
- `--video`: Path to input video file (defaults to `../shared-assets/demo_video_1.mp4`).
- `--camera-id`: Camera ID reported in the JSON contract (defaults to `cam1`).
- `--port`: Local API port (defaults to `8000`).
- `--no-loop`: Disable looping of video when it reaches the end.
- `--write-interval`: Frequency of JSON updates in seconds (defaults to `1.0` seconds).
- `--density-multiplier`: Density scaling multiplier (defaults to `10000.0` to convert tiny pixel decimals into readable density metrics).

---

## Swapping Zone Coordinates

Zone coordinates are located in `detect.py` under the `ZONE_CONFIGS` dictionary near the top of the file:

```python
ZONE_CONFIGS = {
    "gate4": {
        "name": "Gate 4 Entrance",
        "rect": [10, 10, 250, 420],      # [x_min, y_min, x_max, y_max]
        "color": (255, 0, 0),             # BGR Color - Blue
    },
    ...
}
```

### How to adjust coordinates:
1. Open `cv-detection/detect.py`.
2. Locate the `ZONE_CONFIGS` dictionary.
3. Replace the `rect` list (`[x_min, y_min, x_max, y_max]`) with your custom pixel coordinates.
4. Set a custom color (in `(B, G, R)` format) to change the bounding box preview colors.
5. The system automatically recalculates the pixel area and updates downstream counts for the new boundaries.

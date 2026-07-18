import cv2
import json
import os
import sys
import time
import datetime
import argparse
import threading
import numpy as np
import math
from collections import deque
from ultralytics import YOLO

# ==============================================================================
# WRAPPER CLASSES FOR CUSTOM MERGED DETECTIONS
# ==============================================================================
class WrapperTensor:
    def __init__(self, val):
        self.val = val
    def cpu(self):
        return self
    def numpy(self):
        return self.val
    def item(self):
        return self.val

class BoxWrapper:
    def __init__(self, xyxy, track_id, conf):
        self._xyxy = xyxy
        self._id = track_id
        self._conf = conf
    
    @property
    def xyxy(self):
        return [WrapperTensor(self._xyxy)]
        
    @property
    def id(self):
        return [WrapperTensor(self._id)] if self._id is not None else None
        
    @property
    def conf(self):
        return [WrapperTensor(self._conf)] if self._conf is not None else None

# ==============================================================================
# CONFIGURATION & ZONE COORDINATES
# ==============================================================================
# Swap in your real coordinates here if zone shapes change.
# Rectangles are structured as [x1, y1, x2, y2] in pixel coordinates.
# Zone IDs must match exactly what Person B and Person C expect.
ZONE_CONFIGS = {
    "gate4": {
        "name": "Platform 1",
        "rect": [2550, 0, 3750, 2160],      # Swapped to right side (where the crowd converges) & full Y height
        "color": (255, 0, 0),             # BGR Color - Blue
    },
    "courtyard": {
        "name": "Platform 2",
        "rect": [1250, 0, 2500, 2160],     # Middle flow area & full Y height
        "color": (0, 255, 0),             # BGR Color - Green
    },
    "mainpath": {
        "name": "Main Path",
        "rect": [50, 0, 1200, 2160],       # Swapped to left side & full Y height
        "color": (0, 0, 255),             # BGR Color - Red
    }
}

MAX_CAPACITIES = {
    "gate4": 15,       # Max safe capacity for Platform 1 (triggers alert on train crowd)
    "courtyard": 120,  # Max safe capacity for Platform 2 (safe sitting area)
    "mainpath": 15
}

# General configuration constants
DEFAULT_CAMERA_ID = "cam1"
DEFAULT_WRITE_INTERVAL_SEC = 1.0     # Write output JSON every 1 second
DEFAULT_DENSITY_MULTIPLIER = 10000.0  # Scales raw pixel density to user-friendly range
HISTORY_WINDOW_SIZE = 20             # Size of rolling frame history for trend calculations
TREND_DEADBAND_THRESHOLD = 0.5       # Difference threshold to trigger trend state change

# ==============================================================================
# GLOBAL STATE & THREADING FOR FASTAPI
# ==============================================================================
latest_payload = {}
payload_lock = threading.Lock()

# Define FastAPI application
try:
    from fastapi import FastAPI
    app = FastAPI(title="CrowdGuardAI - CV Detection Node API")
except ImportError:
    app = None

@app.get("/status")
def get_status():
    """Exposes the latest crowd monitoring JSON to downstream consumers."""
    with payload_lock:
        return latest_payload

def start_api_server(host: str, port: int):
    """Starts the uvicorn server in a background thread."""
    try:
        import uvicorn
        print(f"[CV-Detection] Starting local API server at http://{host}:{port}/status")
        uvicorn.run(app, host=host, port=port, log_level="warning")
    except Exception as e:
        print(f"[CV-Detection] WARNING: Could not start API server: {e}")

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================
def is_inside_rect(point, rect):
    """Checks if a 2D point (x, y) is inside the bounding box rectangle [x1, y1, x2, y2]."""
    px, py = point
    rx1, ry1, rx2, ry2 = rect
    return (rx1 <= px <= rx2) and (ry1 <= py <= ry2)

def calculate_trend(history, deadband=TREND_DEADBAND_THRESHOLD):
    """
    Analyzes rolling history of counts to determine trend.
    Compares the average of the older half to the average of the newer half.
    """
    if len(history) < 10:
        return "stable"
    
    mid = len(history) // 2
    earlier = list(history)[:mid]
    recent = list(history)[mid:]
    
    avg_earlier = sum(earlier) / len(earlier)
    avg_recent = sum(recent) / len(recent)
    
    diff = avg_recent - avg_earlier
    
    if diff > deadband:
        return "rising"
    elif diff < -deadband:
        return "falling"
    else:
        return "stable"

def write_json_atomic(data, target_path):
    """Writes the data to a temp file and atomically renames it to prevent race conditions."""
    tmp_path = target_path + ".tmp"
    try:
        # Ensure target directory exists
        os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
        with open(tmp_path, 'w') as f:
            json.dump(data, f, indent=2)
        # Atomic replacement
        os.replace(tmp_path, target_path)
    except Exception as e:
        print(f"[CV-Detection] ERROR: Failed to write JSON output: {e}")
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass

# ==============================================================================
# CORE PIPELINE RUNNER
# ==============================================================================
def run_pipeline(video_path, output_json_path, camera_id, loop_video, sample_interval, 
                 write_interval, density_multiplier, output_mode, host, port, test_mode,
                 output_video_path=None, max_frames=None, target_zone_id=None,
                 model_name="yolov8n.pt", conf=0.12, inference_w=1920, inference_h=1080,
                 backend_url="http://127.0.0.1:8000"):
    global latest_payload
    import sqlite3
    import math
    import requests
    import numpy as np
    
    # 1. Device check
    device = "cpu"
    try:
        import torch
        if torch.cuda.is_available():
            device = "0"
            print("[CV-Detection] NVIDIA GPU detected. Running YOLOv8 on CUDA device '0'.")
        else:
            print("[CV-Detection] WARNING: CUDA GPU is not available. Running on CPU.")
    except ImportError:
        print("[CV-Detection] WARNING: PyTorch is not imported. Defaulting to CPU.")

    # 2. Load model
    print(f"[CV-Detection] Loading YOLOv8 model ({model_name})...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, model_name)
    if not os.path.exists(model_path):
        # Fall back to checking parent folder
        parent_path = os.path.join(script_dir, "..", model_name)
        if os.path.exists(parent_path):
            model_path = parent_path
            print(f"[CV-Detection] Found YOLO model in parent folder: {model_path}")
        else:
            print(f"[CV-Detection] Local {model_name} not found. Will download automatically.")
            model_path = model_name

    # Workaround: PyTorch fails to load paths containing single quotes on Windows
    if "'" in model_path or '"' in model_path:
        import shutil
        user_home = os.path.expanduser("~")
        safe_model_path = os.path.join(user_home, model_name)
        print(f"[CV-Detection] Path contains quotes. Copying model to safe path: {safe_model_path}")
        try:
            if not os.path.exists(safe_model_path) or os.path.getsize(safe_model_path) != os.path.getsize(model_path):
                shutil.copy(model_path, safe_model_path)
            model_path = safe_model_path
        except Exception as copy_err:
            print(f"[CV-Detection] WARNING: Could not copy model to safe path: {copy_err}")

    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"[CV-Detection] CRITICAL: Failed to load YOLOv8 model: {e}")
        sys.exit(1)

    # 3. Open Video
    print(f"[CV-Detection] Opening video source: {video_path}")
    if not os.path.exists(video_path):
        print(f"[CV-Detection] CRITICAL: Video file does not exist at '{video_path}'")
        sys.exit(1)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[CV-Detection] CRITICAL: OpenCV could not open video file '{video_path}'")
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    print(f"[CV-Detection] Video details: {width}x{height} @ {fps:.1f} FPS")

    # Profile device inference speed to determine adaptive frame skip
    print("[CV-Detection] Profiling device inference speed...")
    profile_runs = 5
    latencies = []
    dummy_frame = np.zeros((inference_h, inference_w, 3), dtype=np.uint8)
    for _ in range(profile_runs):
        t0 = time.time()
        _ = model.predict(dummy_frame, device=device, classes=[0], verbose=False)
        latencies.append(time.time() - t0)
    avg_latency = sum(latencies) / len(latencies)
    print(f"[CV-Detection] Average inference latency: {avg_latency*1000:.1f}ms")

    frame_duration = 1.0 / fps
    if avg_latency > frame_duration:
        skip_factor = int(math.ceil(avg_latency / frame_duration))
        print(f"[CV-Detection] Hardware latency exceeds frame duration. Enabling adaptive skip (factor: {skip_factor})")
    else:
        skip_factor = 1
        print("[CV-Detection] Performance optimal. Running frame-by-frame.")

    # Initialize Keep-Alive HTTP session for frame post streaming
    import urllib.parse
    http_session = requests.Session()
    safe_camera_id = urllib.parse.quote(camera_id)
    frame_post_url = f"{backend_url.rstrip('/')}/api/cameras/{safe_camera_id}/frame"

    # Initialize VideoWriter if output_video_path is provided
    writer = None
    if output_video_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_video_path)), exist_ok=True)
        if os.path.exists(output_video_path):
            try:
                os.remove(output_video_path)
            except:
                pass
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        writer = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
        if not writer.isOpened():
            writer.release()
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
        if writer.isOpened():
            print(f"[CV-Detection] Processed video writer opened. Saving to: {output_video_path}")
        else:
            print(f"[CV-Detection] ERROR: Could not open VideoWriter for: {output_video_path}")
            writer = None

    # Ensure sample frames folder exists
    sample_frames_dir = os.path.join(script_dir, "sample_frames")
    os.makedirs(sample_frames_dir, exist_ok=True)

    # Calculate zone areas (width * height of rectangle)
    zone_areas = {}
    for zone_id, zconfig in ZONE_CONFIGS.items():
        rx1, ry1, rx2, ry2 = zconfig["rect"]
        zone_areas[zone_id] = float((rx2 - rx1) * (ry2 - ry1))

    # Initialize rolling histories
    zone_histories = {zone_id: deque(maxlen=HISTORY_WINDOW_SIZE) for zone_id in ZONE_CONFIGS}
    sustained_congestion_seconds = {zone_id: 0.0 for zone_id in ZONE_CONFIGS}

    if target_zone_id and target_zone_id not in ZONE_CONFIGS:
        zone_areas[target_zone_id] = float(width * height)
        zone_histories[target_zone_id] = deque(maxlen=HISTORY_WINDOW_SIZE)
        sustained_congestion_seconds[target_zone_id] = 0.0

    # Tracking coordinates & durations
    track_positions = {}
    track_durations = {}

    # Initialize timing
    last_json_write_time = 0.0
    frame_count = 0

    # Start API server if requested
    if output_mode in ["api", "both"] and app is not None:
        api_thread = threading.Thread(target=start_api_server, args=(host, port), daemon=True)
        api_thread.start()

    # SQLite DB path resolution
    db_path = os.path.abspath(os.path.join(script_dir, "..", "backend", "crowdguard.db"))

    # Load camera capacity from SQLite DB dynamically
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT zone_id, max_capacity FROM cameras WHERE id = ?", (camera_id,))
        row = cursor.fetchone()
        if row:
            db_zone_id, db_capacity = row[0], int(row[1])
            MAX_CAPACITIES[db_zone_id] = db_capacity
            print(f"[CV-Detection] Loaded max_capacity={db_capacity} for zone '{db_zone_id}' from DB for camera '{camera_id}'")
        else:
            print(f"[CV-Detection] WARNING: Camera '{camera_id}' not found in SQLite database. Using default fallback capacity.")
    except Exception as e:
        print(f"[CV-Detection] WARNING: Could not query SQLite database for capacity: {e}. Using default fallback capacity.")
    finally:
        if conn:
            conn.close()

    print("[CV-Detection] Entering processing loop. Press Ctrl+C to terminate.")

    last_boxes = []
    
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            
            if not ret:
                if loop_video and (max_frames is None or frame_count < max_frames):
                    print("[CV-Detection] Video reached end. Looping back to frame 0...")
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    print("[CV-Detection] Video completed or limit reached. Exiting loop...")
                    break

            frame_count += 1
            if max_frames is not None and frame_count > max_frames:
                print(f"[CV-Detection] Reached max frames limit ({max_frames}). Exiting loop...")
                break

            # Adaptive skip logic: execute YOLO inference only on every skip_factor frame
            run_inference = (frame_count % skip_factor == 0) or (frame_count == 1)

            if run_inference:
                small_frame = cv2.resize(frame, (inference_w, inference_h))
                
                # Step A: Run standard tracking on full frame
                results = model.track(small_frame, persist=True, device=device, classes=[0], conf=conf, iou=0.50, verbose=False)
                tracked_boxes = results[0].boxes if results and len(results) > 0 else []
                
                final_boxes_list = []
                used_tracks = set()
                
                for box in tracked_boxes:
                    xyxy = box.xyxy[0].cpu().numpy()
                    track_id = int(box.id[0].item()) if (box.id is not None and len(box.id) > 0) else None
                    b_conf = float(box.conf[0].item()) if (box.conf is not None and len(box.conf) > 0) else conf
                    final_boxes_list.append({
                        "xyxy": xyxy,
                        "id": track_id,
                        "conf": b_conf
                    })
                    if track_id is not None:
                        used_tracks.add(track_id)
                
                # Step B: SAHI Tiled Inference for dense crowds (or custom uploaded cameras where recall is critical)
                # Run if we detect some initial crowd density (e.g. >= 2 tracked people) or if target_zone_id is active.
                if len(tracked_boxes) >= 2 or target_zone_id is not None:
                    # Tiling top half of 1080p frame (vanishing point where perspective compression is high)
                    tile_coords = [
                        (0, 0, 960, 540),
                        (960, 0, 1920, 540),
                        (480, 0, 1440, 540)
                    ]
                    
                    tile_detections = []
                    for tx1, ty1, tx2, ty2 in tile_coords:
                        tile_crop = small_frame[ty1:ty2, tx1:tx2]
                        # Resize crop to standard 640x640 input resolution for high-detail YOLO inference
                        tile_crop_resized = cv2.resize(tile_crop, (640, 640))
                        
                        # Run predict (fast inference pass) on the tile
                        tile_res = model.predict(tile_crop_resized, device=device, classes=[0], conf=conf, iou=0.50, verbose=False)
                        tile_boxes = tile_res[0].boxes if tile_res and len(tile_res) > 0 else []
                        
                        scale_x = (tx2 - tx1) / 640.0
                        scale_y = (ty2 - ty1) / 640.0
                        
                        for t_box in tile_boxes:
                            t_xyxy = t_box.xyxy[0].cpu().numpy()
                            # Project coordinates back to small_frame (1920x1080) space
                            gx1 = int(t_xyxy[0] * scale_x) + tx1
                            gy1 = int(t_xyxy[1] * scale_y) + ty1
                            gx2 = int(t_xyxy[2] * scale_x) + tx1
                            gy2 = int(t_xyxy[3] * scale_y) + ty1
                            
                            t_conf = float(t_box.conf[0].item()) if (t_box.conf is not None and len(t_box.conf) > 0) else conf
                            tile_detections.append((gx1, gy1, gx2, gy2, t_conf))
                    
                    # Merge tile detections into final_boxes_list using IoU overlap check
                    next_pseudo_id = max(used_tracks) + 1 if used_tracks else 1000
                    
                    for tx1, ty1, tx2, ty2, t_conf in tile_detections:
                        duplicate = False
                        for existing in final_boxes_list:
                            ex1, ey1, ex2, ey2 = existing["xyxy"]
                            # Calculate IoU overlap
                            xA = max(tx1, ex1)
                            yA = max(ty1, ey1)
                            xB = min(tx2, ex2)
                            yB = min(ty2, ey2)
                            
                            interArea = max(0, xB - xA) * max(0, yB - yA)
                            boxAArea = (tx2 - tx1) * (ty2 - ty1)
                            boxBArea = (ex2 - ex1) * (ey2 - ey1)
                            
                            iou = interArea / float(boxAArea + boxBArea - interArea) if (boxAArea + boxBArea - interArea) > 0 else 0
                            if iou > 0.40:
                                duplicate = True
                                break
                        
                        if not duplicate:
                            final_boxes_list.append({
                                "xyxy": np.array([tx1, ty1, tx2, ty2]),
                                "id": next_pseudo_id,
                                "conf": t_conf
                            })
                            next_pseudo_id += 1
                
                # Wrap merged boxes in BoxWrapper to keep them 100% compatible
                last_boxes = [BoxWrapper(b["xyxy"], b["id"], b["conf"]) for b in final_boxes_list]
                boxes = last_boxes
            else:
                boxes = last_boxes

            # Reset counts for this frame
            current_counts = {zone_id: 0 for zone_id in ZONE_CONFIGS}
            zone_speeds = {zone_id: [] for zone_id in ZONE_CONFIGS}
            if target_zone_id and target_zone_id not in current_counts:
                current_counts[target_zone_id] = 0
                zone_speeds[target_zone_id] = []
            
            # Confidence statistics
            active_tracks = []
            avg_conf_sum = 0.0
            conf_count = 0

            # 4. Check detections & center points
            for box in boxes:
                xyxy = box.xyxy[0].cpu().numpy()
                x1_small, y1_small, x2_small, y2_small = map(int, xyxy)
                
                scale_x = width / inference_w
                scale_y = height / inference_h
                x1 = int(x1_small * scale_x)
                y1 = int(y1_small * scale_y)
                x2 = int(x2_small * scale_x)
                y2 = int(y2_small * scale_y)
                
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
                
                # Fetch confidence
                b_conf = float(box.conf[0].item()) if (box.conf is not None and len(box.conf) > 0) else 1.0
                avg_conf_sum += b_conf
                conf_count += 1
                
                assigned_zone = None
                if target_zone_id:
                    current_counts[target_zone_id] += 1
                    assigned_zone = target_zone_id
                else:
                    for zone_id, zconfig in ZONE_CONFIGS.items():
                        if is_inside_rect((cx, cy), zconfig["rect"]):
                            current_counts[zone_id] += 1
                            assigned_zone = zone_id
                            break
                
                track_id = int(box.id[0].item()) if (box.id is not None and len(box.id) > 0) else None
                if track_id is not None:
                    active_tracks.append(track_id)
                    if run_inference:
                        track_durations[track_id] = track_durations.get(track_id, 0) + 1
                    
                    if assigned_zone:
                        if track_id not in track_positions:
                            track_positions[track_id] = deque(maxlen=5)
                        track_positions[track_id].append((cx, cy))
                        
                        if len(track_positions[track_id]) >= 2:
                            p_prev = track_positions[track_id][-2]
                            p_curr = track_positions[track_id][-1]
                            dist = math.sqrt((p_curr[0] - p_prev[0])**2 + (p_curr[1] - p_prev[1])**2)
                            zone_speeds[assigned_zone].append(dist)

                box_color = ZONE_CONFIGS[assigned_zone]["color"] if (assigned_zone and assigned_zone in ZONE_CONFIGS) else (0, 165, 255)
                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                cv2.circle(frame, (cx, cy), 4, (0, 255, 255), -1)
                
                if track_id is not None:
                    cv2.putText(frame, f"ID: {track_id}", (x1, y1 - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, box_color, 1)

            # Draw zone boundaries & statistics overlay on the frame
            for zone_id, zconfig in ZONE_CONFIGS.items():
                if target_zone_id and zone_id != target_zone_id:
                    continue
                rx1, ry1, rx2, ry2 = zconfig["rect"]
                color = zconfig["color"]
                count = current_counts[zone_id]
                cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), color, 2)
                cv2.putText(frame, zconfig["name"], (rx1 + 5, ry1 + 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                cv2.putText(frame, f"Count: {count}", (rx1 + 5, ry1 + 45),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

            if target_zone_id and target_zone_id not in ZONE_CONFIGS:
                color = (0, 165, 255)
                count = current_counts[target_zone_id]
                cv2.putText(frame, f"Zone: {target_zone_id}", (30, 40),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                cv2.putText(frame, f"Count: {count}", (30, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

            # Write frame to output video if active
            if writer is not None:
                writer.write(frame)

            # Post streaming frame (annotated JPEG bytes) to Backend frame receiver
            try:
                _, jpeg_buf = cv2.imencode('.jpg', frame)
                http_session.post(frame_post_url, data=jpeg_buf.tobytes(), timeout=0.5)
            except Exception as post_err:
                pass

            # 5. Save histories & compute trends
            for zone_id, count in current_counts.items():
                zone_histories[zone_id].append(count)

            # 6. Formulate data contract JSON and Write SQLite DB
            current_time = time.time()
            if current_time - last_json_write_time >= write_interval:
                # Calculate tracking metrics
                stable_tracks = sum(1 for tid in active_tracks if track_durations.get(tid, 0) >= 5)
                tracking_stability = round(stable_tracks / len(active_tracks), 2) if len(active_tracks) > 0 else 1.0
                average_detection_conf = round(avg_conf_sum / conf_count, 2) if conf_count > 0 else 1.0

                zones_payload = []
                # If target_zone_id is specified, compile metrics only for that zone. Otherwise, compile for all default config zones.
                target_zones = [target_zone_id] if target_zone_id else list(ZONE_CONFIGS.keys())
                for zone_id in target_zones:
                    count = current_counts[zone_id]
                    max_cap = MAX_CAPACITIES.get(zone_id, 10.0)
                    density = round((count / max_cap) * 5.0, 2)
                    trend = calculate_trend(zone_histories[zone_id])
                    
                    rolling_avg = round(sum(zone_histories[zone_id]) / len(zone_histories[zone_id]), 2) if len(zone_histories[zone_id]) > 0 else 0.0
                    
                    if len(zone_histories[zone_id]) >= 10:
                        count_current = zone_histories[zone_id][-1]
                        count_old = zone_histories[zone_id][0]
                        time_diff = len(zone_histories[zone_id]) / fps
                        growth_rate = round((count_current - count_old) / time_diff, 2)
                    else:
                        growth_rate = 0.0

                    if count >= max_cap:
                        sustained_congestion_seconds[zone_id] += write_interval
                    else:
                        sustained_congestion_seconds[zone_id] = 0.0

                    speeds = zone_speeds[zone_id]
                    if speeds:
                        avg_speed_px_frame = sum(speeds) / len(speeds)
                        speed_val = round(avg_speed_px_frame * fps, 2)
                        stagnation_index = 1.0 if (speed_val < 30.0 and density >= 2.2) else 0.0
                    else:
                        speed_val = -1.0
                        stagnation_index = -1.0
                    
                    zones_payload.append({
                        "zone_id": zone_id,
                        "person_count": count,
                        "density": density,
                        "trend": trend,
                        "rolling_average": rolling_avg,
                        "growth_rate": growth_rate,
                        "sustained_congestion_sec": round(sustained_congestion_seconds[zone_id], 1),
                        "speed": speed_val,
                        "stagnation_index": stagnation_index
                    })
                
                payload = {
                    "camera_id": camera_id,
                    "timestamp": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                    "zones": zones_payload
                }

                with payload_lock:
                    latest_payload = payload

                if output_mode in ["file", "both"]:
                    write_json_atomic(payload, output_json_path)

                conn = None
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    for zone in zones_payload:
                        cursor.execute("""
                            INSERT INTO live_metrics (camera_id, timestamp, zone_id, person_count, density, trend, rolling_average, 
                                                     growth_rate, sustained_congestion_sec, speed, stagnation_index, 
                                                     average_detection_conf, tracking_stability)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(camera_id, zone_id) DO UPDATE SET
                                timestamp=excluded.timestamp,
                                person_count=excluded.person_count,
                                density=excluded.density,
                                trend=excluded.trend,
                                rolling_average=excluded.rolling_average,
                                growth_rate=excluded.growth_rate,
                                sustained_congestion_sec=excluded.sustained_congestion_sec,
                                speed=excluded.speed,
                                stagnation_index=excluded.stagnation_index,
                                average_detection_conf=excluded.average_detection_conf,
                                tracking_stability=excluded.tracking_stability
                        """, (
                            camera_id,
                            payload["timestamp"],
                            zone["zone_id"],
                            zone["person_count"],
                            zone["density"],
                            zone["trend"],
                            zone["rolling_average"],
                            zone["growth_rate"],
                            zone["sustained_congestion_sec"],
                            zone["speed"],
                            zone["stagnation_index"],
                            average_detection_conf,
                            tracking_stability
                        ))
                    conn.commit()
                except Exception as db_err:
                    print(f"[CV-Detection] DB UPDATE ERROR: {db_err}")
                finally:
                    if conn:
                        conn.close()

                if test_mode:
                    print(f"\n[TEST MODE] Live JSON Payload: {json.dumps(payload, indent=2)}")
                else:
                    counts_str = ", ".join([f"{z['zone_id']}: {z['person_count']} (avg: {z['rolling_average']}, speed: {z['speed']})" for z in zones_payload])
                    print(f"[CV-Detection] Frame: {frame_count} | {counts_str}")

                last_json_write_time = current_time

            # 7. Periodically save annotated sample frame
            if frame_count % sample_interval == 0:
                sample_filename = os.path.join(sample_frames_dir, f"frame_{(frame_count % 300)}.jpg")
                cv2.imwrite(sample_filename, frame)
                if not test_mode:
                    print(f"[CV-Detection] Saved sample validation frame to: {sample_filename}")

    except KeyboardInterrupt:
        print("\n[CV-Detection] Keyboard interrupt received. Exiting...")
    except Exception as e:
        print(f"\n[CV-Detection] CRITICAL Error in processing loop: {e}")
    finally:
        cap.release()
        if writer is not None:
            writer.release()
            print("[CV-Detection] Processed video writer released successfully.")
        cv2.destroyAllWindows()
        print("[CV-Detection] Resources released. Shutdown complete.")

# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CrowdGuardAI - CV Detection pipeline")
    parser.add_argument("--video", type=str, default="", help="Path to input video file")
    parser.add_argument("--output-json", type=str, default="", help="Path to write JSON output")
    parser.add_argument("--output-video", type=str, default="", help="Path to save processed output video")
    parser.add_argument("--max-frames", type=int, default=None, help="Stop processing after this many frames")
    parser.add_argument("--zone-id", type=str, default=None, help="If specified, count all people in frame for this zone")
    parser.add_argument("--camera-id", type=str, default=DEFAULT_CAMERA_ID, help="Camera ID to report")
    parser.add_argument("--loop", action="store_true", default=True, help="Loop video back to start when finished")
    parser.add_argument("--no-loop", action="store_false", dest="loop", help="Do not loop video")
    parser.add_argument("--sample-interval", type=int, default=30, help="Interval in frames to save verification snapshots")
    parser.add_argument("--write-interval", type=float, default=DEFAULT_WRITE_INTERVAL_SEC, help="JSON write interval in seconds")
    parser.add_argument("--density-multiplier", type=float, default=DEFAULT_DENSITY_MULTIPLIER, help="Scale factor for density values")
    
    # Model configuration options
    parser.add_argument("--model-name", type=str, default="yolov8s.pt", help="YOLOv8 model size (yolov8n.pt, yolov8s.pt, etc.)")
    parser.add_argument("--conf", type=float, default=0.05, help="Detection confidence threshold (0.05 - 0.18 recommended)")
    parser.add_argument("--inference-w", type=int, default=1920, help="Inference image resize width")
    parser.add_argument("--inference-h", type=int, default=1080, help="Inference image resize height")

    # Mode configurations
    parser.add_argument("--mode", type=str, choices=["file", "api", "both"], default="both",
                        help="Output mode: 'file' updates JSON file, 'api' hosts a local endpoint, 'both' does both")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="API server host")
    parser.add_argument("--port", type=int, default=8000, help="API server port")
    parser.add_argument("--backend-url", type=str, default="http://127.0.0.1:8000", help="FastAPI backend base URL for frame streaming")
    
    # Test modes
    parser.add_argument("--test-mode", action="store_true", help="Run in test/debug mode, printing JSON output to console")
    
    args = parser.parse_args()

    # Resolve paths relative to script directory by default
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    video_file = args.video
    if not video_file:
        video_file = os.path.abspath(os.path.join(script_dir, "..", "shared-assets", "demo_video_1.mp4"))
        
    output_json = args.output_json
    if not output_json:
        output_json = os.path.join(script_dir, "cv_output.json")

    print("======================================================================")
    print("CrowdGuardAI - Computer Vision Detection Node")
    print(f"Active Camera ID   : {args.camera_id}")
    print(f"Video Input Source : {video_file}")
    print(f"Output Mode        : {args.mode}")
    print(f"YOLO Model Size    : {args.model_name}")
    print(f"Confidence Level   : {args.conf}")
    print(f"Inference Size     : {args.inference_w}x{args.inference_h}")
    if args.mode in ["file", "both"]:
        print(f"Output JSON Path   : {output_json}")
    if args.output_video:
        print(f"Output Video Path  : {args.output_video}")
    if args.max_frames:
        print(f"Max Frames Limit   : {args.max_frames}")
    if args.mode in ["api", "both"]:
        print(f"API Endpoint       : http://{args.host}:{args.port}/status")
    print(f"Video Looping      : {args.loop}")
    print("======================================================================")

    run_pipeline(
        video_path=video_file,
        output_json_path=output_json,
        camera_id=args.camera_id,
        loop_video=args.loop,
        sample_interval=args.sample_interval,
        write_interval=args.write_interval,
        density_multiplier=args.density_multiplier,
        output_mode=args.mode,
        host=args.host,
        port=args.port,
        test_mode=args.test_mode,
        output_video_path=args.output_video,
        max_frames=args.max_frames,
        target_zone_id=args.zone_id,
        model_name=args.model_name,
        conf=args.conf,
        inference_w=args.inference_w,
        inference_h=args.inference_h,
        backend_url=args.backend_url
    )


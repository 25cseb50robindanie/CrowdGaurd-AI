import cv2
import json
import os
import sys
import time
import datetime
import argparse
import threading
from collections import deque
from ultralytics import YOLO

# ==============================================================================
# CONFIGURATION & ZONE COORDINATES
# ==============================================================================
# Swap in your real coordinates here if zone shapes change.
# Rectangles are structured as [x1, y1, x2, y2] in pixel coordinates.
# Zone IDs must match exactly what Person B and Person C expect.
ZONE_CONFIGS = {
    "gate4": {
        "name": "Gate 4 Entrance",
        "rect": [50, 300, 1200, 1950],      # [x_min, y_min, x_max, y_max] (Left flow area)
        "color": (255, 0, 0),             # BGR Color - Blue
    },
    "courtyard": {
        "name": "Main Courtyard",
        "rect": [1250, 300, 2500, 1950],     # [x_min, y_min, x_max, y_max] (Middle flow area)
        "color": (0, 255, 0),             # BGR Color - Green
    },
    "mainpath": {
        "name": "Main Path",
        "rect": [2550, 300, 3750, 1950],     # [x_min, y_min, x_max, y_max] (Right flow area)
        "color": (0, 0, 255),             # BGR Color - Red
    }
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
                 write_interval, density_multiplier, output_mode, host, port, test_mode):
    global latest_payload
    
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
    print("[CV-Detection] Loading YOLOv8 nano model...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, "yolov8n.pt")
    if not os.path.exists(model_path):
        # Fall back to checking parent folder
        parent_path = os.path.join(script_dir, "..", "yolov8n.pt")
        if os.path.exists(parent_path):
            model_path = parent_path
            print(f"[CV-Detection] Found YOLO model in parent folder: {model_path}")
        else:
            print("[CV-Detection] Local yolov8n.pt not found. Will download automatically.")
            model_path = "yolov8n.pt"

    # Workaround: PyTorch fails to load paths containing single quotes on Windows
    if "'" in model_path or '"' in model_path:
        import shutil
        user_home = os.path.expanduser("~")
        safe_model_path = os.path.join(user_home, "yolov8n.pt")
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

    # Initialize timing
    last_json_write_time = 0.0
    frame_count = 0

    # Start API server if requested
    if output_mode in ["api", "both"] and app is not None:
        api_thread = threading.Thread(target=start_api_server, args=(host, port), daemon=True)
        api_thread.start()

    print("[CV-Detection] Entering processing loop. Press Ctrl+C to terminate.")

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            
            # Handle video end/loops
            if not ret:
                if loop_video:
                    print("[CV-Detection] Video reached end. Looping back to frame 0...")
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    print("[CV-Detection] Video completed. Exiting processing loop...")
                    break

            frame_count += 1
            
            # Run YOLOv8 on frame, class 0 (person)
            results = model.predict(frame, device=device, classes=[0], verbose=False)
            boxes = results[0].boxes if results and len(results) > 0 else []

            # Reset counts for this frame
            current_counts = {zone_id: 0 for zone_id in ZONE_CONFIGS}
            person_centers = []

            # 4. Check detections & center points
            for box in boxes:
                xyxy = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, xyxy)
                
                # Person center point
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
                person_centers.append((cx, cy))
                
                # Check which zone it falls in
                assigned_zone = None
                for zone_id, zconfig in ZONE_CONFIGS.items():
                    if is_inside_rect((cx, cy), zconfig["rect"]):
                        current_counts[zone_id] += 1
                        assigned_zone = zone_id
                        break
                
                # Draw bounding box on frame
                box_color = ZONE_CONFIGS[assigned_zone]["color"] if assigned_zone else (128, 128, 128)
                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                # Draw center point
                cv2.circle(frame, (cx, cy), 4, (0, 255, 255), -1)

            # Draw zone boundaries & statistics overlay on the frame
            for zone_id, zconfig in ZONE_CONFIGS.items():
                rx1, ry1, rx2, ry2 = zconfig["rect"]
                color = zconfig["color"]
                count = current_counts[zone_id]
                
                # Draw zone rectangle
                cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), color, 2)
                
                # Label zone name
                cv2.putText(frame, zconfig["name"], (rx1 + 5, ry1 + 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                
                # Label current count
                cv2.putText(frame, f"Count: {count}", (rx1 + 5, ry1 + 45),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

            # 5. Save histories & compute trends
            for zone_id, count in current_counts.items():
                zone_histories[zone_id].append(count)

            # 6. Formulate data contract JSON
            current_time = time.time()
            if current_time - last_json_write_time >= write_interval:
                zones_payload = []
                for zone_id, zconfig in ZONE_CONFIGS.items():
                    count = current_counts[zone_id]
                    area = zone_areas[zone_id]
                    # Calculate density per pixel area, scaled up
                    density = round((count / area) * density_multiplier, 2)
                    trend = calculate_trend(zone_histories[zone_id])
                    
                    zones_payload.append({
                        "zone_id": zone_id,
                        "person_count": count,
                        "density": density,
                        "trend": trend
                    })
                
                payload = {
                    "camera_id": camera_id,
                    "timestamp": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                    "zones": zones_payload
                }

                # Update global latest payload
                with payload_lock:
                    latest_payload = payload

                # Write JSON output if enabled
                if output_mode in ["file", "both"]:
                    write_json_atomic(payload, output_json_path)

                if test_mode:
                    print(f"\n[TEST MODE] Live JSON Payload: {json.dumps(payload, indent=2)}")
                else:
                    counts_str = ", ".join([f"{z['zone_id']}: {z['person_count']} (trend: {z['trend']})" for z in zones_payload])
                    print(f"[CV-Detection] Frame: {frame_count} | {counts_str}")

                last_json_write_time = current_time

            # 7. Periodically save annotated sample frame for visual confirmation
            if frame_count % sample_interval == 0:
                # Use modulo 300 to rotate filenames and keep max 10 files
                sample_filename = os.path.join(sample_frames_dir, f"frame_{(frame_count % 300)}.jpg")
                cv2.imwrite(sample_filename, frame)
                # Keep log clean
                if not test_mode:
                    print(f"[CV-Detection] Saved sample validation frame to: {sample_filename}")

    except KeyboardInterrupt:
        print("\n[CV-Detection] Keyboard interrupt received. Exiting...")
    except Exception as e:
        print(f"\n[CV-Detection] CRITICAL Error in processing loop: {e}")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("[CV-Detection] Resources released. Shutdown complete.")

# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CrowdGuardAI - CV Detection pipeline")
    parser.add_argument("--video", type=str, default="", help="Path to input video file")
    parser.add_argument("--output-json", type=str, default="", help="Path to write JSON output")
    parser.add_argument("--camera-id", type=str, default=DEFAULT_CAMERA_ID, help="Camera ID to report")
    parser.add_argument("--loop", action="store_true", default=True, help="Loop video back to start when finished")
    parser.add_argument("--no-loop", action="store_false", dest="loop", help="Do not loop video")
    parser.add_argument("--sample-interval", type=int, default=30, help="Interval in frames to save verification snapshots")
    parser.add_argument("--write-interval", type=float, default=DEFAULT_WRITE_INTERVAL_SEC, help="JSON write interval in seconds")
    parser.add_argument("--density-multiplier", type=float, default=DEFAULT_DENSITY_MULTIPLIER, help="Scale factor for density values")
    
    # Mode configurations
    parser.add_argument("--mode", type=str, choices=["file", "api", "both"], default="both",
                        help="Output mode: 'file' updates JSON file, 'api' hosts a local endpoint, 'both' does both")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="API server host")
    parser.add_argument("--port", type=int, default=8000, help="API server port")
    
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
    if args.mode in ["file", "both"]:
        print(f"Output JSON Path   : {output_json}")
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
        test_mode=args.test_mode
    )

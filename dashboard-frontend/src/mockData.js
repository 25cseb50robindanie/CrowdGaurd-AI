// Mock Data for CrowdGuard AI Dashboard
// ALL camera streams, zone names, and AI bounding box specifications are declared here 
// for easy swappability when connecting real backend/model data later.

export const mockZonesData = {
  zones: [
    { zone_id: "gate4", status: "green", density: 1.0, message: "Safe" },
    { zone_id: "courtyard", status: "green", density: 1.0, message: "Safe" }
  ]
};

export const mockCameras = [
  { 
    id: "cam1", 
    name: "Camera 1", 
    label: "Platform 1", 
    streamUrl: "/assets/cameras/1_processed.mp4", // Processed Video 1.mp4 mapped to Camera 1 (Platform 1)
    streamLabel: "CAM_01 // PLATFORM_1",
    boundingBoxes: []
  },
  { 
    id: "cam2", 
    name: "Camera 2", 
    label: "Platform 2", 
    streamUrl: "/assets/cameras/5_processed.mp4", // Processed Video 5.mp4 mapped to Camera 2 (Platform 2)
    streamLabel: "CAM_02 // PLATFORM_2",
    boundingBoxes: []
  }
];

export const mockAlerts = [
  {
    id: "alert1",
    zoneId: "gate4",
    zoneName: "Platform 1",
    title: "High Crowd Density Warning",
    riskLevel: "red",
    timestamp: "Just now",
    dateTime: "2026-07-12 14:02:11",
    message: "Platform 1 - Sector A7. Rapid crowd accumulation detected from arriving train flow.",
    streamUrl: "/assets/cameras/1_processed.mp4", // Live Processed video
    boundingBoxes: [],
    aiMetadata: {
      congestion: "92.4%",
      count: "1,248",
      flowRate: "8.2 p/s",
      streamId: "CG-V-00912",
      integrity: {
        engine: "LATENCY 42ms",
        link: "NOMINAL"
      }
    }
  },
  {
    id: "alert3",
    zoneId: "courtyard",
    zoneName: "Platform 2",
    title: "Normal Platform Operations",
    riskLevel: "green",
    timestamp: "10m ago",
    dateTime: "2026-07-12 13:19:15",
    message: "Platform 2. Visual confirmation: commuters sitting/waiting. No physical crowd threats.",
    streamUrl: "/assets/cameras/5_processed.mp4", // Safe Processed video
    boundingBoxes: [],
    aiMetadata: {
      congestion: "22.0%",
      count: "142",
      flowRate: "1.5 p/s",
      streamId: "CG-V-00918",
      integrity: {
        engine: "LATENCY 125ms",
        link: "NOMINAL"
      }
    }
  }
];

export const mockHistoricalAlerts = [
  { id: "#CRD-9402", zoneName: "Platform 1 East", timestamp: "2026-07-12 12:22:10", riskLevel: "red", status: "Dispatched" },
  { id: "#CRD-9398", zoneName: "Platform 2 North", timestamp: "2026-07-12 11:50:45", riskLevel: "amber", status: "Resolved" },
  { id: "#CRD-9385", zoneName: "Platform 2 Corridor", timestamp: "2026-07-12 10:15:33", riskLevel: "green", status: "Resolved" }
];

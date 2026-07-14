// Mock Data for CrowdGuard AI Dashboard
// ALL camera streams, zone names, and AI bounding box specifications are declared here 
// for easy swappability when connecting real backend/model data later.

export const mockZonesData = {
  zones: [
    { zone_id: "gate4", status: "red", density: 4.2, message: "Avoid — expected unsafe in 8 min" },
    { zone_id: "courtyard", status: "green", density: 1.8, message: "Safe" },
    { zone_id: "mainpath", status: "amber", density: 2.9, message: "Caution — increasing density" }
  ]
};

export const mockCameras = [
  { 
    id: "cam1", 
    name: "Camera 1", 
    label: "Gate 4 Entrance", 
    streamUrl: "/assets/cameras/4.mp4", // Video 4.mp4 mapped to Camera 1
    streamLabel: "CAM_01 // GATE_4_NORTH",
    boundingBoxes: [
      { 
        id: "c1-box1", 
        label: "PERSON_082 RISK: RED", 
        style: { border: "2px solid #ffb4ab", top: "25%", left: "33%", width: "8rem", height: "12rem" }, 
        badgeStyle: "bg-error text-on-error" 
      },
      { 
        id: "c1-box2", 
        label: "PERSON_104 RISK: GREEN", 
        style: { border: "2px solid #b4c5ff", top: "33%", right: "25%", width: "6rem", height: "10rem", opacity: 0.5 }, 
        badgeStyle: "bg-primary text-on-primary" 
      }
    ]
  },
  { 
    id: "cam2", 
    name: "Camera 2", 
    label: "Courtyard East", 
    streamUrl: "/assets/cameras/1.mp4", // Updated video 1.mp4 mapped to Camera 2
    streamLabel: "CAM_02 // COURTYARD_EAST",
    boundingBoxes: [
      { 
        id: "c2-box1", 
        label: "PERSON_221 RISK: GREEN", 
        style: { border: "2px solid #b4c5ff", top: "20%", left: "40%", width: "5rem", height: "9rem", opacity: 0.5 }, 
        badgeStyle: "bg-primary text-on-primary" 
      }
    ]
  },
  { 
    id: "cam3", 
    name: "Camera 3", 
    label: "Main Shrine Path", 
    streamUrl: "/assets/cameras/5.mp4", // Video 5.mp4 mapped to Camera 3
    streamLabel: "CAM_03 // SHRINE_PATH",
    boundingBoxes: [
      { 
        id: "c3-box1", 
        label: "PERSON_412 RISK: AMBER", 
        style: { border: "2px solid #f59e0b", top: "45%", left: "50%", width: "7rem", height: "11rem" }, 
        badgeStyle: "bg-amber-500 text-black" 
      }
    ]
  }
];

export const mockAlerts = [
  {
    id: "alert1",
    zoneId: "gate4",
    zoneName: "Gate 4 Entrance",
    title: "Aggressive Movement Detected",
    riskLevel: "red",
    timestamp: "2m ago",
    dateTime: "2026-07-12 14:02:11",
    message: "Gate 4 Entrance - Sector A7. Multiple subjects showing high-velocity directional changes. Possible bottleneck forming.",
    streamUrl: "/assets/cameras/4.mp4", // Camera 1 stream
    boundingBoxes: [
      { 
        id: "ab1-box1", 
        label: "CONGESTION AREA A7: RED RISK", 
        style: { border: "2px solid #ffb4ab", top: "33%", left: "25%", width: "10rem", height: "14rem" }, 
        badgeStyle: "bg-error text-on-error" 
      },
      { 
        id: "ab1-box2", 
        label: "FLOW SECTOR B2: GREEN", 
        style: { border: "2px solid #b4c5ff", top: "25%", right: "33%", width: "7rem", height: "10rem", opacity: 0.5 }, 
        badgeStyle: "bg-primary text-on-primary" 
      }
    ],
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
    id: "alert2",
    zoneId: "mainpath",
    zoneName: "Main Shrine Path",
    title: "Path Obstruction Reported",
    riskLevel: "amber",
    timestamp: "12m ago",
    dateTime: "2026-07-12 13:52:10",
    message: "Debris or slowdown detected on Main Shrine Path. bottlenecks forming near the steps.",
    streamUrl: "/assets/cameras/5.mp4", // Camera 3 stream
    boundingBoxes: [
      { 
        id: "ab2-box1", 
        label: "OBSTRUCTION L4: AMBER", 
        style: { border: "2px solid #f59e0b", top: "40%", left: "45%", width: "9rem", height: "11rem" }, 
        badgeStyle: "bg-amber-500 text-black" 
      }
    ],
    aiMetadata: {
      congestion: "65.1%",
      count: "782",
      flowRate: "4.1 p/s",
      streamId: "CG-V-00914",
      integrity: {
        engine: "LATENCY 48ms",
        link: "NOMINAL"
      }
    }
  },
  {
    id: "alert3",
    zoneId: "courtyard",
    zoneName: "Courtyard East",
    title: "Sensor Sync Lag - Node 04",
    riskLevel: "green",
    timestamp: "45m ago",
    dateTime: "2026-07-12 13:19:15",
    message: "High latency on sensor node 04. Data syncing with delay. No physical crowd threat active.",
    streamUrl: "/assets/cameras/1.mp4", // Camera 2 stream
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
  { id: "#CRD-9402", zoneName: "Main Gate East", timestamp: "2026-07-12 12:22:10", riskLevel: "red", status: "Dispatched" },
  { id: "#CRD-9398", zoneName: "Sacred Sanctum", timestamp: "2026-07-12 11:50:45", riskLevel: "amber", status: "Resolved" },
  { id: "#CRD-9385", zoneName: "North Exit Gate", timestamp: "2026-07-12 10:15:33", riskLevel: "green", status: "Resolved" },
  { id: "#CRD-9382", zoneName: "Courtyard Perimeter", timestamp: "2026-07-12 09:42:01", riskLevel: "red", status: "Resolved" },
  { id: "#CRD-9361", zoneName: "East Tunnel Approach", timestamp: "2026-07-12 08:11:43", riskLevel: "amber", status: "Resolved" },
  { id: "#CRD-9355", zoneName: "West Plaza", timestamp: "2026-07-12 07:33:12", riskLevel: "green", status: "Resolved" }
];

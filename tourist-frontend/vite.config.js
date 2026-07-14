import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All zones across our placeholder locations
let mockZones = [
  // Grand Shrine
  { zone_id: "gate4", status: "red", density: 4.2, message: "Avoid — expected unsafe in 8 min" },
  { zone_id: "courtyard", status: "green", density: 1.8, message: "Safe" },
  { zone_id: "mainpath", status: "amber", density: 2.9, message: "Caution — increasing density" },
  
  // Harbor Boardwalk
  { zone_id: "pier1", status: "green", density: 1.2, message: "Safe" },
  { zone_id: "seafoodmarket", status: "amber", density: 3.1, message: "Caution — busy vendor area" },
  
  // Central Park
  { zone_id: "fountaingrade", status: "green", density: 1.5, message: "Safe" },
  { zone_id: "meadoweast", status: "green", density: 0.8, message: "Safe" }
];

// Helper to update mock data slightly on each poll
function updateMockZones() {
  mockZones = mockZones.map(zone => {
    let delta = (Math.random() - 0.5) * 0.4;
    let newDensity = parseFloat((zone.density + delta).toFixed(1));
    
    // Bounds check
    if (newDensity < 0.2) newDensity = 0.2;
    if (newDensity > 5.0) newDensity = 5.0;

    // Determine status based on density
    let newStatus = "green";
    let newMessage = "Safe";
    
    if (newDensity >= 3.5) {
      newStatus = "red";
      newMessage = "Avoid — density threshold exceeded";
    } else if (newDensity >= 2.2) {
      newStatus = "amber";
      newMessage = "Caution — increasing density";
    } else {
      newStatus = "green";
      newMessage = "Safe";
    }

    // Keep initial detailed messages for consistency if possible
    if (zone.zone_id === "gate4" && newStatus === "red") {
      newMessage = "Avoid — expected unsafe in 8 min";
    }
    if (zone.zone_id === "seafoodmarket" && newStatus === "amber") {
      newMessage = "Caution — busy vendor area";
    }

    return {
      ...zone,
      status: newStatus,
      density: newDensity,
      message: newMessage
    };
  });
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-zones-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/zones') {
            updateMockZones();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ zones: mockZones }));
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 5174,
  }
})

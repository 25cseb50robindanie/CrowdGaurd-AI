import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import LocationDetail from './pages/LocationDetail';
import { mockLocations } from './data/locationsData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Safe baseline fallback mock data if API polling encounters network issues
const INITIAL_ZONES_DATA = [
  { zone_id: "gate4", status: "red", density: 4.2, message: "Avoid — expected unsafe in 8 min" },
  { zone_id: "courtyard", status: "green", density: 1.8, message: "Safe" },
  { zone_id: "mainpath", status: "amber", density: 2.9, message: "Caution — increasing density" },
  { zone_id: "pier1", status: "green", density: 1.2, message: "Safe" },
  { zone_id: "seafoodmarket", status: "amber", density: 3.1, message: "Caution — busy vendor area" },
  { zone_id: "fountaingrade", status: "green", density: 1.5, message: "Safe" },
  { zone_id: "meadoweast", status: "green", density: 0.8, message: "Safe" }
];

export default function App() {
  const [locations, setLocations] = useState(mockLocations);
  const [zonesData, setZonesData] = useState(INITIAL_ZONES_DATA);
  const [pollingError, setPollingError] = useState(false);

  useEffect(() => {
    // Immediate initial fetch
    fetchZones();

    // Set up polling interval every 5 seconds (optimized for Gemini API rate limits)
    const intervalId = setInterval(fetchZones, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  const fetchZones = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/zones`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data && data.zones) {
        setZonesData(data.zones);
        setPollingError(false);

        // Dynamically update the Central Railway Station zones list and hotspots mapping
        setLocations(prevLocations => {
          return prevLocations.map(loc => {
            if (loc.id === "central-station") {
              const activeZoneIds = data.zones.map(z => z.zone_id);
              
              // Map hotspots dynamically
              const hotspots = data.zones.map((z, idx) => {
                let label = `Platform ${z.zone_id.replace("plt", "").toUpperCase()}`;
                if (z.zone_id === "gate4") label = "Platform 1";
                if (z.zone_id === "courtyard") label = "Platform 2";
                if (z.zone_id === "mainpath") label = "Platform 3";

                // Distribute pins dynamically across the map
                const topVal = `${25 + idx * 20}%`;
                const leftVal = `${33 + (idx % 2) * 20}%`;

                return {
                  zoneId: z.zone_id,
                  label: label,
                  top: topVal,
                  left: leftVal
                };
              });

              return {
                ...loc,
                zones: activeZoneIds,
                mapConfig: {
                  ...loc.mapConfig,
                  hotspots: hotspots
                }
              };
            }
            return loc;
          });
        });
      }
    } catch (error) {
      console.warn("Polling http://localhost:8000/api/zones failed. Falling back to simulated client-side state. Error:", error.message);
      setPollingError(true);
      
      // Fallback: update local state with minor random changes if API is down
      // This ensures the demo remains dynamic even if viewed as a static bundle!
      setZonesData(prevZones => 
        prevZones.map(zone => {
          let delta = (Math.random() - 0.5) * 0.3;
          let newDensity = parseFloat((zone.density + delta).toFixed(1));
          if (newDensity < 0.2) newDensity = 0.2;
          if (newDensity > 5.0) newDensity = 5.0;

          let newStatus = "green";
          let newMessage = "Safe";
          if (newDensity >= 3.5) {
            newStatus = "red";
            newMessage = "Avoid — density threshold exceeded";
          } else if (newDensity >= 2.2) {
            newStatus = "amber";
            newMessage = "Caution — increasing density";
          }
          
          if (zone.zone_id === "gate4" && newStatus === "red") {
            newMessage = "Avoid — expected unsafe in 8 min";
          }

          return { ...zone, density: newDensity, status: newStatus, message: newMessage };
        })
      );
    }
  };

  return (
    <Routes>
      <Route 
        path="/" 
        element={<Home locations={locations} zonesData={zonesData} />} 
      />
      <Route 
        path="/location/:locationId" 
        element={<LocationDetail locations={locations} zonesData={zonesData} />} 
      />
    </Routes>
  );
}

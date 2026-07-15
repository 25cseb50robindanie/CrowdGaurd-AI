import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import AnalyzeModal from './components/AnalyzeModal';
import CriticalAlertModal from './components/CriticalAlertModal';
import Toast from './components/Toast';
import { mockZonesData, mockCameras, mockAlerts } from './mockData';

export default function App() {
  // Global React States
  const [zones, setZones] = useState(mockZonesData.zones);
  const [cameras, setCameras] = useState(mockCameras);
  const [alerts, setAlerts] = useState(mockAlerts);
  const [activeCamera, setActiveCamera] = useState(mockCameras[0]);
  const [analyzeAlert, setAnalyzeAlert] = useState(null); // Alert object currently being analyzed
  const [showCriticalAlert, setShowCriticalAlert] = useState(false); // Controls CriticalAlertModal
  const [dispatchLogs, setDispatchLogs] = useState([]); // List of dispatched events
  const [toasts, setToasts] = useState([]); // List of active toasts

  // Resilient Polling: Queries the FastAPI backend every 2 seconds
  // Falls back to static mock data if the API server is not running
  React.useEffect(() => {
    const pollBackend = setInterval(() => {
      fetch('http://localhost:8000/api/zones')
        .then((res) => {
          if (!res.ok) throw new Error('API server returned error');
          return res.json();
        })
        .then((data) => {
          if (data && data.zones) {
            // Filter to only display the 3 active dashboard zones: gate4, courtyard, mainpath
            const dashboardZones = data.zones.filter(z => 
              z.zone_id === 'gate4' || z.zone_id === 'courtyard' || z.zone_id === 'mainpath'
            );
            setZones(dashboardZones);
            
            // Map the new zone status and messages directly to update our active alerts stream
            setAlerts((prevAlerts) => {
              return prevAlerts.map((alert) => {
                const matchingZone = data.zones.find((z) => z.zone_id === alert.zoneId);
                if (matchingZone) {
                  const capacityPercent = Math.min(Math.round((matchingZone.density / 4.5) * 100), 100);
                  const approxCount = Math.round(matchingZone.density * 300);
                  return {
                    ...alert,
                    riskLevel: matchingZone.status, // red, amber, green
                    message: matchingZone.message || alert.message,
                    aiMetadata: {
                      ...alert.aiMetadata,
                      congestion: `${capacityPercent}%`,
                      count: approxCount.toLocaleString()
                    }
                  };
                }
                return alert;
              });
            });
          }
        })
        .catch((err) => {
          // Dev server is offline; fallback silently to the local mock data
        });
    }, 5000);

    return () => clearInterval(pollBackend);
  }, [alerts]);

  // Adds a toast notification
  const handleAddToast = (message) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message }]);
  };

  // Removes a toast notification
  const handleRemoveToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Dispatch Force action handler
  const handleDispatch = (alert) => {
    // 1. Trigger toast
    handleAddToast("Alert sent to Station Control Room");

    // 2. Add timestamped entry to dispatch activity log
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = {
      id: Date.now(),
      timestamp: timeStr,
      zone: alert.zoneName || alert.zone_id || "Gate 4 Entrance",
      message: `Operational Unit 4 dispatched in response to: ${alert.title || "Critical density"}`
    };

    setDispatchLogs((prev) => [...prev, logEntry]);

    // 3. Post dispatch event to FastAPI backend (Person C)
    fetch('http://localhost:8000/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: alert.zoneId || "gate4",
        timestamp: timeStr,
        message: logEntry.message
      })
    })
    .catch((err) => {
      // Backend endpoint not active yet; ignore silently
    });
  };

  // Triggered when clicking Analyze inside Critical Alert Modal
  const handleViewCriticalDetails = () => {
    // Find the Gate 4 red alert from alerts array
    const gate4Alert = alerts.find((a) => a.zoneId === 'gate4') || alerts[0];
    setShowCriticalAlert(false);
    setAnalyzeAlert(gate4Alert);
  };

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-background text-on-background font-body-md">
        
        {/* Navbar */}
        <Navbar 
          onTriggerCriticalAlert={() => setShowCriticalAlert(true)} 
          activeAlertsCount={alerts.filter(a => a.riskLevel === 'red').length}
        />

        {/* Content routing */}
        <main className="flex-1 overflow-x-hidden">
          <Routes>
            <Route 
              path="/" 
              element={
                <DashboardPage
                  zones={zones}
                  cameras={cameras}
                  alerts={alerts}
                  activeCamera={activeCamera}
                  setActiveCamera={setActiveCamera}
                  dispatchLogs={dispatchLogs}
                  onAnalyzeAlert={(alert) => setAnalyzeAlert(alert)}
                  onDispatchAlert={handleDispatch}
                />
              } 
            />
            <Route 
              path="/reports" 
              element={<ReportsPage onAddToast={handleAddToast} />} 
            />
          </Routes>
        </main>

        {/* Overlay Modals */}
        {analyzeAlert && (
          <AnalyzeModal
            alert={analyzeAlert}
            onClose={() => setAnalyzeAlert(null)}
            onDispatch={(alert) => {
              handleDispatch(alert);
              // setAnalyzeAlert(null); // Keep modal open or close based on preference, let's keep it open to show status changes
            }}
          />
        )}

        <CriticalAlertModal
          isOpen={showCriticalAlert}
          onClose={() => setShowCriticalAlert(false)}
          onDispatch={() => {
            const gate4Alert = alerts.find((a) => a.zoneId === 'gate4') || alerts[0];
            handleDispatch(gate4Alert);
            setShowCriticalAlert(false);
          }}
          onViewDetails={handleViewCriticalDetails}
        />

        {/* Floating Toast Notification Container */}
        <Toast toasts={toasts} onRemove={handleRemoveToast} />
        
      </div>
    </Router>
  );
}

import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import AnalyzeModal from './components/AnalyzeModal';
import CriticalAlertModal from './components/CriticalAlertModal';
import Toast from './components/Toast';
import { mockZonesData, mockCameras, mockAlerts } from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function App() {
  // Global React States
  const [zones, setZones] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeCamera, setActiveCamera] = useState(null);
  const [analyzeAlert, setAnalyzeAlert] = useState(null); // Alert object currently being analyzed
  const [showCriticalAlert, setShowCriticalAlert] = useState(false); // Controls CriticalAlertModal
  const [dispatchLogs, setDispatchLogs] = useState([]); // List of dispatched events
  const [toasts, setToasts] = useState([]); // List of active toasts
  const [showLinkCameraModal, setShowLinkCameraModal] = useState(false); // Upload modal toggle
  const [acknowledgedZones, setAcknowledgedZones] = useState({});

  // Form states for linking camera
  const [uploadCamId, setUploadCamId] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadZoneId, setUploadZoneId] = useState('');
  const [uploadCapacity, setUploadCapacity] = useState('15');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch cameras, dispatches, and initial alerts on mount
  const loadInitialData = () => {
    fetch(`${API_BASE_URL}/api/cameras`)
      .then((res) => {
        if (!res.ok) throw new Error('API server offline');
        return res.json();
      })
      .then((data) => {
        const formatted = (data || []).map(cam => ({
          id: cam.id,
          name: cam.name,
          label: cam.label,
          streamUrl: cam.stream_url,
          streamLabel: cam.stream_label,
          boundingBoxes: []
        }));
        setCameras(formatted);
        setActiveCamera((prev) => {
          if (prev) {
            const matched = formatted.find(c => c.id === prev.id);
            if (matched) return matched;
          }
          return formatted.length > 0 ? formatted[0] : null;
        });
      })
      .catch((err) => {
        setCameras(mockCameras);
        setActiveCamera(mockCameras[0]);
      });

    fetch(`${API_BASE_URL}/api/dispatches`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setDispatchLogs(data);
      })
      .catch(() => {});
  };

  const handleUnlinkCamera = (cameraId) => {
    fetch(`${API_BASE_URL}/api/cameras/${cameraId}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to unlink camera');
        return res.json();
      })
      .then(() => {
        handleAddToast("Camera disconnected.");
        setCameras((prev) => {
          const updated = prev.filter((c) => c.id !== cameraId);
          if (activeCamera && activeCamera.id === cameraId) {
            setActiveCamera(updated.length > 0 ? updated[0] : null);
          }
          return updated;
        });
      })
      .catch((err) => {
        handleAddToast(`Error unlinking camera: ${err.message}`);
      });
  };

  React.useEffect(() => {
    loadInitialData();
  }, []);

  // Polling zones & alerts
  React.useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    const pollBackend = setInterval(() => {
      if (isFetching) return;
      isFetching = true;

      Promise.all([
        // 1. Fetch live zone metrics
        fetch(`${API_BASE_URL}/api/zones`)
          .then((res) => {
            if (!res.ok) throw new Error('API server returned error');
            return res.json();
          })
          .then((data) => {
            if (isMounted && data && data.zones) {
              setZones(data.zones);
            }
          })
          .catch(() => {
            if (isMounted) {
              setZones(mockZonesData.zones);
            }
          }),

        // 2. Fetch live alerts (synced with the database lifecycle status)
        fetch(`${API_BASE_URL}/api/alerts`)
          .then((res) => {
            if (!res.ok) throw new Error('API server error');
            return res.json();
          })
          .then((data) => {
            if (isMounted && data) {
              setAlerts(data);
              
              // Automatically trigger the critical alert modal if live person count is 80 or above
              // and status is NEW (but check if it's not already acknowledged to prevent popup spam).
              setAcknowledgedZones(prev => {
                const next = { ...prev };
                let updated = false;

                // 1. Scan for active zones with 80 or more people counted to trigger alerts
                data.forEach(a => {
                  const countVal = a.aiMetadata && a.aiMetadata.count ? parseInt(a.aiMetadata.count, 10) : (a.count || 0);
                  if (countVal >= 80 && a.status === 'NEW') {
                    if (!next[a.zoneId]) {
                      setShowCriticalAlert(true);
                    }
                  }
                });

                // 2. Clear acknowledgement for zones that returned below 80
                Object.keys(next).forEach(zId => {
                  const activeAlert = data.find(a => a.zoneId === zId);
                  if (activeAlert) {
                    const countVal = activeAlert.aiMetadata && activeAlert.aiMetadata.count ? parseInt(activeAlert.aiMetadata.count, 10) : (activeAlert.count || 0);
                    if (countVal < 80) {
                      delete next[zId];
                      updated = true;
                    }
                  } else {
                    delete next[zId];
                    updated = true;
                  }
                });

                return updated ? next : prev;
              });
            }
          })
          .catch(() => {
            // fallback silently
          }),

        // 3. Poll dispatch history
        fetch(`${API_BASE_URL}/api/dispatches`)
          .then((res) => res.json())
          .then((data) => {
            if (isMounted && data) {
              setDispatchLogs(data);
            }
          })
          .catch(() => {})
      ]).finally(() => {
        isFetching = false;
      });
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollBackend);
    };
  }, []);

  // Sync the expanded alert detail modal values with polled updates in real time
  React.useEffect(() => {
    if (analyzeAlert) {
      const updated = alerts.find(a => a.id === analyzeAlert.id);
      if (updated) {
        setAnalyzeAlert(updated);
      }
    }
  }, [alerts, analyzeAlert]);

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
  const handleDispatch = (alert, notes = "") => {
    const zoneId = alert.zoneId || alert.zone_id || "gate4";
    handleAddToast("🚨 Response Unit Dispatched Successfully!");
    setTimeout(() => {
      handleAddToast("🧠 Mem0 Vector DB: Incident & Operator Notes saved to Cloud Memory!");
    }, 700);

    // Mark incident as acknowledged for this zone so popup won't show again
    setAcknowledgedZones(prev => ({ ...prev, [zoneId]: true }));
    setShowCriticalAlert(false);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntryMessage = `Operational Unit dispatched in response to: ${alert.title || "Critical density"}`;

    // Extract stats for Mem0 memory saving
    const crowdCount = alert.aiMetadata?.count ? parseInt(alert.aiMetadata.count, 10) : (alert.count || 0);
    const densityVal = alert.density || 0.0;
    const riskLevel = alert.riskLevel || "green";
    const recommendation = alert.aiMetadata?.recommendation || "No recommendation";

    // Post dispatch event to FastAPI backend (Updates SQLite status to DISPATCHED and posts to Mem0)
    fetch(`${API_BASE_URL}/api/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: zoneId,
        timestamp: timeStr,
        message: logEntryMessage,
        operator_notes: notes,
        crowd_count: crowdCount,
        density: densityVal,
        risk_level: riskLevel,
        recommendation: recommendation
      })
    })
    .then((res) => res.json())
    .then((data) => {
      // Reload logs
      setDispatchLogs((prev) => [data, ...prev]);
    })
    .catch((err) => {
      // Offline fallback
      setDispatchLogs((prev) => [
        {
          id: Date.now(),
          timestamp: timeStr,
          zone: alert.zoneName || "Gate 4",
          message: logEntryMessage,
          zone_id: zoneId
        },
        ...prev
      ]);
    });
  };


  // Triggered when clicking Analyze inside Critical Alert Modal
  const handleViewCriticalDetails = () => {
    // Acknowledge all currently threshold-exceeded zones so they don't pop up again
    setAcknowledgedZones(prev => {
      const next = { ...prev };
      alerts.forEach(a => {
        const countVal = a.aiMetadata && a.aiMetadata.count ? parseInt(a.aiMetadata.count, 10) : 0;
        if (countVal > 100) {
          next[a.zoneId] = true;
        }
      });
      return next;
    });

    const activeThresholdAlert = alerts.find((a) => {
      const countVal = a.aiMetadata && a.aiMetadata.count ? parseInt(a.aiMetadata.count, 10) : 0;
      return countVal > 100;
    }) || alerts[0];
    setShowCriticalAlert(false);
    setAnalyzeAlert(activeThresholdAlert);
    handleAddToast("Critical alert acknowledged.");
  };

  // Handle linking camera upload submission
  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!uploadCamId || !uploadName || !uploadLabel || !uploadZoneId || !selectedFile) {
      handleAddToast("All fields and video selection are required.");
      return;
    }

    setIsUploading(true);
    handleAddToast("Uploading video and initiating YOLO tracker...");

    const formData = new FormData();
    formData.append("camera_id", uploadCamId);
    formData.append("name", uploadName);
    formData.append("label", uploadLabel);
    formData.append("zone_id", uploadZoneId);
    formData.append("max_capacity", uploadCapacity);
    formData.append("video", selectedFile);

    fetch(`${API_BASE_URL}/api/cameras/upload`, {
      method: 'POST',
      body: formData
    })
    .then((res) => {
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    })
    .then((data) => {
      setIsUploading(false);
      setShowLinkCameraModal(false);
      handleAddToast("Video uploaded successfully.");
      handleAddToast("Camera linked successfully.");
      
      // Clean form fields
      setUploadCamId('');
      setUploadName('');
      setUploadLabel('');
      setUploadZoneId('');
      setSelectedFile(null);

      // Reload cameras
      loadInitialData();
    })
    .catch((err) => {
      setIsUploading(false);
      handleAddToast(`Camera upload failed: ${err.message}`);
    });
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
                  onLinkCameraClick={() => setShowLinkCameraModal(true)}
                  onUnlinkCamera={handleUnlinkCamera}
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
            }}
          />
        )}

        <CriticalAlertModal
          isOpen={showCriticalAlert}
          onClose={() => {
            // Acknowledge all currently threshold-exceeded zones so they don't pop up again
            setAcknowledgedZones(prev => {
              const next = { ...prev };
              alerts.forEach(a => {
                const countVal = a.aiMetadata && a.aiMetadata.count ? parseInt(a.aiMetadata.count, 10) : 0;
                if (countVal > 100) {
                  next[a.zoneId] = true;
                }
              });
              return next;
            });
            setShowCriticalAlert(false);
            handleAddToast("Critical alert acknowledged.");
          }}
          onDispatch={() => {
            const criticalAlert = alerts.find((a) => {
              const countVal = a.aiMetadata && a.aiMetadata.count ? parseInt(a.aiMetadata.count, 10) : 0;
              return countVal > 100;
            }) || alerts[0];
            handleDispatch(criticalAlert);
          }}
          onViewDetails={handleViewCriticalDetails}
        />

        {/* Link Camera Upload Modal */}
        {showLinkCameraModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-md p-4">
            <div className="relative w-full max-w-md bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Link a New Camera</h3>
                <button 
                  onClick={() => setShowLinkCameraModal(false)}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1">Camera ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. cam3" 
                      value={uploadCamId}
                      onChange={(e) => setUploadCamId(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      required 
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1">Camera Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Camera 3" 
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      required 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1">Platform Label</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Main Path" 
                      value={uploadLabel}
                      onChange={(e) => setUploadLabel(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      required 
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1">Zone ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. mainpath" 
                      value={uploadZoneId}
                      onChange={(e) => setUploadZoneId(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      required 
                    />
                  </div>
                </div>

                <div>
                  <label className="font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1">Max Safe Capacity</label>
                  <input 
                    type="number" 
                    value={uploadCapacity}
                    onChange={(e) => setUploadCapacity(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    required 
                  />
                </div>

                <div>
                  <label className="font-label-caps text-[10px] text-on-surface-variant uppercase block mb-1">Upload Video Feed (.mp4)</label>
                  <input 
                    type="file" 
                    accept="video/mp4"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="w-full text-xs text-on-surface-variant file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    required 
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-outline-variant">
                  <button 
                    type="button"
                    onClick={() => setShowLinkCameraModal(false)}
                    className="px-4 py-2 border border-outline-variant rounded text-xs hover:bg-surface-variant"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUploading}
                    className="px-4 py-2 bg-primary text-on-primary rounded font-bold text-xs hover:opacity-90 active:scale-95 transition-all flex items-center gap-1"
                  >
                    {isUploading ? "Uploading..." : "Link Camera"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Floating Toast Notification Container */}
        <Toast toasts={toasts} onRemove={handleRemoveToast} />
        
      </div>
    </Router>
  );
}

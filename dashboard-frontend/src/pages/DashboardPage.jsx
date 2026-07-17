import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import CameraPanel from '../components/CameraPanel';
import VideoPlayer from '../components/VideoPlayer';
import DensityPanel from '../components/DensityPanel';
import HeatMap from '../components/HeatMap';
import AlertCard from '../components/AlertCard';
import DispatchLog from '../components/DispatchLog';

export default function DashboardPage({
  zones,
  cameras,
  alerts,
  activeCamera,
  setActiveCamera,
  dispatchLogs,
  onAnalyzeAlert,
  onDispatchAlert,
  onLinkCameraClick,
  onUnlinkCamera,
}) {
  const navigate = useNavigate();

  // State to track manual alert expansion overrides
  // Initially, red alerts are expanded, amber/green are collapsed.
  const [expandedAlerts, setExpandedAlerts] = useState(() => {
    const initial = {};
    alerts.forEach((alert) => {
      // red risk is expanded by default
      initial[alert.id] = alert.riskLevel === 'red';
    });
    return initial;
  });

  const handleToggleExpand = (alertId) => {
    setExpandedAlerts((prev) => ({
      ...prev,
      [alertId]: !prev[alertId],
    }));
  };

  // Sort alerts by risk level: red first, then amber, then green
  const sortedAlerts = [...alerts].sort((a, b) => {
    const score = { red: 3, amber: 2, green: 1 };
    return score[b.riskLevel] - score[a.riskLevel];
  });

  return (
    <div className="max-w-container-max mx-auto space-y-gutter p-margin-desktop">
      {/* Top Metrics Row */}
      <StatCard zones={zones} alerts={alerts} camerasCount={cameras.length} />

      {/* Camera Selection Row */}
      <CameraPanel
        cameras={cameras}
        activeCameraId={activeCamera ? activeCamera.id : null}
        onSelectCamera={setActiveCamera}
        onLinkCameraClick={onLinkCameraClick}
        onUnlinkCamera={onUnlinkCamera}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        
        {/* Main Video & Analytics Panel (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-gutter">
          {/* Main Video Panel */}
          {activeCamera ? (
            <VideoPlayer camera={activeCamera} />
          ) : (
            <div className="aspect-video bg-surface-container border-2 border-outline-variant flex items-center justify-center text-on-surface-variant font-bold text-lg">
              No Camera Stream Available
            </div>
          )}

          {/* Two-Column Analytics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <DensityPanel zones={zones} />
            <HeatMap zones={zones} />
          </div>
        </div>

        {/* Live Alerts Stream Panel (Right 4 cols) */}
        <div id="alerts-section" className="lg:col-span-4 flex flex-col space-y-gutter scroll-mt-20">
          <div className="bg-surface-container border border-outline-variant rounded flex flex-col h-full max-h-[800px]">
            {/* Header */}
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
              <h3 className="font-label-caps text-label-caps font-bold text-on-surface">Live Alerts Stream</h3>
              <span className="bg-error-container text-on-error-container text-[10px] px-2 py-0.5 rounded-full font-bold">
                {alerts.filter((a) => a.riskLevel === 'red').length} CRITICAL
              </span>
            </div>

            {/* Alert List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {sortedAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  isExpanded={!!expandedAlerts[alert.id]}
                  onToggleExpand={() => handleToggleExpand(alert.id)}
                  onAnalyze={onAnalyzeAlert}
                  onDispatch={onDispatchAlert}
                />
              ))}
            </div>

            {/* View History Footer */}
            <div className="p-4 bg-surface-container-low border-t border-outline-variant shrink-0">
              <button
                onClick={() => navigate('/reports')}
                className="w-full py-2 text-on-surface-variant font-label-caps text-xs hover:text-primary transition-colors flex items-center justify-center gap-1 active:scale-95"
              >
                VIEW ALERT HISTORY 
                <span className="material-symbols-outlined text-sm">history</span>
              </button>
            </div>
          </div>

          {/* Dispatch Event Logger Widget */}
          <DispatchLog logs={dispatchLogs} />
        </div>

      </div>
    </div>
  );
}

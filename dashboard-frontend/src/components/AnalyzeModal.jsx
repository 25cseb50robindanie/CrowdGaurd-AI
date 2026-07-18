import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function AnalyzeModal({ alert, onClose, onDispatch }) {
  const [officerNotes, setOfficerNotes] = useState('');
  const [notesFocused, setNotesFocused] = useState(false);
  const [aiLayersActive, setAiLayersActive] = useState(true);
  const [memories, setMemories] = useState([]);
  const [aiSummary, setAiSummary] = useState('');
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesFailed, setMemoriesFailed] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (alert) {
      setMemoriesLoading(true);
      setMemoriesFailed(false);
      setMemories([]);
      setAiSummary('');

      const zoneId = alert.zoneId || alert.zone_id || "gate4";
      const zoneName = alert.zoneName || "Gate 4";
      const riskLevel = alert.riskLevel || "green";
      const crowdCount = alert.aiMetadata?.count ? parseInt(alert.aiMetadata.count, 10) : (alert.count || 0);
      const densityScore = alert.density || 0.0;
      const recommendedAction = alert.aiMetadata?.recommendation || "Continue normal monitoring";

      fetch(`${API_BASE_URL}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: zoneId,
          zone_name: zoneName,
          risk_level: riskLevel,
          crowd_count: crowdCount,
          density_score: densityScore,
          recommended_action: recommendedAction
        })
      })
      .then(res => res.json())
      .then(data => {
        setMemories(data.memories || []);
        setAiSummary(data.summary || '');
        setMemoriesLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch similar incidents:", err);
        setMemoriesFailed(true);
        setMemoriesLoading(false);
      });
    }
  }, [alert]);

  useEffect(() => {
    // Sync playback time from the dashboard's main video player to keep it looking like a continuous live stream
    const mainVideo = document.querySelector('main video');
    if (mainVideo && videoRef.current) {
      const syncTime = () => {
        if (videoRef.current && mainVideo) {
          videoRef.current.currentTime = mainVideo.currentTime;
        }
      };

      if (videoRef.current.readyState >= 1) {
        syncTime();
      } else {
        videoRef.current.addEventListener('loadedmetadata', syncTime);
        return () => {
          if (videoRef.current) {
            videoRef.current.removeEventListener('loadedmetadata', syncTime);
          }
        };
      }
    }
  }, [alert]);

  if (!alert) return null;

  // Set default metadata if not provided
  const metadata = alert.aiMetadata || {
    congestion: "0%",
    count: "0",
    flowRate: "0.0 p/s",
    streamId: `CG-V-${alert.zoneId ? alert.zoneId.toUpperCase() : "UNKNOWN"}`,
    prediction: "No prediction data",
    explanation: "No explanation data",
    recommendation: "Continue normal monitoring",
    confidence: "100%",
    integrity: { engine: "LATENCY 38ms", link: "NOMINAL" }
  };

  const isRed = alert.riskLevel === 'red';
  const isAmber = alert.riskLevel === 'amber';

  const getRiskBadge = () => {
    if (isRed) {
      return (
        <div className="bg-error-container/20 border border-error-container text-error px-3 py-1 rounded flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] animate-status-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <span className="font-label-caps text-label-caps uppercase tracking-wider">RED RISK ALERT</span>
        </div>
      );
    } else if (isAmber) {
      return (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1 rounded flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span className="font-label-caps text-label-caps uppercase tracking-wider">AMBER RISK ALERT</span>
        </div>
      );
    } else {
      return (
        <div className="bg-primary-container/10 border border-primary-container/30 text-primary px-3 py-1 rounded flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">sensors</span>
          <span className="font-label-caps text-label-caps uppercase tracking-wider">GREEN RISK ALERT</span>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-md p-4 md:p-6" id="modal-overlay">
      {/* Large Centered Modal Panel */}
      <div className="relative w-full max-w-[1280px] h-[90vh] bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-outline-variant flex items-center justify-between shrink-0 bg-surface-container-highest">
          <div className="flex items-center gap-4 min-w-0">
            {getRiskBadge()}
            <div className="hidden sm:block h-6 w-px bg-outline-variant"></div>
            <div className="truncate">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{alert.zoneName}</h2>
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
                Stream ID: {metadata.streamId} // Operational Unit 4
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded hover:bg-surface-bright transition-colors flex items-center justify-center text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row min-h-0">
          
          {/* Main Feed Area (Left) */}
          <div className="flex-[3] flex flex-col border-r border-outline-variant min-h-[300px] lg:h-full">
            <div className="relative flex-1 bg-black group overflow-hidden">
              {/* Expanded Surveillance Video Player - Loaded dynamically from centralized config */}
              <video
                ref={videoRef}
                key={alert.id}
                src={alert.streamUrl || "/assets/cameras/1.mp4"}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover opacity-60 absolute inset-0"
              />

              {/* AI Layer Bounding Boxes - Rendered dynamically from centralized config */}
              {aiLayersActive && alert.boundingBoxes && (
                <div className="absolute inset-0 z-10 pointer-events-none p-6">
                  {alert.boundingBoxes.map((box) => (
                    <div 
                      key={box.id} 
                      className="absolute"
                      style={box.style}
                    >
                      <span className={`${box.badgeStyle} font-label-caps text-[10px] px-1 absolute -top-5 left-0 whitespace-nowrap`}>
                        {box.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* HUD Overlays */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                <div className="bg-black/60 backdrop-blur px-3 py-1 border-l-2 border-primary">
                  <span className="font-data-table text-xs text-primary">LIVE REC // UTC TIMESTAMP</span>
                </div>
                <div className="bg-black/60 backdrop-blur px-3 py-1 border-l-2 border-error">
                  <span className="font-data-table text-xs text-error">CONGESTION THRESHOLD: {metadata.congestion}</span>
                </div>
              </div>

              {/* Scanline Effect Overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
            </div>

            {/* Footbar for Stream Controls */}
            <div className="h-14 bg-surface-container-low border-t border-outline-variant px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setAiLayersActive(!aiLayersActive)}
                  className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">videocam</span>
                  <span className="font-label-caps text-[10px] uppercase">Toggle AI Layers</span>
                </button>
                <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">zoom_in</span>
                  <span className="font-label-caps text-[10px] uppercase">Enhance Feed</span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="font-data-table text-xs">SENSORS: ACTIVE</span>
                <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(37,99,235,0.6)]"></div>
              </div>
            </div>
          </div>

          {/* Analysis Sidebar (Right) */}
          <aside className="flex-1 lg:max-w-[400px] bg-surface-container flex flex-col divide-y divide-outline-variant lg:h-full lg:overflow-y-auto">
            {/* Density Analytics Section */}
            <section className="p-6 border-b border-outline-variant">
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Density Analytics</span>
                <span className="material-symbols-outlined text-primary">analytics</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">YOLO Count</p>
                  <p className="font-data-display text-base text-primary font-bold">{metadata.count}</p>
                </div>
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Zone Density</p>
                  <p className="font-data-display text-xs text-on-surface font-semibold">
                    {alert.density ? alert.density.toFixed(2) : "0.00"} <span className="text-[10px] text-on-surface-variant font-normal">p/m²</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Rolling Average</p>
                  <p className="font-data-display text-xs text-on-surface font-semibold">
                    {alert.rollingAverage ? alert.rollingAverage.toFixed(1) : "0.0"} <span className="text-[10px] text-on-surface-variant font-normal">avg</span>
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Rolling Trend</p>
                  <p className="font-data-display text-xs text-on-surface font-semibold capitalize">
                    {alert.trend || "Stable"}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-on-surface">
                  <span className="font-body-md text-xs opacity-80">Saturation Level</span>
                  <span className="font-data-table text-xs text-error font-semibold">{metadata.congestion}</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div 
                    className="bg-error h-full transition-all duration-500" 
                    style={{ width: metadata.congestion }}
                  ></div>
                </div>
              </div>
            </section>

            {/* Movement & Congestion Section */}
            <section className="p-6 border-b border-outline-variant">
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Movement & Congestion</span>
                <span className="material-symbols-outlined text-primary">directions_run</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Growth Rate</p>
                  <p className="font-data-display text-xs text-on-surface font-semibold">
                    {metadata.flowRate}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Sustained Congestion</p>
                  <p className="font-data-display text-xs text-on-surface font-semibold">
                    {alert.sustainedCongestionSec ? alert.sustainedCongestionSec.toFixed(1) : "0.0"}s
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Average Speed</p>
                  <p className="font-data-display text-xs text-on-surface font-semibold">
                    {alert.speed && alert.speed >= 0 ? `${alert.speed.toFixed(1)} px/s` : "N/A"}
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Stagnation Status</p>
                  <p className="font-data-display text-xs text-on-surface font-bold capitalize">
                    {alert.stagnationIndex && alert.stagnationIndex > 0.5 ? "Stagnant" : "Moving"}
                  </p>
                </div>
              </div>
            </section>

            {/* AI Agent Analysis Section */}
            <section className="p-6 border-b border-outline-variant bg-surface-container-low/20">
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">AI Agent Safety Warnings</span>
                <span className="material-symbols-outlined text-primary">psychology</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Deterministic Prediction</p>
                  <p className="font-body-md text-xs text-on-surface leading-relaxed">{metadata.prediction}</p>
                </div>
                <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[9px] text-on-surface-variant uppercase mb-1">Agent Explanation</p>
                  <p className="font-body-md text-xs text-on-surface-variant leading-relaxed">{metadata.explanation}</p>
                </div>
                <div className="p-3 bg-primary/10 border border-primary/25 rounded">
                  <p className="font-label-caps text-[9px] text-primary uppercase mb-1">Recommended Response Action</p>
                  <p className="font-body-md text-xs text-primary font-bold leading-relaxed">{metadata.recommendation}</p>
                </div>
                <div className="flex justify-between items-center text-on-surface-variant pt-1">
                  <span className="font-label-caps text-[9px] uppercase">Confidence</span>
                  <span className="font-data-table text-[10px] font-bold text-secondary-fixed">{metadata.confidence}</span>
                </div>
              </div>
            </section>

            {/* AI Memory Insight Section */}
            {!memoriesFailed && (
              <section className="p-6 border-b border-outline-variant bg-primary/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">AI Memory Insight</span>
                  <span className="material-symbols-outlined text-primary">history_edu</span>
                </div>
                
                {memoriesLoading ? (
                  <div className="text-center font-body-md text-xs text-on-surface-variant/60 py-2 animate-pulse">
                    Retrieving AI Memory insights...
                  </div>
                ) : memories && memories.length > 0 ? (
                  <div className="space-y-4">
                    {/* AI Summary */}
                    <div className="p-3 bg-surface-container-low border border-outline-variant rounded">
                      <p className="font-label-caps text-[9px] text-primary uppercase mb-1">AI Summary</p>
                      <p className="font-body-md text-xs text-on-surface leading-relaxed">
                        {aiSummary || "Summary unavailable. Showing raw historical facts."}
                      </p>
                    </div>

                    {/* Most Recent Incident Details */}
                    {(() => {
                      const firstMem = memories[0];
                      return (
                        <div className="p-3 bg-surface-container-low border border-outline-variant rounded space-y-2">
                          <div className="flex justify-between items-center border-b border-outline-variant/30 pb-1.5 mb-1.5">
                            <span className="font-label-caps text-[9px] text-on-surface-variant uppercase">Most Relevant Previous Incident</span>
                            <span className="font-data-table text-[9px] text-outline font-semibold">{firstMem.date}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <p className="font-label-caps text-[8px] text-on-surface-variant uppercase">Previous Action Taken</p>
                              <p className="font-body-md text-on-surface font-medium truncate" title={firstMem.action_taken}>{firstMem.action_taken}</p>
                            </div>
                            <div>
                              <p className="font-label-caps text-[8px] text-on-surface-variant uppercase">Previous Outcome</p>
                              <p className="font-body-md text-on-surface font-medium truncate" title={firstMem.outcome}>{firstMem.outcome}</p>
                            </div>
                          </div>
                          {firstMem.operator_notes && (
                            <div className="pt-1.5 border-t border-outline-variant/30">
                              <p className="font-label-caps text-[8px] text-on-surface-variant uppercase mb-0.5">Operator Notes</p>
                              <p className="font-body-md text-on-surface-variant italic">"{firstMem.operator_notes}"</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="font-body-md text-xs text-on-surface-variant/60 italic text-center py-2">
                    No similar incident memory available.
                  </p>
                )}
              </section>
            )}

            {/* Local Heat Map Section */}
            <section className="p-6 border-b border-outline-variant">
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Local Heat Map</span>
                <span className="material-symbols-outlined text-on-surface-variant">map</span>
              </div>
              <div className="aspect-video w-full rounded border border-outline-variant overflow-hidden relative">
                {/* Architectural blueprint background */}
                <div 
                  className="absolute inset-0 bg-cover bg-center grayscale opacity-40" 
                  style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB4gSbpz243weAz1l2ktyt2-Adx_aYCFTf5dGKog2cSRKJQ6Vv3H9ijNhUmje2UYjtagQj62_jJvxg9cwmt5W7aZNCoWEhdONWeqmRnoREoVo6Rwl6od4Dbqc0LQjWOHQbvFje4piiSref-BsktMWv2Undl5HU2btVKvz22JaGys9Ktsww2ff5r-GzE_Jpn4a2qwqxqRJgu650BX3OUdLpn3T54VeLo6VN2zqOv4bqHISZDAlEIdtdrAI6olh-Sgzw6latZR9mMQzSR')" }}
                ></div>
                {/* Simulated Heatmap pulses linked to risk */}
                <div className={`absolute top-1/2 left-1/3 w-20 h-20 rounded-full blur-xl animate-pulse ${alert.riskLevel === 'red' ? 'bg-error/40' : alert.riskLevel === 'amber' ? 'bg-amber-500/35' : 'bg-primary/20'}`}></div>
                
                {/* Crosshair UI */}
                <div className="absolute inset-0 border border-primary/20 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-primary/10"></div>
                  <div className="h-full w-px bg-primary/10 absolute"></div>
                </div>
              </div>
            </section>

            {/* Officer Notes & Integrity Checklist */}
            <section className="p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`font-label-caps text-[10px] uppercase ${notesFocused ? 'text-primary' : 'text-on-surface-variant'}`} htmlFor="officer-notes">
                    Officer Notes
                  </label>
                  <span className="font-label-caps text-[9px] text-outline">AUTO-SAVING</span>
                </div>
                <textarea 
                  id="officer-notes" 
                  value={officerNotes}
                  onChange={(e) => setOfficerNotes(e.target.value)}
                  onFocus={() => setNotesFocused(true)}
                  onBlur={() => setNotesFocused(false)}
                  placeholder="Enter incident reports, bottleneck causes, or dispatch details..." 
                  rows="3" 
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-3 font-body-md text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50"
                ></textarea>
              </div>

              <div>
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-3">System Integrity</span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className="font-label-caps text-[10px] uppercase text-on-surface">AI Inference Engine</span>
                    </div>
                    <span className="font-data-table text-[10px] text-on-surface-variant">{metadata.integrity.engine}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className="font-label-caps text-[10px] uppercase text-on-surface">Thermal Sensor Link</span>
                    </div>
                    <span className="font-data-table text-[10px] text-on-surface-variant">{metadata.integrity.link}</span>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>

        {/* Modal Footer Actions */}
        <div className="h-16 px-6 border-t border-outline-variant flex items-center justify-between shrink-0 bg-surface-container-highest">
          <div className="flex items-center gap-3">
            <button className="bg-surface-bright border border-outline-variant px-3 py-1.5 rounded font-label-caps text-[10px] uppercase hover:bg-surface-variant transition-colors text-on-surface">
              Archive Footage
            </button>
            <button className="bg-surface-bright border border-outline-variant px-3 py-1.5 rounded font-label-caps text-[10px] uppercase hover:bg-surface-variant transition-colors text-on-surface">
              Share Link
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="bg-outline-variant/20 border border-outline-variant text-on-surface px-4 py-1.5 rounded font-label-caps text-[10px] uppercase hover:bg-outline-variant transition-colors"
            >
              Dismiss Alert
            </button>
            <button 
              onClick={() => { onDispatch(alert, officerNotes); }}
              className="bg-primary text-on-primary px-5 py-1.5 rounded font-label-caps text-[10px] uppercase font-bold shadow-lg shadow-primary-container/20 hover:opacity-90 active:scale-95 transition-all"
            >
              Dispatch Response Unit
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

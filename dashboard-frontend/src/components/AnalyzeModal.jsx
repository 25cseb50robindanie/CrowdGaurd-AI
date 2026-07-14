import React, { useState } from 'react';

export default function AnalyzeModal({ alert, onClose, onDispatch }) {
  const [officerNotes, setOfficerNotes] = useState('');
  const [notesFocused, setNotesFocused] = useState(false);
  const [aiLayersActive, setAiLayersActive] = useState(true);

  if (!alert) return null;

  // Set default metadata if not provided
  const metadata = alert.aiMetadata || {
    congestion: "92.4%",
    count: "1,248",
    flowRate: "8.2 p/s",
    streamId: "CG-V-00912",
    integrity: { engine: "LATENCY 42ms", link: "NOMINAL" }
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
            {/* Density Stats Section */}
            <section className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Density Analytics</span>
                <span className="material-symbols-outlined text-primary">analytics</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Current Count</p>
                  <p className="font-data-display text-lg text-primary">{metadata.count}</p>
                </div>
                <div className="p-4 bg-surface-container-low border border-outline-variant rounded">
                  <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Flow Rate</p>
                  <p className="font-data-display text-lg text-secondary-fixed">
                    {metadata.flowRate.split(' ')[0]}
                    <span className="text-xs ml-1">p/s</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center text-on-surface">
                  <span className="font-body-md text-xs opacity-80">Saturation Level</span>
                  <span className="font-data-table text-xs text-error font-semibold">{metadata.congestion}</span>
                </div>
                <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                  <div 
                    className="bg-error h-full" 
                    style={{ width: metadata.congestion }}
                  ></div>
                </div>
              </div>
            </section>

            {/* Local Heat Map Section */}
            <section className="p-6">
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
                {/* Simulated Heatmap pulses */}
                <div className="absolute top-1/2 left-1/3 w-20 h-20 bg-error/30 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute top-1/4 right-1/4 w-12 h-12 bg-primary/25 rounded-full blur-md"></div>
                
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
              onClick={() => { onDispatch(alert); }}
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

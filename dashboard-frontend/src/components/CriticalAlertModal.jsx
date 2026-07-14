import React from 'react';

export default function CriticalAlertModal({ isOpen, onClose, onDispatch, onViewDetails }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-margin-mobile md:p-0 animate-in fade-in duration-300" id="alert-modal">
      
      {/* Semi-transparent Background with Blur */}
      <div 
        className="absolute inset-0 bg-surface-container-lowest/80 blur-overlay" 
        onClick={onClose}
      ></div>
      
      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-surface-container-high border border-error/30 rounded-xl shadow-2xl shadow-black/60 overflow-hidden transform transition-all animate-in zoom-in duration-300">
        
        {/* Red Warning Accent Bar */}
        <div className="h-1.5 w-full bg-error"></div>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined font-light">close</span>
        </button>

        <div className="p-8 md:p-10 flex flex-col items-center text-center">
          
          {/* Large Warning Icon with Pulse */}
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-error/20 rounded-full scale-150 critical-pulse"></div>
            <div className="relative bg-error-container w-20 h-20 rounded-full flex items-center justify-center border-4 border-error/40">
              <span className="material-symbols-outlined text-error text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
          </div>
          
          {/* Content */}
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3 tracking-tight">Immediate Attention Required</h2>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-error-container text-error rounded-full border border-error/20 mb-6">
            <span className="material-symbols-outlined text-sm animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
            <span className="font-label-caps text-[10px] uppercase tracking-wider">Priority Level: Critical</span>
          </div>
          
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 leading-relaxed max-w-sm">
            <span className="text-on-surface font-bold">Gate 4 - Critical Density:</span> Density rising rapidly near boarding point due to converging crowd inflow. Risk level RED.
          </p>
          
          {/* Actions */}
          <div className="w-full flex flex-col md:flex-row gap-4">
            <button 
              onClick={onDispatch}
              className="flex-1 bg-error hover:bg-error/90 text-on-error font-label-caps text-label-caps uppercase py-4 rounded-lg transition-all active:scale-95 shadow-lg shadow-error/20 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">shield</span>
              Dispatch Force
            </button>
            <button 
              onClick={onViewDetails}
              className="flex-1 bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-caps text-label-caps uppercase py-4 border border-outline-variant rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">analytics</span>
              View Full Details
            </button>
          </div>
        </div>
        
        {/* Footer Meta Info */}
        <div className="bg-surface-container-highest px-8 py-4 border-t border-outline-variant flex justify-between items-center text-on-surface-variant/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">schedule</span>
            <span className="font-data-table text-xs">DETECTED: 14:02:11 GMT+5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">location_on</span>
            <span className="font-data-table text-xs">ZONE_A_N_SEC</span>
          </div>
        </div>

      </div>
    </div>
  );
}

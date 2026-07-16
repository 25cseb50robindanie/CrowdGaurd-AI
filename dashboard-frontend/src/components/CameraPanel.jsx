import React from 'react';

export default function CameraPanel({ cameras, activeCameraId, onSelectCamera, onLinkCameraClick }) {
  return (
    <div id="cameras-section" className="grid grid-cols-2 lg:grid-cols-4 gap-gutter scroll-mt-20">
      {cameras.map((cam) => {
        const isActive = cam.id === activeCameraId;
        return (
          <button
            key={cam.id}
            onClick={() => onSelectCamera(cam)}
            className={`flex items-center space-x-3 p-3 rounded text-left transition-all ${
              isActive
                ? 'bg-primary-container text-on-primary-container border border-primary-container scale-[1.02]'
                : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <div
              className={`w-10 h-10 rounded flex items-center justify-center ${
                isActive ? 'bg-on-primary-container/20' : 'bg-outline-variant/30'
              }`}
            >
              <span className="material-symbols-outlined">videocam</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-label-caps text-[11px] opacity-80 uppercase">{cam.name}</p>
              <p className="font-body-md font-bold truncate">{cam.label}</p>
            </div>
          </button>
        );
      })}
      
      {/* Link Camera button */}
      <button 
        onClick={onLinkCameraClick}
        className="flex items-center justify-center space-x-2 p-3 border-2 border-dashed border-outline-variant text-on-surface-variant rounded hover:bg-surface-container-high transition-colors"
      >
        <span className="material-symbols-outlined">add_circle</span>
        <span className="font-label-caps text-label-caps">Link Camera</span>
      </button>
    </div>
  );
}

import React from 'react';

export default function DensityPanel({ zones }) {
  // Helper to map status to Tailwind color class
  const getColorClass = (status) => {
    switch (status) {
      case 'red':
        return 'bg-error';
      case 'amber':
        return 'bg-amber-500';
      case 'green':
      default:
        return 'bg-primary';
    }
  };

  const getTextColorClass = (status) => {
    switch (status) {
      case 'red':
        return 'text-error';
      case 'amber':
        return 'text-amber-500';
      case 'green':
      default:
        return 'text-primary';
    }
  };

  // Helper to calculate capacity percentage from density value
  // Let's assume maximum capacity density is 5.0 (individuals/m2)
  const getCapacityPercent = (density) => {
    return Math.min(Math.round((density / 4.5) * 100), 100);
  };

  const formatZoneName = (id) => {
    switch (id) {
      case 'gate4':
        return 'Gate 4 Entrance (Active)';
      case 'courtyard':
        return 'Main Courtyard';
      case 'mainpath':
        return 'Main Shrine Path';
      default:
        return id.charAt(0).toUpperCase() + id.slice(1);
    }
  };

  return (
    <div className="bg-surface-container border border-outline-variant rounded p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant">Zone Density Analytics</h3>
        <span className="material-symbols-outlined text-sm opacity-50">bar_chart</span>
      </div>
      <div className="space-y-4">
        {zones.map((zone) => {
          const capPercent = getCapacityPercent(zone.density);
          return (
            <div key={zone.zone_id}>
              <div className="flex justify-between mb-1">
                <span className="font-body-md text-xs text-on-surface">{formatZoneName(zone.zone_id)}</span>
                <span className={`font-data-table text-xs font-semibold ${getTextColorClass(zone.status)}`}>
                  {capPercent}% CAP
                </span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${getColorClass(zone.status)}`} 
                  style={{ width: `${capPercent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';

export default function StatCard({ zones, alerts, camerasCount }) {
  // Compute metrics dynamically from mock data
  const totalZones = zones.length;
  
  // Find highest risk zone (red priority, then amber, then green)
  const redZone = zones.find(z => z.status === 'red');
  const amberZone = zones.find(z => z.status === 'amber');
  const highestRiskZoneName = redZone 
    ? redZone.zone_id.toUpperCase() 
    : amberZone 
      ? amberZone.zone_id.toUpperCase() 
      : 'NONE';

  // Count active alerts (red + amber risk levels)
  const activeAlerts = alerts.filter(a => a.riskLevel === 'red' || a.riskLevel === 'amber').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
      {/* Total Zones */}
      <div className="bg-surface-container border border-outline-variant p-5 rounded">
        <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">Total Zones Monitored</p>
        <div className="flex items-baseline space-x-2">
          <span className="font-headline-lg text-headline-lg font-data-display">{totalZones}</span>
          <span className="text-on-surface-variant text-xs font-data-table uppercase">Active Segments</span>
        </div>
      </div>

      {/* Highest Risk Zone */}
      <div className="bg-error-container/20 border border-error p-5 rounded relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2">
          <span className="material-symbols-outlined text-error risk-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
        </div>
        <p className="font-label-caps text-label-caps text-error mb-2">Current Highest Risk Zone</p>
        <div className="flex items-baseline space-x-2">
          <span className="font-headline-lg text-headline-lg font-data-display text-error">
            {highestRiskZoneName === 'GATE4' ? 'Gate 4' : highestRiskZoneName}
          </span>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-surface-container border border-outline-variant p-5 rounded">
        <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">Active Alerts</p>
        <div className="flex items-baseline space-x-2">
          <span className="font-headline-lg text-headline-lg font-data-display text-primary">{activeAlerts}</span>
          <span className="text-on-surface-variant text-xs font-data-table uppercase">Critical</span>
        </div>
      </div>

      {/* Cameras Status */}
      <div className="bg-surface-container border border-outline-variant p-5 rounded">
        <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">Cameras Online</p>
        <div className="flex items-baseline space-x-2">
          <span className="font-headline-lg text-headline-lg font-data-display text-on-surface">{camerasCount}/{camerasCount}</span>
          <span className="text-on-surface-variant text-xs font-data-table uppercase">Functional</span>
        </div>
      </div>
    </div>
  );
}

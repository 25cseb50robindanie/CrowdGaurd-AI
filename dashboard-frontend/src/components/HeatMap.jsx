import React, { useState, useEffect } from 'react';

export default function HeatMap({ zones }) {
  // Safe default zone states
  const gate4Zone = zones ? zones.find(z => z.zone_id === 'gate4') : null;
  const gate4Status = gate4Zone ? gate4Zone.status : 'green';

  const courtyardZone = zones ? zones.find(z => z.zone_id === 'courtyard') : null;
  const courtyardStatus = courtyardZone ? courtyardZone.status : 'green';

  const mainpathZone = zones ? zones.find(z => z.zone_id === 'mainpath') : null;
  const mainpathStatus = mainpathZone ? mainpathZone.status : 'green';

  // Tile index to style mapping helper
  const getTileStyle = (tileId) => {
    // 1. Platform 1 (gate4) center-left hotspot
    if ([7, 8, 13, 14].includes(tileId)) {
      if (gate4Status === 'red') return 'bg-error/80 border border-error/50 animate-pulse shadow-inner';
      if (gate4Status === 'amber') return 'bg-amber-500/80 border border-amber-500/50 animate-pulse';
      return 'bg-primary/40 border border-primary/30';
    }
    
    // 2. Platform 2 (courtyard) top-left/center hotspot
    if ([1, 2, 6, 12].includes(tileId)) {
      if (courtyardStatus === 'red') return 'bg-error/80 border border-error/50 animate-pulse shadow-inner';
      if (courtyardStatus === 'amber') return 'bg-amber-500/80 border border-amber-500/50 animate-pulse';
      return 'bg-primary/35 border border-primary/25';
    }

    // 3. Platform 3 (mainpath) right-center hotspot
    if ([3, 9, 10, 15, 16].includes(tileId)) {
      if (mainpathStatus === 'red') return 'bg-error/80 border border-error/50 animate-pulse shadow-inner';
      if (mainpathStatus === 'amber') return 'bg-amber-500/80 border border-amber-500/50 animate-pulse';
      return 'bg-primary/30 border border-primary/20';
    }

    // 4. Background baseline activity
    if ([0, 4, 5, 11, 17, 20].includes(tileId)) {
      return 'bg-primary/15 border border-primary/10';
    }

    // 5. Calm inactive boundaries
    return 'bg-surface-container-lowest border border-outline-variant/10';
  };

  // State to track minor noise/fluctuations for aesthetics
  const [opacities, setOpacities] = useState({});

  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random tile to fluctuate opacity slightly
      const randomIdx = Math.floor(Math.random() * 24);
      const randomOpacity = (Math.random() * 0.4 + 0.6).toFixed(2); // 0.6 to 1.0
      setOpacities(prev => ({
        ...prev,
        [randomIdx]: parseFloat(randomOpacity)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Build 24 tiles (6 cols x 4 rows)
  const tiles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    style: getTileStyle(i),
    opacity: opacities[i] ?? 1.0
  }));

  return (
    <div className="bg-surface-container border border-outline-variant rounded p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant">Grid Heat Signature</h3>
        <span className="material-symbols-outlined text-sm opacity-50">grid_view</span>
      </div>
      <div className="grid grid-cols-6 grid-rows-4 gap-1 h-32">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={`${tile.style} rounded-sm transition-all duration-700`}
            style={{ opacity: tile.opacity }}
          />
        ))}
      </div>
    </div>
  );
}

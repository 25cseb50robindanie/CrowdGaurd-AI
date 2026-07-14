import React, { useState, useEffect } from 'react';

export default function HeatMap() {
  // Let's model the 24 tiles (6 columns x 4 rows)
  // Each tile has a base styling representing the Heat Signatures
  const initialTiles = [
    { id: 0, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    { id: 1, style: 'bg-primary/20 border border-primary/20' },
    { id: 2, style: 'bg-primary/40 border border-primary/30' },
    { id: 3, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    { id: 4, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    { id: 5, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    
    { id: 6, style: 'bg-primary/20 border border-primary/20' },
    { id: 7, style: 'bg-error/60 border border-error/40 animate-pulse' },
    { id: 8, style: 'bg-error risk-pulse' },
    { id: 9, style: 'bg-primary/60 border border-primary/40' },
    { id: 10, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    { id: 11, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    
    { id: 12, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    { id: 13, style: 'bg-primary/40 border border-primary/30' },
    { id: 14, style: 'bg-primary/60 border border-primary/40' },
    { id: 15, style: 'bg-primary/20 border border-primary/20' },
    { id: 16, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    { id: 17, style: 'bg-surface-container-highest/30 border border-outline-variant/10' },
    
    { id: 18, style: 'bg-surface-container-lowest border border-outline-variant/5' },
    { id: 19, style: 'bg-surface-container-lowest border border-outline-variant/5' },
    { id: 20, style: 'bg-primary/20 border border-primary/20' },
    { id: 21, style: 'bg-surface-container-lowest border border-outline-variant/5' },
    { id: 22, style: 'bg-surface-container-lowest border border-outline-variant/5' },
    { id: 23, style: 'bg-surface-container-lowest border border-outline-variant/5' }
  ];

  const [tiles, setTiles] = useState(initialTiles);

  useEffect(() => {
    const timer = setInterval(() => {
      // Pick a random tile and update its opacity
      setTiles(prevTiles => {
        const randomIndex = Math.floor(Math.random() * prevTiles.length);
        return prevTiles.map((tile, idx) => {
          if (idx === randomIndex) {
            // Random opacity between 0.4 and 1.0
            const opacity = (Math.random() * 0.6 + 0.4).toFixed(2);
            return {
              ...tile,
              opacity: parseFloat(opacity)
            };
          }
          return tile;
        });
      });
    }, 1500);

    return () => clearInterval(timer);
  }, []);

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
            className={`${tile.style} rounded-sm transition-opacity duration-700`}
            style={{ opacity: tile.opacity ?? 1 }}
          />
        ))}
      </div>
    </div>
  );
}

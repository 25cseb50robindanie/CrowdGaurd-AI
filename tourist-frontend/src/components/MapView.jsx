import React from 'react';
import './MapView.css';

export default function MapView({ location, zonesData, activeHotspot, onHotspotClick }) {
  // Get polled status color for a given zoneId
  const getZoneStatus = (zoneId) => {
    const zone = zonesData.find(z => z.zone_id === zoneId);
    return zone ? zone.status : 'green';
  };

  const getPinClass = (status) => {
    switch (status) {
      case 'red': return 'pin-red';
      case 'amber': return 'pin-amber';
      case 'green':
      default:
        return 'pin-green';
    }
  };

  return (
    <section className="map-view-card">
      <div className="map-canvas-container">
        {/* Schematic floor plan background from Stitch */}
        <div 
          className="map-image-backdrop"
          style={{ backgroundImage: `url(${location.mapConfig.backgroundImage})` }}
          aria-hidden="true"
        />
        
        {/* Centered Map Outline symbol */}
        <div className="map-center-overlay">
          <span className="material-symbols-outlined map-watermark-icon">map</span>
        </div>

        {/* Marker overlays */}
        <div className="map-hotspots-overlay">
          {location.mapConfig.hotspots.map((hotspot) => {
            const status = getZoneStatus(hotspot.zoneId);
            const pinClass = getPinClass(status);
            const isSelected = activeHotspot === hotspot.zoneId;

            return (
              <div 
                key={hotspot.zoneId}
                className={`map-marker-pin ${pinClass} ${isSelected ? 'active-pin' : ''}`}
                style={{ top: hotspot.top, left: hotspot.left }}
                onClick={() => onHotspotClick(hotspot.zoneId)}
              >
                {/* Tooltip Label */}
                <div className="marker-label-box">
                  <span className="marker-label-text">{hotspot.label}</span>
                </div>
                
                {/* Pulse Ring Indicator */}
                <div className="marker-pin-wrapper">
                  <span className="material-symbols-outlined location-pin-symbol">location_on</span>
                  <span className={`marker-pulse-ring ring-${status}`}></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

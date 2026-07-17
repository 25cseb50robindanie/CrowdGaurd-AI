import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import HamburgerMenu from '../components/HamburgerMenu';
import MapView from '../components/MapView';
import ZoneStatusCard from '../components/ZoneStatusCard';
import BottomNavBar from '../components/BottomNavBar';
import './LocationDetail.css';

export default function LocationDetail({ locations, zonesData }) {
  const { locationId } = useParams();
  const navigate = useNavigate();
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const zoneRefs = useRef({});

  // Find corresponding location object
  const location = locations.find(loc => loc.id === locationId);

  // Fallback if location not found
  if (!location) {
    return (
      <div className="location-detail-page error-page container-padding">
        <h2 className="error-title">Location Not Found</h2>
        <p className="error-desc">The requested location could not be located in our active monitoring indices.</p>
        <button className="back-to-home-btn" onClick={() => navigate('/')}>Return Home</button>
      </div>
    );
  }

  // Filter dynamic zones data for zones in this location
  const locationZones = zonesData.filter(z => location.zones.includes(z.zone_id));

  // Scroll to selected zone card when clicking map pins
  const handleHotspotClick = (zoneId) => {
    setActiveHotspot(zoneId);
    
    // Smooth scroll to the target zone card
    const targetCard = zoneRefs.current[zoneId];
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const zoneLabels = {
    gate4: "Platform 1",
    courtyard: "Platform 2",
    mainpath: "Platform 3",
    pier1: "East Wing Walk",
    seafoodmarket: "Central Court",
    fountaingrade: "North Checkpoint",
    meadoweast: "Main Arena Stand"
  };

  const getZoneLabel = (zoneId) => {
    if (zoneLabels[zoneId]) return zoneLabels[zoneId];
    if (zoneId.startsWith("plt")) {
      const num = zoneId.replace("plt", "");
      return `Platform ${num.toUpperCase()}`;
    }
    return `Platform ${zoneId.toUpperCase()}`;
  };

  return (
    <div className="location-detail-page animate-fade-in">
      <TopBar onMenuOpen={() => setIsMenuOpen(true)} />
      <HamburgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Back Button Subbar */}
      <div className="detail-navigation-bar desktop-container">
        <button className="detail-back-button" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Locations</span>
        </button>
      </div>

      <main className="detail-main desktop-container">
        <div className="detail-responsive-layout">
          
          {/* Left Column (Map & Description) */}
          <div className="detail-left-column">
            <div className="location-meta-header">
              <span className="detail-location-category">{location.category}</span>
              <h2 className="detail-location-title">{location.name}</h2>
            </div>
            
            <p className="detail-location-description">{location.description}</p>
            
            <div className="detail-map-wrapper">
              <MapView 
                location={location} 
                zonesData={zonesData}
                activeHotspot={activeHotspot}
                onHotspotClick={handleHotspotClick}
              />
            </div>
            
            <button 
              className="cta-nav-button mobile-hide" 
              onClick={() => alert(`Directions loaded for ${location.name}. Please follow signs to the main doors.`)}
            >
              <span className="material-symbols-outlined">directions_walk</span>
              Start Navigation
            </button>
          </div>

          {/* Right Column (Zones list status cards) */}
          <div className="detail-right-column">
            <div className="zones-header-row">
              <h2 className="zones-title">Live Zone Status</h2>
              <span className="auto-refresh-pill">
                <span className="material-symbols-outlined refresh-icon">history</span>
                AUTO-REFRESH ON
              </span>
            </div>
            
            <div className="zones-stack">
              {locationZones.map((zone) => (
                <div 
                  key={zone.zone_id} 
                  ref={el => zoneRefs.current[zone.zone_id] = el}
                  onClick={() => setActiveHotspot(zone.zone_id)}
                >
                  <ZoneStatusCard 
                    zone={zone}
                    label={getZoneLabel(zone.zone_id)}
                    isHighlighted={activeHotspot === zone.zone_id}
                  />
                </div>
              ))}
            </div>

            <button 
              className="cta-nav-button desktop-hide" 
              onClick={() => alert(`Directions loaded for ${location.name}. Please follow signs to the main doors.`)}
            >
              <span className="material-symbols-outlined">directions_walk</span>
              Start Navigation
            </button>
          </div>
          
        </div>
      </main>

      {/* Sticky Bottom Nav Bar for Mobile Viewports */}
      <BottomNavBar />
    </div>
  );
}

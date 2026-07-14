import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LocationCard.css';

export default function LocationCard({ location, zonesData }) {
  const navigate = useNavigate();

  // Filter dynamic zones to find those linked to this location
  const locationZones = zonesData.filter(z => location.zones.includes(z.zone_id));

  // Determine overall status (worst of zones: red > amber > green)
  let overallStatus = 'green';
  if (locationZones.some(z => z.status === 'red')) {
    overallStatus = 'red';
  } else if (locationZones.some(z => z.status === 'amber')) {
    overallStatus = 'amber';
  }

  // Map safety indicators to Stitch names and styles
  const getStatusConfig = (status) => {
    switch (status) {
      case 'red':
        return { label: 'Avoid', class: 'badge-red', icon: 'warning', volume: 'Max Capacity' };
      case 'amber':
        return { label: 'Getting Busy', class: 'badge-amber', icon: 'trending_up', volume: 'Rising Traffic' };
      case 'green':
      default:
        return { label: 'Safe', class: 'badge-green', icon: 'group', volume: 'Low Volume' };
    }
  };

  const statusConfig = getStatusConfig(overallStatus);

  const handleCardClick = () => {
    navigate(`/location/${location.id}`);
  };

  return (
    <article 
      className="location-card" 
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(); }}
    >
      {/* Thumbnail Left */}
      <div className="location-card-thumbnail">
        <img 
          src={location.image} 
          alt={location.name} 
          className="thumbnail-img" 
          loading="lazy"
        />
      </div>
      
      {/* Details Right */}
      <div className="location-card-details">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="material-symbols-outlined category-icon">{location.icon}</span>
            <h3 className="card-title">{location.name}</h3>
          </div>
        </div>

        <div className="card-footer-row">
          <div className="card-volume-info">
            <span className="material-symbols-outlined volume-icon">{statusConfig.icon}</span>
            <span className="volume-label">{location.volumeText || statusConfig.volume}</span>
          </div>
          
          <span className={`card-status-badge ${statusConfig.class}`}>
            <span className="badge-pulse-dot"></span>
            {statusConfig.label}
          </span>
        </div>
      </div>
    </article>
  );
}

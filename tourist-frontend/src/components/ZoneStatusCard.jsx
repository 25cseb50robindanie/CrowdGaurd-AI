import React from 'react';
import './ZoneStatusCard.css';

export default function ZoneStatusCard({ zone, label, isHighlighted }) {
  const { zone_id, status, density, message } = zone;

  // Stitch dynamic safety status translations and styles
  const getBadgeDetails = (statusVal) => {
    switch (statusVal) {
      case 'red':
        return { label: 'Avoid', class: 'badge-avoid', pulseClass: 'pulse-avoid' };
      case 'amber':
        return { label: 'Getting Busy', class: 'badge-busy', pulseClass: 'pulse-busy' };
      case 'green':
      default:
        return { label: 'Safe', class: 'badge-safe', pulseClass: 'pulse-safe' };
    }
  };

  const badgeDetails = getBadgeDetails(status);

  // Map zone IDs to their specific mock public images from Stitch
  const getZoneThumbnail = (id) => {
    switch (id) {
      case 'gate4': // Platform 1
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCIHSbCvUy7lGwnOvFBZOmUYV_-cnv04zKNxbRnOcAdts26XdFwaFK-NJbZjowJ7GYWmSIsPh1OGqbaTuMMOgv4cH1V63LSt3F4iMPHIczqgAZvZs5fPZDg8_39-n1OrjLjrqhqrHad0sek0SrMqXH1YeqA_WY_qqE5b2x2L4J0ITBAxP2ghbVh_btm9uwPT1wDc7XQOG_s_koHfwh5m0C8KAcc-csZxtM70nnY-3q7vmKSGJglwQnvvDRLAcrgXIu7ADXvXBGLqlA';
      case 'courtyard': // Platform 2
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuC9zjhJ4bZcBNVbI71GL6fPF23HCn3eU4xSwITkYZVKbFiX6eohXe346Z1BFeahwfd3aVqkkdYi4SSuIJInK1aKEMk4yTOaG4l4tm3o54LzpPsz6h7Q8x-6Byo9kwtmC5RRGBlFGQAnQQwvz0DAj6DgCqHbCw-3mX54gDkwSKoucWHMmfhguTHp-PCdOFTPEStn1Z8mvAVK5B2gRrX1q_adqS4XpY8elEHYdq1XxpExi1_EZb75vJcdDizeJfeanWikQ8QRZaCO-WM';
      case 'mainpath': // Platform 3
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYdSpFcLvynk62miRSidlaf_ZhqzD1zNCsNBo6PtA5WeoHQw-agCoRxDGTCD0ufzju7fqIYnhOdArT4A28PD2MeGGNLhk0dkdCYNptWFFVP6i3dQbxLKPT4vYxQOZiBmK__rZzfN2lGGPg8uxNuR7V8DCpBUjzhLAeDxNyy7QHQBYVufuEypp0VFdK1csYfYOahw2gu3Pal3k4FYHIBUL9fTXtkk0U9kW1O1SNP8E8Y2uRAuGMakhZUuinnpMe7X-hATrZoRWWTg4';
      
      // Fallback for other locations
      case 'pier1': // East Wing Walk
      case 'fountaingrade':
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCIHSbCvUy7lGwnOvFBZOmUYV_-cnv04zKNxbRnOcAdts26XdFwaFK-NJbZjowJ7GYWmSIsPh1OGqbaTuMMOgv4cH1V63LSt3F4iMPHIczqgAZvZs5fPZDg8_39-n1OrjLjrqhqrHad0sek0SrMqXH1YeqA_WY_qqE5b2x2L4J0ITBAxP2ghbVh_btm9uwPT1wDc7XQOG_s_koHfwh5m0C8KAcc-csZxtM70nnY-3q7vmKSGJglwQnvvDRLAcrgXIu7ADXvXBGLqlA';
      case 'seafoodmarket': // Central Court
      case 'meadoweast':
      default:
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYdSpFcLvynk62miRSidlaf_ZhqzD1zNCsNBo6PtA5WeoHQw-agCoRxDGTCD0ufzju7fqIYnhOdArT4A28PD2MeGGNLhk0dkdCYNptWFFVP6i3dQbxLKPT4vYxQOZiBmK__rZzfN2lGGPg8uxNuR7V8DCpBUjzhLAeDxNyy7QHQBYVufuEypp0VFdK1csYfYOahw2gu3Pal3k4FYHIBUL9fTXtkk0U9kW1O1SNP8E8Y2uRAuGMakhZUuinnpMe7X-hATrZoRWWTg4';
    }
  };

  return (
    <article className={`zone-status-card ${isHighlighted ? 'active-highlight' : ''}`}>
      <div className="zone-header-row">
        <div className="zone-header-left">
          {/* Zone Image Thumbnail */}
          <div className="zone-img-wrapper">
            <img 
              src={getZoneThumbnail(zone_id)} 
              alt={label || zone_id} 
              className="zone-img"
              loading="lazy"
            />
          </div>
          
          <div className="zone-title-group">
            <h3 className="zone-title">{label || zone_id}</h3>
            
            <div className="zone-pulse-update">
              {/* Pulse Indicator */}
              <div className={`pulse-indicator ${badgeDetails.pulseClass}`}></div>
              <span className="zone-update-text">Live Polling • updated just now</span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`zone-badge ${badgeDetails.class}`}>
          {badgeDetails.label}
        </span>
      </div>

      {/* Warning Advisory description */}
      <p className="zone-desc-message">
        {message}
      </p>
      
      {/* Density value and meter bar */}
      <div className="zone-density-info">
        <div className="density-meta">
          <span className="density-title">Current density</span>
          <span className="density-value">{density.toFixed(1)} people/m²</span>
        </div>
        <div className="density-progress-bg">
          <div 
            className={`density-progress-fill fill-${status}`} 
            style={{ width: `${Math.min(100, (density / 5.0) * 100)}%` }}
          ></div>
        </div>
      </div>
    </article>
  );
}

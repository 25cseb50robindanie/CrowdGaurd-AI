import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNavBar.css';

export default function BottomNavBar({ onSearchFocus }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isHomeActive = location.pathname === '/';
  const isMapActive = location.pathname.includes('/location/');

  const handleHomeClick = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchClick = () => {
    navigate('/');
    setTimeout(() => {
      if (onSearchFocus) {
        onSearchFocus();
      } else {
        const input = document.querySelector('.search-input');
        if (input) input.focus();
      }
    }, 100);
  };

  const handleAlertsClick = () => {
    alert("Alerts Log:\n• Platform 1 (Central Station) is building up density.\n• Seafood Market (City Mall) is caution status.");
  };

  const handleMapClick = () => {
    navigate('/location/central-station');
  };

  return (
    <nav className="bottom-navbar">
      <div className="bottom-navbar-container">
        {/* Home */}
        <button 
          className={`nav-item ${isHomeActive && !document.activeElement?.className?.includes('search') ? 'active' : ''}`}
          onClick={handleHomeClick}
          aria-label="Go to Home"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isHomeActive ? "'FILL' 1" : "'FILL' 0" }}>home</span>
          <span className="nav-label">HOME</span>
        </button>

        {/* Search */}
        <button 
          className="nav-item" 
          onClick={handleSearchClick}
          aria-label="Focus Search"
        >
          <span className="material-symbols-outlined">search</span>
          <span className="nav-label">SEARCH</span>
        </button>

        {/* Map */}
        <button 
          className={`nav-item ${isMapActive ? 'active' : ''}`}
          onClick={handleMapClick}
          aria-label="Go to Map"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: isMapActive ? "'FILL' 1" : "'FILL' 0" }}>map</span>
          <span className="nav-label">MAP</span>
        </button>

        {/* Alerts */}
        <button 
          className="nav-item alerts-item"
          onClick={handleAlertsClick}
          aria-label="View Safety Alerts"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="nav-label">ALERTS</span>
          <span className="alerts-badge-dot"></span>
        </button>
      </div>
    </nav>
  );
}

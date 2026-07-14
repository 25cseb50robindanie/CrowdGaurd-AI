import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './TopBar.css';

export default function TopBar({ onMenuOpen }) {
  const navigate = useNavigate();

  const handleHomeClick = (e) => {
    e.preventDefault();
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAlertsClick = (e) => {
    e.preventDefault();
    alert("Safety Advisories:\n• Central Railway Station: Live zones polling actively.\n• Platform 1 is increasing in volume.");
  };

  return (
    <header className="topbar">
      <div className="topbar-container">
        {/* Logo and App Title */}
        <div className="topbar-brand" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
          <span className="brand-title">CrowdGuard AI</span>
        </div>
        
        {/* Desktop-Only Inline Navigation Links */}
        <nav className="desktop-nav">
          <a href="/" onClick={handleHomeClick} className="desktop-nav-link">Home</a>
          <a href="#" onClick={handleAlertsClick} className="desktop-nav-link">Active Alerts</a>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); alert("Emergency Assistance:\nIn case of critical crowd blockages or disasters, dial 119 immediately."); }} 
            className="desktop-nav-link emergency"
          >
            Emergency Contact
          </a>
        </nav>

        {/* Mobile-Only Hamburger Toggle button */}
        <button className="menu-toggle-btn" onClick={onMenuOpen} aria-label="Open Menu">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
    </header>
  );
}

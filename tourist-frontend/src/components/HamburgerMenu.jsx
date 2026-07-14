import React from 'react';
import './HamburgerMenu.css';

export default function HamburgerMenu({ isOpen, onClose }) {
  return (
    <div className={`hamburger-menu-container ${isOpen ? 'open' : ''}`}>
      {/* Backdrop overlay */}
      <div className="menu-backdrop" onClick={onClose}></div>
      
      {/* Drawer panel */}
      <aside className="menu-drawer glass-panel">
        <div className="menu-header">
          <h2 className="menu-title">Safety Menu</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="#D6D0C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <nav className="menu-nav">
          <ul>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }} className="nav-link active">
                <span className="link-icon">🏠</span>
                Home & Search
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); alert("General Safety Guidance:\n• Check active zone densities before entering crowded shrines or parks.\n• Avoid 'red' status areas where bottlenecks are likely.\n• Keep emergency contacts handy in high-traffic landmarks."); onClose(); }} className="nav-link">
                <span className="link-icon">🛡️</span>
                Safety Guidelines
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); alert("Emergency Hotline: dial 119 for disaster management and police assistance."); onClose(); }} className="nav-link emergency">
                <span className="link-icon">📞</span>
                Emergency Contacts
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); alert("About CrowdGuard AI:\nThis public tourist app displays live zone congestion statuses. Data is compiled from local camera feeds and processing services. No private personal credentials or registrations are required."); onClose(); }} className="nav-link">
                <span className="link-icon">ℹ️</span>
                About System
              </a>
            </li>
          </ul>
        </nav>
        
        <div className="menu-footer">
          <p className="footer-tag">CROWDGUARD PUBLIC v1.0.4</p>
          <p className="footer-desc">Public companion app. Powered by CrowdGuard AI engines.</p>
        </div>
      </aside>
    </div>
  );
}

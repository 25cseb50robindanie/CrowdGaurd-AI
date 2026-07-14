import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import SearchBar from '../components/SearchBar';
import LocationCard from '../components/LocationCard';
import HamburgerMenu from '../components/HamburgerMenu';
import BottomNavBar from '../components/BottomNavBar';
import './Home.css';

export default function Home({ locations, zonesData }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // Filter locations by name, category, or description matching query
  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const focusSearchInput = () => {
    const input = document.querySelector('.search-input');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleOpenMapClick = () => {
    // Navigate to the main transit hub
    navigate('/location/central-station');
  };

  return (
    <div className="home-page animate-fade-in">
      <TopBar onMenuOpen={() => setIsMenuOpen(true)} />
      <HamburgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <main className="home-main desktop-container">
        {/* Hero Section */}
        <section className="hero-section">
          <h1 className="hero-title">Know before you go</h1>
          <p className="hero-desc">Check real-time crowd safety for your destination.</p>
        </section>

        {/* Search Input */}
        <section className="search-section">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </section>

        {searchQuery ? (
          <section className="search-results-section">
            <h3 className="section-title">Search Results ({filteredLocations.length})</h3>
            {filteredLocations.length > 0 ? (
              <div className="locations-grid">
                {filteredLocations.map(location => (
                  <LocationCard
                    key={location.id}
                    location={location}
                    zonesData={zonesData}
                  />
                ))}
              </div>
            ) : (
              <div className="no-results shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
                <span className="material-symbols-outlined no-results-icon">search_off</span>
                <p className="no-results-text">No locations matched your search.</p>
                <button className="reset-search-btn" onClick={() => setSearchQuery('')}>Clear Query</button>
              </div>
            )}
          </section>
        ) : (
          /* Default Page Sections */
          <>
            <section className="trending-section">
              <div className="trending-header">
                <h2 className="trending-title">Trending Locations</h2>
                <button 
                  className="view-all-btn"
                  onClick={focusSearchInput}
                >
                  View All
                </button>
              </div>
              
              {/* Stack layout: turns into 3-column grid on desktop, 1-column stack on mobile */}
              <div className="locations-grid">
                {locations.map(location => (
                  <LocationCard 
                    key={location.id} 
                    location={location} 
                    zonesData={zonesData} 
                  />
                ))}
              </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
              <button className="cta-map-button" onClick={handleOpenMapClick}>
                <span className="material-symbols-outlined cta-icon">map</span>
                Open Safety Map
              </button>
            </section>
          </>
        )}
      </main>

      {/* Sticky Bottom Nav Bar for Mobile Viewports */}
      <BottomNavBar onSearchFocus={focusSearchInput} />
    </div>
  );
}

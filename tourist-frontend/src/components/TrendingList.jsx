import React from 'react';
import LocationCard from './LocationCard';
import './TrendingList.css';

export default function TrendingList({ locations, zonesData }) {
  // Take the first two locations to show as "Trending"
  const trendingLocations = locations.slice(0, 2);

  return (
    <section className="trending-section">
      <div className="trending-header">
        <h2 className="trending-title">Trending Now</h2>
        <span className="trending-subtitle">Popular tourist spaces under active watch</span>
      </div>
      <div className="trending-list">
        {trendingLocations.map(location => (
          <LocationCard 
            key={location.id} 
            location={location} 
            zonesData={zonesData} 
          />
        ))}
      </div>
    </section>
  );
}

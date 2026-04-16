import React from 'react';
import { TAB_CONFIG } from '../data/filters';

export default function FilterBar({ filters, activeTab, activeFilter, onTabChange, onFilterChange }) {
  const tabs = Object.keys(TAB_CONFIG);

  return (
    <>
      <div className="nav-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {TAB_CONFIG[tab].label}
          </button>
        ))}
      </div>

      <div className="button-grid">
        {(filters[activeTab] || []).map(filter => (
          <button
            key={filter}
            className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => onFilterChange(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
    </>
  );
}

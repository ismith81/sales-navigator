import React from 'react';
import { TAB_CONFIG } from '../data/filters';

export default function FilterBar({ filters, painpoints = {}, activeTab, activeFilter, onTabChange, onFilterChange }) {
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
        {(filters[activeTab] || []).map(filter => {
          const hint = activeTab === 'behoeften' ? painpoints[filter] : null;
          return (
            <button
              key={filter}
              className={`filter-btn ${activeFilter === filter ? 'active' : ''} ${hint ? 'has-hint' : ''}`}
              onClick={() => onFilterChange(filter)}
            >
              <span className="filter-btn-label">{filter}</span>
              {hint && (
                <span
                  className="filter-btn-hint"
                  dangerouslySetInnerHTML={{ __html: hint }}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

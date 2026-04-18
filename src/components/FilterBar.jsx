import React, { useState, useEffect } from 'react';
import { TAB_CONFIG } from '../data/filters';

const HINTS_STORAGE_KEY = 'sn.showFilterHints';

// Feather-style tab-iconen (stroke-based, currentColor, 16px).
// Doelen = target, Behoeften = lightbulb, Diensten = layers.
function TabIcon({ tab }) {
  const common = {
    width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (tab === 'doelen') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }
  if (tab === 'behoeften') {
    return (
      <svg {...common}>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.3 1 2.1V18h6v-1.2c0-.8.3-1.5 1-2.1A7 7 0 0 0 12 2z" />
      </svg>
    );
  }
  if (tab === 'diensten') {
    return (
      <svg {...common}>
        <polygon points="12 2 22 7 12 12 2 7 12 2" />
        <polyline points="2 12 12 17 22 12" />
        <polyline points="2 17 12 22 22 17" />
      </svg>
    );
  }
  return null;
}

function readStoredHints() {
  try {
    const raw = localStorage.getItem(HINTS_STORAGE_KEY);
    if (raw === null) return true; // default aan
    return raw === 'true';
  } catch {
    return true;
  }
}

export default function FilterBar({ filters, topics = {}, activeTab, activeFilter, onTabChange, onFilterChange }) {
  const tabs = Object.keys(TAB_CONFIG);
  const [showHints, setShowHints] = useState(readStoredHints);

  useEffect(() => {
    try { localStorage.setItem(HINTS_STORAGE_KEY, String(showHints)); } catch {}
  }, [showHints]);

  // Toggle alleen tonen als er überhaupt hints ingevuld zijn — anders geen toegevoegde waarde.
  const hasAnyHints = tabs.some(tab =>
    (filters[tab] || []).some(name => !!(topics?.[tab]?.[name]?.signals || '').trim())
  );

  return (
    <>
      <div className="nav-tabs-row">
        <div className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              <span className="nav-tab-icon"><TabIcon tab={tab} /></span>
              <span className="nav-tab-label">{TAB_CONFIG[tab].label}</span>
            </button>
          ))}
        </div>
        {hasAnyHints && (
          <button
            type="button"
            className={`hints-toggle ${showHints ? 'on' : 'off'}`}
            onClick={() => setShowHints(v => !v)}
            aria-pressed={showHints}
            title={showHints ? 'Verberg klantsignalen' : 'Toon klantsignalen'}
          >
            <span className="hints-toggle-icon" aria-hidden="true">
              {showHints ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.8 19.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.8 19.8 0 0 1-3.17 4.19M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </span>
            <span className="hints-toggle-label">Klantsignalen</span>
          </button>
        )}
      </div>

      <div className={`button-grid ${showHints ? 'show-hints' : 'hide-hints'}`}>
        {(filters[activeTab] || []).map(filter => {
          const hint = topics?.[activeTab]?.[filter]?.signals || '';
          return (
            <button
              key={filter}
              className={`filter-btn ${activeFilter === filter ? 'active' : ''} ${hint ? 'has-hint' : ''}`}
              onClick={() => onFilterChange(filter)}
            >
              <span className="filter-btn-label">{filter}</span>
              {hint && showHints && (
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

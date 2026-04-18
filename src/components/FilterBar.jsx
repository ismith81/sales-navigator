import React, { useState, useEffect } from 'react';
import { TAB_CONFIG } from '../data/filters';

const HINTS_STORAGE_KEY = 'sn.showFilterHints';

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
              {TAB_CONFIG[tab].label}
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

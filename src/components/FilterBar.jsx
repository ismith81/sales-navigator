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
            title={showHints ? 'Verberg pijnpunten onder de topics' : 'Toon pijnpunten onder de topics'}
          >
            <span className="hints-toggle-icon" aria-hidden="true">{showHints ? '👁' : '👁‍🗨'}</span>
            <span className="hints-toggle-label">Pijnpunten {showHints ? 'aan' : 'uit'}</span>
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

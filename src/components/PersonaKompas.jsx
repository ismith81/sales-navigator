import React, { useState } from 'react';
import { PersonaIcon } from '../lib/personaIcons.jsx';

// Compacte 2x2 zonder redundante axis-labels — de quad-titels dragen die info al.

// 2x2 kompas — domain (business/tech) × niveau (strategisch/operationeel).
// Gebruikers kunnen meer dan 4 personas hebben; de 4 kwadranten tonen de eerste match.
// Overige personas komen als "Overige" onder de matrix.
function bucketOf(p) {
  const d = p.domain === 'tech' ? 'tech' : 'business';
  const n = p.niveau === 'operationeel' ? 'operationeel' : 'strategisch';
  return `${d}-${n}`;
}

export default function PersonaKompas({ personas = {}, activePersona, onSelect }) {
  // Start ingeklapt: persona is een optionele coach-laag, niet stap 1 in de flow.
  // De gebruiker opent het alleen als ze weet wie ze spreekt.
  const [collapsed, setCollapsed] = useState(true);
  const [showSignals, setShowSignals] = useState(false);

  const list = Object.values(personas).sort((a, b) => (a.order || 99) - (b.order || 99));
  if (list.length === 0) return null;

  // Primaire persona per bucket = laagste order
  const buckets = { 'business-strategisch': null, 'tech-strategisch': null, 'business-operationeel': null, 'tech-operationeel': null };
  const overflow = [];
  for (const p of list) {
    const b = bucketOf(p);
    if (buckets[b] === null) buckets[b] = p;
    else overflow.push(p);
  }

  const active = activePersona ? personas[activePersona] : null;

  const renderQuad = (bucketKey, gridClass) => {
    const p = buckets[bucketKey];
    if (!p) {
      return (
        <div className={`kompas-quad kompas-quad-empty ${gridClass}`}>
          <span className="kompas-quad-empty-label">—</span>
        </div>
      );
    }
    const isActive = activePersona === p.id;
    return (
      <button
        key={p.id}
        type="button"
        className={`kompas-quad ${gridClass} ${isActive ? 'active' : ''}`}
        onClick={() => onSelect(isActive ? null : p.id)}
        title={p.roles || p.label}
      >
        <span className="kompas-quad-icon" aria-hidden="true">
          <PersonaIcon name={p.icon} size={22} />
        </span>
        <span className="kompas-quad-title">{p.label}</span>
        {p.roles && <span className="kompas-quad-roles">{p.roles}</span>}
      </button>
    );
  };

  return (
    <div className={`kompas ${collapsed ? 'kompas--collapsed' : ''}`}>
      <div className="kompas-header">
        <button
          type="button"
          className="kompas-title-btn"
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Kompas openen' : 'Kompas inklappen'}
        >
          <svg className="kompas-title-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="10" cy="7" r="4" />
            <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="kompas-title-text">Met wie praat je?</span>
          <span className="kompas-chevron">{collapsed ? '▸' : '▾'}</span>
        </button>
        {active && !collapsed && (
          <button
            type="button"
            className="kompas-clear"
            onClick={() => onSelect(null)}
          >
            Wissen
          </button>
        )}
        {active && collapsed && (
          <span className="kompas-collapsed-chip">
            <PersonaIcon name={active.icon} size={14} />
            <strong>{active.label}</strong>
            <button
              type="button"
              className="kompas-collapsed-clear"
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              title="Wissen"
            >✕</button>
          </span>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="kompas-grid">
            {renderQuad('business-strategisch', 'kompas-q1')}
            {renderQuad('tech-strategisch', 'kompas-q2')}
            {renderQuad('business-operationeel', 'kompas-q3')}
            {renderQuad('tech-operationeel', 'kompas-q4')}
          </div>

          {overflow.length > 0 && (
            <div className="kompas-overflow">
              <span className="kompas-overflow-label">Overige:</span>
              {overflow.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`kompas-overflow-chip ${activePersona === p.id ? 'active' : ''}`}
                  onClick={() => onSelect(activePersona === p.id ? null : p.id)}
                >
                  <PersonaIcon name={p.icon} size={14} /> {p.label}
                </button>
              ))}
            </div>
          )}

          {active && (
            <div className="kompas-helper">
              <div className="kompas-helper-main">
                {active.coaching ? (
                  <span className="kompas-helper-coach">{active.coaching}</span>
                ) : (
                  <span className="kompas-helper-coach kompas-helper-coach--empty">Geen coaching-tekst ingevuld.</span>
                )}
                {active.signals && (
                  <button
                    type="button"
                    className="kompas-signals-toggle"
                    onClick={() => setShowSignals(v => !v)}
                  >
                    {showSignals ? 'Verberg herkenningspunten' : 'Toon herkenningspunten'} {showSignals ? '▴' : '▾'}
                  </button>
                )}
              </div>
              {showSignals && active.signals && (
                <div
                  className="kompas-helper-signals rich-text"
                  dangerouslySetInnerHTML={{ __html: active.signals }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

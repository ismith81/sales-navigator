import React from 'react';
import ReferenceCard from './ReferenceCard';
import { PersonaIcon } from '../lib/personaIcons.jsx';

const TAG_CLASS = { doelen: 'doel', behoeften: 'behoefte', diensten: 'dienst' };

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').trim();
}

function matches(caseData, query) {
  const q = query.toLowerCase();
  const haystack = [
    caseData.name,
    caseData.subtitle,
    ...(caseData.keywords || []),
    ...Object.values(caseData.mapping || {}).flat(),
    stripHtml(caseData.situatie),
    stripHtml(caseData.resultaat),
    stripHtml(caseData.businessImpact),
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

export default function CasesOverview({ cases, personas = {}, searchQuery, heading, hint, activeTab, activeFilter, activePersona }) {
  let filtered = cases;
  if (searchQuery?.trim()) {
    filtered = filtered.filter(c => matches(c, searchQuery.trim()));
  }
  if (activeFilter && activeTab) {
    filtered = filtered.filter(c => c.mapping?.[activeTab]?.includes(activeFilter));
  }
  if (activePersona) {
    filtered = filtered.filter(c => (c.mapping?.personas || []).includes(activePersona));
  }

  return (
    <div className="cases-overview">
      {heading && (
        <div className="co-header">
          <h2>{heading}</h2>
        </div>
      )}
      {hint && <p className="co-hint">{hint}</p>}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon-large">🔍</div>
          <p>Geen cases gevonden{searchQuery ? ` voor "${searchQuery}"` : ''}.</p>
        </div>
      ) : (
        <div className="co-grid">
          {filtered.map(c => (
            <CasePreviewCard key={c.id} caseData={c} personas={personas} />
          ))}
        </div>
      )}
    </div>
  );
}

function CasePreviewCard({ caseData, personas = {} }) {
  const [expanded, setExpanded] = React.useState(false);
  const preview = stripHtml(caseData.businessImpact) || stripHtml(caseData.resultaat);
  // Doelen/behoeften/diensten tags maakten de cards te druk in 't Gids-overzicht.
  // Branche-chip + persona-badges blijven (dat is identiteit op één regel);
  // de strategische mapping-tags zijn beschikbaar zodra je de card uitklapt.

  if (expanded) {
    return (
      <div className="co-card co-card--expanded">
        <button className="co-collapse" onClick={() => setExpanded(false)} title="Inklappen">✕</button>
        <ReferenceCard caseData={caseData} personas={personas} lockOpen />
      </div>
    );
  }

  return (
    <div className="co-card" onClick={() => setExpanded(true)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); } }}>
      <div className="co-card-head">
        <div
          className="co-logo"
          style={{ background: `linear-gradient(135deg, ${caseData.logoColor}, ${caseData.logoColor}cc)` }}
        >
          {caseData.logoText}
        </div>
        <div className="co-title-wrap">
          <div className="co-name">{caseData.name}</div>
          <div className="co-subtitle">{caseData.subtitle}</div>
          {(caseData.mapping?.personas || []).length > 0 && (
            <div className="co-persona-strip" title="Gekoppelde persona's">
              {(caseData.mapping.personas || []).map(pid => {
                const p = personas[pid];
                if (!p) return null;
                return (
                  <span key={pid} className="co-persona-badge" title={p.label}>
                    <PersonaIcon name={p.icon} size={14} />
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {(caseData.mapping?.branches || []).length > 0 && (
        <div className="co-branches">
          {(caseData.mapping.branches || []).map(b => (
            <span key={b} className="tag branche small">{b}</span>
          ))}
        </div>
      )}
      {preview && <div className="co-preview">{preview}</div>}
    </div>
  );
}

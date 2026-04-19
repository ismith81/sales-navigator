import React, { useState } from 'react';
import { PersonaIcon } from '../lib/personaIcons.jsx';

const DETAIL_FIELDS = [
  { key: 'situatie', label: 'Situatie' },
  { key: 'doel', label: 'Doel' },
  { key: 'oplossing', label: 'Oplossing' },
  { key: 'resultaat', label: 'Resultaat' },
  { key: 'businessImpact', label: 'Business Impact' },
];

export default function ReferenceCard({ caseData, matchReason, personas = {}, defaultExpanded = false, lockOpen = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded || lockOpen);
  const isOpen = lockOpen || expanded;

  return (
    <div className="ref-card">
      <div
        className="ref-header"
        onClick={lockOpen ? undefined : () => setExpanded(prev => !prev)}
        style={lockOpen ? { cursor: 'default' } : undefined}
      >
        <div
          className="ref-logo"
          style={{ background: `linear-gradient(135deg, ${caseData.logoColor}, ${caseData.logoColor}cc)` }}
        >
          {caseData.logoText}
        </div>
        <div className="ref-info">
          <div className="ref-name">{caseData.name}</div>
          <div className="ref-subtitle">{caseData.subtitle}</div>
        </div>
        {!lockOpen && <span className="ref-chevron">{isOpen ? '▾' : '▸'}</span>}
      </div>

      {matchReason && (
        <div className="ref-match-reason">{matchReason}</div>
      )}

      {isOpen && (
        <div className="ref-details">
          {(caseData.mapping?.branches || []).length > 0 && (
            <div className="detail-field">
              <div className="detail-label">Branche</div>
              <div className="detail-keywords">
                {(caseData.mapping.branches || []).map(b => (
                  <span key={b} className="tag branche small">{b}</span>
                ))}
              </div>
            </div>
          )}
          {(caseData.mapping?.personas || []).length > 0 && (
            <div className="detail-field">
              <div className="detail-label">Relevant voor</div>
              <div className="ref-persona-list">
                {(caseData.mapping.personas || []).map(pid => {
                  const p = personas[pid];
                  if (!p) return null;
                  const reason = caseData.matchReasons?.personas?.[pid];
                  return (
                    <div key={pid} className="ref-persona-item" title={reason || p.label}>
                      <span className="ref-persona-icon" aria-hidden="true">
                        <PersonaIcon name={p.icon} size={18} />
                      </span>
                      <div>
                        <div className="ref-persona-name">{p.label}</div>
                        {reason && <div className="ref-persona-reason">{reason}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {DETAIL_FIELDS.map(({ key, label }) =>
            caseData[key] ? (
              <div key={key} className="detail-field">
                <div className="detail-label">{label}</div>
                <div
                  className="detail-value rich-text"
                  dangerouslySetInnerHTML={{ __html: caseData[key] }}
                />
              </div>
            ) : null
          )}
          {caseData.keywords?.length > 0 && (
            <div className="detail-field">
              <div className="detail-label">Keywords</div>
              <div className="detail-keywords">
                {caseData.keywords.map(kw => (
                  <span key={kw} className="keyword-tag">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

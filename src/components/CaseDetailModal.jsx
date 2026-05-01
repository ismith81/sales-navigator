import React, { useEffect } from 'react';

// Read-only case-weergave als modal — voor wanneer Nova in een chat-antwoord
// een case noemt en de gebruiker er meer over wil zien zonder de chat-context
// te verlaten. Analoog aan TeamMemberDetail-pattern.
//
// Accepteert het case-object direct (al in Navigator-state) i.p.v. fetch op
// id — bespaart een roundtrip en houdt de modal snel.

export default function CaseDetailModal({ caseData, personas = {}, onClose }) {
  // ESC sluit de modal — standaard pattern voor overlays.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Klik op overlay (buiten de box) sluit ook.
  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  if (!caseData) return null;

  const {
    name,
    subtitle,
    logoText,
    logoColor,
    situatie,
    doel,
    oplossing,
    resultaat,
    businessImpact,
    keywords = [],
    mapping = {},
    talkingPoints = [],
    followUps = [],
  } = caseData;

  const detailFields = [
    { key: 'situatie', label: 'Situatie', value: situatie },
    { key: 'doel', label: 'Doel', value: doel },
    { key: 'oplossing', label: 'Oplossing', value: oplossing },
    { key: 'resultaat', label: 'Resultaat', value: resultaat },
    { key: 'businessImpact', label: 'Business impact', value: businessImpact },
  ].filter(f => f.value);

  const personaIds = mapping.personas || [];
  const branches = mapping.branches || [];

  return (
    <div
      className="modal-overlay case-detail-overlay"
      onClick={onOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Case: ${name}`}
    >
      <div className="case-detail-box">
        <button type="button" className="case-detail-close" onClick={onClose} aria-label="Sluiten">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="6" y1="18" x2="18" y2="6"/>
          </svg>
        </button>

        <header className="case-detail-header">
          <div
            className="case-detail-logo"
            aria-hidden="true"
            style={{ background: `linear-gradient(135deg, ${logoColor || '#2C3C52'}, ${(logoColor || '#2C3C52')}cc)` }}
          >
            {logoText || name?.slice(0, 2).toUpperCase() || '?'}
          </div>
          <div className="case-detail-headline">
            <h2 className="case-detail-name">{name}</h2>
            {subtitle && <div className="case-detail-subtitle">{subtitle}</div>}
          </div>
        </header>

        {(mapping.doelen?.length > 0 || mapping.behoeften?.length > 0 || mapping.diensten?.length > 0 || branches.length > 0) && (
          <section className="case-detail-section">
            <div className="case-detail-tags">
              {(mapping.doelen || []).map(d => <span key={`d-${d}`} className="tag doel">{d}</span>)}
              {(mapping.behoeften || []).map(b => <span key={`b-${b}`} className="tag behoefte">{b}</span>)}
              {(mapping.diensten || []).map(s => <span key={`s-${s}`} className="tag dienst">{s}</span>)}
              {branches.map(b => <span key={`br-${b}`} className="tag branche">{b}</span>)}
            </div>
          </section>
        )}

        {detailFields.map(({ key, label, value }) => (
          <section key={key} className="case-detail-section">
            <h3 className="case-detail-h3">{label}</h3>
            {/* Velden situatie/doel/oplossing/resultaat/businessImpact worden in
                CaseEditor via RichTextEditor opgeslagen — dat is HTML (paragrafen,
                lijsten, vetgedrukt). Renderen via dangerouslySetInnerHTML zodat
                de opmaak zichtbaar wordt; admin-content uit een gecontroleerde
                editor (XSS-risico is laag, zelfde aanpak als CaseCard's
                match_reason). */}
            <div
              className="case-detail-rich"
              dangerouslySetInnerHTML={{ __html: value }}
            />
          </section>
        ))}

        {keywords.length > 0 && (
          <section className="case-detail-section">
            <h3 className="case-detail-h3">Keywords</h3>
            <div className="case-detail-tags">
              {keywords.map(kw => (
                <span key={kw} className="case-detail-keyword">{kw}</span>
              ))}
            </div>
          </section>
        )}

        {talkingPoints.length > 0 && (
          <section className="case-detail-section">
            <h3 className="case-detail-h3">Talking points</h3>
            <ul className="case-detail-list">
              {talkingPoints.map((tp, i) => <li key={i}>{tp}</li>)}
            </ul>
          </section>
        )}

        {followUps.length > 0 && (
          <section className="case-detail-section">
            <h3 className="case-detail-h3">Vervolgvragen</h3>
            <ul className="case-detail-list">
              {followUps.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </section>
        )}

        {personaIds.length > 0 && Object.keys(personas).length > 0 && (
          <section className="case-detail-section">
            <h3 className="case-detail-h3">Past bij persona's</h3>
            <div className="case-detail-tags">
              {personaIds.map(pid => {
                const p = personas[pid];
                if (!p) return null;
                return <span key={pid} className="tag persona">{p.label}</span>;
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

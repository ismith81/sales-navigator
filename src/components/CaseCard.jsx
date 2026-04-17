import React, { useState } from 'react';

const DETAIL_FIELDS = [
  { key: 'situatie', label: 'Situatie' },
  { key: 'doel', label: 'Doel' },
  { key: 'oplossing', label: 'Oplossing' },
  { key: 'resultaat', label: 'Resultaat' },
  { key: 'businessImpact', label: 'Business Impact' },
];

export default function CaseCard({ caseData, matchReason }) {
  const [showDetails, setShowDetails] = useState(false);
  const { mapping } = caseData;

  return (
    <div className="case-card">
      <div className="case-header">
        <div
          className="case-logo"
          style={{ background: `linear-gradient(135deg, ${caseData.logoColor}, ${caseData.logoColor}cc)` }}
        >
          {caseData.logoText}
        </div>
        <div>
          <h3>{caseData.name}</h3>
          <div className="subtitle">{caseData.subtitle}</div>
        </div>
      </div>

      <div className="tags">
        {mapping.doelen.map(d => <span key={d} className="tag doel">{d}</span>)}
        {mapping.behoeften.map(b => <span key={b} className="tag behoefte">{b}</span>)}
        {mapping.diensten.map(d => <span key={d} className="tag dienst">{d}</span>)}
      </div>

      {/* Case details toggle */}
      <button
        className="btn-details-toggle"
        onClick={() => setShowDetails(prev => !prev)}
      >
        {showDetails ? '▾ Case details verbergen' : '▸ Case details bekijken'}
      </button>

      {showDetails && (
        <div className="case-details">
          {DETAIL_FIELDS.map(({ key, label }) =>
            caseData[key] ? (
              <div key={key} className="detail-field">
                <div className="detail-label">{label}</div>
                <div className="detail-value">{caseData[key]}</div>
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

      {matchReason && (
        <div className="highlight-match" dangerouslySetInnerHTML={{ __html: matchReason }} />
      )}

      <div className="section-title section-title--talking">Talking Points</div>
      {caseData.talkingPoints.map((tp, i) => (
        <div key={i} className="talking-point">
          <span className="bullet">•</span>
          <span>{tp}</span>
        </div>
      ))}

      <div className="section-title section-title--followup">Vervolgvragen</div>
      {caseData.followUps.map((q, i) => (
        <div key={i} className="followup-question">
          <span className="bullet">•</span>
          <span>{q}</span>
        </div>
      ))}
    </div>
  );
}

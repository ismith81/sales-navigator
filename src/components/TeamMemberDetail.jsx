import React, { useEffect, useState } from 'react';
import { getTeamMember, getCvPdfUrl } from '../lib/teamMembers';

// Read-only profielweergave als modal — voor sales die vanuit de Gids
// een teamlid wil bekijken zonder naar Beheer te gaan.
//
// Bewust een aparte component (niet TeamMemberEditor met readonly-prop):
// de editor is toolswear (sticky save-bar, form-layout, edit-states), en
// een modal moet compact en glanceable zijn. Code-overlap is beperkt.

export default function TeamMemberDetail({ memberId, onClose }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cvUrl, setCvUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await getTeamMember(memberId);
      if (cancelled) return;
      if (!m) {
        setError('Profiel niet gevonden.');
        setLoading(false);
        return;
      }
      setMember(m);
      if (m.cv_pdf_path) {
        const url = await getCvPdfUrl(m.cv_pdf_path, 600);
        if (!cancelled) setCvUrl(url || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

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

  // Download — zelfde blob-trick als in de editor om cross-origin
  // download-attribuut werkbaar te krijgen.
  const handleDownload = async () => {
    if (!cvUrl || !member?.cv_pdf_path) return;
    const fileName = member.cv_pdf_path.split('/').slice(-1)[0].replace(/^\d+-/, '');
    try {
      const res = await fetch(cvUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'cv.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      window.open(cvUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="modal-overlay team-detail-overlay" onClick={onOverlayClick} role="dialog" aria-modal="true" aria-label="Teamlid-profiel">
      <div className="team-detail-box">
        <button type="button" className="team-detail-close" onClick={onClose} aria-label="Sluiten">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="6" y1="18" x2="18" y2="6"/>
          </svg>
        </button>

        {loading && <div className="team-detail-loading">Laden…</div>}
        {error && <div className="team-detail-error">⚠️ {error}</div>}

        {member && (
          <>
            <header className="team-detail-header">
              <div className="team-detail-avatar" aria-hidden="true">{initials(member.name)}</div>
              <div className="team-detail-headline">
                <h2 className="team-detail-name">{member.name}</h2>
                <div className="team-detail-role">
                  {[member.seniority, member.role].filter(Boolean).join(' · ')}
                </div>
                {member.current_client && (
                  <div className="team-detail-client">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 21h18"/>
                      <path d="M5 21V7l7-4 7 4v14"/>
                    </svg>
                    <span>Bij {member.current_client}</span>
                  </div>
                )}
              </div>
            </header>

            {member.summary && (
              <section className="team-detail-section">
                <h3 className="team-detail-h3">Samenvatting</h3>
                <p className="team-detail-summary">{member.summary}</p>
              </section>
            )}

            {(member.kernskills?.length > 0 || member.technologies?.length > 0) && (
              <section className="team-detail-section">
                <h3 className="team-detail-h3">Kernskills & technologieën</h3>
                <div className="team-detail-tags">
                  {(member.kernskills || []).map(s => (
                    <span key={`k-${s}`} className="team-tag">{s}</span>
                  ))}
                  {(member.technologies || []).map(t => (
                    <span key={`t-${t}`} className="team-tag">{t}</span>
                  ))}
                </div>
              </section>
            )}

            {member.sectors?.length > 0 && (
              <section className="team-detail-section">
                <h3 className="team-detail-h3">Sectoren</h3>
                <div className="team-detail-tags">
                  {member.sectors.map(s => (
                    <span key={s} className="team-tag">{s}</span>
                  ))}
                </div>
              </section>
            )}

            {member.project_experience?.length > 0 && (
              <section className="team-detail-section">
                <h3 className="team-detail-h3">Projectervaring</h3>
                <ul className="team-detail-projects">
                  {member.project_experience.map((p, i) => (
                    <li key={i}>
                      <div className="team-detail-project-head">
                        <strong>{p.name || '—'}</strong>
                        {p.role && <span className="team-detail-project-role">{p.role}</span>}
                      </div>
                      {p.description && <p className="team-detail-project-desc">{p.description}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {member.certifications?.length > 0 && (
              <section className="team-detail-section">
                <h3 className="team-detail-h3">Certificaten</h3>
                <div className="team-detail-tags">
                  {member.certifications.map(c => (
                    <span key={c} className="team-tag">{c}</span>
                  ))}
                </div>
              </section>
            )}

            {member.cv_pdf_path && cvUrl && (
              <section className="team-detail-section team-detail-cv">
                <h3 className="team-detail-h3">CV</h3>
                <div className="team-detail-cv-actions">
                  <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="team-cv-link">
                    Bekijken
                  </a>
                  <button type="button" className="team-cv-link" onClick={handleDownload}>
                    Downloaden
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

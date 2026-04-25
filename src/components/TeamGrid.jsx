import React, { useEffect, useState } from 'react';
import { listTeamMembers, groupTeamByAvailability } from '../lib/teamMembers';
import TeamMemberDetail from './TeamMemberDetail';

// "Beschikbaarheid"-strip voor de Gids-startpagina, gegroepeerd in
// maand-buckets:
//   • Nu beschikbaar
//   • Vrij in [maand jaar] (per kalendermaand, tot 6 maanden vooruit)
//   • Later (> 6 maanden)
//   • Bezet — einddatum onbekend
// Bucket-logica zit in lib/teamMembers.js (gedeeld met Beheer-list).
//
// Click op card = read-only detail-modal.

export default function TeamGrid() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listTeamMembers();
      if (cancelled) return;
      setMembers(all || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (members.length === 0) return null;

  const buckets = groupTeamByAvailability(members);

  return (
    <>
      <section className="team-grid-strip" aria-label="Team-beschikbaarheid">
        <div className="team-grid-header">
          <h3 className="team-grid-title">Beschikbaarheid team</h3>
          <span className="team-grid-count">{members.length}</span>
        </div>

        {buckets.map(b => (
          <div key={b.label} className={`team-grid-bucket team-grid-bucket--${b.sortKey === 0 ? 'now' : b.sortKey >= 9000 ? 'far' : 'soon'}`}>
            <div className="team-grid-bucket-header">
              <span className="team-grid-bucket-dot" aria-hidden="true" />
              <span className="team-grid-bucket-label">{b.label}</span>
              <span className="team-grid-bucket-count">{b.items.length}</span>
            </div>
            <div className="team-grid-row">
              {b.items.map(m => (
                <button
                  type="button"
                  key={m.id}
                  className="team-grid-card"
                  onClick={() => setOpenId(m.id)}
                  title={`Open profiel van ${m.name}`}
                >
                  <div className="team-grid-avatar" aria-hidden="true">
                    {initials(m.name)}
                  </div>
                  <div className="team-grid-card-body">
                    <div className="team-grid-name">{m.name}</div>
                    <div className="team-grid-role">
                      {[m.seniority, m.role].filter(Boolean).join(' · ')}
                    </div>
                    {m.current_client && (
                      <div className="team-grid-client" title="Huidige klant / opdracht">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 21h18"/>
                          <path d="M5 21V7l7-4 7 4v14"/>
                        </svg>
                        <span>{m.current_client}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {openId && (
        <TeamMemberDetail memberId={openId} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

// "Niels van Velthoven" → "NV". Voor het avatar-bolletje.
function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

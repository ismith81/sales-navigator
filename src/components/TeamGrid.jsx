import React, { useEffect, useState } from 'react';
import { listTeamMembers } from '../lib/teamMembers';
import TeamMemberDetail from './TeamMemberDetail';

// Compact "Beschikbare collega's"-strip voor de Gids-startpagina.
// - Toont alleen team-leden met available_for_sales = true
// - Horizontale scroll-rij met kleine cards (kleiner dan case-cards zodat
//   ze niet de aandacht trekken van de cases-grid)
// - Klik op een card opent een read-only TeamMemberDetail-modal
//
// Bewust een aparte component (niet TeamManager hergebruiken) omdat de UX
// fundamenteel anders is: dit is glanceable browse, geen CRUD.

export default function TeamGrid() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listTeamMembers();
      if (cancelled) return;
      setMembers((all || []).filter(m => m.available_for_sales));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Niets renderen als geen beschikbare team-leden — de Gids hoeft geen
  // lege strook te tonen wanneer 't team-feature gewoon niet (nog) gevuld is.
  if (loading) return null;
  if (members.length === 0) return null;

  return (
    <>
      <section className="team-grid-strip" aria-label="Beschikbare collega's">
        <div className="team-grid-header">
          <h3 className="team-grid-title">Beschikbare collega's</h3>
          <span className="team-grid-count">{members.length}</span>
        </div>
        <div className="team-grid-row">
          {members.map(m => (
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

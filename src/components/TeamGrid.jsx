import React, { useEffect, useState } from 'react';
import { listTeamMembers, groupTeamByAvailability, formatAvailableFrom } from '../lib/teamMembers';
import TeamMemberDetail from './TeamMemberDetail';
import CardSectionTitle, { useCollapsibleSection } from './CardSectionTitle';

// "Beschikbaarheid"-strip voor de Gids-startpagina, gegroepeerd in 3 buckets:
//   • Nu beschikbaar
//   • Beschikbaar in de komende 3 maanden
//   • Beschikbaar > 3 maanden  (incl. mensen zonder einddatum, onderaan)
// Bucket-logica zit in lib/teamMembers.js (gedeeld met Beheer-list).
// Binnen elke bucket: chronologisch gesorteerd op available_from.
//
// Click op card = read-only detail-modal.

export default function TeamGrid() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const { collapsed, toggle } = useCollapsibleSection('team', false);

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
      <section className="team-grid-strip" aria-label="Team">
        <CardSectionTitle
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          label="Team"
          count={members.length}
          collapsible
          collapsed={collapsed}
          onToggle={toggle}
        />

        {/* Sectie-layout: buckets onder elkaar (full-width), met cards
            binnen elke bucket in een auto-fit grid (2-4 kolommen
            afhankelijk van beschikbare breedte). Eerder kanban met
            buckets-als-kolommen, maar dat gaf veel wasted whitespace
            zodra een bucket veel meer cards had dan de andere. */}
        {!collapsed && (
        <div className="team-grid-buckets">
        {buckets.map(b => (
          <div key={b.label} className={`team-grid-bucket team-grid-bucket--${b.bucket}`}>
            <div className="team-grid-bucket-header">
              <span className="team-grid-bucket-dot" aria-hidden="true" />
              <span className="team-grid-bucket-label">{b.label}</span>
              <span className="team-grid-bucket-count">{b.items.length}</span>
            </div>
            <div className="team-grid-row">
              {b.items.map(m => {
                // Datum-badge per kaart (binnen bucket): exacte vrij-datum
                // als die ingevuld is — anders niets ('nu beschikbaar' óf
                // 'einddatum onbekend' is al via bucket/klant duidelijk).
                const fromLabel = formatAvailableFrom(m);
                const showDate = !!fromLabel && b.bucket !== 'now';
                return (
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
                    {showDate && (
                      <div className="team-grid-date" title="Beschikbaar vanaf">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>vanaf {fromLabel}</span>
                      </div>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          </div>
        ))}
        </div>
        )}
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

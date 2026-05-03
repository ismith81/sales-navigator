import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  listCertifications,
  setConsultantCertAchieved,
  setOtherCertifications,
  setConsultantRoleCode,
  migrateCertificationsArray,
} from '../lib/certifications';

// Eenmalige migratie-wizard om de bestaande team_members.certifications
// (text[] vrije strings) te koppelen aan de nieuwe gestructureerde tabellen.
//
// Per consultant:
//   - Huidige cert-strings worden gefuzzymatcht tegen de master-lijst
//   - Hoge-confidence matches zijn default geselecteerd; lage-confidence
//     vereisen handmatige bevestiging
//   - Niet-matchende strings vallen in other_certifications (vrije text)
//   - Specialisatie (AE/DE/DSA) wordt door sales handmatig gekozen — geen
//     auto-guess, want de externe role-tekst zegt niet automatisch iets over
//     de interne specialisatie
//   - "Bevestig"-knop slaat alle keuzes op en stapt naar de volgende
//
// Wizard kan tussentijds worden afgesloten zonder data-verlies — alleen
// bevestigde consultants worden opgeslagen. Re-runnable: consultants die
// al een specialisatie + achieved-rijen hebben kunnen worden geskipt of
// opnieuw gedaan.

const CONFIDENCE_LABEL = {
  high: 'Hoge zekerheid',
  medium: 'Vermoedelijk match',
  low: 'Mogelijk typo / near-miss',
};
const CONFIDENCE_COLOR = {
  high: 'var(--teal)',
  medium: '#F0A33A',
  low: '#D63A5C',
};

const ROLE_OPTIONS = [
  { code: 'AE', label: 'Analytics Engineer' },
  { code: 'DE', label: 'Data Engineer' },
  { code: 'DSA', label: 'Data Solution Architect' },
];

export default function CertMigrationWizard({ onClose }) {
  const [members, setMembers] = useState([]);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skipped, setSkipped] = useState(new Set());
  const [completed, setCompleted] = useState(new Set());

  // Per-consultant beslis-state. Key = consultant_id; value = { roleCode,
  // matchSelections: Map<input,certId|null>, otherCerts: array }.
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, mRes] = await Promise.all([
        listCertifications(),
        supabase
          .from('team_members')
          .select('id, name, role, role_code, certifications, other_certifications')
          .order('name', { ascending: true }),
      ]);
      if (cancelled) return;
      if (mRes.error) {
        console.warn('CertMigrationWizard: members-fetch fout:', mRes.error.message);
        setMembers([]);
      } else {
        setMembers(mRes.data || []);
      }
      setCerts(c);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const active = members[activeIndex];

  // Bouw per-consultant initial state (parse + match) zodra we 'em activeren.
  useEffect(() => {
    if (!active) return;
    if (decisions[active.id]) return; // al bestaand beslis-state — niet overschrijven
    const { matched, unmatched } = migrateCertificationsArray(active.certifications || [], certs);
    const matchSelections = new Map();
    for (const m of matched) {
      // High-confidence matches: default selected; medium/low: default selected
      // ook (sales kan deselecteren). Ambiguous matches: default UN-selected
      // omdat 'r dubbelzinnigheid is.
      const initial = m.ambiguous ? null : m.cert.id;
      matchSelections.set(m.input, { selectedCertId: initial, match: m });
    }
    setDecisions(prev => ({
      ...prev,
      [active.id]: {
        roleCode: active.role_code || null,
        matchSelections,
        otherCerts: [
          ...(active.other_certifications || []),
          ...unmatched.map(u => u.input),
        ],
      },
    }));
  }, [active, certs, decisions]);

  const decision = active ? decisions[active.id] : null;

  // Gegroepeerde matches voor display.
  const matchEntries = useMemo(() => {
    if (!decision) return [];
    return Array.from(decision.matchSelections.entries()).map(([input, val]) => ({
      input,
      ...val,
    }));
  }, [decision]);

  const updateRoleCode = (code) => {
    if (!active) return;
    setDecisions(prev => ({
      ...prev,
      [active.id]: { ...prev[active.id], roleCode: code },
    }));
  };

  const updateMatchSelection = (input, certId) => {
    if (!active) return;
    const next = new Map(decision.matchSelections);
    const entry = next.get(input);
    if (entry) {
      next.set(input, { ...entry, selectedCertId: certId });
    }
    setDecisions(prev => ({
      ...prev,
      [active.id]: { ...prev[active.id], matchSelections: next },
    }));
  };

  const updateOtherCerts = (text) => {
    if (!active) return;
    // Splits op nieuwe regels; trim per item; filter empties.
    const list = text.split('\n').map(s => s.trim()).filter(Boolean);
    setDecisions(prev => ({
      ...prev,
      [active.id]: { ...prev[active.id], otherCerts: list },
    }));
  };

  const goNext = () => {
    if (activeIndex < members.length - 1) setActiveIndex(activeIndex + 1);
  };

  const goPrev = () => {
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  const skipCurrent = () => {
    if (!active) return;
    setSkipped(prev => new Set(prev).add(active.id));
    goNext();
  };

  const confirmCurrent = async () => {
    if (!active || !decision) return;
    setSaving(true);
    try {
      // 1. role_code opslaan
      if (decision.roleCode && decision.roleCode !== active.role_code) {
        const r = await setConsultantRoleCode(active.id, decision.roleCode);
        if (r.error) {
          alert(`Fout bij opslaan rol: ${r.error}`);
          setSaving(false);
          return;
        }
      }
      // 2. achieved-status per geselecteerde match
      const certIds = new Set();
      for (const [, val] of decision.matchSelections) {
        if (val.selectedCertId) certIds.add(val.selectedCertId);
      }
      for (const certId of certIds) {
        const r = await setConsultantCertAchieved(active.id, certId, true);
        if (r.error) {
          alert(`Fout bij opslaan cert ${certId}: ${r.error}`);
          setSaving(false);
          return;
        }
      }
      // 3. other_certifications opslaan
      const otherR = await setOtherCertifications(active.id, decision.otherCerts);
      if (otherR.error) {
        alert(`Fout bij opslaan overige certs: ${otherR.error}`);
        setSaving(false);
        return;
      }
      setCompleted(prev => new Set(prev).add(active.id));
      goNext();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="case-detail-box" style={{ padding: '2rem', textAlign: 'center' }}>
          Laden…
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="case-detail-box" style={{ padding: '2rem' }}>
          <h2>Geen team-leden</h2>
          <p>Voeg eerst team-leden toe in Beheer → Team voordat je een migratie draait.</p>
          <button type="button" className="btn-add-small" onClick={onClose}>Sluiten</button>
        </div>
      </div>
    );
  }

  if (!active) {
    // Klaar
    return (
      <div className="modal-overlay">
        <div className="case-detail-box" style={{ padding: '2rem' }}>
          <h2>Migratie klaar</h2>
          <p>{completed.size} van {members.length} consultants bevestigd. {skipped.size} overgeslagen.</p>
          <button type="button" className="btn-add-small" onClick={onClose}>Sluiten</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="case-detail-box cert-wizard-box">
        <header className="cert-wizard-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Migratie {activeIndex + 1} / {members.length}</h2>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              {completed.size} bevestigd · {skipped.size} overgeslagen
            </div>
          </div>
          <button type="button" className="case-detail-close" onClick={onClose} aria-label="Sluiten">✕</button>
        </header>

        <section className="cert-wizard-section">
          <div className="cert-wizard-name">{active.name}</div>
          <div className="cert-wizard-role">Huidige CV-rol: <em>{active.role || '—'}</em></div>
        </section>

        <section className="cert-wizard-section">
          <h3 className="case-detail-h3">Specialisatie</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
            Interne specialisatie van deze Data Consultant — bepaalt welke certs verwacht worden in de gap-analyse. Onafhankelijk van de externe CV-rol hierboven.
          </p>
          <div className="cert-wizard-role-options">
            {ROLE_OPTIONS.map(opt => (
              <label key={opt.code} className="cert-wizard-role-option">
                <input
                  type="radio"
                  name={`role-${active.id}`}
                  value={opt.code}
                  checked={decision?.roleCode === opt.code}
                  onChange={() => updateRoleCode(opt.code)}
                />
                <span><strong>{opt.code}</strong> — {opt.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="cert-wizard-section">
          <h3 className="case-detail-h3">Voorgestelde cert-matches</h3>
          {matchEntries.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Geen cert-strings gevonden in de bestaande array.</p>
          ) : (
            <ul className="cert-wizard-match-list">
              {matchEntries.map(({ input, match, selectedCertId }) => (
                <li key={input} className="cert-wizard-match-item">
                  <div className="cert-wizard-match-input">
                    <code>{input}</code>
                  </div>
                  <div className="cert-wizard-match-suggestion">
                    <span
                      className="cert-wizard-confidence"
                      style={{ background: CONFIDENCE_COLOR[match.confidence] }}
                    >
                      {CONFIDENCE_LABEL[match.confidence]}
                    </span>
                    <span style={{ marginLeft: '0.5rem' }}>
                      → <strong>{match.cert.id}</strong> {match.cert.name}
                    </span>
                    {match.ambiguous && (
                      <span style={{ marginLeft: '0.5rem', color: '#D63A5C', fontSize: '0.8rem' }}>
                        ⚠ ambigu — handmatig bevestigen
                      </span>
                    )}
                  </div>
                  <div className="cert-wizard-match-controls">
                    <label>
                      <input
                        type="radio"
                        name={`match-${active.id}-${input}`}
                        checked={selectedCertId === match.cert.id}
                        onChange={() => updateMatchSelection(input, match.cert.id)}
                      />
                      Accepteer ({match.cert.id})
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`match-${active.id}-${input}`}
                        checked={selectedCertId === null}
                        onChange={() => updateMatchSelection(input, null)}
                      />
                      Afwijzen (zet bij overige)
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cert-wizard-section">
          <h3 className="case-detail-h3">Overige certificeringen (niet-standaard)</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
            Eén cert per regel. Hier landen niet-matchende strings + handmatig afgewezen matches. Tellen niet mee in de gap-analyse.
          </p>
          <textarea
            className="cert-wizard-textarea"
            value={(decision?.otherCerts || []).join('\n')}
            onChange={(e) => updateOtherCerts(e.target.value)}
            rows={4}
          />
        </section>

        <footer className="cert-wizard-footer">
          <button type="button" className="btn-add-small" onClick={goPrev} disabled={activeIndex === 0 || saving}>
            ← Vorige
          </button>
          <button type="button" className="btn-add-small" onClick={skipCurrent} disabled={saving}>
            Overslaan
          </button>
          <button type="button" className="btn-add-small" onClick={confirmCurrent} disabled={saving || !decision?.roleCode}>
            {saving ? 'Opslaan…' : 'Bevestigen + volgende →'}
          </button>
        </footer>
      </div>
    </div>
  );
}

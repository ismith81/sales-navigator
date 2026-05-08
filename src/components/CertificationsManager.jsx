import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  listSpecializations,
  listCertifications,
  listRoleRelevance,
  listAllConsultantCerts,
  setConsultantCertAchieved,
  setOtherCertifications,
  setConsultantRoleCode,
  seedCertifications,
  computeConsultantCoverage,
  computeTopTeamGaps,
} from '../lib/certifications';
import CertMigrationWizard from './CertMigrationWizard';
import CertStandardManager from './CertStandardManager';

// Beheer → Certificeringen — drie subviews:
//
//   1. Teamview (default): matrix consultants × certs, gegroepeerd op tier.
//      Filter op specialisatie. Aggregaten + top-3 gaps. Click consultant → detail.
//   2. Detail: per consultant alle relevante certs (expected + recommended)
//      met checkbox + other_certifications-veld + specialisatie-keuze.
//   3. Standaard beheren: CRUD op certs + specialisaties. Voor competentie-
//      leads om de master-lijst zelfstandig te onderhouden.
//
// Plus: knoppen voor seed (master-list updaten vanuit JSON) en migratie-
// wizard (eenmalige conversie van bestaande vrije-tekst certs).
//
// ROLE_OPTIONS komt sinds Optie A uit de DB (specializations-tabel) i.p.v.
// hardcoded — toevoegen/hernoemen van specialisaties werkt direct overal door.

const RELEVANCE_LABEL = {
  expected: 'Verwacht',
  recommended: 'Aanbevolen',
  not_applicable: 'Niet van toepassing',
};

export default function CertificationsManager() {
  const [members, setMembers] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [certs, setCerts] = useState([]);
  const [roleRelevance, setRoleRelevance] = useState([]);
  const [consultantCerts, setConsultantCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState('team'); // 'team' | 'detail' | 'standard'
  const [selectedConsultantId, setSelectedConsultantId] = useState(null);
  const [filterRole, setFilterRole] = useState('all');

  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // Specialisaties dynamic uit DB. Sorteer op sort_order, dan code; alleen
  // active=true is relevant voor team/detail-views (de Standaard-tab toont
  // ook gedeactiveerde via z'n eigen fetch).
  const roleOptions = useMemo(
    () => specs
      .filter(s => s.active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.code.localeCompare(b.code))
      .map(s => ({ code: s.code, label: s.label })),
    [specs]
  );

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, rr, cc, mRes] = await Promise.all([
        listSpecializations(),
        listCertifications(),
        listRoleRelevance(),
        listAllConsultantCerts(),
        supabase
          .from('team_members')
          .select('id, name, role, role_code, other_certifications')
          .order('name', { ascending: true }),
      ]);
      if (mRes.error) {
        setError(`Team-leden ophalen faalde: ${mRes.error.message}`);
      } else {
        setMembers(mRes.data || []);
      }
      setSpecs(s);
      setCerts(c);
      setRoleRelevance(rr);
      setConsultantCerts(cc);
    } catch (err) {
      setError(err?.message || 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // ─── Seed-actie ───────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true);
    setSeedStatus({ kind: 'busy', message: "Master-lijst aan 't seeden…" });
    const res = await seedCertifications();
    if (res?.error) {
      setSeedStatus({ kind: 'error', message: `Seed faalde: ${res.error}` });
    } else {
      setSeedStatus({
        kind: 'ok',
        message: `Seed klaar — ${res.new} nieuw, ${res.updated} bijgewerkt, ${res.unchanged} ongewijzigd. Role-relevance: ${res.role_relevance_rows} rijen.`,
      });
      await refresh();
    }
    setSeeding(false);
  };

  // ─── Filtered consultants voor de teamview ───────────────────────────
  const filteredMembers = useMemo(() => {
    if (filterRole === 'all') return members;
    return members.filter(m => m.role_code === filterRole);
  }, [members, filterRole]);

  // ─── Aggregaten ──────────────────────────────────────────────────────
  const teamCoverage = useMemo(() => {
    const stats = { baselineComplete: 0, specialistComplete: 0, total: 0 };
    for (const m of filteredMembers) {
      if (!m.role_code) continue;
      stats.total++;
      const base = computeConsultantCoverage(m, certs, roleRelevance, consultantCerts, { tier: 'baseline' });
      const spec = computeConsultantCoverage(m, certs, roleRelevance, consultantCerts, { tier: 'specialist' });
      if (base.expected > 0 && base.achieved === base.expected) stats.baselineComplete++;
      if (spec.expected === 0 || spec.achieved === spec.expected) stats.specialistComplete++;
    }
    return stats;
  }, [filteredMembers, certs, roleRelevance, consultantCerts]);

  const topGaps = useMemo(
    () => computeTopTeamGaps(filteredMembers, certs, roleRelevance, consultantCerts, 5),
    [filteredMembers, certs, roleRelevance, consultantCerts]
  );

  // ─── Toggle achieved per consultant×cert ─────────────────────────────
  const toggleAchieved = async (consultantId, certId, current) => {
    const r = await setConsultantCertAchieved(consultantId, certId, !current);
    if (r.error) {
      alert(`Fout: ${r.error}`);
      return;
    }
    // Optimistic local update
    setConsultantCerts(prev => {
      const idx = prev.findIndex(x => x.consultant_id === consultantId && x.cert_id === certId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], achieved: !current };
        return next;
      }
      return [...prev, { consultant_id: consultantId, cert_id: certId, achieved: !current }];
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) return <div className="cm-section-sub">Laden…</div>;
  if (error) return <div className="cm-section-sub" style={{ color: 'var(--accent)' }}>⚠️ {error}</div>;

  return (
    <div className="cert-manager">
      <div className="cert-manager-toolbar">
        <div className="cert-manager-toolbar-left">
          <button
            type="button"
            className={`cert-tab-btn ${view === 'team' ? 'active' : ''}`}
            onClick={() => setView('team')}
          >
            Teamview
          </button>
          <button
            type="button"
            className={`cert-tab-btn ${view === 'detail' ? 'active' : ''}`}
            onClick={() => setView('detail')}
            disabled={!selectedConsultantId && view !== 'detail'}
          >
            Per consultant
          </button>
          <button
            type="button"
            className={`cert-tab-btn ${view === 'standard' ? 'active' : ''}`}
            onClick={() => setView('standard')}
          >
            Standaard beheren
          </button>
        </div>
        <div className="cert-manager-toolbar-right">
          <button type="button" className="btn-add-small" onClick={() => setShowWizard(true)}>
            🪄 Migratie-wizard
          </button>
          <div className="cert-advanced-wrap">
            <button
              type="button"
              className="btn-add-small"
              onClick={() => setShowAdvanced(v => !v)}
              aria-expanded={showAdvanced}
              aria-haspopup="menu"
            >
              ⋯ Geavanceerd
            </button>
            {showAdvanced && (
              <>
                {/* Click-outside catcher */}
                <div className="cert-advanced-backdrop" onClick={() => setShowAdvanced(false)} />
                <div className="cert-advanced-menu" role="menu">
                  <button
                    type="button"
                    className="cert-advanced-item cert-advanced-item--danger"
                    onClick={() => { setShowAdvanced(false); setShowSeedConfirm(true); }}
                    disabled={seeding}
                  >
                    {seeding ? '⏳ Bezig…' : '↻ Seed master-lijst uit JSON'}
                    <small>Overschrijft handmatige wijzigingen — alleen voor eerste setup / disaster-recovery</small>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {seedStatus && (
        <div className={`team-embed-status team-embed-status--${seedStatus.kind}`} style={{ marginBottom: '0.85rem' }}>
          {seedStatus.message}
        </div>
      )}

      {view === 'standard' ? (
        <CertStandardManager onChange={refresh} />
      ) : certs.length === 0 ? (
        <div className="cert-empty">
          <p><strong>De master-lijst is nog niet ingelezen.</strong></p>
          <p>Ga naar <em>Standaard beheren</em> om certs handmatig toe te voegen, of gebruik <em>⋯ Geavanceerd → Seed master-lijst uit JSON</em> om de 14 standaard-certificeringen vanuit <code>src/data/certifications.json</code> in de database te zetten.</p>
        </div>
      ) : view === 'team' ? (
        <TeamView
          members={filteredMembers}
          allMembers={members}
          certs={certs}
          roleRelevance={roleRelevance}
          consultantCerts={consultantCerts}
          roleOptions={roleOptions}
          filterRole={filterRole}
          setFilterRole={setFilterRole}
          teamCoverage={teamCoverage}
          topGaps={topGaps}
          onSelectConsultant={(id) => { setSelectedConsultantId(id); setView('detail'); }}
        />
      ) : (
        <DetailView
          consultantId={selectedConsultantId}
          members={members}
          certs={certs}
          roleRelevance={roleRelevance}
          consultantCerts={consultantCerts}
          roleOptions={roleOptions}
          onToggleAchieved={toggleAchieved}
          onSelectConsultant={setSelectedConsultantId}
          onUpdateRoleCode={async (id, code) => {
            const r = await setConsultantRoleCode(id, code);
            if (r.error) { alert(r.error); return; }
            setMembers(prev => prev.map(m => m.id === id ? { ...m, role_code: code } : m));
          }}
          onUpdateOtherCerts={async (id, list) => {
            const r = await setOtherCertifications(id, list);
            if (r.error) { alert(r.error); return; }
            setMembers(prev => prev.map(m => m.id === id ? { ...m, other_certifications: list } : m));
          }}
        />
      )}

      {showWizard && (
        <CertMigrationWizard onClose={() => { setShowWizard(false); refresh(); }} />
      )}

      {showSeedConfirm && (
        <SeedConfirmDialog
          onCancel={() => setShowSeedConfirm(false)}
          onConfirm={async () => {
            setShowSeedConfirm(false);
            await handleSeed();
          }}
        />
      )}
    </div>
  );
}

// ─── Seed-confirm-dialog ──────────────────────────────────────────────
// Vereist dat de user letterlijk "seed" typt voor 't draaien — voorkomt
// onbedoelde clicks. De seed-actie reset role-relevance per cert in de
// JSON; handmatige UI-wijzigingen op die certs raken kwijt.
function SeedConfirmDialog({ onCancel, onConfirm }) {
  const [typed, setTyped] = useState('');
  const canConfirm = typed.trim().toLowerCase() === 'seed';
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="case-detail-box csm-modal" style={{ maxWidth: 540 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--accent)' }}>
          ⚠ Master-lijst seeden uit JSON?
        </h2>
        <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>
          Dit zal de 14 certs uit <code>src/data/certifications.json</code> upserten en
          <strong> alle role-relevance per cert resetten</strong> naar de JSON-waarden.
        </p>
        <div className="csm-section-note" style={{ borderLeftColor: 'var(--accent)', background: 'rgba(237,23,75,0.06)', marginTop: '0.8rem' }}>
          <strong style={{ color: 'var(--accent)' }}>Handmatige wijzigingen op de standaard-certs raken kwijt:</strong>
          <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
            <li>Tier-aanpassingen (baseline ↔ specialistisch)</li>
            <li>Role-relevance per specialisatie</li>
            <li>Naam, link, vendor, notitie-velden</li>
          </ul>
        </div>
        <p style={{ marginTop: '0.7rem', fontSize: '0.78rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
          <strong>Blijven intact:</strong> specialisaties, consultant-toewijzingen, eigen toegevoegde certs (niet in JSON), other_certifications.
        </p>
        <div className="csm-form-row" style={{ marginTop: '1.1rem' }}>
          <label>Typ <code>seed</code> om te bevestigen</label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="seed"
            autoFocus
          />
        </div>
        <div className="csm-modal-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>Annuleren</button>
          <button
            type="button"
            className="csm-btn-primary"
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              background: canConfirm ? 'var(--accent)' : 'var(--muted)',
              borderColor: canConfirm ? 'var(--accent)' : 'var(--muted)',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            Doorvoeren
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TeamView sub-component ────────────────────────────────────────────
function TeamView({ members, allMembers, certs, roleRelevance, consultantCerts, roleOptions, filterRole, setFilterRole, teamCoverage, topGaps, onSelectConsultant }) {
  const achievedSet = useMemo(() => {
    const s = new Set();
    for (const c of consultantCerts) if (c.achieved) s.add(`${c.consultant_id}::${c.cert_id}`);
    return s;
  }, [consultantCerts]);

  const certsByTier = useMemo(() => {
    const baseline = certs.filter(c => c.tier === 'baseline' && c.active !== false);
    const specialist = certs.filter(c => c.tier === 'specialist' && c.active !== false);
    return { baseline, specialist };
  }, [certs]);

  return (
    <div className="cert-team-view">
      <div className="cert-filter-bar">
        <span style={{ marginRight: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>Specialisatie:</span>
        <button type="button" className={`cert-filter-btn ${filterRole === 'all' ? 'active' : ''}`} onClick={() => setFilterRole('all')}>Alle</button>
        {(roleOptions || []).map(opt => (
          <button
            key={opt.code}
            type="button"
            className={`cert-filter-btn ${filterRole === opt.code ? 'active' : ''}`}
            onClick={() => setFilterRole(opt.code)}
          >
            {opt.code} — {opt.label}
          </button>
        ))}
      </div>

      <h3 className="cert-section-heading">Gap-analyse — team</h3>
      <div className="cert-aggregate-grid">
        <div className="cert-aggregate-card">
          <div className="cert-aggregate-value">{teamCoverage.total > 0 ? Math.round((teamCoverage.baselineComplete / teamCoverage.total) * 100) : 0}%</div>
          <div className="cert-aggregate-label">Baseline compleet</div>
          <div className="cert-aggregate-sub">{teamCoverage.baselineComplete} van {teamCoverage.total} consultants</div>
        </div>
        <div className="cert-aggregate-card">
          <div className="cert-aggregate-value">{teamCoverage.total > 0 ? Math.round((teamCoverage.specialistComplete / teamCoverage.total) * 100) : 0}%</div>
          <div className="cert-aggregate-label">Specialistisch compleet</div>
          <div className="cert-aggregate-sub">{teamCoverage.specialistComplete} van {teamCoverage.total} consultants</div>
        </div>
        <div className="cert-aggregate-card cert-aggregate-card--gaps">
          <div className="cert-aggregate-label" style={{ marginBottom: '0.4rem' }}>Top gaps</div>
          {topGaps.length === 0 ? (
            <div className="cert-aggregate-sub">Geen openstaande gaps 🎉</div>
          ) : (
            <ol className="cert-top-gaps">
              {topGaps.map(g => (
                <li key={g.cert.id}>
                  <strong>{g.cert.id}</strong> — {g.missingCount} van {g.applicableCount} mist
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <h3 className="cert-section-heading">Cert-matrix per consultant</h3>
      <div className="cert-matrix-wrap">
        <table className="cert-matrix">
          <thead>
            <tr>
              <th rowSpan={2} className="cert-matrix-name-th">Consultant</th>
              <th rowSpan={2}>Specialisatie</th>
              <th colSpan={certsByTier.baseline.length}>Baseline</th>
              <th colSpan={certsByTier.specialist.length}>Specialistisch</th>
            </tr>
            <tr>
              {certsByTier.baseline.map(c => <th key={c.id} title={c.name} className="cert-matrix-cert-th">{c.id}</th>)}
              {certsByTier.specialist.map(c => <th key={c.id} title={c.name} className="cert-matrix-cert-th">{c.id}</th>)}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr><td colSpan={2 + certsByTier.baseline.length + certsByTier.specialist.length}>Geen consultants in deze filter.</td></tr>
            ) : members.map(m => (
              <tr key={m.id} className="cert-matrix-row" onClick={() => onSelectConsultant(m.id)}>
                <td className="cert-matrix-name-td">{m.name}</td>
                <td className="cert-matrix-role-td">{m.role_code || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                {certsByTier.baseline.map(c => (
                  <td key={c.id} className="cert-matrix-cell">
                    {achievedSet.has(`${m.id}::${c.id}`) ? '✓' : ''}
                  </td>
                ))}
                {certsByTier.specialist.map(c => (
                  <td key={c.id} className="cert-matrix-cell">
                    {achievedSet.has(`${m.id}::${c.id}`) ? '✓' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DetailView sub-component ──────────────────────────────────────────
function DetailView({ consultantId, members, certs, roleRelevance, consultantCerts, roleOptions, onToggleAchieved, onSelectConsultant, onUpdateRoleCode, onUpdateOtherCerts }) {
  const consultant = members.find(m => m.id === consultantId) || members[0];

  const [otherText, setOtherText] = useState('');
  useEffect(() => {
    setOtherText((consultant?.other_certifications || []).join('\n'));
  }, [consultant]);

  const relevanceMap = useMemo(() => {
    const map = new Map();
    for (const r of roleRelevance) {
      if (!map.has(r.cert_id)) map.set(r.cert_id, {});
      map.get(r.cert_id)[r.role] = r.relevance;
    }
    return map;
  }, [roleRelevance]);

  const achievedSet = useMemo(() => {
    const s = new Set();
    for (const c of consultantCerts) {
      if (c.consultant_id === consultantId && c.achieved) s.add(c.cert_id);
    }
    return s;
  }, [consultantCerts, consultantId]);

  const baselineCoverage = useMemo(
    () => computeConsultantCoverage(consultant, certs, roleRelevance, consultantCerts, { tier: 'baseline' }),
    [consultant, certs, roleRelevance, consultantCerts]
  );
  const specialistCoverage = useMemo(
    () => computeConsultantCoverage(consultant, certs, roleRelevance, consultantCerts, { tier: 'specialist' }),
    [consultant, certs, roleRelevance, consultantCerts]
  );

  if (!consultant) {
    return (
      <div className="cert-empty">
        <p>Selecteer een consultant uit de teamview.</p>
      </div>
    );
  }

  const renderTier = (tier, label) => {
    const list = certs
      .filter(c => c.tier === tier && c.active !== false)
      .map(c => ({
        cert: c,
        relevance: consultant.role_code ? relevanceMap.get(c.id)?.[consultant.role_code] : null,
      }))
      .filter(x => x.relevance && x.relevance !== 'not_applicable');
    if (list.length === 0) {
      return (
        <section className="cert-detail-section">
          <h3>{label}</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Geen relevante certs voor deze specialisatie — kies eerst een specialisatie.
          </p>
        </section>
      );
    }
    return (
      <section className="cert-detail-section">
        <h3>{label}</h3>
        <ul className="cert-detail-list">
          {list.map(({ cert, relevance }) => (
            <li key={cert.id} className="cert-detail-item">
              <label>
                <input
                  type="checkbox"
                  checked={achievedSet.has(cert.id)}
                  onChange={() => onToggleAchieved(consultant.id, cert.id, achievedSet.has(cert.id))}
                />
                <strong>{cert.id}</strong> {cert.name}
                <span className={`cert-relevance-badge cert-relevance-badge--${relevance}`}>
                  {RELEVANCE_LABEL[relevance]}
                </span>
                <span style={{ marginLeft: '0.5rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                  {cert.vendor}
                </span>
              </label>
              {cert.notes && (
                <div className="cert-detail-notes">{cert.notes}</div>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="cert-detail-view">
      <div className="cert-detail-header">
        <select
          value={consultant.id}
          onChange={(e) => onSelectConsultant(e.target.value)}
          className="cert-detail-select"
        >
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="cert-detail-role-bar">
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Specialisatie:</span>
          {(roleOptions || []).map(opt => (
            <button
              key={opt.code}
              type="button"
              className={`cert-filter-btn ${consultant.role_code === opt.code ? 'active' : ''}`}
              onClick={() => onUpdateRoleCode(consultant.id, opt.code)}
              title={opt.label}
            >
              {opt.code}
            </button>
          ))}
          {consultant.role_code && (
            <button type="button" className="cert-filter-btn" onClick={() => onUpdateRoleCode(consultant.id, null)}>
              wis
            </button>
          )}
        </div>
      </div>

      <h3 className="cert-section-heading">Gap-analyse — {consultant.name}</h3>
      <div className="cert-detail-coverage">
        <div className="cert-detail-coverage-item">
          <span className="cert-detail-coverage-label">Baseline:</span>
          <strong>{baselineCoverage.achieved} / {baselineCoverage.expected}</strong>
          <span className="cert-detail-coverage-pct">({baselineCoverage.percent}%)</span>
        </div>
        <div className="cert-detail-coverage-item">
          <span className="cert-detail-coverage-label">Specialistisch:</span>
          <strong>{specialistCoverage.achieved} / {specialistCoverage.expected}</strong>
          <span className="cert-detail-coverage-pct">({specialistCoverage.percent}%)</span>
        </div>
      </div>

      {renderTier('baseline', 'Baseline')}
      {renderTier('specialist', 'Specialistisch')}

      <section className="cert-detail-section">
        <h3>Overige certificeringen (niet-standaard)</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
          Vrije tekst, één per regel. Voor certs buiten de Creates-standaard (bv. AWS, GCP). Tellen niet mee in de gap-analyse — wel zichtbaar in het profiel.
        </p>
        <textarea
          className="cert-wizard-textarea"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onBlur={() => {
            const list = otherText.split('\n').map(s => s.trim()).filter(Boolean);
            onUpdateOtherCerts(consultant.id, list);
          }}
          rows={4}
        />
      </section>
    </div>
  );
}

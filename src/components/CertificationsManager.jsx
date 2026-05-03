import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
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

// Beheer → Certificeringen — twee subviews:
//
//   1. Teamview (default): matrix consultants × certs, gegroepeerd op tier.
//      Filter op rol. Aggregaten + top-3 gaps. Click consultant → detail.
//   2. Detail: per consultant alle relevante certs (expected + recommended)
//      met checkbox + other_certifications-veld + role_code-keuze.
//
// Plus: knoppen voor seed (master-list updaten vanuit JSON) en migratie-
// wizard (eenmalige conversie van bestaande vrije-tekst certs).

const ROLE_OPTIONS = [
  { code: 'AE', label: 'Analytics Engineer' },
  { code: 'DE', label: 'Data Engineer' },
  { code: 'DSA', label: 'Solution Architect' },
];

const RELEVANCE_LABEL = {
  expected: 'Verwacht',
  recommended: 'Aanbevolen',
  not_applicable: 'Niet van toepassing',
};

export default function CertificationsManager() {
  const [members, setMembers] = useState([]);
  const [certs, setCerts] = useState([]);
  const [roleRelevance, setRoleRelevance] = useState([]);
  const [consultantCerts, setConsultantCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState('team'); // 'team' | 'detail'
  const [selectedConsultantId, setSelectedConsultantId] = useState(null);
  const [filterRole, setFilterRole] = useState('all');

  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, rr, cc, mRes] = await Promise.all([
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
    const stats = { foundationComplete: 0, specialistComplete: 0, total: 0 };
    for (const m of filteredMembers) {
      if (!m.role_code) continue;
      stats.total++;
      const found = computeConsultantCoverage(m, certs, roleRelevance, consultantCerts, { tier: 'foundation' });
      const spec = computeConsultantCoverage(m, certs, roleRelevance, consultantCerts, { tier: 'specialist' });
      if (found.expected > 0 && found.achieved === found.expected) stats.foundationComplete++;
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
            Detail
          </button>
        </div>
        <div className="cert-manager-toolbar-right">
          <button type="button" className="btn-add-small" onClick={() => setShowWizard(true)}>
            🪄 Migratie-wizard
          </button>
          <button type="button" className="btn-add-small" onClick={handleSeed} disabled={seeding}>
            {seeding ? '⏳ Bezig…' : '↻ Seed master-lijst'}
          </button>
        </div>
      </div>

      {seedStatus && (
        <div className={`team-embed-status team-embed-status--${seedStatus.kind}`} style={{ marginBottom: '0.85rem' }}>
          {seedStatus.message}
        </div>
      )}

      {certs.length === 0 ? (
        <div className="cert-empty">
          <p><strong>De master-lijst is nog niet ingelezen.</strong></p>
          <p>Klik op <em>↻ Seed master-lijst</em> om de 14 standaard-certificeringen vanuit <code>src/data/certifications.json</code> in de database te zetten. Daarna kan de migratie-wizard de bestaande consultant-certs koppelen.</p>
        </div>
      ) : view === 'team' ? (
        <TeamView
          members={filteredMembers}
          allMembers={members}
          certs={certs}
          roleRelevance={roleRelevance}
          consultantCerts={consultantCerts}
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
    </div>
  );
}

// ─── TeamView sub-component ────────────────────────────────────────────
function TeamView({ members, allMembers, certs, roleRelevance, consultantCerts, filterRole, setFilterRole, teamCoverage, topGaps, onSelectConsultant }) {
  const achievedSet = useMemo(() => {
    const s = new Set();
    for (const c of consultantCerts) if (c.achieved) s.add(`${c.consultant_id}::${c.cert_id}`);
    return s;
  }, [consultantCerts]);

  const certsByTier = useMemo(() => {
    const foundation = certs.filter(c => c.tier === 'foundation' && c.active !== false);
    const specialist = certs.filter(c => c.tier === 'specialist' && c.active !== false);
    return { foundation, specialist };
  }, [certs]);

  return (
    <div className="cert-team-view">
      <div className="cert-filter-bar">
        <span style={{ marginRight: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>Rol:</span>
        <button type="button" className={`cert-filter-btn ${filterRole === 'all' ? 'active' : ''}`} onClick={() => setFilterRole('all')}>Alle</button>
        {ROLE_OPTIONS.map(opt => (
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

      <div className="cert-aggregate-grid">
        <div className="cert-aggregate-card">
          <div className="cert-aggregate-value">{teamCoverage.total > 0 ? Math.round((teamCoverage.foundationComplete / teamCoverage.total) * 100) : 0}%</div>
          <div className="cert-aggregate-label">Foundation compleet</div>
          <div className="cert-aggregate-sub">{teamCoverage.foundationComplete} van {teamCoverage.total} consultants</div>
        </div>
        <div className="cert-aggregate-card">
          <div className="cert-aggregate-value">{teamCoverage.total > 0 ? Math.round((teamCoverage.specialistComplete / teamCoverage.total) * 100) : 0}%</div>
          <div className="cert-aggregate-label">Specialist compleet</div>
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

      <div className="cert-matrix-wrap">
        <table className="cert-matrix">
          <thead>
            <tr>
              <th rowSpan={2} className="cert-matrix-name-th">Consultant</th>
              <th rowSpan={2}>Rol</th>
              <th colSpan={certsByTier.foundation.length}>Foundation</th>
              <th colSpan={certsByTier.specialist.length}>Specialist</th>
            </tr>
            <tr>
              {certsByTier.foundation.map(c => <th key={c.id} title={c.name} className="cert-matrix-cert-th">{c.id}</th>)}
              {certsByTier.specialist.map(c => <th key={c.id} title={c.name} className="cert-matrix-cert-th">{c.id}</th>)}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr><td colSpan={2 + certsByTier.foundation.length + certsByTier.specialist.length}>Geen consultants in deze filter.</td></tr>
            ) : members.map(m => (
              <tr key={m.id} className="cert-matrix-row" onClick={() => onSelectConsultant(m.id)}>
                <td className="cert-matrix-name-td">{m.name}</td>
                <td className="cert-matrix-role-td">{m.role_code || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                {certsByTier.foundation.map(c => (
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
function DetailView({ consultantId, members, certs, roleRelevance, consultantCerts, onToggleAchieved, onSelectConsultant, onUpdateRoleCode, onUpdateOtherCerts }) {
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

  const foundationCoverage = useMemo(
    () => computeConsultantCoverage(consultant, certs, roleRelevance, consultantCerts, { tier: 'foundation' }),
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
            Geen relevante certs voor deze rol — kies eerst een rol-classificatie.
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
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Rol-code:</span>
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.code}
              type="button"
              className={`cert-filter-btn ${consultant.role_code === opt.code ? 'active' : ''}`}
              onClick={() => onUpdateRoleCode(consultant.id, opt.code)}
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

      <div className="cert-detail-coverage">
        <div className="cert-detail-coverage-item">
          <span className="cert-detail-coverage-label">Foundation:</span>
          <strong>{foundationCoverage.achieved} / {foundationCoverage.expected}</strong>
          <span className="cert-detail-coverage-pct">({foundationCoverage.percent}%)</span>
        </div>
        <div className="cert-detail-coverage-item">
          <span className="cert-detail-coverage-label">Specialist:</span>
          <strong>{specialistCoverage.achieved} / {specialistCoverage.expected}</strong>
          <span className="cert-detail-coverage-pct">({specialistCoverage.percent}%)</span>
        </div>
      </div>

      {renderTier('foundation', 'Foundation')}
      {renderTier('specialist', 'Specialist')}

      <section className="cert-detail-section">
        <h3>Overige certificeringen</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
          Vrije tekst, één per regel. Voor certs buiten de Creates-standaard (bv. AWS, GCP).
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

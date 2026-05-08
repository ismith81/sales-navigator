import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  listSpecializations,
  listCertifications,
  listRoleRelevance,
  upsertCertification,
  setCertificationTier,
  setCertificationActive,
  setRoleRelevance as apiSetRoleRelevance,
  createSpecialization,
  updateSpecialization,
} from '../lib/certifications';

// Beheer → Certificeringen → Standaard beheren
//
// Twee subviews voor competentie-leads:
//   1. Certificeringen — CRUD op de master-lijst (naam, vendor, tier,
//      role-relevance per specialisatie, active, url, notes). Inline-bewerk
//      voor tier/relevance/active; modal voor naam/vendor/link/notitie.
//   2. Specialisaties — CRUD op de specializations-tabel. Toevoegen/hernoemen
//      werkt direct door in de cert-tabel-headers en teamview-matrix.
//
// Ontwerp-principes:
//   - Inline-edit voor frequente acties (tier toggle, relevance dropdown,
//     active toggle); modal voor zeldzamer / multi-veld bewerken.
//   - Geen hard-delete; alleen deactivate (`active=false`) zodat
//     consultant_certifications-historie intact blijft.
//   - Optimistische UI-update: muteer lokale state direct, rollback bij fout.

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="14" height="14"
       aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const RELEVANCE_OPTIONS = [
  { value: 'expected', label: 'Verwacht' },
  { value: 'recommended', label: 'Aanbevolen' },
  { value: 'not_applicable', label: 'N.v.t.' },
];

export default function CertStandardManager({ onChange }) {
  const [sub, setSub] = useState('certs'); // 'certs' | 'specs'
  const [specs, setSpecs] = useState([]);
  const [certs, setCerts] = useState([]);
  const [roleRelevance, setRoleRelevance] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCert, setEditingCert] = useState(null); // cert-object of null
  const [showNewCert, setShowNewCert] = useState(false);
  const [showNewSpec, setShowNewSpec] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, rr, m] = await Promise.all([
        listSpecializations(),
        listCertifications(),
        listRoleRelevance(),
        supabase.from('team_members').select('role_code'),
      ]);
      setSpecs(s);
      setCerts(c);
      setRoleRelevance(rr);
      // Tel per specialisatie hoeveel consultants er zijn
      const counts = {};
      for (const row of (m.data || [])) {
        if (row.role_code) counts[row.role_code] = (counts[row.role_code] || 0) + 1;
      }
      setMemberCounts(counts);
    } catch (err) {
      setError(err?.message || 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Map cert_id → role → relevance — voor snelle UI-rendering
  const relevanceByCert = useMemo(() => {
    const map = new Map();
    for (const r of roleRelevance) {
      if (!map.has(r.cert_id)) map.set(r.cert_id, {});
      map.get(r.cert_id)[r.role] = r.relevance;
    }
    return map;
  }, [roleRelevance]);

  const activeSpecs = useMemo(
    () => specs.filter(s => s.active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.code.localeCompare(b.code)),
    [specs]
  );

  // ─── Cert-mutators (optimistisch) ─────────────────────────────────────
  const handleTierChange = async (certId, tier) => {
    setCerts(prev => prev.map(c => c.id === certId ? { ...c, tier } : c));
    const r = await setCertificationTier(certId, tier);
    if (r.error) { alert(`Tier wijzigen faalde: ${r.error}`); refresh(); }
    else onChange?.();
  };

  const handleRelevanceChange = async (certId, role, relevance) => {
    // Update lokale state
    setRoleRelevance(prev => {
      const idx = prev.findIndex(x => x.cert_id === certId && x.role === role);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], relevance };
        return next;
      }
      return [...prev, { cert_id: certId, role, relevance }];
    });
    const r = await apiSetRoleRelevance(certId, role, relevance);
    if (r.error) { alert(`Relevance wijzigen faalde: ${r.error}`); refresh(); }
    else onChange?.();
  };

  const handleActiveChange = async (certId, active) => {
    setCerts(prev => prev.map(c => c.id === certId ? { ...c, active } : c));
    const r = await setCertificationActive(certId, active);
    if (r.error) { alert(`Activatie wijzigen faalde: ${r.error}`); refresh(); }
    else onChange?.();
  };

  // ─── Spec-mutators ────────────────────────────────────────────────────
  const handleSpecField = async (code, field, value) => {
    setSpecs(prev => prev.map(s => s.code === code ? { ...s, [field]: value } : s));
    const r = await updateSpecialization(code, { [field]: value });
    if (r.error) { alert(`Specialisatie wijzigen faalde: ${r.error}`); refresh(); }
    else onChange?.();
  };

  const handleSpecActive = async (code, active) => {
    if (!active && (memberCounts[code] || 0) > 0) {
      const ok = confirm(
        `${memberCounts[code]} consultant(s) hebben "${code}" als specialisatie. ` +
        `Bij deactiveren verdwijnt de kolom uit de matrix maar blijven bestaande ` +
        `toewijzingen intact. Doorgaan?`
      );
      if (!ok) return;
    }
    handleSpecField(code, 'active', active);
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading) return <div className="cm-section-sub">Laden…</div>;
  if (error) return <div className="cm-section-sub" style={{ color: 'var(--accent)' }}>⚠️ {error}</div>;

  return (
    <div className="csm-wrap">
      <div className="csm-subnav">
        <button
          type="button"
          className={`csm-subtab ${sub === 'certs' ? 'active' : ''}`}
          onClick={() => setSub('certs')}
        >
          Certificeringen
        </button>
        <button
          type="button"
          className={`csm-subtab ${sub === 'specs' ? 'active' : ''}`}
          onClick={() => setSub('specs')}
        >
          Specialisaties
        </button>
      </div>

      {sub === 'certs' && (
        <CertsSubview
          certs={certs}
          activeSpecs={activeSpecs}
          relevanceByCert={relevanceByCert}
          onTierChange={handleTierChange}
          onRelevanceChange={handleRelevanceChange}
          onActiveChange={handleActiveChange}
          onEditCert={setEditingCert}
          onAddCert={() => setShowNewCert(true)}
        />
      )}
      {sub === 'specs' && (
        <SpecsSubview
          specs={specs}
          memberCounts={memberCounts}
          onFieldChange={handleSpecField}
          onActiveChange={handleSpecActive}
          onAddSpec={() => setShowNewSpec(true)}
        />
      )}

      {showNewCert && (
        <CertModal
          mode="new"
          activeSpecs={activeSpecs}
          onClose={() => setShowNewCert(false)}
          onSave={async (cert) => {
            const r = await upsertCertification(cert);
            if (r.error) { alert(`Toevoegen faalde: ${r.error}`); return; }
            // Set initial role-relevance voor elke spec op N.v.t.
            for (const s of activeSpecs) {
              const initial = cert.role_relevance?.[s.code] || 'not_applicable';
              await apiSetRoleRelevance(cert.id, s.code, initial);
            }
            setShowNewCert(false);
            await refresh();
            onChange?.();
          }}
        />
      )}
      {editingCert && (
        <CertModal
          mode="edit"
          cert={editingCert}
          activeSpecs={activeSpecs}
          onClose={() => setEditingCert(null)}
          onSave={async (cert) => {
            const r = await upsertCertification(cert);
            if (r.error) { alert(`Opslaan faalde: ${r.error}`); return; }
            setEditingCert(null);
            await refresh();
            onChange?.();
          }}
        />
      )}
      {showNewSpec && (
        <SpecModal
          onClose={() => setShowNewSpec(false)}
          onSave={async (data) => {
            const r = await createSpecialization(data);
            if (r.error) { alert(`Toevoegen faalde: ${r.error}`); return; }
            setShowNewSpec(false);
            await refresh();
            onChange?.();
          }}
        />
      )}
    </div>
  );
}

// ─── Certs-subview ────────────────────────────────────────────────────────
function CertsSubview({ certs, activeSpecs, relevanceByCert, onTierChange, onRelevanceChange, onActiveChange, onEditCert, onAddCert }) {
  const sorted = useMemo(() => {
    return [...certs].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier === 'baseline' ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }, [certs]);

  const activeCount = certs.filter(c => c.active).length;
  const inactiveCount = certs.length - activeCount;

  return (
    <>
      <div className="csm-header">
        <div className="csm-counter">
          {activeCount} actief · {inactiveCount} gedeactiveerd
        </div>
        <button type="button" className="btn-add-small" onClick={onAddCert}>
          ＋ Nieuwe certificering
        </button>
      </div>

      {/* Desktop: tabel-layout. Verborgen op <=768px via CSS. */}
      <div className="csm-table-wrap csm-desktop-only">
        <table className="csm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Naam</th>
              <th>Vendor</th>
              <th>Tier</th>
              {activeSpecs.map(s => (
                <th key={s.code} title={`Voor ${s.label}`}>{s.code}</th>
              ))}
              <th>Actief</th>
              <th>Bewerken</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6 + activeSpecs.length} className="csm-empty">
                  Nog geen certificeringen — gebruik "Nieuwe certificering" om te beginnen, of "↻ Seed master-lijst" voor de standaard 14 vanuit JSON.
                </td>
              </tr>
            ) : (
              <CertRows
                rows={sorted}
                activeSpecs={activeSpecs}
                relevanceByCert={relevanceByCert}
                onTierChange={onTierChange}
                onRelevanceChange={onRelevanceChange}
                onActiveChange={onActiveChange}
                onEditCert={onEditCert}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: card-layout. Alleen zichtbaar op <=768px via CSS. */}
      <div className="csm-cards csm-mobile-only">
        {sorted.length === 0 ? (
          <div className="csm-empty">
            Nog geen certificeringen — gebruik "Nieuwe certificering" om te beginnen.
          </div>
        ) : (
          <CertCards
            rows={sorted}
            activeSpecs={activeSpecs}
            relevanceByCert={relevanceByCert}
            onTierChange={onTierChange}
            onRelevanceChange={onRelevanceChange}
            onActiveChange={onActiveChange}
            onEditCert={onEditCert}
          />
        )}
      </div>
    </>
  );
}

function CertCards({ rows, activeSpecs, relevanceByCert, onTierChange, onRelevanceChange, onActiveChange, onEditCert }) {
  const blocks = [];
  let last = null;
  for (const c of rows) {
    if (c.tier !== last) {
      blocks.push(
        <div key={`hdr-${c.tier}`} className="csm-card-tier-header">
          {c.tier === 'baseline' ? 'Baseline' : 'Specialistisch'}
        </div>
      );
      last = c.tier;
    }
    blocks.push(
      <div key={c.id} className={`csm-card ${c.active ? '' : 'csm-deprecated'}`}>
        <div className="csm-card-head">
          <span className="csm-cert-id">{c.id}</span>
          <div className="csm-card-title-block">
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="csm-cert-link">
                {c.name} <span className="csm-link-icon">↗</span>
              </a>
            ) : (
              <span className="csm-cert-name">{c.name}</span>
            )}
            <div className="csm-cert-vendor">{c.vendor}</div>
          </div>
          <button
            type="button"
            className="csm-row-edit"
            title="Naam, vendor, link en notitie bewerken"
            onClick={() => onEditCert(c)}
          >
            <EditIcon />
          </button>
        </div>

        <div className="csm-card-controls">
          <div className="csm-card-control">
            <span className="csm-card-control-label">Tier</span>
            <div className="csm-tier-radio">
              <input
                type="radio"
                name={`m-tier-${c.id}`}
                id={`m-tier-${c.id}-base`}
                checked={c.tier === 'baseline'}
                onChange={() => onTierChange(c.id, 'baseline')}
              />
              <label htmlFor={`m-tier-${c.id}-base`}>Baseline</label>
              <input
                type="radio"
                name={`m-tier-${c.id}`}
                id={`m-tier-${c.id}-spec`}
                checked={c.tier === 'specialist'}
                onChange={() => onTierChange(c.id, 'specialist')}
              />
              <label htmlFor={`m-tier-${c.id}-spec`}>Spec.</label>
            </div>
          </div>

          <div className="csm-card-control">
            <span className="csm-card-control-label">Actief</span>
            <label className="csm-toggle">
              <input
                type="checkbox"
                checked={!!c.active}
                onChange={(e) => onActiveChange(c.id, e.target.checked)}
              />
              <span className="csm-toggle-slider" />
            </label>
          </div>
        </div>

        <div className="csm-card-relevance">
          {activeSpecs.map(s => {
            const cur = relevanceByCert.get(c.id)?.[s.code] || 'not_applicable';
            return (
              <div key={s.code} className="csm-card-relevance-row">
                <span className="csm-card-control-label">{s.code}</span>
                <select
                  className={`csm-relevance csm-relevance--${cur}`}
                  value={cur}
                  onChange={(e) => onRelevanceChange(c.id, s.code, e.target.value)}
                >
                  {RELEVANCE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {c.notes && <div className="csm-cert-note">{c.notes}</div>}
      </div>
    );
  }
  return <>{blocks}</>;
}

function CertRows({ rows, activeSpecs, relevanceByCert, onTierChange, onRelevanceChange, onActiveChange, onEditCert }) {
  const blocks = [];
  let last = null;
  for (const c of rows) {
    if (c.tier !== last) {
      blocks.push(
        <tr key={`hdr-${c.tier}`}>
          <td colSpan={6 + activeSpecs.length} className="csm-tier-divider">
            {c.tier === 'baseline' ? 'Baseline' : 'Specialistisch'}
          </td>
        </tr>
      );
      last = c.tier;
    }
    blocks.push(
      <tr key={c.id} className={c.active ? '' : 'csm-deprecated'}>
        <td><span className="csm-cert-id">{c.id}</span></td>
        <td>
          {c.url ? (
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="csm-cert-link">
              {c.name} <span className="csm-link-icon">↗</span>
            </a>
          ) : (
            <span className="csm-cert-name">{c.name}</span>
          )}
          {c.notes && <div className="csm-cert-note">{c.notes}</div>}
        </td>
        <td><span className="csm-cert-vendor">{c.vendor}</span></td>
        <td>
          <div className="csm-tier-radio">
            <input
              type="radio"
              name={`tier-${c.id}`}
              id={`tier-${c.id}-base`}
              checked={c.tier === 'baseline'}
              onChange={() => onTierChange(c.id, 'baseline')}
            />
            <label htmlFor={`tier-${c.id}-base`}>Baseline</label>
            <input
              type="radio"
              name={`tier-${c.id}`}
              id={`tier-${c.id}-spec`}
              checked={c.tier === 'specialist'}
              onChange={() => onTierChange(c.id, 'specialist')}
            />
            <label htmlFor={`tier-${c.id}-spec`}>Spec.</label>
          </div>
        </td>
        {activeSpecs.map(s => {
          const cur = relevanceByCert.get(c.id)?.[s.code] || 'not_applicable';
          return (
            <td key={s.code}>
              <select
                className={`csm-relevance csm-relevance--${cur}`}
                value={cur}
                onChange={(e) => onRelevanceChange(c.id, s.code, e.target.value)}
              >
                {RELEVANCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </td>
          );
        })}
        <td>
          <label className="csm-toggle">
            <input
              type="checkbox"
              checked={!!c.active}
              onChange={(e) => onActiveChange(c.id, e.target.checked)}
            />
            <span className="csm-toggle-slider" />
          </label>
        </td>
        <td>
          <button
            type="button"
            className="csm-row-edit"
            title="Naam, vendor, link en notitie bewerken"
            onClick={() => onEditCert(c)}
          >
            <EditIcon />
          </button>
        </td>
      </tr>
    );
  }
  return <>{blocks}</>;
}

// ─── Specs-subview ────────────────────────────────────────────────────────
function SpecsSubview({ specs, memberCounts, onFieldChange, onActiveChange, onAddSpec }) {
  const sorted = useMemo(
    () => [...specs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.code.localeCompare(b.code)),
    [specs]
  );
  const activeCount = specs.filter(s => s.active).length;
  const inactiveCount = specs.length - activeCount;

  return (
    <>
      <div className="csm-header">
        <div className="csm-counter">
          {activeCount} actief · {inactiveCount} gedeactiveerd
        </div>
        <button type="button" className="btn-add-small" onClick={onAddSpec}>
          ＋ Nieuwe specialisatie
        </button>
      </div>

      <div className="csm-section-note">
        <strong>Specialisaties drijven de gap-analyse.</strong> Elke nieuwe specialisatie krijgt automatisch een kolom in de Certificeringen-tabel en een filter-knop in de teamview-matrix. Hernoemen werkt direct overal door — geen redeploy nodig. Een gedeactiveerde specialisatie verdwijnt uit de UI maar bestaande consultant-toewijzingen blijven intact.
      </div>

      {/* Desktop: tabel */}
      <div className="csm-table-wrap csm-desktop-only">
        <table className="csm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Korte label</th>
              <th>Volledige naam (CV-context)</th>
              <th>Aantal consultants</th>
              <th>Actief</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="csm-empty">
                  Nog geen specialisaties geconfigureerd — voeg de eerste toe om te beginnen.
                </td>
              </tr>
            ) : sorted.map(s => (
              <tr key={s.code} className={s.active ? '' : 'csm-deprecated'}>
                <td><span className="csm-spec-code">{s.code}</span></td>
                <td>
                  <input
                    className="csm-spec-input"
                    defaultValue={s.label}
                    onBlur={(e) => {
                      if (e.target.value !== s.label) onFieldChange(s.code, 'label', e.target.value);
                    }}
                  />
                </td>
                <td>
                  <input
                    className="csm-spec-input"
                    defaultValue={s.full_name || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (s.full_name || '')) {
                        onFieldChange(s.code, 'full_name', e.target.value);
                      }
                    }}
                  />
                </td>
                <td className={`csm-spec-count ${(memberCounts[s.code] || 0) === 0 ? 'csm-spec-count-zero' : ''}`}>
                  {memberCounts[s.code] || 0}
                </td>
                <td>
                  <label className="csm-toggle">
                    <input
                      type="checkbox"
                      checked={!!s.active}
                      onChange={(e) => onActiveChange(s.code, e.target.checked)}
                    />
                    <span className="csm-toggle-slider" />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card-layout */}
      <div className="csm-cards csm-mobile-only">
        {sorted.length === 0 ? (
          <div className="csm-empty">
            Nog geen specialisaties geconfigureerd — voeg de eerste toe om te beginnen.
          </div>
        ) : sorted.map(s => (
          <div key={s.code} className={`csm-card ${s.active ? '' : 'csm-deprecated'}`}>
            <div className="csm-card-head">
              <span className="csm-spec-code">{s.code}</span>
              <div className="csm-card-title-block">
                <input
                  className="csm-spec-input"
                  defaultValue={s.label}
                  placeholder="Korte label"
                  onBlur={(e) => {
                    if (e.target.value !== s.label) onFieldChange(s.code, 'label', e.target.value);
                  }}
                />
                <input
                  className="csm-spec-input"
                  defaultValue={s.full_name || ''}
                  placeholder="Volledige naam (CV-context)"
                  onBlur={(e) => {
                    if (e.target.value !== (s.full_name || '')) {
                      onFieldChange(s.code, 'full_name', e.target.value);
                    }
                  }}
                  style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-light)' }}
                />
              </div>
            </div>
            <div className="csm-card-controls">
              <div className="csm-card-control">
                <span className="csm-card-control-label">Consultants</span>
                <span className={`csm-spec-count ${(memberCounts[s.code] || 0) === 0 ? 'csm-spec-count-zero' : ''}`}>
                  {memberCounts[s.code] || 0}
                </span>
              </div>
              <div className="csm-card-control">
                <span className="csm-card-control-label">Actief</span>
                <label className="csm-toggle">
                  <input
                    type="checkbox"
                    checked={!!s.active}
                    onChange={(e) => onActiveChange(s.code, e.target.checked)}
                  />
                  <span className="csm-toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────
function CertModal({ mode, cert, activeSpecs, onClose, onSave }) {
  const [form, setForm] = useState({
    id: cert?.id || '',
    name: cert?.name || '',
    vendor: cert?.vendor || 'Microsoft',
    tier: cert?.tier || 'baseline',
    url: cert?.url || '',
    notes: cert?.notes || '',
    active: cert?.active !== false,
  });
  const [relevance, setRelevance] = useState(() => {
    const r = {};
    for (const s of activeSpecs) r[s.code] = 'not_applicable';
    return r;
  });

  const isEdit = mode === 'edit';
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.id.trim()) { alert('Cert-ID is verplicht.'); return; }
    if (!form.name.trim()) { alert('Naam is verplicht.'); return; }
    await onSave({
      id: form.id.trim(),
      name: form.name.trim(),
      vendor: form.vendor.trim() || 'Anders',
      tier: form.tier,
      url: form.url.trim(),
      notes: form.notes.trim(),
      active: form.active,
      role_relevance: isEdit ? undefined : relevance,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="case-detail-box csm-modal">
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--navy)' }}>
          {isEdit ? `Certificering bewerken — ${form.id}` : 'Nieuwe certificering toevoegen'}
        </h2>

        <div className="csm-form">
          <div className="csm-form-row">
            <label>Cert-ID <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input
              type="text"
              value={form.id}
              onChange={(e) => update('id', e.target.value)}
              placeholder="bv. AZ-204, DBX-ML-A"
              disabled={isEdit}
            />
            {!isEdit && (
              <small className="csm-form-hint">Korte canonical string die ook in CV-tekst voorkomt.</small>
            )}
          </div>

          <div className="csm-form-row">
            <label>Naam</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="bv. Azure Developer Associate"
            />
          </div>

          <div className="csm-form-grid">
            <div>
              <label>Vendor</label>
              <input
                type="text"
                value={form.vendor}
                onChange={(e) => update('vendor', e.target.value)}
                placeholder="Microsoft / Databricks / DAMA / …"
              />
            </div>
            <div>
              <label>Tier</label>
              <select value={form.tier} onChange={(e) => update('tier', e.target.value)}>
                <option value="baseline">Baseline</option>
                <option value="specialist">Specialistisch</option>
              </select>
            </div>
          </div>

          {!isEdit && activeSpecs.length > 0 && (
            <div className="csm-form-row">
              <label>Relevantie per specialisatie</label>
              <div className="csm-form-relevance-grid">
                {activeSpecs.map(s => (
                  <div key={s.code}>
                    <span className="csm-spec-code" style={{ display: 'block', marginBottom: '0.25rem' }}>{s.code}</span>
                    <select
                      value={relevance[s.code]}
                      onChange={(e) => setRelevance(r => ({ ...r, [s.code]: e.target.value }))}
                    >
                      {RELEVANCE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="csm-form-row">
            <label>Externe link (optioneel)</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => update('url', e.target.value)}
              placeholder="https://learn.microsoft.com/…"
            />
            <small className="csm-form-hint">
              Naam in de tabel wordt clickable als hier een link staat.
            </small>
          </div>

          <div className="csm-form-row">
            <label>Notitie (optioneel)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Bv. 'Aanbevolen, niet verwacht. Examen breed van scope…'"
            />
          </div>
        </div>

        <div className="csm-modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>Annuleren</button>
          <button type="button" className="csm-btn-primary" onClick={submit}>
            {isEdit ? 'Opslaan' : 'Toevoegen aan master-lijst'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpecModal({ onClose, onSave }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [fullName, setFullName] = useState('');

  const submit = async () => {
    await onSave({ code, label, full_name: fullName });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="case-detail-box csm-modal" style={{ maxWidth: 480 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--navy)' }}>
          Nieuwe specialisatie toevoegen
        </h2>

        <div className="csm-form">
          <div className="csm-form-row">
            <label>Code <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="bv. DA, MLE, CDA"
              maxLength={6}
              style={{ textTransform: 'uppercase' }}
            />
            <small className="csm-form-hint">2-6 hoofdletters. Wordt gebruikt als kolom-header in de matrix.</small>
          </div>
          <div className="csm-form-row">
            <label>Korte label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="bv. Data Analyst, ML Engineer"
            />
          </div>
          <div className="csm-form-row">
            <label>Volledige naam (CV-context, optioneel)</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="bv. Data Consultant - Data Analyst"
            />
          </div>
        </div>

        <div className="csm-modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>Annuleren</button>
          <button type="button" className="csm-btn-primary" onClick={submit}>Toevoegen</button>
        </div>
      </div>
    </div>
  );
}

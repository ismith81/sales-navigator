import React, { useEffect, useMemo, useState } from 'react';
import {
  listTeamMembers,
  createTeamMember,
  deleteTeamMember,
  parseCvPdf,
  uploadCvPdf,
  listBranches,
  getAvailabilityBucket,
  backfillTeamEmbeddings,
} from '../lib/teamMembers';
import TeamMemberEditor from './TeamMemberEditor';

// Beheer-tab voor consultant-profielen ("Team"). Layout in lijn met
// Beheer → Certificeringen:
//   - Toolbar: filter-pills (avail-bucket) links, primary CTA + gear rechts
//   - Aggregaat-cards: team-grootte, beschikbaarheid, specialisaties
//   - Card-grid voor team-leden i.p.v. flat rows
//   - Gear-popover voor zelden-gebruikte semantic-embedding-acties
// Skills-tags bewust weggelaten — komt terug zodra kernskills/technologies-
// overlap is opgelost in een aparte PR.

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="14" height="14"
       aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="14" height="14"
       aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
);
const CvIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="11" height="11"
       aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);
const ClientIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 21h18"/>
    <path d="M5 21V7l7-4 7 4v14"/>
    <path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>
  </svg>
);
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="18" height="18"
       aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="14" height="14"
       aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
    <path d="M3 12a9 3 0 0 0 18 0"/>
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="14" height="14"
       aria-hidden="true">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

// Filter-pills voor avail-bucket. Op mobile alleen short-label, op
// desktop full label — patroon uit cert-page (AE / AE — Analytics Engineer).
const BUCKET_ORDER = ['all', 'now', 'soon', 'later'];
const BUCKET = {
  all:   { short: 'Alle',       long: 'Alle' },
  now:   { short: 'Nu',         long: 'Nu beschikbaar' },
  soon:  { short: 'Binnenkort', long: 'Bijna beschikbaar' },
  later: { short: 'Bezet',      long: 'Bezet' },
};
const BUCKET_TITLE = {
  all: 'Alle teamleden',
  now: 'Nu beschikbaar',
  soon: 'Bijna beschikbaar (≤ 3 maanden)',
  later: 'Bezet (> 3 maanden of einddatum onbekend)',
};

export default function TeamManager() {
  const [members, setMembers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingPrefill, setEditingPrefill] = useState(null);
  const [parseStatus, setParseStatus] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [embedStatus, setEmbedStatus] = useState(null);
  const [filterBucket, setFilterBucket] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [m, b] = await Promise.all([listTeamMembers(), listBranches()]);
    setMembers(m);
    setBranches(b);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  // ─── Aggregaat-tellingen ─────────────────────────────────────────────
  // Bucketcounts: hoeveel team-leden per beschikbaarheids-bucket. Specs:
  // hoeveel per role_code (uit specializations-tabel; null = onbekend).
  const stats = useMemo(() => {
    const buckets = { now: 0, soon: 0, later: 0 };
    const specs = {}; // code → count
    for (const m of members) {
      const b = getAvailabilityBucket(m);
      buckets[b.bucket] = (buckets[b.bucket] || 0) + 1;
      const code = m.role_code || '—';
      specs[code] = (specs[code] || 0) + 1;
    }
    return { buckets, specs, total: members.length };
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (filterBucket === 'all') return members;
    return members.filter(m => getAvailabilityBucket(m).bucket === filterBucket);
  }, [members, filterBucket]);

  // ─── Acties ──────────────────────────────────────────────────────────
  const startNew = () => {
    setEditingPrefill(null);
    setEditingId('new');
  };

  // Klik op + CV uploaden: file-picker, parse, dan editor openen met
  // geëxtraheerde velden vooringevuld + PDF wachtend om te uploaden bij save.
  const startFromCv = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setParseError(null);
      setParseStatus('CV inlezen + structuur ophalen…');
      const result = await parseCvPdf(file);
      setParseStatus(null);
      if (result.error) {
        setParseError(result.error);
        return;
      }
      // Diagnose: meld als 't extract erg dun was zodat sales weet of 't
      // model 't liet liggen of dat 't aan de PDF lag.
      const d = result.diagnostics || {};
      if (d.fieldsFilled !== undefined && d.fieldsFilled < 4) {
        const hint = d.textLength < 800
          ? `Slechts ${d.textLength} chars uit PDF gehaald — mogelijk gescand of image-zwaar. Vul handmatig aan of probeer een tekst-PDF.`
          : `Tekst gelezen (${d.textLength} chars), maar Gemini vond weinig velden (${d.fieldsFilled}/9). Check of 't CV de gangbare structuur heeft (rol, skills, projecten).`;
        setParseError(`⚠️ Beperkte extractie. ${hint}`);
      }
      // Editor wordt geopend in 'new'-mode met de parsed fields voorgevuld
      // én het PDF-bestand zodat de editor het bij saven kan uploaden.
      setEditingPrefill({ ...result.fields, _pendingPdf: file });
      setEditingId('new');
    };
    input.click();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Verwijder profiel van "${name}"?`)) return;
    await deleteTeamMember(id);
    await refresh();
  };

  const handleEditorClose = async (didSave) => {
    setEditingId(null);
    setEditingPrefill(null);
    if (didSave) await refresh();
  };

  // Backfill van semantic-embeddings — handmatige actie voor wanneer er
  // profielen zonder embedding zijn (na de SQL-migratie of als ooit een
  // auto-embed faalde tijdens save). Default = alleen profielen zonder
  // embedding; force=true herrekent álle embeddings.
  const handleEmbedBackfill = async ({ force = false } = {}) => {
    setShowAdvanced(false);
    setEmbedStatus({ kind: 'busy', message: force ? 'Alle profielen opnieuw embedden…' : 'Profielen zonder embedding ophalen + embedden…' });
    const res = await backfillTeamEmbeddings({ force });
    if (res?.error) {
      setEmbedStatus({ kind: 'error', message: `Backfill faalde: ${res.error}` });
      return;
    }
    const { processed = 0, succeeded = 0, failed = 0, errors = [], message } = res || {};
    if (processed === 0) {
      setEmbedStatus({ kind: 'ok', message: message || 'Niets te embedden.' });
      return;
    }
    const errSummary = errors.length
      ? ` Fouten: ${errors.slice(0, 3).map(e => `${e.name || e.id}: ${e.error}`).join('; ')}${errors.length > 3 ? '…' : ''}`
      : '';
    setEmbedStatus({
      kind: failed > 0 ? 'partial' : 'ok',
      message: `Embeddings: ${succeeded}/${processed} succesvol${failed > 0 ? `, ${failed} faalde` : ''}.${errSummary}`,
    });
  };

  if (editingId !== null) {
    return (
      <TeamMemberEditor
        memberId={editingId === 'new' ? null : editingId}
        prefill={editingPrefill}
        branches={branches}
        onClose={handleEditorClose}
      />
    );
  }

  return (
    <div className="team-manager">
      {/* ─── Toolbar ──────────────────────────────────────────────────
          Twee rijen: filters + tandwiel rechts boven (admin-actie,
          visueel apart van de CTAs); CTA-knoppen op tweede rij. */}
      <div className="team-toolbar">
        <div className="team-toolbar-filters">
          {BUCKET_ORDER.map(b => {
            const count = b === 'all' ? stats.total : (stats.buckets[b] || 0);
            return (
              <button
                key={b}
                type="button"
                className={`cert-filter-btn ${filterBucket === b ? 'active' : ''}`}
                onClick={() => setFilterBucket(b)}
                title={BUCKET_TITLE[b]}
              >
                <span className="team-filter-mobile">{BUCKET[b].short}</span>
                <span className="team-filter-desktop">{BUCKET[b].long}</span>
                <span className="team-filter-count"> ({count})</span>
              </button>
            );
          })}
          <div className="cert-advanced-wrap team-toolbar-gear">
            <button
              type="button"
              className="cert-advanced-trigger"
              onClick={() => setShowAdvanced(v => !v)}
              aria-expanded={showAdvanced}
              aria-haspopup="menu"
              aria-label="Geavanceerde acties"
              title="Geavanceerde acties (semantic embeddings)"
            >
              <GearIcon />
            </button>
            {showAdvanced && (
              <>
                <div className="cert-advanced-backdrop" onClick={() => setShowAdvanced(false)} />
                <div className="cert-advanced-menu" role="menu">
                  <button
                    type="button"
                    className="cert-advanced-item"
                    onClick={() => handleEmbedBackfill({ force: false })}
                    disabled={embedStatus?.kind === 'busy'}
                  >
                    <span className="team-advanced-item-head">
                      <DatabaseIcon /> Embed ontbrekende profielen
                    </span>
                    <small>Voor profielen zonder semantic embedding (na initial setup of als auto-embed faalde)</small>
                  </button>
                  <button
                    type="button"
                    className="cert-advanced-item cert-advanced-item--danger"
                    onClick={() => handleEmbedBackfill({ force: true })}
                    disabled={embedStatus?.kind === 'busy'}
                  >
                    <span className="team-advanced-item-head">
                      <RefreshIcon /> Herbouw alle embeddings
                    </span>
                    <small>Herrekent álles — gebruik na grote profiel-updates of model-wissel</small>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="team-toolbar-actions">
          <button
            type="button"
            className="csm-btn-secondary"
            onClick={startFromCv}
            disabled={!!parseStatus}
          >
            {parseStatus ? '⏳ Bezig…' : '＋ CV uploaden'}
          </button>
          <button
            type="button"
            className="csm-btn-primary"
            onClick={startNew}
            disabled={!!parseStatus}
          >
            ＋ Nieuw teamlid
          </button>
        </div>
      </div>

      {/* ─── Status-meldingen ─────────────────────────────────────────── */}
      {parseError && (
        <div className="team-parse-error">⚠️ {parseError}</div>
      )}
      {parseStatus && (
        <div className="team-parse-status">{parseStatus}</div>
      )}
      {embedStatus && (
        <div className={`team-embed-status team-embed-status--${embedStatus.kind}`} style={{ marginBottom: '0.85rem' }}>
          {embedStatus.message}
        </div>
      )}

      {/* ─── Specialisaties-card ──────────────────────────────────────
          Team-grootte + beschikbaarheid weggelaten — info zit al in de
          filter-pill-counts hierboven. Specialisaties zijn een aparte
          dimensie die de filter niet toont, dus die houden we. */}
      <div className="cert-aggregate-card team-spec-card">
        <div className="cert-aggregate-card-head">
          <span className="cert-aggregate-card-label">Specialisaties</span>
          <span className="cert-aggregate-card-percent" style={{ fontSize: '0.95rem', fontFamily: "'Consolas', monospace" }}>
            {Object.entries(stats.specs)
              .filter(([code]) => code !== '—')
              .map(([code, n]) => `${code} ${n}`)
              .join(' · ') || '—'}
          </span>
        </div>
        <div className="cert-aggregate-card-stats">
          {stats.specs['—']
            ? `${stats.specs['—']} zonder specialisatie toegewezen`
            : 'iedereen heeft een specialisatie'}
        </div>
      </div>

      {/* ─── Team-cards ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="team-empty">Laden…</div>
      ) : members.length === 0 ? (
        <div className="team-empty">
          Nog geen teamleden. Klik <strong>+ CV uploaden</strong> om een PDF of
          Word-document (.docx) in te lezen — Nova haalt de velden er voor je uit.
          Of <strong>+ Nieuw teamlid</strong> voor handmatig invoeren.
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="team-empty">Geen teamleden in deze filter.</div>
      ) : (
        <div className="team-grid">
          {filteredMembers.map(m => {
            const b = getAvailabilityBucket(m);
            return (
              <button
                key={m.id}
                type="button"
                className="team-card"
                onClick={() => { setEditingPrefill(null); setEditingId(m.id); }}
              >
                <div className="team-card-head">
                  <span className="team-card-name">{m.name}</span>
                  <span className={`team-badge team-badge--${b.bucket}`}>{b.label}</span>
                </div>
                <div className="team-card-role">
                  {[m.seniority, m.role].filter(Boolean).join(' · ') || '—'}
                </div>
                {m.current_client && (
                  <div className="team-card-client" title="Huidige klant / opdracht">
                    <ClientIcon />
                    <span>{m.current_client}</span>
                  </div>
                )}
                <div className="team-card-meta">
                  <span className="team-card-cv">
                    {m.cv_pdf_path ? (
                      <><CvIcon /> CV-PDF</>
                    ) : (
                      <span className="team-card-cv-missing">Geen CV</span>
                    )}
                  </span>
                  <span className="team-card-actions">
                    <button
                      type="button"
                      className="team-icon-btn team-icon-btn--edit"
                      onClick={(e) => { e.stopPropagation(); setEditingPrefill(null); setEditingId(m.id); }}
                      title="Bewerken"
                      aria-label="Bewerken"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="team-icon-btn team-icon-btn--danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(m.id, m.name); }}
                      title="Verwijder profiel"
                      aria-label="Verwijder profiel"
                    >
                      <TrashIcon />
                    </button>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

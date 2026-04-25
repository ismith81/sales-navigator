import React, { useEffect, useState } from 'react';
import {
  listTeamMembers,
  createTeamMember,
  deleteTeamMember,
  parseCvPdf,
  uploadCvPdf,
  listBranches,
} from '../lib/teamMembers';
import TeamMemberEditor from './TeamMemberEditor';

// Beheer-tab voor consultant-profielen ("Team"). Toont een lijst en routeert
// klikken naar de editor. Knoppen: + Nieuw teamlid (lege editor) en + CV
// uploaden (PDF → parse → prefill editor).
export default function TeamManager() {
  const [members, setMembers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingPrefill, setEditingPrefill] = useState(null);
  const [parseStatus, setParseStatus] = useState(null);
  const [parseError, setParseError] = useState(null);

  const refresh = async () => {
    setLoading(true);
    const [m, b] = await Promise.all([listTeamMembers(), listBranches()]);
    setMembers(m);
    setBranches(b);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const startNew = () => {
    setEditingPrefill(null);
    setEditingId('new');
  };

  // Klik op + CV uploaden: file-picker, parse, dan editor openen met
  // geëxtraheerde velden vooringevuld + PDF wachtend om te uploaden bij save.
  const startFromCv = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
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
      <div className="team-actions">
        <button type="button" className="btn-add-small" onClick={startFromCv} disabled={!!parseStatus}>
          {parseStatus ? '⏳ Bezig…' : '＋ CV uploaden'}
        </button>
        <button type="button" className="btn-add-small" onClick={startNew} disabled={!!parseStatus}>
          ＋ Nieuw teamlid
        </button>
      </div>
      {parseError && (
        <div className="team-parse-error">
          ⚠️ {parseError}
        </div>
      )}
      {parseStatus && (
        <div className="team-parse-status">
          {parseStatus}
        </div>
      )}

      {loading ? (
        <div className="team-empty">Laden…</div>
      ) : members.length === 0 ? (
        <div className="team-empty">
          Nog geen teamleden. Klik <strong>+ CV uploaden</strong> om een PDF in te lezen
          (Nova haalt de velden er voor je uit), of <strong>+ Nieuw teamlid</strong>
          voor handmatig invoeren.
        </div>
      ) : (
        <div className="team-list">
          {members.map(m => (
            <div
              key={m.id}
              className="team-row"
              onClick={() => { setEditingPrefill(null); setEditingId(m.id); }}
            >
              <div className="team-row-main">
                <div className="team-row-name">
                  {m.name}
                  {!m.available_for_sales && <span className="team-badge team-badge--off">niet beschikbaar</span>}
                </div>
                <div className="team-row-role">
                  {[m.seniority, m.role].filter(Boolean).join(' · ')}
                </div>
                {m.current_client && (
                  <div className="team-row-client" title="Huidige klant / opdracht">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 21h18"/>
                      <path d="M5 21V7l7-4 7 4v14"/>
                      <path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>
                    </svg>
                    <span>{m.current_client}</span>
                  </div>
                )}
                <div className="team-row-tags">
                  {/* Skills + technologies in dezelfde teal-stijl — visueel
                      lossen we 't onderscheid niet op want voor sales is 't
                      één gecombineerde "wat kan deze persoon"-set. */}
                  {[...(m.kernskills || []), ...(m.technologies || [])]
                    .slice(0, 10)
                    .map((tag, idx) => (
                      <span key={`${tag}-${idx}`} className="team-tag">{tag}</span>
                    ))}
                </div>
              </div>
              <div className="team-row-actions">
                {m.cv_pdf_path && (
                  <span className="team-row-cv-icon" title="CV-PDF aanwezig">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </span>
                )}
                <button
                  type="button"
                  className="team-row-del"
                  onClick={(e) => { e.stopPropagation(); handleDelete(m.id, m.name); }}
                  title="Verwijder profiel"
                  aria-label="Verwijder profiel"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

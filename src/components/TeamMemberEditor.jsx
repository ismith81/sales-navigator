import React, { useEffect, useRef, useState } from 'react';
import {
  getTeamMember,
  createTeamMember,
  updateTeamMember,
  parseCvPdf,
  uploadCvPdf,
  getCvPdfUrl,
} from '../lib/teamMembers';

// Editor voor één team-member-profiel. Gebruikt zowel voor "+ Nieuw" (memberId=null)
// als voor edit van een bestaande row. prefill is optioneel — gebruikt bij "+ CV
// uploaden"-flow uit TeamManager: parsed fields + de originele File object onder
// _pendingPdf (die we hier uploaden bij save).

// Creates-eigen senioriteits-schaal (vervangt de eerdere generieke
// Junior/Medior/Lead/Principal). Mapping voor reeds opgeslagen oude waardes:
// Junior → Starter, Medior → Young Professional, Lead/Principal → Expert.
const SENIORITY_OPTIONS = ['Starter', 'Young Professional', 'Professional', 'Senior', 'Expert'];
const SENIORITY_MIGRATION = {
  Junior: 'Starter',
  Medior: 'Young Professional',
  Lead: 'Expert',
  Principal: 'Expert',
};

// Klein hulpmiddel: array <-> komma-gescheiden string voor de tag-inputs.
const arrToText = (a = []) => Array.isArray(a) ? a.join(', ') : '';
const textToArr = (s = '') => (s || '')
  .split(',').map(x => x.trim()).filter(Boolean);

export default function TeamMemberEditor({ memberId, prefill, branches = [], onClose }) {
  const isNew = !memberId;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form-state. Velden komen uit de team_members-schema.
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState('Professional');
  const [kernskills, setKernskills] = useState('');
  const [technologies, setTechnologies] = useState('');
  // sectors is een array (chip-picker uit canonical branches-lijst), niet
  // free-text zoals de andere tag-velden — gegarandeerd synchroon met cases.
  const [sectors, setSectors] = useState([]);
  const [certifications, setCertifications] = useState('');
  const [summary, setSummary] = useState('');
  const [available, setAvailable] = useState(true);
  const [currentClient, setCurrentClient] = useState('');
  const [projectExperience, setProjectExperience] = useState([]); // [{name, role, description}]

  // CV-PDF: bestaand path uit DB + signed URL voor preview, of pending File
  // van de "+ CV uploaden"-flow / re-upload binnen de editor.
  const [cvPath, setCvPath] = useState('');
  const [cvSignedUrl, setCvSignedUrl] = useState('');
  const [pendingPdf, setPendingPdf] = useState(null);
  const [reparseStatus, setReparseStatus] = useState(null);
  // Replace-mode: 'reparse' (parse PDF + overschrijf velden) of 'pdf-only'
  // (alleen PDF vervangen, velden ongemoeid). Gezet door de keuze-knoppen.
  const [replaceMode, setReplaceMode] = useState(null);
  const fileInputRef = useRef(null);

  // Originele bestandsnaam afleiden uit de path (`<memberId>/<timestamp>-<name>`)
  // voor de download-attribuut zodat de gebruiker het herkent in z'n downloads-map.
  const cvFileName = cvPath
    ? cvPath.split('/').slice(-1)[0].replace(/^\d+-/, '')
    : '';

  // Echte download flow: een gewoon <a download={name}> werkt cross-origin
  // niet (Supabase Storage staat op een andere domain → browser negeert
  // het download-attribuut en opent in plaats daarvan in nieuw tab). Fix:
  // de blob ophalen, daar een object-URL van maken (same-origin) en die
  // klikken. Resultaat: echte save-as-dialog met de juiste filename.
  const handleDownload = async () => {
    if (!cvSignedUrl) return;
    try {
      const res = await fetch(cvSignedUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = cvFileName || 'cv.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Geef de browser even tijd om de download te starten voor we de URL
      // weggooien — Chrome heeft 'm direct nodig, Safari soms iets later.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      console.warn('CV-download fout:', err);
      // Fallback: gewoon openen in nieuw tab (zoals voorheen).
      window.open(cvSignedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // ─── load existing OR apply prefill ────────────────────────────────────
  useEffect(() => {
    if (isNew) {
      // Vooringevulde velden uit een net-geparsed CV.
      if (prefill) {
        setName(prefill.name || '');
        setRole(prefill.role || '');
        setSeniority(SENIORITY_MIGRATION[prefill.seniority] || prefill.seniority || 'Professional');
        setKernskills(arrToText(prefill.kernskills));
        setTechnologies(arrToText(prefill.technologies));
        setSectors(Array.isArray(prefill.sectors) ? prefill.sectors : []);
        setCertifications(arrToText(prefill.certifications));
        setSummary(prefill.summary || '');
        setProjectExperience(Array.isArray(prefill.project_experience) ? prefill.project_experience : []);
        if (prefill._pendingPdf) setPendingPdf(prefill._pendingPdf);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const m = await getTeamMember(memberId);
      if (cancelled) return;
      if (!m) {
        setError('Profiel niet gevonden.');
        setLoading(false);
        return;
      }
      setName(m.name || '');
      setRole(m.role || '');
      setSeniority(SENIORITY_MIGRATION[m.seniority] || m.seniority || 'Professional');
      setKernskills(arrToText(m.kernskills));
      setTechnologies(arrToText(m.technologies));
      setSectors(Array.isArray(m.sectors) ? m.sectors : []);
      setCertifications(arrToText(m.certifications));
      setSummary(m.summary || '');
      setAvailable(!!m.available_for_sales);
      setCurrentClient(m.current_client || '');
      setProjectExperience(Array.isArray(m.project_experience) ? m.project_experience : []);
      setCvPath(m.cv_pdf_path || '');
      if (m.cv_pdf_path) {
        // 600s TTL — geeft tijd om te downloaden, evt. extern bewerken,
        // en weer te uploaden zonder dat de URL ondertussen verloopt.
        const url = await getCvPdfUrl(m.cv_pdf_path, 600);
        if (!cancelled) setCvSignedUrl(url || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId, isNew, prefill]);

  // ─── PDF kiezen + uploaden (twee modes) ────────────────────────────────
  // 'reparse'  = nieuwe PDF parsen en velden overschrijven (CV is geüpdatet)
  // 'pdf-only' = alleen PDF vervangen, velden behouden (snelle correctie)
  const triggerFilePick = (mode) => {
    setReplaceMode(mode);
    fileInputRef.current?.click();
  };

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const mode = replaceMode || 'reparse';

    if (mode === 'reparse') {
      setReparseStatus('CV inlezen + structuur ophalen…');
      const result = await parseCvPdf(file);
      setReparseStatus(null);
      if (result.error) {
        setError(result.error);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      // Velden updaten met geëxtraheerde waarden — gebruiker kan na de save
      // alsnog wijzigen voor 't echt opslaat. Alleen overschrijven als
      // er een waarde uit kwam — anders behouden we wat de user had.
      const f = result.fields || {};
      if (f.name) setName(f.name);
      if (f.role) setRole(f.role);
      if (f.seniority) setSeniority(SENIORITY_MIGRATION[f.seniority] || f.seniority);
      if (Array.isArray(f.kernskills) && f.kernskills.length) setKernskills(arrToText(f.kernskills));
      if (Array.isArray(f.technologies) && f.technologies.length) setTechnologies(arrToText(f.technologies));
      if (Array.isArray(f.sectors) && f.sectors.length) {
        // Filter naar alleen canonical waardes — Gemini's enum-constraint
        // moet 't al doen, defensief filter blokkeert vrij-text-drift bij
        // oudere parses.
        const valid = f.sectors.filter(s => branches.includes(s));
        setSectors(valid);
      }
      if (Array.isArray(f.certifications) && f.certifications.length) setCertifications(arrToText(f.certifications));
      if (f.summary) setSummary(f.summary);
      if (Array.isArray(f.project_experience) && f.project_experience.length) setProjectExperience(f.project_experience);

      // Diagnose tonen als de extractie dun was.
      const d = result.diagnostics || {};
      if (d.fieldsFilled !== undefined && d.fieldsFilled < 4) {
        const hint = d.textLength < 800
          ? `Slechts ${d.textLength} chars uit PDF gehaald — mogelijk gescand of image-zwaar.`
          : `Tekst gelezen (${d.textLength} chars), maar Gemini vond weinig velden (${d.fieldsFilled}/9).`;
        setError(`⚠️ Beperkte extractie. ${hint} Vul handmatig aan waar nodig.`);
      }
    }
    // mode === 'pdf-only' → niets met de fields doen, alleen pendingPdf zetten

    // Reset de input zodat 't change-event opnieuw kan vuren bij dezelfde file.
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPendingPdf(file);
    setReplaceMode(null);
  };

  // ─── save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Naam is verplicht.');
      setSaving(false);
      return;
    }

    const payload = {
      name: cleanName,
      role: role.trim() || null,
      seniority: seniority || null,
      kernskills: textToArr(kernskills),
      technologies: textToArr(technologies),
      // sectors is al een array (chip-picker) — geen textToArr-conversie nodig.
      sectors: sectors,
      certifications: textToArr(certifications),
      summary: summary.trim() || null,
      available_for_sales: available,
      current_client: currentClient.trim() || null,
      project_experience: projectExperience,
    };

    let activeId = memberId;
    if (isNew) {
      const created = await createTeamMember(payload);
      if (!created?.id) {
        setError('Aanmaken mislukt.');
        setSaving(false);
        return;
      }
      activeId = created.id;
    } else {
      const updated = await updateTeamMember(memberId, payload);
      if (!updated) {
        setError('Opslaan mislukt.');
        setSaving(false);
        return;
      }
    }

    // Eventuele pending PDF nu uploaden + path koppelen.
    if (pendingPdf && activeId) {
      const upRes = await uploadCvPdf(activeId, pendingPdf);
      if (upRes.error) {
        setError(`Profiel opgeslagen, maar PDF-upload faalde: ${upRes.error}`);
        setSaving(false);
        return;
      }
      await updateTeamMember(activeId, { cv_pdf_path: upRes.path });
    }

    setSaving(false);
    onClose?.(true);
  };

  // ─── projectervaring: simpele inline-editor ───────────────────────────
  const updateProject = (idx, patch) => {
    setProjectExperience(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };
  const addProject = () => {
    setProjectExperience(prev => [...prev, { name: '', role: '', description: '' }]);
  };
  const removeProject = (idx) => {
    setProjectExperience(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return <div className="team-editor team-editor--loading">Laden…</div>;
  }

  return (
    <div className="team-editor">
      <div className="team-editor-topbar">
        <button type="button" className="team-editor-back" onClick={() => onClose?.(false)} aria-label="Terug">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Terug</span>
        </button>
        <div className="team-editor-title">
          <span className="team-editor-eyebrow">{isNew ? 'Nieuw teamlid' : 'Teamlid bewerken'}</span>
          <span className="team-editor-name">{name || '—'}</span>
        </div>
        <button type="button" className="team-editor-save" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Opslaan…' : '✓ Opslaan'}
        </button>
      </div>

      {error && <div className="team-editor-error">⚠️ {error}</div>}
      {reparseStatus && <div className="team-editor-status">{reparseStatus}</div>}

      <div className="team-editor-grid">
        <label className="team-field">
          <span className="team-field-label">Naam</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Voor- en achternaam"
          />
        </label>
        <label className="team-field">
          <span className="team-field-label">Functietitel</span>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="bv. Analytics Engineer"
          />
        </label>
        <label className="team-field">
          <span className="team-field-label">Senioriteit</span>
          <select value={seniority} onChange={(e) => setSeniority(e.target.value)}>
            {SENIORITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="team-field team-field--toggle">
          <span className="team-field-label">Beschikbaar voor sales</span>
          <label className="team-toggle">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
            <span>{available ? 'Ja' : 'Nee'}</span>
          </label>
        </label>

        <label className="team-field team-field--wide">
          <span className="team-field-label">
            Huidige klant / opdracht
            <span className="team-field-hint">Vrij tekst — bv. <em>"Bol.com (tot Q3 2026)"</em> of <em>"Beschikbaar"</em></span>
          </span>
          <input
            type="text"
            value={currentClient}
            onChange={(e) => setCurrentClient(e.target.value)}
            placeholder="bv. Bol.com — Solution Architect"
          />
        </label>

        <label className="team-field team-field--wide">
          <span className="team-field-label">
            Kernskills
            <span className="team-field-hint">Komma-gescheiden — bv. <em>Power BI, DAX, datamodellering, stakeholdermanagement</em></span>
          </span>
          <input
            type="text"
            value={kernskills}
            onChange={(e) => setKernskills(e.target.value)}
            placeholder="komma-gescheiden"
          />
        </label>
        <label className="team-field team-field--wide">
          <span className="team-field-label">
            Technologieën
            <span className="team-field-hint">Tools/platforms — <em>Power BI, Microsoft Fabric, Databricks, Azure</em></span>
          </span>
          <input
            type="text"
            value={technologies}
            onChange={(e) => setTechnologies(e.target.value)}
            placeholder="komma-gescheiden"
          />
        </label>
        <div className="team-field team-field--wide">
          <span className="team-field-label">
            Sectoren
            <span className="team-field-hint">Klik om te (de)selecteren — synchroon met cases</span>
          </span>
          <div className="team-sector-chips">
            {branches.length === 0 ? (
              <span className="team-sector-empty">Nog geen branches geconfigureerd.</span>
            ) : (
              branches.map(b => {
                const active = sectors.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    className={`team-sector-chip${active ? ' is-active' : ''}`}
                    onClick={() => {
                      setSectors(prev => active ? prev.filter(s => s !== b) : [...prev, b]);
                    }}
                  >{b}</button>
                );
              })
            )}
          </div>
        </div>
        <label className="team-field team-field--wide">
          <span className="team-field-label">
            Certificaten
            <span className="team-field-hint">Officiële certificaten</span>
          </span>
          <input
            type="text"
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            placeholder="komma-gescheiden"
          />
        </label>

        <label className="team-field team-field--wide">
          <span className="team-field-label">
            Klantgerichte samenvatting
            <span className="team-field-hint">2–3 zinnen voor offertes/voorstellen, in derde persoon</span>
          </span>
          <textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="bv. 'Jessica is een Analytics Engineer met sterke ervaring in Power BI…'"
          />
        </label>
      </div>

      <div className="team-projects">
        <div className="team-projects-header">
          <span className="team-field-label">Projectervaring</span>
          <button type="button" className="team-projects-add" onClick={addProject}>＋ Project</button>
        </div>
        {projectExperience.length === 0 && (
          <div className="team-projects-empty">Nog geen projecten. Voeg er een toe of upload een CV om ze te extracten.</div>
        )}
        {projectExperience.map((p, idx) => (
          <div key={idx} className="team-project">
            <div className="team-project-row">
              <input
                type="text"
                value={p.name || ''}
                onChange={(e) => updateProject(idx, { name: e.target.value })}
                placeholder="Project- of klantnaam"
                className="team-project-name"
              />
              <input
                type="text"
                value={p.role || ''}
                onChange={(e) => updateProject(idx, { role: e.target.value })}
                placeholder="Rol"
                className="team-project-role"
              />
              <button
                type="button"
                className="team-project-del"
                onClick={() => removeProject(idx)}
                title="Project verwijderen"
                aria-label="Project verwijderen"
              >×</button>
            </div>
            <textarea
              rows={2}
              value={p.description || ''}
              onChange={(e) => updateProject(idx, { description: e.target.value })}
              placeholder="1–2 zinnen wat je deed en waarom 't relevant is"
            />
          </div>
        ))}
      </div>

      <div className="team-cv">
        <div className="team-cv-header">
          <span className="team-field-label">CV-bestand (PDF)</span>
        </div>
        {cvPath ? (
          <>
            <div className="team-cv-current">
              <span className="team-cv-name">📄 {cvFileName}</span>
              {cvSignedUrl && (
                <>
                  <a
                    href={cvSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="team-cv-link"
                    title="In nieuw tabblad openen"
                  >
                    Bekijken
                  </a>
                  <button
                    type="button"
                    className="team-cv-link"
                    onClick={handleDownload}
                    title="Naar je downloads-map opslaan"
                  >
                    Downloaden
                  </button>
                </>
              )}
            </div>
            <div className="team-cv-replace-row">
              <span className="team-cv-replace-hint">CV bijgewerkt? Vervang de PDF:</span>
              <button
                type="button"
                className="team-cv-replace"
                onClick={() => triggerFilePick('reparse')}
                title="Nieuwe PDF uploaden en velden opnieuw uit het CV laten halen"
              >
                Vervangen + velden opnieuw extracten
              </button>
              <button
                type="button"
                className="team-cv-replace"
                onClick={() => triggerFilePick('pdf-only')}
                title="Alleen de PDF vervangen, mijn velden ongemoeid laten"
              >
                Alleen PDF vervangen
              </button>
            </div>
          </>
        ) : (
          <div className="team-cv-empty">
            {pendingPdf ? (
              <>
                <span>📄 {pendingPdf.name} <em>(wordt geüpload bij opslaan)</em></span>
                <button type="button" className="team-cv-replace" onClick={() => triggerFilePick('reparse')}>Andere kiezen</button>
              </>
            ) : (
              <>
                <span>Nog geen CV gekoppeld.</span>
                <button type="button" className="team-cv-replace" onClick={() => triggerFilePick('reparse')}>＋ PDF kiezen + inlezen</button>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={onFilePicked}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

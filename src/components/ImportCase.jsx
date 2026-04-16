import React, { useRef, useState } from 'react';
import { parseTemplate, generateDefaultTalkingPoints, generateDefaultFollowUps } from '../utils/parseTemplate';

export default function ImportCase({ onImport }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      setStatus('Alleen .docx bestanden worden ondersteund.');
      setError(true);
      return;
    }

    setStatus('Template wordt gelezen...');
    setError(false);

    try {
      const { caseData, rawText } = await parseTemplate(file);
      
      // Generate defaults for talking points and follow-ups
      if (caseData.talkingPoints.length === 0) {
        caseData.talkingPoints = generateDefaultTalkingPoints(caseData);
      }
      if (caseData.followUps.length === 0) {
        caseData.followUps = generateDefaultFollowUps(caseData);
      }

      setPreview(caseData);
      setStatus('Template geparsed — controleer de preview hieronder.');
      setError(false);
    } catch (err) {
      console.error('Parse error:', err);
      setStatus(`Fout bij het lezen: ${err.message}`);
      setError(true);
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirm = () => {
    if (preview) {
      onImport(preview);
      setPreview(null);
      setStatus(`✓ ${preview.name} is toegevoegd aan de navigator!`);
      setError(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setStatus(null);
  };

  return (
    <div className="import-panel">
      <h2>📥 Case Importeren</h2>
      
      <div className="import-actions">
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          📄 Upload ingevuld template
          <input
            ref={fileRef}
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
        
        <a
          className="btn btn-secondary"
          href="./case-template.docx"
          download="case-template.docx"
        >
          ⬇ Download leeg template
        </a>
      </div>

      {status && (
        <div className={`import-status ${error ? 'error' : ''}`}>{status}</div>
      )}

      {preview && (
        <div className="import-preview">
          <h3>Preview: {preview.name}</h3>

          <div className="preview-field">
            <div className="label">Bedrijfsnaam</div>
            <div className={`value ${!preview.name ? 'empty' : ''}`}>
              {preview.name || 'Niet ingevuld'}
            </div>
          </div>

          <div className="preview-field">
            <div className="label">Omschrijving</div>
            <div className={`value ${!preview.subtitle ? 'empty' : ''}`}>
              {preview.subtitle || 'Niet ingevuld'}
            </div>
          </div>

          <div className="preview-field">
            <div className="label">Situatie</div>
            <div className={`value ${!preview.situatie ? 'empty' : ''}`}>
              {preview.situatie || 'Niet ingevuld'}
            </div>
          </div>

          <div className="preview-field">
            <div className="label">Resultaat</div>
            <div className={`value ${!preview.resultaat ? 'empty' : ''}`}>
              {preview.resultaat || 'Niet ingevuld'}
            </div>
          </div>

          <div className="preview-field">
            <div className="label">Doelen</div>
            <div className="preview-mapping">
              {preview.mapping.doelen.length > 0
                ? preview.mapping.doelen.map(d => <span key={d} className="tag doel">{d}</span>)
                : <span className="value empty">Geen doelen geselecteerd</span>
              }
            </div>
          </div>

          <div className="preview-field">
            <div className="label">Behoeften</div>
            <div className="preview-mapping">
              {preview.mapping.behoeften.length > 0
                ? preview.mapping.behoeften.map(b => <span key={b} className="tag behoefte">{b}</span>)
                : <span className="value empty">Geen behoeften geselecteerd</span>
              }
            </div>
          </div>

          <div className="preview-field">
            <div className="label">Diensten</div>
            <div className="preview-mapping">
              {preview.mapping.diensten.length > 0
                ? preview.mapping.diensten.map(d => <span key={d} className="tag dienst">{d}</span>)
                : <span className="value empty">Geen diensten geselecteerd</span>
              }
            </div>
          </div>

          <div className="confirm-actions">
            <button className="btn btn-primary" onClick={handleConfirm}>
              ✓ Toevoegen aan Navigator
            </button>
            <button className="btn btn-danger" onClick={handleCancel}>
              ✕ Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

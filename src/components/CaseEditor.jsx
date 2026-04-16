import React, { useState } from 'react';
import { FILTERS } from '../data/filters';
import RichTextEditor from './RichTextEditor';
import { exportCaseToDocx } from '../utils/exportCase';

const TAG_CLASS = { doelen: 'doel', behoeften: 'behoefte', diensten: 'dienst' };
const CATEGORY_LABELS = { doelen: 'Doelen', behoeften: 'Behoeften', diensten: 'Diensten' };

const RICH_FIELDS = [
  { key: 'situatie', label: 'Situatie' },
  { key: 'doel', label: 'Doel' },
  { key: 'oplossing', label: 'Oplossing' },
  { key: 'resultaat', label: 'Resultaat' },
  { key: 'businessImpact', label: 'Business Impact' },
];

export default function CaseEditor({ caseData, onSave, onCancel }) {
  const [form, setForm] = useState({
    subtitle: caseData.subtitle || '',
    situatie: caseData.situatie || '',
    doel: caseData.doel || '',
    oplossing: caseData.oplossing || '',
    resultaat: caseData.resultaat || '',
    businessImpact: caseData.businessImpact || '',
    keywords: [...(caseData.keywords || [])],
    mapping: {
      doelen: [...caseData.mapping.doelen],
      behoeften: [...caseData.mapping.behoeften],
      diensten: [...caseData.mapping.diensten],
    },
    matchReasons: {
      doelen: { ...(caseData.matchReasons?.doelen || {}) },
      behoeften: { ...(caseData.matchReasons?.behoeften || {}) },
      diensten: { ...(caseData.matchReasons?.diensten || {}) },
    },
  });

  // --- Field helpers ---
  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // --- Tags ---
  const toggleTag = (category, tag) => {
    setForm(prev => {
      const current = prev.mapping[category];
      const updated = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      return { ...prev, mapping: { ...prev.mapping, [category]: updated } };
    });
  };

  // --- Match reasons ---
  const updateMatchReason = (category, tag, value) => {
    setForm(prev => ({
      ...prev,
      matchReasons: {
        ...prev.matchReasons,
        [category]: { ...prev.matchReasons[category], [tag]: value },
      },
    }));
  };

  // --- Keywords ---
  const addKeyword = (value) => {
    const kw = value.trim();
    if (!kw) return;
    setForm(prev => ({
      ...prev,
      keywords: prev.keywords.includes(kw) ? prev.keywords : [...prev.keywords, kw],
    }));
  };
  const removeKeyword = (kw) =>
    setForm(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));

  // --- Save ---
  const handleSave = () => {
    const cleaned = { ...form };
    cleaned.keywords = cleaned.keywords.filter(kw => kw.trim());
    // Clean matchReasons
    for (const category of ['doelen', 'behoeften', 'diensten']) {
      const mapped = cleaned.mapping[category];
      const reasons = { ...cleaned.matchReasons[category] };
      for (const key of Object.keys(reasons)) {
        if (!mapped.includes(key) || !reasons[key]?.trim()) delete reasons[key];
      }
      cleaned.matchReasons[category] = reasons;
    }
    onSave({ ...caseData, ...cleaned });
  };

  return (
    <div className="ce-panel">
      {/* Top bar */}
      <div className="ce-topbar">
        <button className="btn btn-secondary" onClick={onCancel}>← Terug naar overzicht</button>
        <button className="btn btn-primary" onClick={handleSave}>✓ Opslaan</button>
      </div>

      {/* Case identity */}
      <div className="ce-identity">
        <div
          className="case-logo"
          style={{ background: `linear-gradient(135deg, ${caseData.logoColor}, ${caseData.logoColor}cc)` }}
        >
          {caseData.logoText}
        </div>
        <h2>{caseData.name}</h2>
      </div>

      {/* Detail fields */}
      <div className="ce-section">
        <h3>Case informatie</h3>

        {/* Subtitle stays a plain input */}
        <div className="ce-field">
          <label className="ce-label">Omschrijving</label>
          <textarea
            value={form.subtitle}
            onChange={(e) => updateField('subtitle', e.target.value)}
            rows={1}
            placeholder="Omschrijving..."
          />
        </div>

        {/* Rich text fields */}
        {RICH_FIELDS.map(({ key, label }) => (
          <div key={key} className="ce-field">
            <label className="ce-label">{label}</label>
            <RichTextEditor
              value={form[key]}
              onChange={(html) => updateField(key, html)}
              placeholder={`${label}...`}
            />
          </div>
        ))}

        {/* Keywords */}
        <div className="ce-field">
          <label className="ce-label">Keywords</label>
          <div className="detail-keywords">
            {form.keywords.map(kw => (
              <span key={kw} className="keyword-tag editable" onClick={() => removeKeyword(kw)} title="Klik om te verwijderen">
                {kw} ✕
              </span>
            ))}
          </div>
          <input
            className="keyword-input"
            type="text"
            placeholder="Nieuw keyword + Enter"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addKeyword(e.target.value);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>

      {/* Mapping */}
      <div className="ce-section">
        <h3>Mapping</h3>
        {['doelen', 'behoeften', 'diensten'].map(category => (
          <div key={category} className="ce-field">
            <label className="ce-label">{CATEGORY_LABELS[category]}</label>
            <div className="tag-options">
              {FILTERS[category].map(tag => (
                <button
                  key={tag}
                  className={`tag ${TAG_CLASS[category]} ${form.mapping[category].includes(tag) ? '' : 'inactive'}`}
                  onClick={() => toggleTag(category, tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Match reasons */}
      <div className="ce-section">
        <h3>Match redenen</h3>
        <p className="ce-hint">Leg per gekoppelde tag uit waarom deze case relevant is.</p>
        {['doelen', 'behoeften', 'diensten'].map(category =>
          form.mapping[category].map(tag => (
            <div key={`${category}-${tag}`} className="ce-field">
              <label className="ce-label">{TAG_CLASS[category]} — {tag}</label>
              <textarea
                value={form.matchReasons[category]?.[tag] ?? ''}
                onChange={(e) => updateMatchReason(category, tag, e.target.value)}
                placeholder={`Waarom past deze case bij "${tag}"?`}
                rows={2}
              />
            </div>
          ))
        )}
        {form.mapping.doelen.length + form.mapping.behoeften.length + form.mapping.diensten.length === 0 && (
          <p className="ce-hint">Selecteer eerst tags in de mapping hierboven.</p>
        )}
      </div>

      {/* Bottom save */}
      <div className="ce-bottom-actions">
        <button className="btn btn-primary" onClick={handleSave}>✓ Opslaan</button>
        <button className="btn btn-secondary" onClick={() => exportCaseToDocx({ ...caseData, ...form })}>📄 Exporteer .docx</button>
        <button className="btn btn-danger" onClick={onCancel}>✕ Annuleren</button>
      </div>
    </div>
  );
}

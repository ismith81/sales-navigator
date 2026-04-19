import React, { useState } from 'react';
import { FILTERS as DEFAULT_FILTERS } from '../data/filters';
import RichTextEditor from './RichTextEditor';
import { exportCaseToDocx } from '../utils/exportCase';
import { PersonaIcon } from '../lib/personaIcons.jsx';

const TAG_CLASS = { doelen: 'doel', behoeften: 'behoefte', diensten: 'dienst' };
const CATEGORY_LABELS = { doelen: 'Doelen', behoeften: 'Behoeften', diensten: 'Diensten' };

const RICH_FIELDS = [
  { key: 'situatie', label: 'Situatie' },
  { key: 'doel', label: 'Doel' },
  { key: 'oplossing', label: 'Oplossing' },
  { key: 'resultaat', label: 'Resultaat' },
  { key: 'businessImpact', label: 'Business Impact' },
];

export default function CaseEditor({ caseData, filters: dynamicFilters, personas = {}, branches = [], onSave, onCancel }) {
  const FILTERS = dynamicFilters || DEFAULT_FILTERS;
  const personaList = Object.values(personas).sort((a, b) => (a.order || 99) - (b.order || 99));
  const [form, setForm] = useState({
    name: caseData.name || '',
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
      personas: [...(caseData.mapping.personas || [])],
      branches: [...(caseData.mapping.branches || [])],
    },
    matchReasons: {
      doelen: { ...(caseData.matchReasons?.doelen || {}) },
      behoeften: { ...(caseData.matchReasons?.behoeften || {}) },
      diensten: { ...(caseData.matchReasons?.diensten || {}) },
      personas: { ...(caseData.matchReasons?.personas || {}) },
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
    // Clean matchReasons — ook voor personas (zelfde shape als overige mappings)
    for (const category of ['doelen', 'behoeften', 'diensten', 'personas']) {
      const mapped = cleaned.mapping[category] || [];
      const reasons = { ...(cleaned.matchReasons[category] || {}) };
      for (const key of Object.keys(reasons)) {
        if (!mapped.includes(key) || !reasons[key]?.trim()) delete reasons[key];
      }
      cleaned.matchReasons[category] = reasons;
    }
    const nextName = (cleaned.name || '').trim() || caseData.name || 'Nieuwe case';
    const initials = nextName.split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '??';
    onSave({ ...caseData, ...cleaned, name: nextName, logoText: caseData.logoText || initials });
  };

  return (
    <div className="ce-panel">
      {/* Top bar — sticky zodat Terug + Opslaan altijd in beeld blijven */}
      <div className="ce-topbar">
        <button
          type="button"
          className="btn btn-secondary ce-topbar-btn ce-topbar-back"
          onClick={onCancel}
          aria-label="Terug naar overzicht"
        >
          <span aria-hidden="true">←</span>
          <span className="ce-topbar-btn-label">Terug</span>
        </button>
        <div className="ce-topbar-title-wrap">
          <div className="ce-topbar-eyebrow">Bewerken</div>
          <div className="ce-topbar-title" title={form.name || caseData.name}>
            {form.name || caseData.name || 'Nieuwe case'}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary ce-topbar-btn ce-topbar-save"
          onClick={handleSave}
          aria-label="Opslaan"
        >
          <span aria-hidden="true">✓</span>
          <span className="ce-topbar-btn-label">Opslaan</span>
        </button>
      </div>

      {/* Case identity */}
      <div className="ce-identity">
        <div
          className="case-logo"
          style={{ background: `linear-gradient(135deg, ${caseData.logoColor}, ${caseData.logoColor}cc)` }}
        >
          {caseData.logoText}
        </div>
        <input
          className="ce-name-input"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Case naam..."
        />
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

        {/* Branches — in welke sector speelt deze case */}
        <div className="ce-field">
          <label className="ce-label">Branche</label>
          {branches.length === 0 ? (
            <p className="ce-hint">Nog geen branches geconfigureerd.</p>
          ) : (
            <div className="tag-options">
              {branches.map(b => (
                <button
                  key={b}
                  type="button"
                  className={`tag branche ${form.mapping.branches.includes(b) ? '' : 'inactive'}`}
                  onClick={() => toggleTag('branches', b)}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Personas — "voor wie" is deze case relevant */}
        <div className="ce-field">
          <label className="ce-label">Persona's</label>
          {personaList.length === 0 ? (
            <p className="ce-hint">Nog geen persona's geconfigureerd. Voeg er eerst toe via Beheer → Persona's.</p>
          ) : (
            <div className="ce-persona-options">
              {personaList.map(p => {
                const active = form.mapping.personas.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`ce-persona-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleTag('personas', p.id)}
                    title={p.label}
                  >
                    <span className="ce-persona-chip-icon" aria-hidden="true">
                      <PersonaIcon name={p.icon} size={16} />
                    </span>
                    <span className="ce-persona-chip-label">{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
        {/* Match-reasons per gekoppelde persona */}
        {form.mapping.personas.map(pid => {
          const p = personas[pid];
          if (!p) return null;
          return (
            <div key={`persona-${pid}`} className="ce-field">
              <label className="ce-label">
                <span aria-hidden="true" style={{ marginRight: '0.35rem', display: 'inline-flex', verticalAlign: 'middle' }}>
                  <PersonaIcon name={p.icon} size={14} />
                </span>
                persona — {p.label}
              </label>
              <textarea
                value={form.matchReasons.personas?.[pid] ?? ''}
                onChange={(e) => updateMatchReason('personas', pid, e.target.value)}
                placeholder={`Waarom resoneert deze case bij een ${p.label}?`}
                rows={2}
              />
            </div>
          );
        })}
        {form.mapping.doelen.length + form.mapping.behoeften.length + form.mapping.diensten.length + form.mapping.personas.length === 0 && (
          <p className="ce-hint">Selecteer eerst tags of persona's in de mapping hierboven.</p>
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

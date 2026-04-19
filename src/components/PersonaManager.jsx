import React, { useState, useRef, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';
import { PersonaIcon, PERSONA_ICONS, PERSONA_ICON_KEYS } from '../lib/personaIcons.jsx';

/**
 * Compacte popover-picker voor persona-iconen. Trigger toont het actieve
 * icoon + label; klik opent een drijvend grid. Sluit bij outside-click,
 * Escape, of na selectie.
 */
function IconPickerPopover({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const currentEntry = value && PERSONA_ICONS[value];
  const currentLabel = currentEntry?.label || 'Kies icoon';

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="pm-icon-popover-wrap" ref={wrapRef}>
      <button
        type="button"
        className="pm-icon-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="pm-icon-trigger-icon">
          <PersonaIcon name={value} size={18} />
        </span>
        <span className="pm-icon-trigger-label">{currentLabel}</span>
        <span className="pm-icon-trigger-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="pm-icon-popover" role="dialog" aria-label="Kies een icoon">
          <div className="pm-icon-picker">
            {PERSONA_ICON_KEYS.map(key => {
              const { label: iconLabel } = PERSONA_ICONS[key];
              const active = value === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`pm-icon-pick ${active ? 'active' : ''}`}
                  onClick={() => { onChange(key); setOpen(false); }}
                  title={iconLabel}
                  aria-label={iconLabel}
                  aria-pressed={active}
                >
                  <PersonaIcon name={key} size={18} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').trim();
}

const DOMAINS = [
  { value: 'business', label: 'Business' },
  { value: 'tech', label: 'Tech' },
];
const NIVEAUS = [
  { value: 'strategisch', label: 'Strategisch' },
  { value: 'operationeel', label: 'Operationeel' },
];

export default function PersonaManager({ personas = {}, onUpdate, onAdd, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const list = Object.values(personas).sort((a, b) => (a.order || 99) - (b.order || 99));

  const toggle = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
    setRenamingId(null);
  };

  const startRename = (p) => {
    setRenamingId(p.id);
    setRenameValue(p.label);
  };
  const saveRename = (id) => {
    const next = renameValue.trim();
    if (next) onUpdate(id, { label: next });
    setRenamingId(null);
  };

  return (
    <div className="pm-container">
      <div className="fm-section-header">
        <h3>Overzicht</h3>
        <button className="btn-add-small" onClick={onAdd}>+ Toevoegen</button>
      </div>

      <div className="fm-table">
        {list.map(p => {
          const expanded = expandedId === p.id;
          const isRenaming = renamingId === p.id;
          const descText = stripHtml(p.description);
          const signalsText = stripHtml(p.signals);
          const hasCoaching = !!(p.coaching || '').trim();
          const isComplete = !!descText && !!signalsText && hasCoaching;

          return (
            <div key={p.id} className={`fm-row-wrap ${expanded ? 'expanded' : ''}`}>
              <div
                className="fm-row pm-row"
                onClick={() => toggle(p.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p.id); } }}
              >
                <div className="pm-row-icon" aria-hidden="true">
                  <PersonaIcon name={p.icon} size={20} />
                </div>
                <div className="fm-row-main">
                  <div className="pm-row-title">{p.label}</div>
                  <div className="pm-row-axes">
                    {DOMAINS.find(d => d.value === p.domain)?.label || '—'}
                    {' · '}
                    {NIVEAUS.find(n => n.value === p.niveau)?.label || '—'}
                  </div>
                </div>
                <div className="pm-row-preview">
                  {p.roles || (descText ? (descText.length > 90 ? descText.slice(0, 90) + '…' : descText) : <em style={{ color: 'var(--muted, #6B7A8F)' }}>Nog niets ingevuld</em>)}
                </div>
                <div className="fm-row-meta">
                  <span className={`cm-badge ${isComplete ? 'complete' : 'incomplete'}`}>
                    {isComplete ? 'Compleet' : 'Incompleet'}
                  </span>
                  <span className="fm-chevron">{expanded ? '▾' : '▸'}</span>
                </div>
              </div>

              {expanded && (
                <div className="fm-expand-panel" onClick={(e) => e.stopPropagation()}>
                  {/* Titel + hernoemen */}
                  <div className="fm-panel-title-row">
                    {isRenaming ? (
                      <div className="fm-rename-row">
                        <input
                          className="fm-input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(p.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          autoFocus
                        />
                        <button className="btn btn-teal" onClick={() => saveRename(p.id)}>Opslaan</button>
                        <button className="btn btn-secondary" onClick={() => setRenamingId(null)}>Annuleren</button>
                      </div>
                    ) : (
                      <>
                        <span className="tag-large pm-tag-large">
                          <PersonaIcon name={p.icon} size={16} />
                          {p.label}
                        </span>
                        <button
                          className="fm-inline-rename"
                          onClick={() => startRename(p)}
                          title="Hernoemen"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                            <path d="M10 4l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                          </svg>
                          <span>Hernoemen</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Icon + axes */}
                  <div className="pm-meta-grid">
                    <div className="fm-field pm-field-icon">
                      <div className="fm-field-header">
                        <span className="fm-field-label">Icoon</span>
                      </div>
                      <div className="fm-field-body">
                        <IconPickerPopover
                          value={p.icon}
                          onChange={(key) => onUpdate(p.id, { icon: key })}
                        />
                      </div>
                    </div>
                    <div className="fm-field">
                      <div className="fm-field-header">
                        <span className="fm-field-label">Domein</span>
                        <span className="fm-field-hint">Horizontale as</span>
                      </div>
                      <div className="fm-field-body">
                        <div className="pm-chip-group">
                          {DOMAINS.map(d => (
                            <button
                              key={d.value}
                              type="button"
                              className={`pm-axis-chip ${p.domain === d.value ? 'active' : ''}`}
                              onClick={() => onUpdate(p.id, { domain: d.value })}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="fm-field">
                      <div className="fm-field-header">
                        <span className="fm-field-label">Niveau</span>
                        <span className="fm-field-hint">Verticale as</span>
                      </div>
                      <div className="fm-field-body">
                        <div className="pm-chip-group">
                          {NIVEAUS.map(n => (
                            <button
                              key={n.value}
                              type="button"
                              className={`pm-axis-chip ${p.niveau === n.value ? 'active' : ''}`}
                              onClick={() => onUpdate(p.id, { niveau: n.value })}
                            >
                              {n.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Roles */}
                  <div className="fm-field">
                    <div className="fm-field-header">
                      <span className="fm-field-label">Voorbeeld-rollen</span>
                      <span className="fm-field-hint">Komma-gescheiden, toont als geheugensteun in het kompas</span>
                    </div>
                    <div className="fm-field-body">
                      <input
                        className="fm-input"
                        value={p.roles || ''}
                        onChange={(e) => onUpdate(p.id, { roles: e.target.value })}
                        placeholder="bv. CFO, Algemeen Directeur, CCO"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="fm-field">
                    <div className="fm-field-header">
                      <span className="fm-field-label">Omschrijving</span>
                      <span className="fm-field-hint">Korte duiding: waaraan herken je dit type?</span>
                    </div>
                    <div className="fm-field-body">
                      <RichTextEditor
                        value={p.description || ''}
                        onChange={(html) => onUpdate(p.id, { description: html })}
                        placeholder={`Omschrijving van ${p.label}...`}
                      />
                    </div>
                  </div>

                  {/* Signals */}
                  <div className="fm-field">
                    <div className="fm-field-header">
                      <span className="fm-field-label">Klantsignalen</span>
                      <span className="fm-field-hint">Citaten die typisch bij deze persona horen — helpen bij herkenning tijdens koud bellen</span>
                    </div>
                    <div className="fm-field-body">
                      <RichTextEditor
                        value={p.signals || ''}
                        onChange={(html) => onUpdate(p.id, { signals: html })}
                        placeholder={`Signalen die bij ${p.label} passen...`}
                      />
                    </div>
                  </div>

                  {/* Coaching */}
                  <div className="fm-field">
                    <div className="fm-field-header">
                      <span className="fm-field-label">Coaching</span>
                      <span className="fm-field-hint">Stijl-instructie die in het kompas verschijnt zodra deze persona is geselecteerd</span>
                    </div>
                    <div className="fm-field-body">
                      <textarea
                        className="fm-input pm-coaching-textarea"
                        value={p.coaching || ''}
                        onChange={(e) => onUpdate(p.id, { coaching: e.target.value })}
                        placeholder="bv. Denk in ROI, vermijd techjargon, praat over outcomes..."
                        rows={4}
                      />
                    </div>
                  </div>

                  <div className="fm-panel-footer">
                    <button
                      className="fm-delete-btn"
                      onClick={() => setConfirmDeleteId(p.id)}
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="fm-empty">Nog geen persona's. Voeg er een toe.</div>
        )}
      </div>

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Persona verwijderen</h3>
            <p>
              Weet je zeker dat je <strong>"{personas[confirmDeleteId]?.label}"</strong> wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); setExpandedId(null); }}
              >
                Verwijderen
              </button>
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteId(null)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

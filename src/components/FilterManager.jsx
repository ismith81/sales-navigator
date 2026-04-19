import React, { useState } from 'react';
import { TAB_CONFIG } from '../data/filters';
import RichTextEditor from './RichTextEditor';

const TAG_CLASS = { doelen: 'doel', behoeften: 'behoefte', diensten: 'dienst' };

// Inline list-editor voor string-arrays (talking points + follow-ups).
// Klik een item om te bewerken, Enter om op te slaan, Esc om af te breken.
function FmListEditor({ items = [], onChange, placeholder = 'Nieuw item toevoegen...' }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const save = (idx, value) => {
    const v = (value || '').trim();
    if (!v) {
      // Leeg opslaan = verwijderen
      onChange(items.filter((_, i) => i !== idx));
    } else {
      const next = [...items];
      next[idx] = v;
      onChange(next);
    }
    setEditingIdx(null);
  };

  const add = (value) => {
    const v = (value || '').trim();
    if (!v) { setAdding(false); setDraft(''); return; }
    onChange([...items, v]);
    setAdding(false);
    setDraft('');
  };

  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="fm-list-editor">
      {items.map((item, i) => (
        <div key={i} className="fm-list-item">
          {editingIdx === i ? (
            <textarea
              className="fm-list-input"
              defaultValue={item}
              autoFocus
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(i, e.target.value); }
                if (e.key === 'Escape') setEditingIdx(null);
              }}
              onBlur={(e) => save(i, e.target.value)}
            />
          ) : (
            <>
              <span className="fm-list-text" onClick={() => setEditingIdx(i)}>{item}</span>
              <button type="button" className="fm-list-remove" onClick={() => remove(i)} title="Verwijderen">✕</button>
            </>
          )}
        </div>
      ))}
      {adding ? (
        <textarea
          className="fm-list-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          rows={2}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(draft); }
            if (e.key === 'Escape') { setAdding(false); setDraft(''); }
          }}
          onBlur={() => add(draft)}
        />
      ) : (
        <button type="button" className="btn-add-small" onClick={() => setAdding(true)}>
          + Toevoegen
        </button>
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

export default function FilterManager({ filters, cases, topics = {}, onAdd, onRename, onDelete, onUpdateTopicMeta }) {
  const [expandedItem, setExpandedItem] = useState(null); // { category, name }
  const [renaming, setRenaming] = useState(null); // { category, name }
  const [renameValue, setRenameValue] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [addValue, setAddValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const getReferencingCases = (category, name) =>
    cases.filter(c => c.mapping[category]?.includes(name));

  const isExpanded = (category, name) =>
    expandedItem?.category === category && expandedItem?.name === name;

  const toggleExpand = (category, name) => {
    if (isExpanded(category, name)) {
      setExpandedItem(null);
      setRenaming(null);
    } else {
      setExpandedItem({ category, name });
      setRenaming(null);
    }
  };

  const startRename = (category, name) => {
    setRenaming({ category, name });
    setRenameValue(name);
  };
  const saveRename = () => {
    if (!renaming) return;
    const newName = renameValue.trim();
    if (!newName || newName === renaming.name) { setRenaming(null); return; }
    if (filters[renaming.category].includes(newName)) {
      alert(`"${newName}" bestaat al in deze categorie.`);
      return;
    }
    onRename(renaming.category, renaming.name, newName);
    setExpandedItem({ category: renaming.category, name: newName });
    setRenaming(null);
  };

  const handleAdd = (category) => {
    const name = addValue.trim();
    if (!name) return;
    if (filters[category].includes(name)) {
      alert(`"${name}" bestaat al in deze categorie.`);
      return;
    }
    onAdd(category, name);
    setAddValue('');
    setAddingTo(null);
  };

  const handleDeleteClick = (category, name) => {
    const refs = getReferencingCases(category, name);
    if (refs.length > 0) {
      setConfirmDelete({ category, name, blocked: true, refs });
    } else {
      setConfirmDelete({ category, name, blocked: false });
    }
  };
  const handleConfirmDelete = () => {
    if (confirmDelete && !confirmDelete.blocked) {
      onDelete(confirmDelete.category, confirmDelete.name);
      if (expandedItem?.category === confirmDelete.category && expandedItem?.name === confirmDelete.name) {
        setExpandedItem(null);
      }
    }
    setConfirmDelete(null);
  };

  return (
    <div className="fm-container">
      <div className="fm-header">
        <h2>Doelen, Behoeften & Diensten</h2>
        <p>Beheer de categorieën die beschikbaar zijn in de Navigator. Klik een item open om de omschrijving en klantsignalen te bewerken.</p>
      </div>

      {Object.entries(TAB_CONFIG).map(([category, config]) => (
        <div key={category} className="fm-section">
          <div className="fm-section-header">
            <h3>{config.label}</h3>
            <button
              className="btn-add-small"
              onClick={() => { setAddingTo(addingTo === category ? null : category); setAddValue(''); }}
            >
              {addingTo === category ? '✕' : '+ Toevoegen'}
            </button>
          </div>

          <div className="fm-table">
            {(filters[category] || []).map(name => {
              const refs = getReferencingCases(category, name);
              const topic = topics?.[category]?.[name] || {};
              const descText = stripHtml(topic.description);
              const signalsText = stripHtml(topic.signals);
              const hasDesc = !!descText;
              const hasSignals = !!signalsText;
              const isComplete = hasDesc && hasSignals;
              const expanded = isExpanded(category, name);
              const isRenaming = renaming?.category === category && renaming?.name === name;

              return (
                <div key={name} className={`fm-row-wrap ${expanded ? 'expanded' : ''}`}>
                  <div
                    className="fm-row"
                    onClick={() => toggleExpand(category, name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(category, name); } }}
                  >
                    <div className="fm-row-main">
                      <span className={`tag ${TAG_CLASS[category]}`}>{name}</span>
                      {descText && <span className="fm-row-preview">{descText.length > 90 ? descText.slice(0, 90) + '…' : descText}</span>}
                    </div>
                    <div className="fm-row-meta">
                      <span className="fm-row-refs" title={`Gebruikt door ${refs.length} case(s)`}>
                        {refs.length} case{refs.length === 1 ? '' : 's'}
                      </span>
                      <span className={`cm-badge ${isComplete ? 'complete' : 'incomplete'}`}>
                        {isComplete ? 'Compleet' : 'Incompleet'}
                      </span>
                      <span className="fm-chevron">{expanded ? '▾' : '▸'}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div className="fm-expand-panel" onClick={(e) => e.stopPropagation()}>
                      {/* Inline rename: big tag + pencil button */}
                      <div className="fm-panel-title-row">
                        {isRenaming ? (
                          <div className="fm-rename-row">
                            <input
                              className="fm-input"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') setRenaming(null);
                              }}
                              autoFocus
                            />
                            <button className="btn btn-teal" onClick={saveRename}>Opslaan</button>
                            <button className="btn btn-secondary" onClick={() => setRenaming(null)}>Annuleren</button>
                          </div>
                        ) : (
                          <>
                            <span className={`tag ${TAG_CLASS[category]} tag-large`}>{name}</span>
                            <button
                              className="fm-inline-rename"
                              onClick={() => startRename(category, name)}
                              title="Hernoemen"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                                <path d="M10 4l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              </svg>
                              <span>Hernoemen</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Description field */}
                      <div className="fm-field">
                        <div className="fm-field-header">
                          <span className="fm-field-label">Omschrijving</span>
                          <span className="fm-field-hint">— korte uitleg (1-2 zinnen) die je kunt gebruiken om dit concept toe te lichten</span>
                        </div>
                        <div className="fm-field-body">
                          <RichTextEditor
                            value={topic.description || ''}
                            onChange={(html) => onUpdateTopicMeta(category, name, { description: html })}
                            placeholder={`Omschrijving van "${name}"...`}
                          />
                        </div>
                      </div>

                      {/* Signals field */}
                      <div className="fm-field">
                        <div className="fm-field-header">
                          <span className="fm-field-label">Klantsignalen</span>
                          <span className="fm-field-hint">— waaraan herken je dat dit speelt? (bv. "Excel is onhoudbaar", "we willen data-gedreven werken")</span>
                        </div>
                        <div className="fm-field-body">
                          <RichTextEditor
                            value={topic.signals || ''}
                            onChange={(html) => onUpdateTopicMeta(category, name, { signals: html })}
                            placeholder={`Klantsignalen bij "${name}"...`}
                          />
                        </div>
                      </div>

                      {/* Talking points: "Wat zeg je?" */}
                      <div className="fm-field">
                        <div className="fm-field-header">
                          <span className="fm-field-label">Wat zeg je?</span>
                          <span className="fm-field-hint">— talking points die je tijdens een gesprek gebruikt</span>
                        </div>
                        <div className="fm-field-body">
                          <FmListEditor
                            items={topic.talkingPoints || []}
                            onChange={(next) => onUpdateTopicMeta(category, name, { talkingPoints: next })}
                            placeholder="Nieuw talking point toevoegen..."
                          />
                        </div>
                      </div>

                      {/* Follow-ups: "Wat vraag je?" */}
                      <div className="fm-field">
                        <div className="fm-field-header">
                          <span className="fm-field-label">Wat vraag je?</span>
                          <span className="fm-field-hint">— vervolgvragen om door te vragen</span>
                        </div>
                        <div className="fm-field-body">
                          <FmListEditor
                            items={topic.followUps || []}
                            onChange={(next) => onUpdateTopicMeta(category, name, { followUps: next })}
                            placeholder="Nieuwe vraag toevoegen..."
                          />
                        </div>
                      </div>

                      {/* Footer: destructive action */}
                      <div className="fm-panel-footer">
                        <button
                          className={`fm-delete-btn ${refs.length > 0 ? 'disabled' : ''}`}
                          onClick={() => handleDeleteClick(category, name)}
                          disabled={refs.length > 0}
                          title={refs.length > 0 ? `Kan niet verwijderen: ${refs.length} case(s) verwijzen hiernaar` : 'Dit item verwijderen'}
                        >
                          Verwijderen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {(filters[category] || []).length === 0 && (
              <div className="fm-empty">Geen items. Voeg er een toe.</div>
            )}
          </div>

          {addingTo === category && (
            <div className="fm-add-row">
              <input
                className="fm-input"
                placeholder={`Nieuwe ${config.singular} toevoegen...`}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd(category);
                  if (e.key === 'Escape') { setAddingTo(null); setAddValue(''); }
                }}
                autoFocus
              />
              <button className="btn btn-teal" onClick={() => handleAdd(category)}>Toevoegen</button>
            </div>
          )}
        </div>
      ))}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {confirmDelete.blocked ? (
              <>
                <h3>Kan niet verwijderen</h3>
                <p>
                  <strong>"{confirmDelete.name}"</strong> wordt gebruikt door {confirmDelete.refs.length} case{confirmDelete.refs.length !== 1 ? 's' : ''}:
                </p>
                <div className="fm-blocked-list">
                  {confirmDelete.refs.map(c => (
                    <span key={c.id} className="fm-blocked-case">{c.name}</span>
                  ))}
                </div>
                <p style={{ marginTop: '0.75rem' }}>
                  Verwijder eerst de koppeling in deze case(s) voordat je dit item kunt verwijderen.
                </p>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                    Begrepen
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Item verwijderen</h3>
                <p>
                  Weet je zeker dat je <strong>"{confirmDelete.name}"</strong> wilt verwijderen?
                  Bijbehorende talking points en vervolgvragen worden ook verwijderd.
                </p>
                <div className="modal-actions">
                  <button className="btn btn-danger" onClick={handleConfirmDelete}>
                    Verwijderen
                  </button>
                  <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                    Annuleren
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

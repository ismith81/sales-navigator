import React, { useState } from 'react';
import { TAB_CONFIG } from '../data/filters';
import RichTextEditor from './RichTextEditor';

const TAG_CLASS = { doelen: 'doel', behoeften: 'behoefte', diensten: 'dienst' };

export default function FilterManager({ filters, cases, painpoints = {}, onAdd, onRename, onDelete, onUpdatePainpoint }) {
  const [editingItem, setEditingItem] = useState(null); // { category, name }
  const [editValue, setEditValue] = useState('');
  const [addingTo, setAddingTo] = useState(null); // category key
  const [addValue, setAddValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // { category, name }
  const [expandedPain, setExpandedPain] = useState(null); // behoefte name

  // Check if a filter item is referenced by any case
  const getReferencingCases = (category, name) => {
    return cases.filter(c => c.mapping[category]?.includes(name));
  };

  const handleStartEdit = (category, name) => {
    setEditingItem({ category, name });
    setEditValue(name);
    setAddingTo(null);
  };

  const handleSaveEdit = () => {
    if (!editingItem || !editValue.trim()) return;
    const newName = editValue.trim();
    if (newName !== editingItem.name) {
      // Check for duplicates
      if (filters[editingItem.category].includes(newName)) {
        alert(`"${newName}" bestaat al in deze categorie.`);
        return;
      }
      onRename(editingItem.category, editingItem.name, newName);
    }
    setEditingItem(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditValue('');
  };

  const handleAdd = (category) => {
    if (!addValue.trim()) return;
    const name = addValue.trim();
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
      // Can't delete — show message
      setConfirmDelete({ category, name, blocked: true, refs });
    } else {
      setConfirmDelete({ category, name, blocked: false });
    }
  };

  const handleConfirmDelete = () => {
    if (confirmDelete && !confirmDelete.blocked) {
      onDelete(confirmDelete.category, confirmDelete.name);
    }
    setConfirmDelete(null);
  };

  return (
    <div className="fm-container">
      <div className="fm-header">
        <h2>Doelen, Behoeften & Diensten</h2>
        <p>Beheer de categorieën die beschikbaar zijn in de Navigator.</p>
      </div>

      {Object.entries(TAB_CONFIG).map(([category, config]) => (
        <div key={category} className="fm-section">
          <div className="fm-section-header">
            <h3>{config.label}</h3>
            <button
              className="btn-add-small"
              onClick={() => { setAddingTo(addingTo === category ? null : category); setAddValue(''); setEditingItem(null); }}
            >
              {addingTo === category ? '✕' : '+ Toevoegen'}
            </button>
          </div>

          <div className="fm-list">
            {(filters[category] || []).map(name => {
              const isEditing = editingItem?.category === category && editingItem?.name === name;
              const refCount = getReferencingCases(category, name).length;

              return (
                <div key={name} className="fm-item">
                  {isEditing ? (
                    <div className="fm-edit-row">
                      <input
                        className="fm-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <button className="fm-btn save" onClick={handleSaveEdit} title="Opslaan">✓</button>
                      <button className="fm-btn cancel" onClick={handleCancelEdit} title="Annuleren">✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="fm-display-row">
                        <span className={`tag ${TAG_CLASS[category]}`}>{name}</span>
                        {refCount > 0 && (
                          <span className="fm-ref-count" title={`Gebruikt door ${refCount} case(s)`}>
                            {refCount} case{refCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {category === 'behoeften' && painpoints[name] && (
                          <span className="fm-pain-indicator" title="Heeft pijnpunten">💬</span>
                        )}
                        <div className="fm-item-actions">
                          {category === 'behoeften' && (
                            <button
                              className={`fm-btn pain ${expandedPain === name ? 'active' : ''}`}
                              onClick={() => setExpandedPain(expandedPain === name ? null : name)}
                              title="Pijnpunten bewerken"
                            >
                              💬
                            </button>
                          )}
                          <button
                            className="fm-btn edit"
                            onClick={() => handleStartEdit(category, name)}
                            title="Hernoemen"
                          >
                            ✎
                          </button>
                          <button
                            className={`fm-btn delete ${refCount > 0 ? 'disabled' : ''}`}
                            onClick={() => handleDeleteClick(category, name)}
                            title={refCount > 0 ? `Kan niet verwijderen: ${refCount} case(s) verwijzen hiernaar` : 'Verwijderen'}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                      {category === 'behoeften' && expandedPain === name && (
                        <div className="fm-pain-editor">
                          <label className="fm-pain-label">
                            Pijnpunten <span className="fm-pain-hint">— hoe een klant dit kan verwoorden (bv. "Excel is onhoudbaar")</span>
                          </label>
                          <RichTextEditor
                            value={painpoints[name] || ''}
                            onChange={(html) => onUpdatePainpoint(name, html)}
                            placeholder={`Pijnpunten bij "${name}"...`}
                          />
                        </div>
                      )}
                    </>
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
              <button className="fm-btn save" onClick={() => handleAdd(category)}>✓ Toevoegen</button>
            </div>
          )}
        </div>
      ))}

      {/* Delete confirmation / blocked modal */}
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
                    🗑 Verwijderen
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

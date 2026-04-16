import React, { useState } from 'react';
import CaseEditor from './CaseEditor';
import ImportCase from './ImportCase';
import FilterManager from './FilterManager';
import { exportCaseToDocx } from '../utils/exportCase';
import { exportCaseToPptx } from '../utils/exportPptx';

const TAG_CLASS = { doelen: 'doel', behoeften: 'behoefte', diensten: 'dienst' };

export default function CaseManager({ cases, filters, onUpdate, onImport, onRemove, onAddFilter, onRenameFilter, onDeleteFilter, onBackup, onRestore }) {
  const [editingId, setEditingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const editingCase = editingId ? cases.find(c => c.id === editingId) : null;

  const handleSave = (updatedCase) => {
    onUpdate(updatedCase);
    setEditingId(null);
  };

  const handleImport = (newCase) => {
    onImport(newCase);
    setShowImport(false);
  };

  // If editing a case, show the editor
  if (editingCase) {
    return (
      <div className="case-manager">
        <CaseEditor
          caseData={editingCase}
          filters={filters}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      </div>
    );
  }

  return (
    <div className="case-manager">
      <div className="cm-header">
        <h2>Beheer</h2>
        <p>Beheer, bewerk en importeer cases.</p>
      </div>

      <div className="cm-actions">
        <button
          className={`btn ${showImport ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => setShowImport(prev => !prev)}
        >
          {showImport ? '✕ Sluiten' : 'Case importeren'}
        </button>
      </div>

      {showImport && <ImportCase onImport={handleImport} />}

      {/* Cases table */}
      <div className="cm-table">
        <div className="cm-table-header">
          <div className="cm-col-name">Case</div>
          <div className="cm-col-tags">Doelen / Behoeften / Diensten</div>
          <div className="cm-col-status">Status</div>
          <div className="cm-col-actions"></div>
        </div>

        {cases.map(c => {
          const totalTags = c.mapping.doelen.length + c.mapping.behoeften.length + c.mapping.diensten.length;
          const hasReasons = Object.values(c.matchReasons || {}).some(cat =>
            Object.values(cat).some(v => v?.trim())
          );
          const isComplete = totalTags > 0 && hasReasons && c.situatie && c.resultaat;

          return (
            <div key={c.id} className="cm-row" onClick={() => setEditingId(c.id)}>
              <div className="cm-col-name">
                <div
                  className="cm-logo"
                  style={{ background: `linear-gradient(135deg, ${c.logoColor}, ${c.logoColor}cc)` }}
                >
                  {c.logoText}
                </div>
                <div>
                  <div className="cm-name">{c.name}</div>
                  <div className="cm-subtitle">{c.subtitle}</div>
                </div>
              </div>
              <div className="cm-col-tags">
                {['doelen', 'behoeften', 'diensten'].map(cat =>
                  c.mapping[cat].map(tag => (
                    <span key={tag} className={`tag ${TAG_CLASS[cat]} small`}>{tag}</span>
                  ))
                )}
                {totalTags === 0 && <span className="cm-empty">Geen tags</span>}
              </div>
              <div className="cm-col-status">
                <span className={`cm-badge ${isComplete ? 'complete' : 'incomplete'}`}>
                  {isComplete ? 'Compleet' : 'Incompleet'}
                </span>
              </div>
              <div className="cm-col-actions">
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); setEditingId(c.id); }}
                  title="Bewerken"
                >
                  ✎
                </button>
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); exportCaseToDocx(c); }}
                  title="Exporteren als .docx"
                >
                  📄
                </button>
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); exportCaseToPptx(c); }}
                  title="Exporteren als PowerPoint"
                >
                  📊
                </button>
                <button
                  className="btn-icon danger"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                  title="Verwijderen"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}

        {cases.length === 0 && (
          <div className="cm-empty-state">
            Nog geen cases. Importeer een case via het template.
          </div>
        )}
      </div>

      {/* Filter Manager */}
      <FilterManager
        filters={filters}
        cases={cases}
        onAdd={onAddFilter}
        onRename={onRenameFilter}
        onDelete={onDeleteFilter}
      />

      {/* Backup / Restore */}
      <div className="cm-backup-bar">
        <button className="btn btn-secondary" onClick={onBackup}>
          Backup downloaden
        </button>
        <button className="btn btn-secondary" onClick={onRestore}>
          Backup herstellen
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Case verwijderen</h3>
            <p>Weet je zeker dat je <strong>{cases.find(c => c.id === confirmDeleteId)?.name}</strong> wilt verwijderen? Dit kan niet ongedaan worden.</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={() => { onRemove(confirmDeleteId); setConfirmDeleteId(null); }}>
                🗑 Verwijderen
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

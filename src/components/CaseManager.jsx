import React, { useState, useEffect } from 'react';
import CaseEditor from './CaseEditor';
import ImportCase from './ImportCase';
import FilterManager from './FilterManager';
import PersonaManager from './PersonaManager';
import { exportCaseToDocx } from '../utils/exportCase';
import { PersonaIcon } from '../lib/personaIcons.jsx';

const TAG_CLASS = { doelen: 'doel', behoeften: 'behoefte', diensten: 'dienst' };

export default function CaseManager({ section = 'cases', cases, filters, topics, personas, branches = [], onUpdate, onImport, onRemove, onAddFilter, onRenameFilter, onDeleteFilter, onUpdateTopicMeta, onUpdatePersona, onAddPersona, onDeletePersona, onBackup, onRestore }) {
  const [editingId, setEditingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Verlaat de case-editor zodra de gebruiker naar een andere beheer-sectie gaat
  // (Onderwerpen / Persona's). Anders zien ze nog steeds de editor ondanks dat de
  // subnav een andere sectie aangeeft.
  useEffect(() => {
    if (section !== 'cases') setEditingId(null);
  }, [section]);

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
          personas={personas}
          branches={branches}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      </div>
    );
  }

  // De subnav in de topbar toont al de sectie-titel — geen extra intro-regel
  // of H2 meer nodig.
  return (
    <div className="case-manager">
      {section === 'cases' && (
        <>
      <div className="cm-actions">
        <button
          className="btn-add-small"
          onClick={() => {
            const id = `nieuwe-case-${Date.now()}`;
            onImport({
              id,
              name: 'Nieuwe case',
              subtitle: '',
              logoText: 'NC',
              logoColor: '#1a6baa',
              situatie: '', doel: '', oplossing: '', resultaat: '',
              keywords: [],
              businessImpact: '',
              mapping: { doelen: [], behoeften: [], diensten: [], personas: [], branches: [] },
              talkingPoints: [], followUps: [],
              matchReasons: { doelen: {}, behoeften: {}, diensten: {} },
            });
            setEditingId(id);
          }}
        >
          + Nieuwe case
        </button>
        <button
          className="btn-add-small"
          onClick={() => setShowImport(prev => !prev)}
        >
          {showImport ? '✕ Sluiten' : '+ Case importeren'}
        </button>
      </div>

      {showImport && <ImportCase onImport={handleImport} />}

      {/* Cases table */}
      <div className="cm-table">
        <div className="cm-table-header">
          <div className="cm-col-name">Case</div>
          <div className="cm-col-tags">
            <span className="cm-legend">
              <span className="cm-legend-dot doel"></span>Doelen
            </span>
            <span className="cm-legend">
              <span className="cm-legend-dot behoefte"></span>Behoeften
            </span>
            <span className="cm-legend">
              <span className="cm-legend-dot dienst"></span>Diensten
            </span>
          </div>
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
                  {(c.mapping.personas || []).length > 0 && (
                    <div className="cm-persona-strip" title="Gekoppelde persona's">
                      {(c.mapping.personas || []).map(pid => {
                        const p = personas?.[pid];
                        if (!p) return null;
                        return (
                          <span key={pid} className="cm-persona-badge" title={p.label}>
                            <PersonaIcon name={p.icon} size={14} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="cm-col-tags">
                {(c.mapping.branches || []).map(b => (
                  <span key={`b-${b}`} className="tag branche small">{b}</span>
                ))}
                {['doelen', 'behoeften', 'diensten'].map(cat =>
                  c.mapping[cat].map(tag => (
                    <span key={tag} className={`tag ${TAG_CLASS[cat]} small`}>{tag}</span>
                  ))
                )}
                {totalTags === 0 && (c.mapping.branches || []).length === 0 && <span className="cm-empty">Geen tags</span>}
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
        </>
      )}

      {section === 'onderwerpen' && (
        <FilterManager
          filters={filters}
          cases={cases}
          topics={topics}
          onAdd={onAddFilter}
          onRename={onRenameFilter}
          onDelete={onDeleteFilter}
          onUpdateTopicMeta={onUpdateTopicMeta}
        />
      )}

      {section === 'personas' && (
        <PersonaManager
          personas={personas}
          onUpdate={onUpdatePersona}
          onAdd={onAddPersona}
          onDelete={onDeletePersona}
        />
      )}

      {/* Backup / Restore — altijd zichtbaar (beheer-niveau actie). */}
      <div className="cm-backup-bar">
        <button className="btn-add-small" onClick={onBackup}>
          ⬇ Backup downloaden
        </button>
        <button className="btn-add-small" onClick={onRestore}>
          ⬆ Backup herstellen
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

import React, { useEffect, useRef, useState } from 'react';
import { groupSessionsByDate } from '../lib/chatHistory';

// ChatSidebar — Claude.ai-stijl history-sidebar voor Nova.
//
// Drie weergaven, gestuurd via props/CSS-klassen:
//   - expanded  (default desktop, ~260px breed met volledige lijst)
//   - collapsed (smal rail van ~50px, alleen toggle + nieuw-icoon)
//   - mobile    (overlay-drawer, geactiveerd via mobileOpen-prop)
//
// State (collapsed of niet) wordt door de parent (ChatPanel) bewaard in
// localStorage. Mobile-open is ook parent-state zodat de chat-header
// hamburger 'm kan toggelen.

export default function ChatSidebar({
  sessions = [],
  activeId = null,
  collapsed = false,
  mobileOpen = false,
  onToggleCollapse,
  onMobileClose,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
}) {
  // Per-sessie ⋮-menu state: welke sessie heeft 'm open?
  const [openMenuId, setOpenMenuId] = useState(null);
  // Bevestiging vóór delete: welke sessie staat in confirm-mode?
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  // Inline-rename state in de sidebar: actieve id + draft-titel.
  const [renameId, setRenameId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameRef = useRef(null);

  // Pinned items vormen een eigen bucket bovenaan; de rest gaat door de
  // dag-groepering. Sessies komen al gesorteerd binnen (pinned first dan
  // recency) — we splitsen ze hier alleen visueel uit elkaar.
  const pinnedItems = sessions.filter(s => s.pinned);
  const unpinnedItems = sessions.filter(s => !s.pinned);
  const dateGroups = groupSessionsByDate(unpinnedItems);
  const groups = pinnedItems.length > 0
    ? [{ label: 'Vastgepind', pinned: true, items: pinnedItems }, ...dateGroups]
    : dateGroups;

  // Klik buiten een open ⋮-menu: sluiten (en evt. confirm-state opheffen).
  useEffect(() => {
    if (!openMenuId) return;
    const onDoc = (e) => {
      if (!e.target.closest('.chat-sidebar-item-menu') && !e.target.closest('.chat-sidebar-item-menu-trigger')) {
        setOpenMenuId(null);
        setConfirmingDeleteId(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenuId]);

  // Bij activeren van rename: focus + selectie van de input.
  useEffect(() => {
    if (renameId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renameId]);

  const startRename = (s) => {
    setOpenMenuId(null);
    setRenameId(s.id);
    setRenameDraft(s.title || '');
  };

  const commitRename = async () => {
    const t = renameDraft.trim();
    const id = renameId;
    setRenameId(null);
    if (!id) return;
    const original = sessions.find(s => s.id === id)?.title || '';
    if (!t || t === original) return; // niets te doen
    onRenameSession?.(id, t);
  };

  const cancelRename = () => {
    setRenameId(null);
    setRenameDraft('');
  };

  // Twee-staps delete: eerste klik zet confirm-mode aan in dezelfde dropdown,
  // tweede klik op "Verwijder" voert 't echt uit. Native browser-confirm
  // gebruikten we eerst maar paste niet bij de stijl.
  const beginDelete = (s) => {
    setConfirmingDeleteId(s.id);
  };
  const confirmDelete = (s) => {
    setOpenMenuId(null);
    setConfirmingDeleteId(null);
    onDeleteSession?.(s.id);
  };
  const cancelDelete = () => {
    setConfirmingDeleteId(null);
  };

  return (
    <>
      {/* Backdrop voor mobile-overlay */}
      {mobileOpen && (
        <div className="chat-sidebar-backdrop" onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside
        className={
          'chat-sidebar'
          + (collapsed ? ' chat-sidebar--collapsed' : '')
          + (mobileOpen ? ' chat-sidebar--mobile-open' : '')
        }
        aria-label="Chat-geschiedenis"
      >
        {/* Top-rij: collapse-toggle (desktop) + close-knop (mobile) */}
        <div className="chat-sidebar-top">
          <button
            type="button"
            className="chat-sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Sidebar uitklappen' : 'Sidebar inklappen'}
            title={collapsed ? 'Uitklappen' : 'Inklappen'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="9" y1="4" x2="9" y2="20" />
            </svg>
          </button>
          <button
            type="button"
            className="chat-sidebar-close"
            onClick={onMobileClose}
            aria-label="Sluiten"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Nieuw-gesprek: prominent — full button bij expanded, alleen icoon bij collapsed */}
        <button type="button" className="chat-sidebar-new" onClick={onNewChat} title="Nieuw gesprek">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="chat-sidebar-new-label">Nieuw gesprek</span>
        </button>

        {/* History-secties — verborgen in collapsed-mode (CSS) */}
        <div className="chat-sidebar-scroll">
          {sessions.length === 0 && (
            <div className="chat-sidebar-empty">
              Nog geen eerdere gesprekken
            </div>
          )}
          {groups.map(group => (
            <div key={group.label} className="chat-sidebar-group">
              <div className="chat-sidebar-group-label">{group.label}</div>
              <ul className="chat-sidebar-list">
                {group.items.map(s => (
                  <li
                    key={s.id}
                    className={
                      'chat-sidebar-item'
                      + (s.id === activeId ? ' is-active' : '')
                    }
                  >
                    {renameId === s.id ? (
                      <input
                        ref={renameRef}
                        className="chat-sidebar-rename-input"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                          if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                        }}
                        onBlur={commitRename}
                        maxLength={120}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className="chat-sidebar-item-title"
                          onClick={() => onSelectSession?.(s.id)}
                          title={s.title}
                        >
                          {s.pinned && (
                            <svg className="chat-sidebar-item-pin-indicator" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M16 3l5 5-3 1-2 5-3-3-5 5v3l-3-3 3-3v0L4 8l5-2 1-3z" />
                            </svg>
                          )}
                          <span className="chat-sidebar-item-title-text">{s.title}</span>
                        </button>
                        <button
                          type="button"
                          className="chat-sidebar-item-menu-trigger"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id); }}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === s.id}
                          aria-label="Sessie-menu"
                          title="Acties"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.2" />
                            <circle cx="12" cy="12" r="1.2" />
                            <circle cx="12" cy="19" r="1.2" />
                          </svg>
                        </button>
                        {openMenuId === s.id && (
                          confirmingDeleteId === s.id ? (
                            <div className="chat-sidebar-item-menu chat-sidebar-item-menu--confirm" role="menu">
                              <div className="chat-sidebar-item-confirm-text">
                                Weet je het zeker?
                                <span className="chat-sidebar-item-confirm-sub">"{s.title}" wordt verwijderd.</span>
                              </div>
                              <div className="chat-sidebar-item-confirm-actions">
                                <button type="button" onClick={cancelDelete} className="chat-sidebar-item-confirm-cancel">
                                  Annuleer
                                </button>
                                <button type="button" onClick={() => confirmDelete(s)} className="chat-sidebar-item-confirm-delete">
                                  Verwijder
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="chat-sidebar-item-menu" role="menu">
                              <button type="button" onClick={() => { setOpenMenuId(null); onTogglePin?.(s.id, !s.pinned); }} role="menuitem">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 17v5" />
                                  <path d="M9 17h6" />
                                  <path d="M7 17h10l-1.5-3 1.5-7H7.5L9 7l-2 7z" />
                                </svg>
                                <span>{s.pinned ? 'Vastgepind verwijderen' : 'Vastpinnen'}</span>
                              </button>
                              <button type="button" onClick={() => startRename(s)} role="menuitem">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
                                </svg>
                                <span>Hernoemen</span>
                              </button>
                              <button type="button" onClick={() => beginDelete(s)} role="menuitem" className="chat-sidebar-item-menu-danger">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                </svg>
                                <span>Verwijderen</span>
                              </button>
                            </div>
                          )
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { TAB_CONFIG } from '../data/filters';
import { loadAll, saveCases, saveConfig } from '../lib/store';
import { useAuthSession, signOut } from '../lib/auth';
import FilterBar from './FilterBar';
import TopicView from './TopicView';
import CaseManager from './CaseManager';
import Instructies from './Instructies';
import CasesOverview from './CasesOverview';
import PersonaKompas from './PersonaKompas';
import ChatPanel from './ChatPanel';
import Login from './Login';

const ROUTE_KEY = 'sn.route'; // 'assistent' | 'gids'
const ROUTE_MIGRATION_KEY = 'sn.route.migration'; // één-malig migreren naar nieuwe default
const ROUTE_MIGRATION_VERSION = '2'; // bump → resets oude 'assistent' default eenmalig naar 'gids'

function useDebouncedSave(value, hydratedRef, saver, label) {
  useEffect(() => {
    if (!hydratedRef.current) return;
    const handle = setTimeout(() => {
      Promise.resolve(saver(value)).catch(err =>
        console.error(`Supabase save error (${label}):`, err)
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [value]);
}

export default function Navigator() {
  const { session, user, loading: authLoading } = useAuthSession();
  const [cases, setCases] = useState([]);
  const [topics, setTopics] = useState({});
  const [filters, setFilters] = useState({ doelen: [], behoeften: [], diensten: [] });
  const [personas, setPersonas] = useState({});
  const [activePersona, setActivePersona] = useState(null); // session-only, niet persistent
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('navigator');
  const [activeTab, setActiveTab] = useState('doelen');
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInitialPrompt, setChatInitialPrompt] = useState(null);
  const [route, setRoute] = useState(() => {
    try {
      // One-time migratie: de default was eerder 'assistent'; nu 'gids'.
      // Gebruikers die nooit bewust op Assistent hebben gekozen willen we
      // eenmalig resetten. We kunnen niet zien of ze écht hebben gekozen,
      // dus we accepteren dat bewuste Assistent-keuzes ook worden overschreven
      // (kleine gebruikersgroep — bewuste trade-off).
      const migratedVersion = localStorage.getItem(ROUTE_MIGRATION_KEY);
      if (migratedVersion !== ROUTE_MIGRATION_VERSION) {
        localStorage.removeItem(ROUTE_KEY);
        localStorage.setItem(ROUTE_MIGRATION_KEY, ROUTE_MIGRATION_VERSION);
      }
      const stored = localStorage.getItem(ROUTE_KEY);
      return stored === 'gids' || stored === 'assistent' ? stored : 'gids';
    } catch { return 'gids'; }
  });
  const [searchOpen, setSearchOpen] = useState(false); // mobile: collapsed search toggle
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const hydrated = useRef(false);

  // Initial load vanuit Supabase — pas laden als er een session is,
  // anders blokkeert RLS alles en krijgen we lege data.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    loadAll()
      .then(data => {
        if (cancelled) return;
        setCases(data.cases);
        setTopics(data.topics);
        setFilters(data.filters);
        setPersonas(data.personas || {});
        // Géén default-filter: lege state toont de assistent-hero (primaire entry).
        setLoading(false);
        // Zet hydrated pas in de volgende tick, zodat de eerste setState-renders geen save triggeren.
        setTimeout(() => { hydrated.current = true; }, 0);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Supabase load error:', err);
        setLoadError(err.message || 'Kon data niet laden');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  // Debounced save per slice — schrijft alleen na initial hydrate.
  useDebouncedSave(cases, hydrated, (v) => saveCases(v), 'cases');
  useDebouncedSave(topics, hydrated, (v) => saveConfig('topics', v), 'topics');
  useDebouncedSave(filters, hydrated, (v) => saveConfig('filters', v), 'filters');
  useDebouncedSave(personas, hydrated, (v) => saveConfig('personas', v), 'personas');

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (msg) => setToast(msg);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Géén auto-selectie — laat de gebruiker bewust kiezen, of Nova gebruiken.
    setActiveFilter(null);
  };

  const changeRoute = (next) => {
    setRoute(next);
    try { localStorage.setItem(ROUTE_KEY, next); } catch {}
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(prev => prev === filter ? null : filter);
  };

  // Cases CRUD
  const handleImport = (newCase) => { setCases(prev => [...prev, newCase]); showToast('Case geimporteerd'); };
  const handleUpdateCase = (updated) => { setCases(prev => prev.map(c => c.id === updated.id ? updated : c)); showToast('Case opgeslagen'); };
  const handleRemove = (id) => { setCases(prev => prev.filter(c => c.id !== id)); showToast('Case verwijderd'); };

  // Topic update
  const handleUpdateTopic = (topicData) => {
    setTopics(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [activeFilter]: topicData,
      },
    }));
  };

  // Filter CRUD
  const handleAddFilter = (category, name) => {
    setFilters(prev => ({
      ...prev,
      [category]: [...prev[category], name],
    }));
    setTopics(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [name]: { description: '', signals: '', talkingPoints: [], followUps: [] },
      },
    }));
    showToast(`"${name}" toegevoegd`);
  };

  // Update losse metadata (description / signals) per topic — zonder de rest te overschrijven.
  const handleUpdateTopicMeta = (category, name, patch) => {
    setTopics(prev => {
      const current = prev[category]?.[name] || { description: '', signals: '', talkingPoints: [], followUps: [] };
      return {
        ...prev,
        [category]: {
          ...prev[category],
          [name]: { ...current, ...patch },
        },
      };
    });
  };

  const handleRenameFilter = (category, oldName, newName) => {
    setFilters(prev => ({
      ...prev,
      [category]: prev[category].map(f => f === oldName ? newName : f),
    }));
    setTopics(prev => {
      const catTopics = { ...prev[category] };
      if (catTopics[oldName]) {
        catTopics[newName] = catTopics[oldName];
        delete catTopics[oldName];
      }
      return { ...prev, [category]: catTopics };
    });
    setCases(prev => prev.map(c => ({
      ...c,
      mapping: {
        ...c.mapping,
        [category]: c.mapping[category].map(f => f === oldName ? newName : f),
      },
      matchReasons: {
        ...c.matchReasons,
        [category]: Object.fromEntries(
          Object.entries(c.matchReasons?.[category] || {}).map(([k, v]) =>
            [k === oldName ? newName : k, v]
          )
        ),
      },
    })));
    if (activeFilter === oldName && activeTab === category) {
      setActiveFilter(newName);
    }
    showToast(`Hernoemd naar "${newName}"`);
  };

  const handleDeleteFilter = (category, name) => {
    setFilters(prev => ({
      ...prev,
      [category]: prev[category].filter(f => f !== name),
    }));
    setTopics(prev => {
      const catTopics = { ...prev[category] };
      delete catTopics[name];
      return { ...prev, [category]: catTopics };
    });
    if (activeFilter === name && activeTab === category) {
      setActiveFilter(null);
    }
    showToast(`"${name}" verwijderd`);
  };

  // Persona CRUD
  const handleUpdatePersona = (id, patch) => {
    setPersonas(prev => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };
  const handleAddPersona = () => {
    const id = `persona-${Date.now()}`;
    const nextOrder = Object.values(personas).reduce((m, p) => Math.max(m, p.order || 0), 0) + 1;
    setPersonas(prev => ({
      ...prev,
      [id]: {
        id,
        label: 'Nieuwe persona',
        icon: '👤',
        domain: 'business',
        niveau: 'strategisch',
        order: nextOrder,
        description: '',
        roles: '',
        signals: '',
        coaching: '',
      },
    }));
    showToast('Persona toegevoegd');
  };
  const handleDeletePersona = (id) => {
    setPersonas(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activePersona === id) setActivePersona(null);
    showToast('Persona verwijderd');
  };

  // Backup / Restore
  const handleBackup = () => {
    const data = { cases, topics, filters, personas, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-navigator-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup gedownload');
  };

  const handleRestore = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.cases) setCases(data.cases);
        if (data.topics) setTopics(data.topics);
        if (data.filters) setFilters(data.filters);
        if (data.personas) setPersonas(data.personas);
        showToast('Backup hersteld');
      } catch {
        showToast('Ongeldig backup-bestand');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentTopic = activeFilter ? topics[activeTab]?.[activeFilter] : null;

  // Auth-gate: eerst wachten op session-check, dan Login tonen als niet ingelogd.
  if (authLoading) {
    return (
      <div className="app">
        <div className="empty-state">
          <div className="icon-large loading-spinner" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        </div>
      </div>
    );
  }
  if (!session) {
    return <Login />;
  }

  if (loading) {
    return (
      <div className="app">
        <div className="empty-state">
          <div className="icon-large loading-spinner" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <p>Data laden...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app">
        <div className="empty-state">
          <div className="icon-large">⚠️</div>
          <p>Kon data niet laden: {loadError}</p>
          <button className="btn" onClick={() => window.location.reload()}>Opnieuw proberen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Compact sticky header */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-brand">
            <span className="topbar-title">Sales <span>Navigator</span></span>
            <img src="/creates-logo.png" alt="Creates" className="topbar-logo" />
          </div>
        </div>
        {view === 'navigator' && (
          <>
            <button
              type="button"
              className="topbar-search-icon"
              onClick={() => setSearchOpen(o => !o)}
              title={searchOpen ? 'Zoeken sluiten' : 'Zoeken'}
              aria-label={searchOpen ? 'Zoeken sluiten' : 'Zoeken'}
              aria-expanded={searchOpen}
            >
              {searchOpen ? (
                <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1 }}>✕</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.5" y2="16.5" />
                </svg>
              )}
            </button>
            <div className={`topbar-search-row ${searchOpen ? 'is-open' : ''}`}>
              <div className="topbar-search">
                <input
                  type="text"
                  placeholder="Zoek een case, klant of trefwoord..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus={searchOpen || undefined}
                />
                {searchQuery && (
                  <button className="topbar-search-clear" onClick={() => setSearchQuery('')} title="Wissen">✕</button>
                )}
              </div>
            </div>
          </>
        )}
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${view === 'navigator' ? 'active' : ''}`}
            onClick={() => setView('navigator')}
          >
            Navigator
          </button>
          <button
            className={`view-toggle-btn ${view === 'beheer' ? 'active' : ''}`}
            onClick={() => setView('beheer')}
          >
            Beheer
          </button>
          <button
            className={`view-toggle-btn ${view === 'instructies' ? 'active' : ''}`}
            onClick={() => setView('instructies')}
          >
            Instructies
          </button>
        </div>
        <button
          type="button"
          className="topbar-logout"
          onClick={() => signOut()}
          title={user?.email ? `Uitloggen (${user.email})` : 'Uitloggen'}
          aria-label="Uitloggen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      {view === 'instructies' ? (
        <Instructies />
      ) : view === 'navigator' ? (
        <>
          {/* Route-toggle: Assistent (AI-chat) vs. Gids (guided flow) */}
          <div className="route-toggle-wrap">
          <div className="route-toggle" role="tablist" aria-label="Kies je werkwijze">
            <button
              type="button"
              role="tab"
              aria-selected={route === 'gids'}
              className={`route-toggle-btn ${route === 'gids' ? 'active' : ''}`}
              onClick={() => changeRoute('gids')}
            >
              <svg className="route-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <polygon points="15.5 8.5 12.5 13.5 8.5 15.5 11.5 10.5" />
              </svg>
              <span>Gids</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={route === 'assistent'}
              className={`route-toggle-btn ${route === 'assistent' ? 'active' : ''}`}
              onClick={() => changeRoute('assistent')}
            >
              <svg className="route-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
                <path d="M18 14l.8 1.7L20.5 16.5l-1.7.8L18 19l-.8-1.7L15.5 16.5l1.7-.8L18 14z" />
              </svg>
              <span>Assistent</span>
            </button>
          </div>
          </div>

          {searchQuery.trim() ? (
            <>
              <div className="active-filter-bar">
                <span className="active-filter-chip">
                  <span className="afc-label">Zoekopdracht:</span>
                  <strong>{searchQuery}</strong>
                </span>
                <button
                  className="btn-clear-filter"
                  onClick={() => setSearchQuery('')}
                >
                  ← Terug naar totaal overzicht
                </button>
              </div>
              <CasesOverview
                cases={cases}
                searchQuery={searchQuery}
                heading={`Zoekresultaten voor "${searchQuery}"`}
              />
            </>
          ) : route === 'assistent' ? (
            /* Assistent-route: chat is het hoofdscherm, géén persona-strip. */
            <ChatPanel
              variant="inline"
              open
              cases={cases}
              initialPrompt={chatInitialPrompt}
              onPromptConsumed={() => setChatInitialPrompt(null)}
              onNavigateToCase={(caseName) => {
                changeRoute('gids');
                setActiveFilter(null);
                setSearchQuery(caseName);
              }}
              context={{
                activeTab: null,
                activeFilter: null,
                activePersonaLabel: null,
              }}
            />
          ) : (
            /* Gids-route: persona + guided flow (tabs → filters → topic/cases) */
            <div className="gids-route">
              <div className="context-strip context-strip--card">
                <PersonaKompas
                  personas={personas}
                  activePersona={activePersona}
                  onSelect={setActivePersona}
                />
                <FilterBar
                  filters={filters}
                  topics={topics}
                  activeTab={activeTab}
                  activeFilter={activeFilter}
                  onTabChange={handleTabChange}
                  onFilterChange={handleFilterChange}
                />
              </div>

              {activeFilter && currentTopic && (
                <TopicView
                  topicKey={activeFilter}
                  tab={activeTab}
                  topicData={currentTopic}
                  cases={cases}
                  onUpdateTopic={handleUpdateTopic}
                  hideReferences
                  hideTitle
                  activePersona={activePersona ? personas[activePersona] : null}
                />
              )}

              <CasesOverview
                cases={cases}
                activeTab={activeTab}
                activeFilter={activeFilter}
                heading={activeFilter ? `Referenties voor "${activeFilter}"` : 'Alle cases'}
                hint={activeFilter
                  ? null
                  : 'Klik op een case voor de details, of kies een filter hierboven om talking points te zien.'}
              />
            </div>
          )}
        </>
      ) : (
        <CaseManager
          cases={cases}
          filters={filters}
          topics={topics}
          personas={personas}
          onUpdate={handleUpdateCase}
          onImport={handleImport}
          onRemove={handleRemove}
          onAddFilter={handleAddFilter}
          onRenameFilter={handleRenameFilter}
          onDeleteFilter={handleDeleteFilter}
          onUpdateTopicMeta={handleUpdateTopicMeta}
          onUpdatePersona={handleUpdatePersona}
          onAddPersona={handleAddPersona}
          onDeletePersona={handleDeletePersona}
          onBackup={handleBackup}
          onRestore={() => fileRef.current?.click()}
        />
      )}

      {/* Hidden file input for restore */}
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleRestore}
      />

      {/* Toast notification */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

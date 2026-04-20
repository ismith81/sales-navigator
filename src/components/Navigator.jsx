import React, { useState, useEffect, useRef } from 'react';
import { TAB_CONFIG } from '../data/filters';
import { loadAll, saveCases, saveConfig } from '../lib/store';
import { useAuthSession, signOut, signInWithPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';
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

// Dev-only auto-login: als we in `npm run dev` draaien én er staan
// VITE_DEV_EMAIL + VITE_DEV_PASSWORD in .env.local, logt de app automatisch in.
// Productie raakt dit niet (DEV is false én env-vars bestaan daar niet).
const DEV_AUTOLOGIN_EMAIL = import.meta.env.DEV ? import.meta.env.VITE_DEV_EMAIL : null;
const DEV_AUTOLOGIN_PASSWORD = import.meta.env.DEV ? import.meta.env.VITE_DEV_PASSWORD : null;

export default function Navigator() {
  const { session, user, loading: authLoading } = useAuthSession();
  // Password-recovery flow: Supabase vuurt PASSWORD_RECOVERY mét een geldige
  // session. Zonder deze flag zou Navigator direct renderen en zou de
  // gebruiker nooit een nieuw wachtwoord kunnen zetten.
  const [inRecovery, setInRecovery] = useState(false);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setInRecovery(true);
    });
    return () => sub.subscription?.unsubscribe();
  }, []);

  // Dev-bypass: probeer één keer auto-login wanneer er geen session is.
  useEffect(() => {
    if (authLoading || session) return;
    if (!DEV_AUTOLOGIN_EMAIL || !DEV_AUTOLOGIN_PASSWORD) return;
    signInWithPassword(DEV_AUTOLOGIN_EMAIL, DEV_AUTOLOGIN_PASSWORD).then(({ error }) => {
      if (error) console.warn('[dev-autologin] faalde:', error.message);
    });
  }, [authLoading, session]);

  const [cases, setCases] = useState([]);
  const [topics, setTopics] = useState({});
  const [filters, setFilters] = useState({ doelen: [], behoeften: [], diensten: [] });
  const [personas, setPersonas] = useState({});
  const [branches, setBranches] = useState([]);
  const [activePersona, setActivePersona] = useState(null); // session-only, niet persistent
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('navigator');
  const [activeTab, setActiveTab] = useState('doelen');
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInitialPrompt, setChatInitialPrompt] = useState(null);
  // Sub-nav sectie per hoofdweergave. Blijft hangen zolang je op die view bent,
  // reset bij de volgende mount — bewust niet persisted (geen verwachting).
  const [beheerSection, setBeheerSection] = useState('cases'); // cases | onderwerpen | personas
  const [instructiesSection, setInstructiesSection] = useState('algemeen'); // algemeen | nova | beheer
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
  const topbarRef = useRef(null);

  // Meet live de hoogte van de sticky topbar (inclusief subnav) en zet 'm als
  // --topbar-height op <html>. Child-elementen die sticky onder de topbar
  // willen plakken (zoals de case-editor topbar) gebruiken deze var.
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const setVar = () => {
      // offsetHeight = integer incl. padding+border; +2px veiligheidsbuffer
      // zodat de sticky-child er nooit half achter valt bij subpixel-rounding.
      const h = el.offsetHeight + 2;
      document.documentElement.style.setProperty('--topbar-height', `${h}px`);
    };
    setVar();
    // rAF-tick om na eerste paint opnieuw te meten (subnav-row rendert vaak
    // een frame later in preview-iframes / trage fonts).
    const raf1 = requestAnimationFrame(() => {
      setVar();
      requestAnimationFrame(setVar);
    });
    // Font-load kan de hoogte ook nog veranderen.
    if (document.fonts?.ready) document.fonts.ready.then(setVar).catch(() => {});
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    window.addEventListener('resize', setVar);
    return () => {
      cancelAnimationFrame(raf1);
      ro.disconnect();
      window.removeEventListener('resize', setVar);
    };
  }, [view, beheerSection]);

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
        setBranches(data.branches || []);
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

  // Cases CRUD — bij expliciete user-acties (import/save/remove) direct naar
  // Supabase schrijven i.p.v. op de 400ms debounce wachten. Anders kun je
  // binnen dat venster wegnavigeren/sluiten → save verloren. Debounce blijft
  // wel actief als vangnet voor overige state-wijzigingen.
  const flushCases = (next) => {
    Promise.resolve(saveCases(next)).catch(err => {
      console.error('Supabase save error (cases):', err);
      showToast('Opslaan mislukt — probeer opnieuw');
    });
  };
  const handleImport = (newCase) => {
    setCases(prev => {
      const next = [...prev, newCase];
      if (hydrated.current) flushCases(next);
      return next;
    });
    showToast('Case geimporteerd');
  };
  const handleUpdateCase = (updated) => {
    setCases(prev => {
      const next = prev.map(c => c.id === updated.id ? updated : c);
      if (hydrated.current) flushCases(next);
      return next;
    });
    showToast('Case opgeslagen');
  };
  const handleRemove = (id) => {
    setCases(prev => {
      const next = prev.filter(c => c.id !== id);
      if (hydrated.current) flushCases(next);
      return next;
    });
    showToast('Case verwijderd');
  };

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
        icon: 'user',
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
  if (!session || inRecovery) {
    return <Login forceRecovery={inRecovery} onRecoveryDone={() => setInRecovery(false)} />;
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
      <header className="topbar" ref={topbarRef}>
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-home"
            onClick={() => setView('navigator')}
            title="Terug naar home"
            aria-label="Sales Navigator — terug naar home"
          >
            <span className="topbar-brand-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
            </span>
            <span className="topbar-title">Sales <span>Navigator</span></span>
          </button>
          <nav className="view-toggle">
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
          </nav>
        </div>
        {/* Eén gedeelde subnav-strook onder de hoofdnav — toont items van actieve view */}
        <div className="topbar-subnav-row">
          {view === 'navigator' && (
            <div className="view-subnav" role="tablist">
              <button type="button" role="tab" aria-selected={route === 'gids'}
                className={`view-subnav-btn ${route === 'gids' ? 'active' : ''}`}
                onClick={() => changeRoute('gids')}>Gids</button>
              <button type="button" role="tab" aria-selected={route === 'assistent'}
                className={`view-subnav-btn ${route === 'assistent' ? 'active' : ''}`}
                onClick={() => changeRoute('assistent')}>Assistent</button>
            </div>
          )}
          {view === 'beheer' && (
            <div className="view-subnav" role="tablist">
              <button type="button" role="tab" aria-selected={beheerSection === 'cases'}
                className={`view-subnav-btn ${beheerSection === 'cases' ? 'active' : ''}`}
                onClick={() => setBeheerSection('cases')}>Cases</button>
              <button type="button" role="tab" aria-selected={beheerSection === 'onderwerpen'}
                className={`view-subnav-btn ${beheerSection === 'onderwerpen' ? 'active' : ''}`}
                onClick={() => setBeheerSection('onderwerpen')}>Onderwerpen</button>
              <button type="button" role="tab" aria-selected={beheerSection === 'personas'}
                className={`view-subnav-btn ${beheerSection === 'personas' ? 'active' : ''}`}
                onClick={() => setBeheerSection('personas')}>Persona's</button>
            </div>
          )}
          {view === 'instructies' && (
            <div className="view-subnav" role="tablist">
              <button type="button" role="tab" aria-selected={instructiesSection === 'algemeen'}
                className={`view-subnav-btn ${instructiesSection === 'algemeen' ? 'active' : ''}`}
                onClick={() => setInstructiesSection('algemeen')}>Algemeen</button>
              <button type="button" role="tab" aria-selected={instructiesSection === 'nova'}
                className={`view-subnav-btn ${instructiesSection === 'nova' ? 'active' : ''}`}
                onClick={() => setInstructiesSection('nova')}>Nova</button>
              <button type="button" role="tab" aria-selected={instructiesSection === 'beheer'}
                className={`view-subnav-btn ${instructiesSection === 'beheer' ? 'active' : ''}`}
                onClick={() => setInstructiesSection('beheer')}>Beheer</button>
            </div>
          )}
        </div>
        <div className={`topbar-search-row ${searchOpen ? 'is-open' : ''}`}>
          <div className="topbar-search">
            <input
              type="text"
              placeholder="Zoek een case, klant of trefwoord..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Zoeken is een case-actie → spring automatisch naar Navigator-view
                // zodra de gebruiker vanuit Beheer/Instructies begint te typen.
                if (view !== 'navigator') setView('navigator');
              }}
              autoFocus={searchOpen || undefined}
            />
            {searchQuery && (
              <button className="topbar-search-clear" onClick={() => setSearchQuery('')} title="Wissen">✕</button>
            )}
          </div>
        </div>
        <div className="topbar-actions">
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
        </div>
      </header>

      {view === 'instructies' ? (
        <Instructies section={instructiesSection} />
      ) : view === 'navigator' ? (
        <>
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
                personas={personas}
                branches={branches}
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
                  personas={personas}
                  branches={branches}
                  onUpdateTopic={handleUpdateTopic}
                  hideReferences
                  hideTitle
                  activePersona={activePersona ? personas[activePersona] : null}
                />
              )}

              <CasesOverview
                cases={cases}
                personas={personas}
                branches={branches}
                activeTab={activeTab}
                activeFilter={activeFilter}
                heading={activeFilter ? `Referenties voor "${activeFilter}"` : null}
                hint={null}
              />
            </div>
          )}
        </>
      ) : (
        <CaseManager
          section={beheerSection}
          cases={cases}
          filters={filters}
          topics={topics}
          personas={personas}
          branches={branches}
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

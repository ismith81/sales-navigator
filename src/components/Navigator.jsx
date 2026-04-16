import React, { useState, useEffect, useRef } from 'react';
import initialCases from '../data/cases.json';
import initialTopics from '../data/topics.json';
import { DEFAULT_FILTERS, TAB_CONFIG } from '../data/filters';
import FilterBar from './FilterBar';
import TopicView from './TopicView';
import CaseManager from './CaseManager';

const CASES_KEY = 'salesNavigatorCases';
const TOPICS_KEY = 'salesNavigatorTopics';
const FILTERS_KEY = 'salesNavigatorFilters';

function loadJSON(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return fallback;
}

export default function Navigator() {
  const [cases, setCases] = useState(() => loadJSON(CASES_KEY, initialCases));
  const [topics, setTopics] = useState(() => loadJSON(TOPICS_KEY, initialTopics));
  const [filters, setFilters] = useState(() => loadJSON(FILTERS_KEY, DEFAULT_FILTERS));
  const [view, setView] = useState('navigator');
  const [activeTab, setActiveTab] = useState('doelen');
  const [activeFilter, setActiveFilter] = useState(null);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  // Persist
  useEffect(() => { localStorage.setItem(CASES_KEY, JSON.stringify(cases)); }, [cases]);
  useEffect(() => { localStorage.setItem(TOPICS_KEY, JSON.stringify(topics)); }, [topics]);
  useEffect(() => { localStorage.setItem(FILTERS_KEY, JSON.stringify(filters)); }, [filters]);

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
    setActiveFilter(null);
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
        [name]: { talkingPoints: [], followUps: [] },
      },
    }));
    showToast(`"${name}" toegevoegd`);
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

  // Backup / Restore
  const handleBackup = () => {
    const data = { cases, topics, filters, exportedAt: new Date().toISOString() };
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
        showToast('Backup hersteld');
      } catch {
        showToast('Ongeldig backup-bestand');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentTopic = activeFilter ? topics[activeTab]?.[activeFilter] : null;

  return (
    <div className="app">
      {/* Compact sticky header */}
      <header className="topbar">
        <div className="topbar-left">
          <img src="/creates-logo.png" alt="Creates" className="topbar-logo" />
          <span className="topbar-title">Sales <span>Navigator</span></span>
        </div>
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
        </div>
      </header>

      {view === 'navigator' ? (
        <>
          <FilterBar
            filters={filters}
            activeTab={activeTab}
            activeFilter={activeFilter}
            onTabChange={handleTabChange}
            onFilterChange={handleFilterChange}
          />

          {!activeFilter ? (
            <div className="empty-state">
              <div className="icon-large">👆</div>
              <p>Kies een {TAB_CONFIG[activeTab].singular} hierboven om te starten</p>
            </div>
          ) : currentTopic ? (
            <TopicView
              topicKey={activeFilter}
              tab={activeTab}
              topicData={currentTopic}
              cases={cases}
              onUpdateTopic={handleUpdateTopic}
            />
          ) : (
            <div className="empty-state">
              <div className="icon-large">📋</div>
              <p>Geen content voor "{activeFilter}". Voeg talking points toe via Beheer.</p>
            </div>
          )}
        </>
      ) : (
        <CaseManager
          cases={cases}
          filters={filters}
          onUpdate={handleUpdateCase}
          onImport={handleImport}
          onRemove={handleRemove}
          onAddFilter={handleAddFilter}
          onRenameFilter={handleRenameFilter}
          onDeleteFilter={handleDeleteFilter}
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

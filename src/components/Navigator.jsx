import React, { useState, useEffect } from 'react';
import initialCases from '../data/cases.json';
import initialTopics from '../data/topics.json';
import { TAB_CONFIG } from '../data/filters';
import FilterBar from './FilterBar';
import TopicView from './TopicView';
import CaseManager from './CaseManager';

const CASES_KEY = 'salesNavigatorCases';
const TOPICS_KEY = 'salesNavigatorTopics';

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
  const [view, setView] = useState('navigator');
  const [activeTab, setActiveTab] = useState('doelen');
  const [activeFilter, setActiveFilter] = useState(null);

  // Persist
  useEffect(() => { localStorage.setItem(CASES_KEY, JSON.stringify(cases)); }, [cases]);
  useEffect(() => { localStorage.setItem(TOPICS_KEY, JSON.stringify(topics)); }, [topics]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActiveFilter(null);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(prev => prev === filter ? null : filter);
  };

  // Cases CRUD
  const handleImport = (newCase) => setCases(prev => [...prev, newCase]);
  const handleUpdateCase = (updated) => setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
  const handleRemove = (id) => setCases(prev => prev.filter(c => c.id !== id));

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

  const currentTopic = activeFilter ? topics[activeTab]?.[activeFilter] : null;

  return (
    <div className="app">
      <header className="header">
        <div className="badge">Interactief Belscript</div>
        <h1>Sales <span>Navigator</span></h1>
        <p>
          {view === 'navigator'
            ? 'Klik op een doel, behoefte of dienst om talking points, vervolgvragen en referenties te zien.'
            : 'Beheer, bewerk en importeer je cases.'}
        </p>
      </header>

      {/* View toggle */}
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${view === 'navigator' ? 'active' : ''}`}
          onClick={() => setView('navigator')}
        >
          📞 Navigator
        </button>
        <button
          className={`view-toggle-btn ${view === 'beheer' ? 'active' : ''}`}
          onClick={() => setView('beheer')}
        >
          ⚙ Case Beheer
        </button>
      </div>

      {view === 'navigator' ? (
        <>
          <FilterBar
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
              <p>Geen content voor "{activeFilter}". Voeg talking points toe via Case Beheer.</p>
            </div>
          )}
        </>
      ) : (
        <CaseManager
          cases={cases}
          onUpdate={handleUpdateCase}
          onImport={handleImport}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}

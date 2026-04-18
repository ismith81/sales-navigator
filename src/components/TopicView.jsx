import React, { useState } from 'react';
import ReferenceCard from './ReferenceCard';

export default function TopicView({ topicKey, tab, topicData, cases, onUpdateTopic, hideReferences = false, hideTitle = false }) {
  const [editingTP, setEditingTP] = useState(null);
  const [editingFU, setEditingFU] = useState(null);
  const [addingTP, setAddingTP] = useState(false);
  const [addingFU, setAddingFU] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [showDescription, setShowDescription] = useState(false);

  const { talkingPoints, followUps, description } = topicData;
  const hasDescription = description && description.replace(/<[^>]+>/g, '').trim();

  const matchedCases = cases.filter(c => c.mapping[tab]?.includes(topicKey));

  const saveTP = (i, value) => {
    const updated = [...talkingPoints];
    updated[i] = value;
    onUpdateTopic({ ...topicData, talkingPoints: updated.filter(v => v.trim()) });
    setEditingTP(null);
  };

  const saveFU = (i, value) => {
    const updated = [...followUps];
    updated[i] = value;
    onUpdateTopic({ ...topicData, followUps: updated.filter(v => v.trim()) });
    setEditingFU(null);
  };

  const removeTP = (i) => {
    onUpdateTopic({ ...topicData, talkingPoints: talkingPoints.filter((_, idx) => idx !== i) });
  };

  const removeFU = (i) => {
    onUpdateTopic({ ...topicData, followUps: followUps.filter((_, idx) => idx !== i) });
  };

  const addTP = (value) => {
    if (!value.trim()) return;
    onUpdateTopic({ ...topicData, talkingPoints: [...talkingPoints, value.trim()] });
    setAddingTP(false);
    setNewValue('');
  };

  const addFU = (value) => {
    if (!value.trim()) return;
    onUpdateTopic({ ...topicData, followUps: [...followUps, value.trim()] });
    setAddingFU(false);
    setNewValue('');
  };

  const handleKeyDown = (e, saveFn) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveFn(e.target.value);
    }
    if (e.key === 'Escape') {
      setEditingTP(null);
      setEditingFU(null);
      setAddingTP(false);
      setAddingFU(false);
    }
  };

  return (
    <div className="topic-view" key={topicKey}>
      {!hideTitle && <h2 className="topic-title">{topicKey}</h2>}

      {hasDescription && (
        <div className={`topic-description-collapsible ${showDescription ? 'open' : ''}`}>
          <button
            type="button"
            className="topic-description-toggle"
            onClick={() => setShowDescription(prev => !prev)}
          >
            <svg className="tdc-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="8" cy="4.5" r="0.9" fill="currentColor" />
              <path d="M8 7v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="tdc-label">Wat is dit?</span>
          </button>
          {showDescription && (
            <div
              className="topic-description rich-text"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </div>
      )}

      <div className="topic-columns">
        {/* Left column: Talking Points — "Wat zeg je?" */}
        <div className="topic-col">
          <div className="section-title section-title--talking">Wat zeg je?</div>
          {talkingPoints.map((tp, i) => (
            <div key={i} className="topic-item">
              {editingTP === i ? (
                <div className="topic-inline-edit">
                  <textarea
                    defaultValue={tp}
                    autoFocus
                    rows={2}
                    onKeyDown={(e) => handleKeyDown(e, (v) => saveTP(i, v))}
                    onBlur={(e) => saveTP(i, e.target.value)}
                  />
                </div>
              ) : (
                <div className="talking-point">
                  <span className="bullet">•</span>
                  <span
                    className="topic-text clickable"
                    onClick={() => setEditingTP(i)}
                    title="Klik om te bewerken"
                  >
                    {tp}
                  </span>
                  <button className="btn-inline-remove" onClick={() => removeTP(i)} title="Verwijder">✕</button>
                </div>
              )}
            </div>
          ))}
          {addingTP ? (
            <div className="topic-inline-edit">
              <textarea
                autoFocus
                rows={2}
                placeholder="Nieuw talking point..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, addTP)}
                onBlur={() => { addTP(newValue); }}
              />
            </div>
          ) : (
            <button className="btn-add" onClick={() => { setAddingTP(true); setNewValue(''); }}>
              + Talking point toevoegen
            </button>
          )}
        </div>

        {/* Right column: Follow-ups — "Wat vraag je?" */}
        <div className="topic-col">
          <div className="section-title section-title--followup">Wat vraag je?</div>
          {followUps.map((q, i) => (
            <div key={i} className="topic-item">
              {editingFU === i ? (
                <div className="topic-inline-edit">
                  <textarea
                    defaultValue={q}
                    autoFocus
                    rows={2}
                    onKeyDown={(e) => handleKeyDown(e, (v) => saveFU(i, v))}
                    onBlur={(e) => saveFU(i, e.target.value)}
                  />
                </div>
              ) : (
                <div className="followup-question">
                  <span className="bullet">•</span>
                  <span
                    className="topic-text clickable"
                    onClick={() => setEditingFU(i)}
                    title="Klik om te bewerken"
                  >
                    {q}
                  </span>
                  <button className="btn-inline-remove" onClick={() => removeFU(i)} title="Verwijder">✕</button>
                </div>
              )}
            </div>
          ))}
          {addingFU ? (
            <div className="topic-inline-edit">
              <textarea
                autoFocus
                rows={2}
                placeholder="Nieuwe vervolgvraag..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, addFU)}
                onBlur={() => { addFU(newValue); }}
              />
            </div>
          ) : (
            <button className="btn-add" onClick={() => { setAddingFU(true); setNewValue(''); }}>
              + Vervolgvraag toevoegen
            </button>
          )}
        </div>
      </div>

      {/* Reference cases */}
      {!hideReferences && matchedCases.length > 0 && (
        <>
          <div className="section-title">📎 Referenties ({matchedCases.length})</div>
          <div className="reference-list">
            {matchedCases.map(c => (
              <ReferenceCard
                key={c.id}
                caseData={c}
                matchReason={c.matchReasons?.[tab]?.[topicKey]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

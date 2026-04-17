import React, { useState } from 'react';
import ReferenceCard from './ReferenceCard';

export default function TopicView({ topicKey, tab, topicData, cases, onUpdateTopic, hideReferences = false, hideTitle = false }) {
  const [editingTP, setEditingTP] = useState(null);
  const [editingFU, setEditingFU] = useState(null);
  const [addingTP, setAddingTP] = useState(false);
  const [addingFU, setAddingFU] = useState(false);
  const [newValue, setNewValue] = useState('');

  const { talkingPoints, followUps } = topicData;

  // Filter cases that match this topic
  const matchedCases = cases.filter(c => c.mapping[tab]?.includes(topicKey));

  // --- Inline edit helpers ---
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

      {/* Talking Points */}
      <div className="section-title section-title--talking">Talking Points</div>
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

      {/* Follow-ups */}
      <div className="section-title section-title--followup">Vervolgvragen</div>
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

import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'sn.chatMessages';

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

const QUICK_PROMPTS = [
  'Welke cases passen bij AI ready?',
  'Bereid CFO-gesprek voor over dataplatform-migratie',
  'Wat zijn goede vervolgvragen bij realtime data?',
];

export default function ChatPanel({ open, onClose, context = {} }) {
  const [messages, setMessages] = useState(readStored);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toolActivity, setToolActivity] = useState(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    // Close on ESC
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const send = async (text) => {
    const clean = (text || '').trim();
    if (!clean || busy) return;

    const nextMessages = [...messages, { role: 'user', content: clean }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    setToolActivity(null);

    // Placeholder assistant-bericht dat we live bijwerken.
    setMessages(m => [...m, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, context }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Server ${res.status}: ${errText || 'onbekende fout'}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() || '';
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let parsed;
          try { parsed = JSON.parse(json); } catch { continue; }
          if (parsed.type === 'text') {
            setMessages(m => {
              const copy = m.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: last.content + parsed.value };
              }
              return copy;
            });
          } else if (parsed.type === 'tool') {
            setToolActivity(parsed.value?.join(', ') || null);
          } else if (parsed.type === 'error') {
            setMessages(m => {
              const copy = m.slice();
              copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${parsed.value}` };
              return copy;
            });
          } else if (parsed.type === 'done') {
            setToolActivity(null);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(m => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          const msg = `⚠️ ${err.message || 'Kon geen verbinding maken'}`;
          if (last && last.role === 'assistant' && !last.content) {
            copy[copy.length - 1] = { role: 'assistant', content: msg };
          } else {
            copy.push({ role: 'assistant', content: msg });
          }
          return copy;
        });
      }
    } finally {
      setBusy(false);
      setToolActivity(null);
      abortRef.current = null;
    }
  };

  const clearChat = () => {
    if (busy) abortRef.current?.abort();
    setMessages([]);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      <div className={`chat-overlay ${open ? 'open' : ''}`} onClick={onClose} aria-hidden={!open} />
      <aside className={`chat-panel ${open ? 'open' : ''}`} aria-hidden={!open} role="dialog" aria-label="Sales assistent">
        <header className="chat-header">
          <div className="chat-header-title">
            <span className="chat-header-dot" aria-hidden="true" />
            <strong>Sales assistent</strong>
          </div>
          <div className="chat-header-actions">
            {messages.length > 0 && (
              <button type="button" className="chat-header-btn" onClick={clearChat} title="Gesprek wissen">
                Wissen
              </button>
            )}
            <button type="button" className="chat-header-btn chat-close" onClick={onClose} aria-label="Sluiten">✕</button>
          </div>
        </header>

        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="chat-welcome">
              <p>Hoi, ik help je je voorbereiden op een klantgesprek. Stel een vraag of kies een starter:</p>
              <div className="chat-quickprompts">
                {QUICK_PROMPTS.map(q => (
                  <button key={q} type="button" className="chat-quickprompt" onClick={() => send(q)} disabled={busy}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg chat-msg--${m.role}`}>
              <div className="chat-msg-bubble">
                {m.content || (busy && i === messages.length - 1 ? <span className="chat-typing">●●●</span> : null)}
              </div>
            </div>
          ))}
          {toolActivity && (
            <div className="chat-tool-activity">🔎 zoekt in {toolActivity}…</div>
          )}
        </div>

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Stel een vraag…"
            rows={1}
            disabled={busy}
          />
          <button type="submit" className="chat-send" disabled={busy || !input.trim()} aria-label="Verstuur">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </aside>
    </>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

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

export default function ChatPanel({ open, onClose, context = {}, cases = [], onNavigateToCase, initialPrompt = null, onPromptConsumed, variant = 'drawer' }) {
  const inline = variant === 'inline';
  // Namen van bestaande cases — gebruikt om in assistent-antwoorden klikbare links te maken.
  // Langste eerst zodat "AkzoNobel (Paint Company)" vóór "AkzoNobel" wordt gematcht.
  const caseNames = React.useMemo(
    () => cases.map(c => c.name).filter(Boolean).sort((a, b) => b.length - a.length),
    [cases]
  );

  // Fuzzy helper: strip spaties, punctuatie, diacritics en lowercase.
  // "Tulp Group", "tulpgroep", "Tulp-Group" matchen dan allemaal.
  const normalize = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  // Markdown-component override: vervangt <strong> inhoud door een klikbare link
  // als de tekst (fuzzy) overeenkomt met een case-naam. Niet-case-bold blijft gewoon bold.
  const markdownComponents = React.useMemo(() => ({
    strong: ({ children }) => {
      const text = React.Children.toArray(children).map(c => typeof c === 'string' ? c : '').join('').trim();
      const textNorm = normalize(text);
      const matched = textNorm && caseNames.find(n => {
        const nNorm = normalize(n);
        if (!nNorm) return false;
        return nNorm === textNorm || textNorm.startsWith(nNorm) || nNorm.startsWith(textNorm) || nNorm.includes(textNorm) || textNorm.includes(nNorm);
      });
      if (matched && onNavigateToCase) {
        return (
          <button
            type="button"
            className="chat-case-link"
            onClick={() => onNavigateToCase(matched)}
            title={`Bekijk case: ${matched}`}
          >
            {children}
          </button>
        );
      }
      return <strong>{children}</strong>;
    },
  }), [caseNames, onNavigateToCase]);

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
    // Close on ESC — niet relevant voor inline-modus (geen sluit-actie).
    if (!open || inline) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, inline]);

  // Auto-verstuur een prompt wanneer het panel geopend wordt met een initialPrompt
  // (vanuit de hero-quick-prompts). Pas na mount versturen — met een tick zodat de
  // animatie/render af is.
  const autoSentRef = useRef(null);
  useEffect(() => {
    if (!open || !initialPrompt || busy) return;
    if (autoSentRef.current === initialPrompt) return; // al verstuurd in deze cyclus
    autoSentRef.current = initialPrompt;
    const handle = setTimeout(() => {
      send(initialPrompt);
      onPromptConsumed?.();
    }, 80);
    return () => clearTimeout(handle);
    // Bewust geen send/busy in deps — willen alleen reageren op open/initialPrompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  // Reset auto-sent guard wanneer panel sluit, zodat volgende keer opnieuw mag.
  useEffect(() => {
    if (!open) autoSentRef.current = null;
  }, [open]);

  const send = async (text) => {
    const clean = (text || '').trim();
    if (!clean || busy) return;

    const nextMessages = [...messages, { role: 'user', content: clean }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    setToolActivity(null);

    // Placeholder assistant-bericht dat we live bijwerken.
    setMessages(m => [...m, { role: 'assistant', content: '', toolCalls: [], feedback: 0 }]);

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
            // Log welke tools gebruikt zijn — gaat mee als context bij feedback.
            setMessages(m => {
              const copy = m.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                const merged = [...(last.toolCalls || []), ...(parsed.value || [])];
                copy[copy.length - 1] = { ...last, toolCalls: merged };
              }
              return copy;
            });
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

  const sendFeedback = async (index, rating) => {
    // Index in messages-array: we willen weten welk user-bericht er direct aan voorafging.
    const assistant = messages[index];
    if (!assistant || assistant.role !== 'assistant') return;
    // Voorkom dubbel-klikken.
    if (assistant.feedback === rating) return;

    // Optimistic UI update — direct visueel reageren.
    setMessages(m => m.map((msg, i) => i === index ? { ...msg, feedback: rating } : msg));

    // Zoek het user-bericht dat dit antwoord triggerde (eerstvoorgaande role=user).
    let userMessage = '';
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { userMessage = messages[i].content; break; }
    }

    try {
      await fetch('/api/chat-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          userMessage,
          assistantMessage: assistant.content,
          context,
          toolCalls: assistant.toolCalls || [],
        }),
      });
    } catch (e) {
      // Feedback mag de UX niet breken — stil loggen.
      console.warn('Feedback kon niet opgeslagen worden:', e);
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
      {!inline && (
        <div className={`chat-overlay ${open ? 'open' : ''}`} onClick={onClose} aria-hidden={!open} />
      )}
      <aside
        className={`chat-panel ${inline ? 'chat-panel--inline' : ''} ${open ? 'open' : ''}`}
        aria-hidden={!open}
        role={inline ? 'region' : 'dialog'}
        aria-label="Sales assistent"
      >
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
            {!inline && (
              <button type="button" className="chat-header-btn chat-close" onClick={onClose} aria-label="Sluiten">✕</button>
            )}
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
          {messages.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            const isLast = i === messages.length - 1;
            const isStreaming = busy && isLast;
            const hasContent = !!m.content;
            // Feedback-knoppen pas tonen na afgeronde assistent-berichten met echte inhoud.
            const showFeedback = isAssistant && hasContent && !isStreaming && !m.content.startsWith('⚠️');
            return (
              <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                <div className="chat-msg-bubble">
                  {hasContent ? (
                    isAssistant
                      ? <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                      : m.content
                  ) : (isStreaming ? <span className="chat-typing">●●●</span> : null)}
                </div>
                {showFeedback && (
                  <div className="chat-feedback">
                    <button
                      type="button"
                      className={`chat-feedback-btn ${m.feedback === 1 ? 'active' : ''}`}
                      onClick={() => sendFeedback(i, 1)}
                      title="Goed antwoord"
                      aria-label="Goed antwoord"
                    >👍</button>
                    <button
                      type="button"
                      className={`chat-feedback-btn ${m.feedback === -1 ? 'active' : ''}`}
                      onClick={() => sendFeedback(i, -1)}
                      title="Slecht antwoord"
                      aria-label="Slecht antwoord"
                    >👎</button>
                    {m.feedback !== 0 && <span className="chat-feedback-thanks">Dank je.</span>}
                  </div>
                )}
              </div>
            );
          })}
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

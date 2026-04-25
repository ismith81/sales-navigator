import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { authedFetch } from '../lib/auth';

const STORAGE_KEY = 'sn.chatMessages';

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

const QUICK_PROMPT_GROUPS = [
  {
    label: 'Voor het gesprek',
    items: [
      { kind: 'Briefing', text: 'Maak een briefing over [bedrijfsnaam] — gebruik het 7-bucket raamwerk', shortText: 'Briefing over bedrijf' },
      { kind: 'Voorbereiding', text: 'Bereid een CFO-gesprek voor over dataplatform-migratie', shortText: 'CFO-gesprek over dataplatform' },
      { kind: 'Rollenspel', text: 'Speel de IT-manager van een bank en val me aan op governance', shortText: 'IT-manager over governance' },
    ],
  },
  {
    label: 'Na het gesprek',
    items: [
      { kind: 'Follow-up', text: 'Maak van deze gespreksnotities een follow-up mail', shortText: 'Mail uit gespreksnotities' },
      { kind: 'Actielijst', text: 'Haal uit mijn notes een actielijst met eigenaar en volgende stap', shortText: 'Acties uit notes' },
    ],
  },
];

const TOOL_LABELS = {
  search_cases: 'Cases',
  get_topic: 'Topics',
  list_personas: 'Persona’s',
  search_web: 'Web',
  prospect_brief: 'Briefing',
};

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
  const [copiedIdx, setCopiedIdx] = useState(null);
  const empty = messages.length === 0;

  const formatToolLabels = (toolCalls = []) => {
    const unique = [...new Set((toolCalls || []).map((name) => TOOL_LABELS[name] || name))];
    return unique;
  };

  const copyMessage = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(c => (c === idx ? null : c)), 1400);
    } catch {
      // Fallback: selecteer textarea om het handmatig te kopiëren
      console.warn('Clipboard niet beschikbaar');
    }
  };
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  // Auto-scroll alleen als gebruiker al ongeveer onderin stond — zodat ze kunnen
  // terugscrollen om iets te lezen zonder dat streaming-updates je terugduwen.
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, busy, toolActivity]);

  // Track of de gebruiker "aan de bodem" zit (binnen 80px). Alleen dan
  // volgt de viewport automatisch bij nieuwe content.
  const handleMessagesScroll = (e) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  // Auto-grow textarea tot max-height (CSS), daarna intern scrollen.
  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  };
  useEffect(() => { autosize(); }, [input]);

  const stopGenerating = () => {
    abortRef.current?.abort();
  };

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
      const res = await authedFetch('/api/chat', {
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
          } else if (parsed.type === 'grounding') {
            // Web-bronnen uit search_web-tool calls — gerenderd als "Bronnen (Google Search)"
            // onder het assistant-bericht. De Web-chip in "Gebruikte context" komt al vanzelf
            // omdat search_web al in toolCalls zit via het normale 'tool'-event.
            setMessages(m => {
              const copy = m.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                copy[copy.length - 1] = {
                  ...last,
                  groundingSources: parsed.value?.sources || [],
                  groundingQueries: parsed.value?.queries || [],
                };
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
      await authedFetch('/api/chat-feedback', {
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
        className={`chat-panel ${inline ? 'chat-panel--inline' : ''} ${empty ? 'chat-panel--empty' : ''} ${open ? 'open' : ''}`}
        aria-hidden={!open}
        role={inline ? 'region' : 'dialog'}
        aria-label="Nova — sales assistent"
      >
        <header className="chat-header">
          <div className="chat-header-meta">
            <div className="chat-header-title">
              <span className="chat-header-dot" aria-hidden="true" />
              <strong>Nova</strong>
              <span className="chat-header-subtitle">sales-assistent</span>
            </div>
            <div className="chat-header-trust">werkt met jullie cases, topics en persona’s</div>
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

        <div className="chat-messages" ref={listRef} onScroll={handleMessagesScroll}>
         <div className="chat-column">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div className="chat-welcome-intro">
                <span className="chat-welcome-dot" aria-hidden="true" />
                <p>
                  <span className="chat-welcome-copy-desktop">Hoi, ik ben <strong>Nova</strong> — ik help je vóór én na een klantgesprek en werk met jullie cases, topics en persona’s. Stel een vraag, plak je notities, of kies een starter:</span>
                  <span className="chat-welcome-copy-mobile">Hoi, ik ben <strong>Nova</strong>. Ik help je vóór én na klantgesprekken met jullie cases, topics en persona’s.</span>
                </p>
              </div>
              <div className="chat-quickgroups">
                {QUICK_PROMPT_GROUPS.map((group) => (
                  <section key={group.label} className="chat-quickgroup">
                    <div className="chat-quickgroup-label">{group.label}</div>
                    <div className="chat-quickprompts">
                      {group.items.map((item) => (
                        <button key={item.text} type="button" className="chat-quickprompt" onClick={() => send(item.text)} disabled={busy}>
                          <span className="chat-quickprompt-kind">{item.kind}</span>
                          <span className="chat-quickprompt-text">{item.text}</span>
                          <span className="chat-quickprompt-short">{item.shortText || item.text}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            const isLast = i === messages.length - 1;
            const isStreaming = busy && isLast;
            const hasContent = !!m.content;
            const contextTags = isAssistant ? formatToolLabels(m.toolCalls) : [];
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
                {isAssistant && contextTags.length > 0 && (
                  <div className="chat-context-used">
                    <span className="chat-context-used-label">Gebruikte context</span>
                    {contextTags.map((tag) => (
                      <span key={tag} className="chat-context-tag">{tag}</span>
                    ))}
                  </div>
                )}
                {isAssistant && m.groundingSources && m.groundingSources.length > 0 && (
                  <div className="chat-sources">
                    <span className="chat-sources-label">Bronnen (Google Search)</span>
                    <ol className="chat-sources-list">
                      {m.groundingSources.map((s, idx) => (
                        <li key={`${s.uri}-${idx}`}>
                          <a href={s.uri} target="_blank" rel="noopener noreferrer" title={s.uri}>
                            {s.title || s.uri}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {showFeedback && (
                  <div className="chat-feedback">
                    <button
                      type="button"
                      className="chat-feedback-btn"
                      onClick={() => copyMessage(m.content, i)}
                      title={copiedIdx === i ? 'Gekopieerd' : 'Kopieer antwoord'}
                      aria-label="Kopieer antwoord"
                    >
                      {copiedIdx === i ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
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
                    {m.feedback !== 0 && m.feedback !== undefined && <span className="chat-feedback-thanks">Dank je.</span>}
                  </div>
                )}
              </div>
            );
          })}
          {toolActivity && (
            <div className="chat-tool-activity">🔎 zoekt in {toolActivity}…</div>
          )}
         </div>
        </div>

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <div className="chat-column chat-column--input">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Plak notities of beschrijf je gesprek…"
              rows={1}
            />
            <div className="chat-input-helper">Tip: noem rol, sector of onderwerp voor een sterker antwoord.</div>
            {busy ? (
              <button type="button" className="chat-send chat-stop" onClick={stopGenerating} aria-label="Stop genereren" title="Stop genereren">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button type="submit" className="chat-send" disabled={!input.trim()} aria-label="Verstuur">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </aside>
    </>
  );
}


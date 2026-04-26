import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { authedFetch } from '../lib/auth';
import {
  listSessions,
  loadSession,
  createSession,
  updateSession,
  deleteSession,
  setSessionPinned,
  getActiveSessionId,
  setActiveSessionId,
} from '../lib/chatHistory';
import ChatSidebar from './ChatSidebar';

const SIDEBAR_COLLAPSE_KEY = 'sn.chatSidebar';
const readSidebarCollapsed = () => {
  try { return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === 'collapsed'; } catch { return false; }
};
const writeSidebarCollapsed = (v) => {
  try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, v ? 'collapsed' : 'expanded'); } catch {}
};

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
    label: 'Team-match',
    items: [
      { kind: 'Match', text: 'Welke collega past het beste bij [klantvraag]? Geef top 3 met motivatie.', shortText: 'Collega zoeken voor klantvraag' },
      { kind: 'Pitch', text: 'Schrijf een klantgerichte pitch voor [naam] voor een [type] traject', shortText: 'Pitch voor consultant' },
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
  find_team_members: 'Team',
  get_team_member: 'Profiel',
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

  // Pre-process markdown content: alle [n]-citaties (kaal of met URL erachter)
  // omzetten naar interne markdown-link [n](#cite-n) zodat de a-component
  // override ze als citation-marker rendert. Dekt ook het geval dat Nova/Gemini
  // een markdown-link mét random URL produceert (`[5](https://broken-redirect)`):
  // we strippen de URL en houden het nummer, gekoppeld aan onze cite-handler.
  // Anchor-href (#) is veilig — ReactMarkdown's URL-sanitizer laat 'm intact
  // (eerdere poging met §-teken werd URL-encoded naar %C2%A7).
  const processCitations = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text
      // Eerst: [n](anything) → [n](#cite-n). Vangt zowel onze eigen vorm
      // (idempotent) als foute Gemini-redirect-URLs af.
      .replace(/\[(\d+)\]\([^)]*\)/g, '[$1](#cite-$1)')
      // Daarna: kale [n] zonder parens → [n](#cite-n).
      .replace(/\[(\d+)\](?!\()/g, '[$1](#cite-$1)');
  };

  // Maak markdownComponents voor één specifiek bericht (per message-idx),
  // zodat citation-clicks weten bij welk bericht ze horen. sourceCount =
  // hoogste geldige bron-nummer voor dit bericht; nummers buiten range
  // worden als plain-text gerenderd ipv broken citation-knopje.
  const makeMarkdownComponents = (messageIdx, sourceCount = 0) => ({
    // <strong> → klikbare case-link als naam matched (bestaand gedrag).
    // Skip korte bold-strings (<3 chars) — die kunnen single-letter
    // BANT-rubrieken zijn (**B**, **A**, **N**, **T**) of andere afkortingen.
    // Met fuzzy-matching slaat een 1-letter bold te snel aan op een case-naam
    // die toevallig die letter bevat (substring-match).
    strong: ({ children }) => {
      const text = React.Children.toArray(children).map(c => typeof c === 'string' ? c : '').join('').trim();
      const textNorm = normalize(text);
      const matched = textNorm.length >= 3 && caseNames.find(n => {
        const nNorm = normalize(n);
        if (!nNorm || nNorm.length < 3) return false;
        return nNorm === textNorm
          || nNorm.startsWith(textNorm)   // "Tulp" ↔ "Tulp Group"
          || textNorm.startsWith(nNorm)   // "AkzoNobel-Latam" ↔ "AkzoNobel"
          || (textNorm.length >= 5 && nNorm.includes(textNorm))
          || (nNorm.length >= 5 && textNorm.includes(nNorm));
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
    // <a> override: #cite-N-href = citatie-marker (superscript), andere href = gewone link.
    a: ({ href, children }) => {
      if (typeof href === 'string' && href.startsWith('#cite-')) {
        const n = parseInt(href.slice(6), 10);
        // Alleen renderen als n binnen het aantal beschikbare bronnen valt —
        // anders plain text zodat een onjuist nummer geen dood knopje wordt.
        if (Number.isFinite(n) && n >= 1 && n <= sourceCount) {
          return (
            <sup className="chat-citation">
              <button
                type="button"
                className="chat-citation-btn"
                onClick={() => handleCitationClick(messageIdx, n)}
                title={`Bron ${n}`}
                aria-label={`Bron ${n}`}
              >{n}</button>
            </sup>
          );
        }
        // Out-of-range: plain text zonder superscript (gewoon "[5]" terug-renderen).
        return <span>[{n}]</span>;
      }
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toolActivity, setToolActivity] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  // History-state: actieve sessie-id, lijst met laatste 10 sessies.
  const [sessionId, setSessionId] = useState(() => getActiveSessionId());
  const [sessions, setSessions] = useState([]);
  // Sidebar (Claude.ai-stijl): inline-mode-only. Collapsed-state leeft in
  // localStorage; mobile-overlay-state in geheugen (default closed).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Header title-edit-state: actief? en draft.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef(null);
  // Per-bericht: bronnen-blok ingeklapt of uitgeklapt (default ingeklapt als chip).
  const [expandedSources, setExpandedSources] = useState(() => new Set());
  // Tijdelijke highlight op een bron na klik op een [n]-citatie.
  const [highlightedSource, setHighlightedSource] = useState(null); // {messageIdx, n}

  // Toggle voor het bronnen-blok: ingeklapt-chip ↔ uitgeklapte lijst.
  const toggleSourcesExpanded = (idx) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  // Klik op een [n]-citatie: bronnen-blok uitklappen + scrollen naar bron + flash.
  const handleCitationClick = (messageIdx, n) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      next.add(messageIdx);
      return next;
    });
    setHighlightedSource({ messageIdx, n });
    // Scroll na render-tick zodat 't blok eerst uitklapt.
    setTimeout(() => {
      const el = document.getElementById(`chat-source-${messageIdx}-${n}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
    // Highlight wegfaden na ~2s.
    setTimeout(() => {
      setHighlightedSource(prev => (prev && prev.messageIdx === messageIdx && prev.n === n) ? null : prev);
    }, 2000);
  };
  const empty = messages.length === 0;
  const activeSession = sessions.find(s => s.id === sessionId) || null;
  const activeTitle = activeSession?.title || '';

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

  // ─── History persistence ─────────────────────────────────────────────
  // Bij mount: laad de sessions-lijst (voor de sidebar) en probeer de actieve
  // sessie terug te laden zodat een refresh mid-conversatie geen werk-verlies
  // oplevert. Mislukt 't (verwijderd door pruning of andere user op zelfde
  // browser): begin gewoon leeg.
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    (async () => {
      // Sessions-lijst voor de sidebar — fail-open, lege lijst als DB niet bereikbaar.
      setSessions(await listSessions());
      const id = getActiveSessionId();
      if (!id) return;
      const s = await loadSession(id);
      if (s && Array.isArray(s.messages)) {
        setMessages(s.messages);
        setSessionId(s.id);
      } else {
        setActiveSessionId(null);
        setSessionId(null);
      }
    })();
  }, []);

  // Wanneer titel-edit-modus actief wordt: focus + selecteer.
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // Auto-save (debounced 700ms) — bij eerste user-bericht wordt sessie aangemaakt,
  // daarna worden updates gepusht. Tijdens busy/streaming sla je tussenstanden over
  // om te voorkomen dat we elk text-chunk een DB-write triggeren.
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (busy) return; // wacht tot streaming klaar is
    if (messages.length === 0) return;
    // Sla alleen op als er minimaal één user-bericht is (geen lege placeholder).
    const hasUser = messages.some(m => m.role === 'user' && (m.content || '').trim());
    if (!hasUser) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (sessionId) {
        await updateSession(sessionId, { messages });
      } else {
        const created = await createSession(messages);
        if (created?.id) {
          setSessionId(created.id);
          setActiveSessionId(created.id);
          // Refresh sessions-lijst zodat de nieuwe titel direct in 't menu staat.
          setSessions(await listSessions());
        }
      }
    }, 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, busy, sessionId]);

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

  // (Eerder hier: een visualViewport-hack om position:fixed te verschuiven met
  // 't iOS-keyboard. Verwijderd — de chat-input-row staat nu in normal flow
  // binnen 't flex-column chat-panel, dus iOS zelf scrollt 'm in beeld zodra
  // 'ie focus krijgt. Eenvoudiger en betrouwbaarder dan de fixed+JS-aanpak.)

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

  // Nieuw gesprek: leeg scherm, oude sessie blijft in history.
  const startNewChat = () => {
    if (busy) abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setActiveSessionId(null);
    setMobileSidebarOpen(false);
  };

  // Klik op een history-item in de sidebar → wissel van sessie.
  const switchToSession = async (id) => {
    if (busy) abortRef.current?.abort();
    setMobileSidebarOpen(false);
    if (id === sessionId) return;
    const s = await loadSession(id);
    if (s) {
      setMessages(Array.isArray(s.messages) ? s.messages : []);
      setSessionId(s.id);
      setActiveSessionId(s.id);
    }
  };

  // Verwijder een sessie via de sidebar — confirmatie zit al in ChatSidebar.jsx.
  const removeSessionById = async (id) => {
    await deleteSession(id);
    if (id === sessionId) {
      setMessages([]);
      setSessionId(null);
      setActiveSessionId(null);
    }
    setSessions(await listSessions());
  };

  // Hernoem een sessie (vanuit sidebar ⋮-menu of inline header-edit).
  const renameSessionTitle = async (id, title) => {
    if (!id || !title) return;
    await updateSession(id, { title });
    setSessions(await listSessions());
  };

  // Pin/unpin toggle vanuit sidebar ⋮-menu.
  const togglePinSession = async (id, pinned) => {
    await setSessionPinned(id, pinned);
    setSessions(await listSessions());
  };

  // Toggle sidebar collapsed-state (desktop) en persisteer in localStorage.
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(c => {
      const next = !c;
      writeSidebarCollapsed(next);
      return next;
    });
  };

  // Header-titel inline edit-flow.
  const beginEditTitle = () => {
    if (!sessionId) return; // alleen actieve sessies hebben een titel
    setTitleDraft(activeTitle || '');
    setEditingTitle(true);
  };
  const commitEditTitle = async () => {
    const t = titleDraft.trim();
    setEditingTitle(false);
    if (!t || !sessionId || t === activeTitle) return;
    await renameSessionTitle(sessionId, t);
  };
  const cancelEditTitle = () => {
    setEditingTitle(false);
    setTitleDraft('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  // Header-content wordt zowel in inline-mode (binnen chat-layout naast sidebar)
  // als in drawer-mode (popup) gebruikt — daarom in een variabele.
  const headerJsx = (
    <header className="chat-header">
      <div className="chat-header-inner">
        <div className="chat-header-meta">
          <div className="chat-header-title">
            {/* Mobile-only hamburger om de sidebar als overlay te openen */}
            {inline && (
              <button
                type="button"
                className="chat-header-hamburger"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open chat-geschiedenis"
                title="Geschiedenis"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <span className="chat-header-dot" aria-hidden="true" />
            <strong>Nova</strong>
            {sessionId && activeTitle ? (
              editingTitle ? (
                <input
                  ref={titleInputRef}
                  className="chat-header-title-input"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEditTitle(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEditTitle(); }
                  }}
                  onBlur={commitEditTitle}
                  maxLength={120}
                />
              ) : (
                <button
                  type="button"
                  className="chat-header-title-text"
                  onClick={beginEditTitle}
                  title="Klik om te hernoemen"
                >
                  <span className="chat-header-title-sep" aria-hidden="true">·</span>
                  <span className="chat-header-title-value">{activeTitle}</span>
                </button>
              )
            ) : (
              <span className="chat-header-subtitle">sales-assistent</span>
            )}
          </div>
        </div>
        <div className="chat-header-actions">
          {!inline && (
            <button type="button" className="chat-header-btn chat-close" onClick={onClose} aria-label="Sluiten">✕</button>
          )}
        </div>
      </div>
    </header>
  );

  const panelJsx = (
    <aside
      className={`chat-panel ${inline ? 'chat-panel--inline' : ''} ${empty ? 'chat-panel--empty' : ''} ${open ? 'open' : ''}`}
      aria-hidden={!open}
      role={inline ? 'region' : 'dialog'}
      aria-label="Nova — sales assistent"
    >
      {headerJsx}

        <div className="chat-messages" ref={listRef} onScroll={handleMessagesScroll}>
         <div className="chat-column">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div className="chat-welcome-intro">
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
                      ? <ReactMarkdown components={makeMarkdownComponents(i, (m.groundingSources || []).length)}>{processCitations(m.content)}</ReactMarkdown>
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
                  expandedSources.has(i) ? (
                    <div className="chat-sources chat-sources--expanded">
                      <button
                        type="button"
                        className="chat-sources-toggle"
                        onClick={() => toggleSourcesExpanded(i)}
                        aria-expanded="true"
                      >
                        <span className="chat-sources-label">Bronnen (Google Search) — {m.groundingSources.length}</span>
                        <span className="chat-sources-chevron" aria-hidden="true">▴</span>
                      </button>
                      <ol className="chat-sources-list">
                        {m.groundingSources.map((s, idx) => {
                          const n = s.n || (idx + 1);
                          const isHighlighted = highlightedSource && highlightedSource.messageIdx === i && highlightedSource.n === n;
                          return (
                            <li
                              key={`${s.uri}-${idx}`}
                              id={`chat-source-${i}-${n}`}
                              className={isHighlighted ? 'is-highlighted' : ''}
                            >
                              <span className="chat-sources-num">{n}</span>
                              <a href={s.uri} target="_blank" rel="noopener noreferrer" title={s.uri}>
                                {s.title || s.uri}
                              </a>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="chat-sources-chip"
                      onClick={() => toggleSourcesExpanded(i)}
                      aria-expanded="false"
                      title="Toon bronnen"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      <span>{m.groundingSources.length} bronnen</span>
                      <span className="chat-sources-chevron" aria-hidden="true">▾</span>
                    </button>
                  )
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
  );

  // Inline-mode: panel + sidebar in een chat-layout flex-row.
  // Drawer-mode: alleen het panel met overlay.
  if (inline) {
    return (
      <div
        className={
          'chat-layout'
          + (sidebarCollapsed ? ' chat-layout--sidebar-collapsed' : '')
        }
      >
        <ChatSidebar
          sessions={sessions}
          activeId={sessionId}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onToggleCollapse={toggleSidebarCollapsed}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onNewChat={startNewChat}
          onSelectSession={switchToSession}
          onDeleteSession={removeSessionById}
          onRenameSession={renameSessionTitle}
          onTogglePin={togglePinSession}
        />
        {panelJsx}
      </div>
    );
  }

  return (
    <>
      <div className={`chat-overlay ${open ? 'open' : ''}`} onClick={onClose} aria-hidden={!open} />
      {panelJsx}
    </>
  );
}


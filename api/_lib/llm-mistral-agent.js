// Mistral Agent-based chat-loop. Gebruikt jouw AI Studio Nova-agent via
// Conversations API i.p.v. de chat.completions endpoint.
//
// Wanneer schakelt deze in?
//   LLM_PROVIDER=mistral-agent + MISTRAL_AGENT_ID + MISTRAL_API_KEY
//
// Voordeel boven llm-mistral.js (chat.completions):
//   - Premium Search built-in (komt uit jouw agent-config in AI Studio)
//   - Sidestepen de "Assistant message must have content or tool_calls"
//     validatie-error van de chat.completions API
//   - Agent's eigen system-prompt — onze giant Gemini-getunede prompt
//     hoeft niet doorgegeven te worden
//
// Beperkingen (POC-scope):
//   - Geen custom function-tools (search_cases, get_topic, …) — agent
//     kan die niet uitvoeren omdat ze onze app-state nodig hebben.
//     Voor briefing-quality A/B-test is dat geen probleem (Premium Search
//     alléén is genoeg voor briefings).
//   - Multi-turn: we sturen alleen de laatste user-message als input.
//     Agent ziet geen prior assistant-replies. Voor de briefing-test
//     ("Maak een briefing over X") is dat niet beperkend; voor langere
//     gesprekken wel — vervolg-werk als POC slaagt.

import { Mistral } from '@mistralai/mistralai';

// Briefing-template: wanneer de user-message een briefing-vraag is over
// een bedrijf, vervangen we die door deze gerichte prompt. De agent's
// basis-instructies (in AI Studio Instructions-veld) gelden altijd; deze
// per-request prompt geeft de specifieke BANT-focus mee.
//
// We kunnen GEEN `instructions`-veld doorgeven aan startStream() wanneer
// 'agentId' is ingesteld — Mistral API geeft dan 400. Daarom prompt-
// engineering via de user-message i.p.v. system-instructions.
function buildBriefingPrompt(company) {
  return `Maak een diepgaande BANT-analyse voor het bedrijf "${company}" (gebruik EXACT deze spelling — niet auto-corrigeren of fonetisch wijzigen).

CREATES-CONTEXT (cruciaal — dit is de lens voor je analyse):
Creates is een Nederlandse data & analytics consultancy. We leveren:
- Data modernisatie (cloud data platforms, lakehouse, dwh)
- Data governance & data kwaliteit
- Business Intelligence & analytics
- AI/ML implementatie en toepassingen
- Training & enablement

Sales gebruikt deze briefing om een gesprek over **data, analytics, BI of AI** te starten — NIET om algemene sector-trends te bespreken.

ZOEKSTRATEGIE: Doe MINSTENS 3 verschillende Premium Search-aanroepen — één per onderwerp — zodat je per BANT-categorie genoeg materiaal hebt:

1. **Financieel & M&A** — query voorbeelden:
   - "${company} omzet jaarverslag 2024 2025"
   - "${company} investeringen overname acquisitie M&A"

2. **Authority via meerdere bronnen** (CRUCIAAL — vorige briefings misten beslissers door alleen op LinkedIn te zoeken; LinkedIn is voor crawlers grotendeels gated):
   - Combineer LinkedIn met andere bronnen — een naam in een persbericht of jaarverslag is even bruikbaar als een LinkedIn-profiel.
   - Gerichte queries (gebruik er minstens 4):
     - "${company} CEO 2025 2026" en "${company} bestuursvoorzitter"
     - "${company} directie management team site:${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.nl" (en .com variant)
     - "${company} CDO" / "${company} 'Chief Data Officer'" / "${company} 'Head of Data'"
     - "${company} CIO 'Chief Information Officer'" / "${company} CTO"
     - "${company} jaarverslag bestuur" / "${company} corporate governance"
     - "site:linkedin.com ${company} CDO" (LinkedIn als aanvulling, niet als primaire bron)
     - "${company} interview keynote" (vaak vermelden journalisten functietitels)
   - Als een naam in nieuws / persbericht / jaarverslag genoemd wordt — GEBRUIK 'M. Bevestiging via LinkedIn is mooi maar geen vereiste.
   - Vermeld in de tabel altijd de bron-context als 1 zin (bv. "Genoemd in jaarverslag 2024 als bestuursvoorzitter").

3. **Need & vacatures** — query voorbeelden:
   - "${company} vacature data engineer 2025 2026"
   - "${company} vacature 'BI developer' OR 'data analyst' OR 'AI'"
   - "${company} digitaliseringsstrategie data-platform AI roadmap"

LEVER HET ANTWOORD IN EXACT DEZE STRUCTUUR (markdown). Houd 't compleet maar zonder uitweidingen — sales wil scanbaar, niet eindeloos.

# **BANT-analyse: ${company}**
*Datum: <vandaag in NL-format>*
*Bronnen: <specifiek opnoemen wat je gebruikte, bv. jaarverslag 2024, persbericht maart 2026, vacaturepagina, nieuwsartikel FD>*

---

## **1. Budget**

### **Financiële gegevens & investeringen**
- **Eigendom**: <publiek of PE, sinds wanneer, met bedrag indien bekend>
- **Omzet**: <recent jaar of laatst beschikbare cijfer; "geen publieke info gevonden" als niets vindbaar>
- **Recente investeringen / financieringsrondes**: <max 2 bullets met bedragen, doelen, datum>
- **M&A**: <max 2 recente overnames met bedragen en data>

### **Budgetindicatie voor data/AI/analytics**
- **<Hoog/Midden/Laag>** — <1-2 zinnen onderbouwing gericht op investeringscapaciteit voor data-projecten>

---

## **2. Authority**

### **Beslissingsstructuur & sleutelfiguren**
| **Functie** | **Naam** | **Locatie** | **Relevantie voor data-gesprek** |
|---|---|---|---|
| CEO | <naam of "geen publieke info"> | <locatie of "?"> | <strategische rol, 1 zin> |
| CDO / CIO | <naam> | <locatie> | <data/IT-leiderschap> |
| Head of Data / Director Analytics | <naam of "vacature open"> | <locatie> | <data-strategie> |
| CTO | <naam> | <locatie> | <technologie/innovatie> |

### **Inzicht**
- <2 bullets max: wie sprak publiek over data/AI, vacatures als signaal voor nieuwe data-rol, of bestuurs-priorities die data raken>

---

## **3. Need**

### **Strategische data/AI-prioriteiten**
- <3 bullets max: data-platform-projecten, BI-modernisatie, AI-pilots, digitaliserings-roadmap, jaarverslag-quotes>

### **Open data/analytics/AI-vacatures**
- <max 4 bullets, alleen data/BI/AI/analytics-rollen — geen algemeen operationeel>

---

## **4. Timeline**

### **Recente mijlpalen** (afgelopen 12 maanden)
- **<Datum>**: <event — M&A / data-platform-aankondiging / CDO aangesteld>
- **<Datum>**: <event>

### **Aankomende horizon**
- **Kort termijn (Q2-Q3 2026)**: <data/AI-projecten in uitrol of planning>
- **Midden termijn (2026-2027)**: <strategische data-doelen>

---

## **Sales-fit & Gap-flag**

### **Sales-fit**
*"<concrete data/analytics/AI-openingshoek die een data-signaal uit Need/Timeline koppelt aan een specifieke Creates-dienst — modernisatie / governance / BI / AI — 1-2 zinnen>"*

### **Gap-flag**
*<1-2 zinnen: een data/AI/analytics-onderwerp waar Creates' portfolio leeg is, of een non-data-kerncompetentie van ${company} dat Creates niet raakt — eerlijk en concreet>*

REGELS:
- Bedrijfsnaam exact zoals gegeven: "${company}". Niet auto-corrigeren of fonetisch wijzigen.
- Sales-fit MOET een data/analytics/AI-haakje hebben. NIET: "hoe ziet u de uitdagingen in uw sector?" of generieke business-advies.
- Verzin geen feiten, namen of cijfers. Mis je info: schrijf "geen publieke info gevonden" voor dat onderdeel.
- Antwoord in het Nederlands.

OUTPUT-DISCIPLINE (kritiek voor sales-bruikbaarheid):
- LEVER DIRECT de volledige BANT-analyse. Vraag NIET om toestemming, NIET "wil je dat ik X of Y doe?", NIET een meta-overleg over de aanpak. Sales wil 't eindproduct in één antwoord — niet een keuze-menu.
- Doe alle nodige Premium Search-calls in één keer en lever dan 't rapport. Als je denkt nog meer info nodig te hebben, doe gewoon de extra search en lever 't rapport, geen toestemmingsvraag.
- Vermeld GEEN interne tool-namen ("web_search", "premium_search", etc.) in je output. Citaties verschijnen automatisch via tool_reference; jij hoeft daar in tekst niets over te zeggen.
- Plaats GEEN source-index-lijsten of nummering ("[0,1,2,3,...]" of "bron 47" of "[1][2][3]") in je antwoord. Citaties zijn automatisch — geen handmatige referenties nodig.
- GEEN preamble ("ik ga nu beginnen", "hier is de analyse", "op basis van mijn onderzoek...") — start direct met de markdown-header "# **BANT-analyse: ${company}**".`;
}

// Detecteer briefing-intent in de laatste user-message. Match op
// "briefing over X", "voorbereiding op X", "research over X", "BANT voor X",
// etc. Returnt de bedrijfsnaam of null.
function detectBriefingIntent(text) {
  if (!text) return null;
  const patterns = [
    /briefing\s+(?:over|voor|op)\s+(.+?)(?:[.?!]|$)/i,
    /voorbereiding\s+(?:over|voor|op)\s+(.+?)(?:[.?!]|$)/i,
    /research\s+(?:over|voor|naar)\s+(.+?)(?:[.?!]|$)/i,
    /BANT[-\s]+(?:analyse\s+)?(?:voor|over|van)\s+(.+?)(?:[.?!]|$)/i,
    /analyse\s+(?:voor|over|van)\s+(.+?)(?:[.?!]|$)/i,
    /vertel\s+(?:me\s+)?(?:iets\s+)?over\s+(?:het\s+bedrijf\s+)?(.+?)(?:[.?!]|$)/i,
    /(?:wat\s+(?:doet|weet\s+je\s+over)|info\s+over)\s+(?:het\s+bedrijf\s+)?(.+?)(?:[.?!]|$)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      const company = m[1].trim()
        .replace(/^(het bedrijf|bedrijf|de organisatie)\s+/i, '')
        .replace(/\s+(en gebruik|met behulp).*$/i, '')
        .trim();
      // Skip placeholders zoals "[bedrijfsnaam]" die nog niet vervangen zijn.
      if (/^\[.*\]$/.test(company)) return null;
      if (company.length < 2 || company.length > 80) return null;
      return company;
    }
  }
  return null;
}

// Detecteer of de vorige assistant-turn al een BANT-rapport was. Zo ja,
// blijft de gebruiker in een BANT-context en willen we follow-ups (waar
// briefing-intent niet matcht) ook in BANT-vorm zien voor consistentie.
// Flexibele match — dekt zowel `**Budget**` als `**1. Budget**` en
// `## **1. Budget**` (de nieuwe template gebruikt nummering in de
// section-headers).
function wasInBantContext(messages) {
  const prevAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  if (!prevAssistant) return false;
  const text = (prevAssistant.content || '').toString();
  const patterns = [
    /\*\*[^*]*\bBudget\b[^*]*\*\*/i,
    /\*\*[^*]*\bAuthority\b[^*]*\*\*/i,
    /\*\*[^*]*\bNeed\b[^*]*\*\*/i,
    /\*\*[^*]*\bTimeline\b[^*]*\*\*/i,
  ];
  const hits = patterns.filter(re => re.test(text)).length;
  return hits >= 3;
}

// Bouw de inputs-string die we naar de agent sturen. We includen de hele
// chat-history als rol-geprefixed conversatie zodat de agent context heeft
// over wat in vorige turns is gevraagd/geantwoord. Mistral's Conversations
// API kan ook role-based InputEntries aan, maar string is simpler en werkt
// goed voor onze use-case.
function buildInputs(messages) {
  // Filter lege berichten en bouw een platte conversatie-string.
  const lines = [];
  for (const m of messages) {
    const content = (m.content || '').toString().trim();
    if (!content) continue;
    const label = m.role === 'assistant' ? 'Nova (jij eerder)' : 'Gebruiker';
    lines.push(`${label}: ${content}`);
  }
  return lines.join('\n\n');
}

export async function runMistralAgentChat({ messages, send }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  const agentId = process.env.MISTRAL_AGENT_ID;
  if (!apiKey) {
    send({ type: 'error', value: 'MISTRAL_API_KEY ontbreekt in env.' });
    return;
  }
  if (!agentId) {
    send({ type: 'error', value: 'MISTRAL_AGENT_ID ontbreekt in env (zie AI Studio agent-detail-pagina).' });
    return;
  }

  const client = new Mistral({ apiKey });

  // Briefing-intent detectie: als de laatste user-msg een briefing-vraag is
  // (of een verduidelijking met alleen een bedrijfsnaam na een eerder
  // briefing-verzoek), vervangen we die met een gerichte BANT-prompt.
  // Resultaat: agent krijgt een duidelijke focus zonder dat we 't via
  // `instructions` hoeven door te geven (API verbiedt dat bij agentId).
  const lastUser = [...messages].reverse().find(m => m.role !== 'assistant');
  const lastUserText = (lastUser?.content || '').toString();
  let briefingCompany = detectBriefingIntent(lastUserText);

  // Als de laatste user-msg een korte naam is en de turn ervoor een
  // assistant-vraag om "welk bedrijf?", behandelen we 't als follow-up
  // op een eerder briefing-verzoek. We pakken de companynaam uit de
  // korte user-input en sturen een fresh BANT-prompt.
  if (!briefingCompany && messages.length >= 2) {
    const prevAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    const prevAssistantText = (prevAssistant?.content || '').toString().toLowerCase();
    const askedForCompany = /welk(\s+\w+)?\s+bedrijf|bedrijfsnaam|over welk/.test(prevAssistantText);
    if (askedForCompany && lastUserText && lastUserText.trim().length < 80 && lastUserText.trim().length >= 2) {
      const candidate = lastUserText.trim().replace(/^[^\w]+|[^\w\s.&-]+$/g, '');
      if (candidate.length >= 2) briefingCompany = candidate;
    }
  }

  // Bouw de inputs-string in 1 van 3 modi:
  //   1. Briefing-intent gedetecteerd → fresh BANT-template met bedrijfsnaam
  //   2. Geen briefing-intent maar vorige turn was BANT → multi-turn
  //      conversation + BANT-context-cue (zodat follow-ups in BANT blijven)
  //   3. Anders → gewone multi-turn conversation
  const inBantContext = !briefingCompany && wasInBantContext(messages);
  let inputs;
  let mode;
  if (briefingCompany) {
    inputs = buildBriefingPrompt(briefingCompany);
    mode = 'fresh-briefing';
  } else if (inBantContext) {
    // Wrap de conversation met een korte cue zodat de agent BANT-format
    // behoudt op follow-up vragen (concurrenten, deeper-dive op één
    // BANT-letter, etc.). Voorkomt format-drift over multi-turn.
    inputs = `[CONTEXT: De vorige reactie was een BANT-analyse over een prospect. Behoud de BANT-structuur (Budget / Authority / Need / Timeline) ook in je antwoord op deze vervolg-vraag — strucureer je response onder de relevante BANT-letter(s) of expand de bestaande BANT-output. Antwoord altijd in het Nederlands.]\n\n${buildInputs(messages)}`;
    mode = 'bant-followup';
  } else {
    inputs = buildInputs(messages);
    mode = 'free-form';
  }

  console.log('[Mistral-Agent] start:', {
    agentId,
    mode,
    messageCount: messages.length,
    briefingCompany: briefingCompany || '(geen briefing-intent gedetecteerd)',
    inBantContext,
    inputsLength: inputs.length,
    inputsPreview: inputs.slice(0, 200),
  });

  // Verzamel sources uit tool_reference-chunks zodat we ze als grounding-
  // event aan 't eind kunnen sturen (zelfde patroon als Gemini-pad).
  const sources = []; // [{uri, title, description?}]
  const seenUrls = new Set();
  let sawText = false;
  let sawPremiumSearch = false;

  let stream;
  try {
    stream = await client.beta.conversations.startStream({
      agentId,
      inputs,
      // GEEN `instructions`-veld: Mistral API geeft 400 zodra agentId is
      // ingesteld ("Conversation with an 'agent' can't contain instructions").
      // De agent's eigen Instructions-veld in AI Studio is leidend; per-
      // request prompt-engineering doen we via de inputs-string.
      store: false,
    });
  } catch (apiErr) {
    console.error('[Mistral-Agent] startStream API-fout:', apiErr?.message || apiErr, apiErr?.body || '');
    send({ type: 'error', value: `Mistral Agent API-fout: ${apiErr?.message || 'onbekend'}` });
    return;
  }

  try {
    for await (const event of stream) {
      const data = event?.data;
      if (!data || !data.type) continue;

      switch (data.type) {
        case 'message.output.delta': {
          const c = data.content;
          if (typeof c === 'string') {
            sawText = true;
            send({ type: 'text', value: c });
          } else if (c && typeof c === 'object') {
            if (c.type === 'text' && typeof c.text === 'string') {
              sawText = true;
              send({ type: 'text', value: c.text });
            } else if (c.type === 'tool_reference' && c.url && !seenUrls.has(c.url)) {
              seenUrls.add(c.url);
              sources.push({
                uri: c.url,
                title: c.title || c.url,
                description: c.description || null,
              });
            }
            // Andere chunk-types (think, image, document) negeren we voor de POC.
          }
          break;
        }
        case 'tool.execution.started':
        case 'tool.execution.delta':
        case 'tool.execution.done': {
          // Premium Search heeft gedraaid — laat ChatPanel zien dat er een
          // tool actief was via het tool-event. Naam normaliseren naar
          // 'search_web' zodat de bestaande TOOL_LABELS-mapping de chip
          // renderet als "Web".
          if (data.type === 'tool.execution.started' && !sawPremiumSearch) {
            sawPremiumSearch = true;
            send({ type: 'tool', value: ['search_web'] });
          }
          break;
        }
        case 'response.error': {
          console.error('[Mistral-Agent] response.error:', data);
          send({ type: 'error', value: `Agent-fout: ${data.message || 'onbekend'}` });
          return;
        }
        case 'response.done': {
          // Stream eindigt verderop; deze event is informatief (usage etc.).
          console.log('[Mistral-Agent] response.done — sawText:', sawText, 'sources:', sources.length);
          break;
        }
        // response.started, agent_handoff_*, function.call → niet relevant voor onze use-case
        default:
          break;
      }
    }
  } catch (streamErr) {
    console.error('[Mistral-Agent] stream-iteratie fout:', streamErr?.message || streamErr);
    if (!sawText) {
      send({ type: 'error', value: `Stream-fout: ${streamErr?.message || 'onbekend'}` });
      return;
    }
  }

  if (!sawText) {
    send({ type: 'text', value: 'Agent heeft geen antwoord teruggegeven. Probeer een specifiekere vraag.' });
  }

  // Stuur sources als één grounding-event zoals het Gemini-pad doet.
  // ChatPanel rendert ze dan als "Bronnen (Premium Search)"-blok.
  if (sources.length > 0) {
    send({
      type: 'grounding',
      value: {
        sources: sources.map((s, i) => ({ n: i + 1, uri: s.uri, title: s.title })),
        queries: [], // Premium Search exposed geen queries terug
      },
    });
  }

  send({ type: 'done' });
}

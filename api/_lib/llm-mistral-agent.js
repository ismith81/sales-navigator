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

FORMAT-EISEN (STRICT — niet afwijken, niet "verbeteren", niet samenvatten):
- ELKE hoofd-sectie begint met EXACT \`## **N. <Naam>**\` (met markdown header level 2).
- ELKE hoofd-sectie heeft één of meer sub-sections met EXACT \`### **<Sub-naam>**\` (header level 3).
- Sectie 2 (Authority) MUST een markdown-tabel zijn met kolommen Functie/Naam/Locatie/Relevantie. NIET bullet-list.
- Bullets gebruiken \`- **<Key>**: <waarde>\` syntax — sleutel altijd bold.
- Tussen secties: \`---\` separator.
- Na sectie 4 (Timeline) volgt EXACT één afsluitende sectie: \`## **Bronnen**\` met daaronder een markdown-bullet-list van geraadpleegde Premium Search-bronnen — formaat per bullet: \`- [Korte titel of bron-naam](https://volledige-url)\`. **MINSTENS 5 unieke bronnen** vermelden — vermeld ALLE Premium Search-resultaten die je hebt geraadpleegd om de BANT in te vullen, niet alleen de meest prominente. Een briefing met slechts 1-2 bronnen suggereert oppervlakkig onderzoek en is onbruikbaar voor sales. Liever 8 relevante bronnen dan 2 perfecte. Geen aanvullende secties ("Mogelijk gemist", "Vervolgvragen voor sales", "Aanbevelingen", reflecties etc.) — die kappen de output af door 't max_tokens-budget te overschrijden.

OUTPUT-CAPS (om binnen 4096 tokens te passen):
- Authority-tabel: max 4 rijen (kies de meest relevante data-rollen).
- Inzicht onder Authority: max 2 bullets.
- Strategische data/AI-prioriteiten: max 3 bullets.
- Open data/analytics/AI-vacatures: max 4 bullets.
- Recente mijlpalen: max 3 bullets.
- Sub-section bullet-lengtes: 1 zin per bullet, geen multi-paragraph uitweidingen.

VOORBEELD (referentie-output voor een fictief bedrijf "TestCorp" — kopieer dit format exact, vul met echte data over ${company}):

# **BANT-analyse: TestCorp**
*Datum: 27 april 2026*
*Bronnen: jaarverslag 2024, persbericht maart 2026, vacaturepagina*

---

## **1. Budget**

### **Financiële gegevens & investeringen**
- **Eigendom**: Beursgenoteerd op Euronext Amsterdam sinds 2010
- **Omzet**: €450 miljoen in 2023 (jaarverslag 2024)
- **Recente investeringen / financieringsrondes**:
  - €30 miljoen kapitaalinjectie voor cloud-migratie (Q1 2025)
  - €15 miljoen voor AI-pilots (Q3 2025)
- **M&A**:
  - Overname DataAnalytics BV (juni 2025, ca. €40 miljoen)

### **Budgetindicatie voor data/AI/analytics**
- **Hoog** — Recente kapitaalinjecties en M&A in data/AI-domein onderstrepen beschikbaarheid van budget voor digitale transformatie.

---

## **2. Authority**

### **Beslissingsstructuur & sleutelfiguren**
| **Functie** | **Naam** | **Locatie** | **Relevantie voor data-gesprek** |
|---|---|---|---|
| CEO | Jan de Vries | Amsterdam | Strategisch leider, sprak in 2025 over data-gedreven groei |
| CDO | Maria Jansen | Amsterdam | Verantwoordelijk voor data-strategie en AI-roadmap |
| Head of Data | Vacature open | Utrecht | Leidt data-platform-modernisatie |
| CTO | Geen publieke info | ? | – |

### **Inzicht**
- Maria Jansen (CDO) noemde Microsoft Fabric in een keynote (mei 2025).
- Open Head of Data-vacature is signaal dat data-team uitbreidt.

---

## **3. Need**

### **Strategische data/AI-prioriteiten**
- Cloud-migratie naar Microsoft Fabric (aangekondigd Q1 2025)
- Implementatie van real-time analytics voor klantsegmentatie
- AI-pilots voor predictive maintenance

### **Open data/analytics/AI-vacatures**
- Data Engineer (Utrecht, april 2026)
- BI Developer (Amsterdam, maart 2026)
- AI/ML Specialist (Amsterdam, april 2026)

---

## **4. Timeline**

### **Recente mijlpalen** (afgelopen 12 maanden)
- **Maart 2026**: Persbericht over partnership met cloud-provider voor data-platform
- **Juni 2025**: Overname DataAnalytics BV afgerond

### **Aankomende horizon**
- **Kort termijn (Q2-Q3 2026)**: Live-gang nieuwe data-platform
- **Midden termijn (2026-2027)**: Volledige migratie legacy-systemen

NU HETZELFDE FORMAT, MET ECHTE DATA OVER "${company}":

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
- Eindig MET een aparte \`## **Bronnen**\`-sectie als beschreven in FORMAT-EISEN: markdown-bullet-list van \`- [Korte titel](https://volledige-url)\`-paren voor elke geraadpleegde Premium Search-bron. De UI parsed deze sectie server-side en rendert 'm als klikbare bronnen-pill onder je antwoord — schrijf 'm dus expliciet, niet weglaten.
- GEEN preamble ("ik ga nu beginnen", "hier is de analyse", "op basis van mijn onderzoek...") — start direct met de markdown-header "# **BANT-analyse: ${company}**".`;
}

// Detecteer briefing-intent in de laatste user-message. Match op
// "briefing over X", "voorbereiding op X", "research over X", "BANT voor X",
// "research X" (zonder voorzetsel), etc. Returnt de bedrijfsnaam of null.
//
// Volgorde-regel: prepositional patterns staan boven de bare fallback zodat
// "research over Bol.com" niet als bare match "over Bol.com" oppikt.
function detectBriefingIntent(text) {
  if (!text) return null;
  const patterns = [
    // Met voorzetsel — meest specifiek eerst.
    /briefing\s+(?:over|voor|op)\s+(.+?)(?:[.?!]|$)/i,
    /voorbereiding\s+(?:over|voor|op)\s+(.+?)(?:[.?!]|$)/i,
    /research\s+(?:over|voor|naar|op)\s+(.+?)(?:[.?!]|$)/i,
    /BANT[-\s]+(?:analyse\s+)?(?:voor|over|van)\s+(.+?)(?:[.?!]|$)/i,
    /analyse\s+(?:voor|over|van)\s+(.+?)(?:[.?!]|$)/i,
    /vertel\s+(?:me\s+)?(?:iets\s+)?over\s+(?:het\s+bedrijf\s+)?(.+?)(?:[.?!]|$)/i,
    /(?:wat\s+(?:doet|weet\s+je\s+over)|info\s+over)\s+(?:het\s+bedrijf\s+)?(.+?)(?:[.?!]|$)/i,
    // Bare fallback — "research Bol.com", "briefing Coolblue", "BANT Tulp".
    // Werkt alleen als de input begint met of een spatie heeft vóór 't keyword
    // (woordgrens), zodat we "biografisch onderzoek" niet als briefing-intent
    // oppakken.
    /(?:^|\s)(?:briefing|voorbereiding|research|BANT)\s+(.+?)(?:[.?!]|$)/i,
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
  //   2. Geen briefing-intent maar vorige turn was BANT → plain conversation
  //      (cue weggehaald — sturing komt uit AI Studio Instructions)
  //   3. Anders → gewone multi-turn conversation
  // Modi 2 en 3 sturen dezelfde inputs; 'mode'-label blijft alleen voor
  // diagnostiek in logs.
  const inBantContext = !briefingCompany && wasInBantContext(messages);
  let inputs;
  let mode;
  if (briefingCompany) {
    inputs = buildBriefingPrompt(briefingCompany);
    mode = 'fresh-briefing';
  } else {
    inputs = buildInputs(messages);
    mode = inBantContext ? 'bant-followup' : 'free-form';
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
      // GEEN `instructions`- of `completion_args`-veld: Mistral API geeft 400
      // zodra agentId is ingesteld ("Conversation with an 'agent' can't
      // contain the following fields ..."). De SDK accepteert deze velden
      // wél via TypeScript-types, maar de server weigert ze. De agent's
      // eigen config in AI Studio is leidend; per-request prompt-engineering
      // doen we via de inputs-string.
      store: false,
    });
  } catch (apiErr) {
    console.error('[Mistral-Agent] startStream API-fout:', apiErr?.message || apiErr, apiErr?.body || '');
    send({ type: 'error', value: `Mistral Agent API-fout: ${apiErr?.message || 'onbekend'}` });
    return;
  }

  // Strip de internal source-index-markers ([[16]], [3], etc.) die 't model
  // soms toch in de text-output stopt ondanks onze prompt-regel daartegen.
  // Onze sources-blok onderaan komt uit tool_reference chunks, niet uit
  // deze inline-nummers — dus de [N]-markers zijn alleen ruis.
  const stripCitationMarkers = (text) => {
    if (!text) return text;
    return text
      // [[16]] / [[16, 10]] / [[ 16 , 10 ]]
      .replace(/\[\[\s*\d+(?:\s*,\s*\d+)*\s*\]\]/g, '')
      // [16] / [16, 10] (niet markdown-links [n](url))
      .replace(/\[\s*\d+(?:\s*,\s*\d+)*\s*\](?!\()/g, '')
      // dubbele spaties opruimen die kunnen ontstaan na strippen
      .replace(/[ \t]{2,}/g, ' ')
      // restanten van punten/komma's na lege strip ("zin .,") naar simpele "zin."
      .replace(/\s+([.,;:])/g, '$1');
  };

  // Streaming-stripper voor de "Bronnen:"-sectie die het model soms tóch
  // onderaan z'n antwoord plakt — ondanks de prompt-regel daartegen. De UI
  // toont al een eigen bronnen-blok (uit tool_reference chunks via de
  // grounding-event), dus zo'n inline-lijst is dubbel-werk.
  //
  // Aanpak: tail-buffer van 80 chars zodat triggers die op een chunk-grens
  // vallen (bv. "\n**Bron" / "nen:**") alsnog in 1 stuk geanalyseerd worden.
  // Zodra een trigger matcht: emit alles ervóór, drop alles erna, stop met
  // verder tekst sturen voor deze response.
  const SOURCES_SECTION_RE = /(?:^|\n)[ \t]*(?:#{1,4}[ \t]+)?\*{0,2}[ \t]*(?:Bronnen|Sources|Referenties|Bronvermelding)[ \t]*\*{0,2}[ \t]*:?[ \t]*\*{0,2}[ \t]*\n/i;
  const TAIL_KEEP = 80;
  let textTail = '';
  let textStopped = false;
  // Bufferen i.p.v. droppen: als aan 't eind van de stream sources.length===0
  // (Mistral stuurde geen tool_reference chunks), flushen we de gestripte
  // sectie alsnog. Anders blijft de user met niets zitten — slechter dan een
  // dubbele weergave.
  let strippedSection = '';

  const streamText = (chunk) => {
    if (!chunk) return;
    if (textStopped) {
      strippedSection += chunk;
      return;
    }
    sawText = true;
    const combined = textTail + chunk;
    const m = SOURCES_SECTION_RE.exec(combined);
    if (m) {
      const cutAt = m.index;
      const safeChunk = combined.slice(0, cutAt);
      if (safeChunk.length > 0) {
        send({ type: 'text', value: stripCitationMarkers(safeChunk) });
      }
      strippedSection = combined.slice(cutAt);
      textStopped = true;
      textTail = '';
      console.log('[Mistral-Agent] Bronnen-sectie gedetecteerd in stream → buffered (sources.length zo ver:', sources.length, ')');
      return;
    }
    if (combined.length > TAIL_KEEP) {
      const toEmit = combined.slice(0, combined.length - TAIL_KEEP);
      textTail = combined.slice(combined.length - TAIL_KEEP);
      send({ type: 'text', value: stripCitationMarkers(toEmit) });
    } else {
      textTail = combined;
    }
  };

  const flushTextTail = () => {
    if (!textStopped && textTail) {
      send({ type: 'text', value: stripCitationMarkers(textTail) });
      textTail = '';
    }
  };

  // Aan 't eind van de stream beslissen we wat met de gebufferde Bronnen-
  // sectie te doen. Twee paden:
  // 1. Er kwamen al tool_reference-sources binnen via chunks → drop de
  //    gebufferde sectie (chunks zijn authoritatief).
  // 2. Geen tool_reference-sources → parse de gebufferde Bronnen-sectie
  //    naar URL+title-paren en push naar de sources-array. De grounding-
  //    event-emit aan 't einde van de handler doet de rest, zodat de UI
  //    altijd dezelfde uitklap-pill krijgt — nooit een inline bullet-list.
  const parseSourcesFromMarkdown = (text) => {
    if (!text) return [];
    const out = [];
    const seenUris = new Set();
    // Pattern 1: markdown-link `[Title](url)` — meest gebruikt.
    const mdLinkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let m;
    while ((m = mdLinkRe.exec(text)) !== null) {
      const title = m[1].trim();
      const uri = m[2].trim();
      if (uri && !seenUris.has(uri)) {
        seenUris.add(uri);
        out.push({ uri, title: title || uri });
      }
    }
    // Pattern 2: kale URL's die niet al via mdLinkRe gevangen zijn (bv.
    // "- https://...", of "- Titel — https://..."). Dedupe op uri.
    const bareUrlRe = /(?:^|[\s\(])(https?:\/\/[^\s)<>]+)/g;
    while ((m = bareUrlRe.exec(text)) !== null) {
      const uri = m[1].replace(/[.,;:]+$/, ''); // trailing punctuatie weg
      if (uri && !seenUris.has(uri)) {
        seenUris.add(uri);
        out.push({ uri, title: uri });
      }
    }
    return out;
  };

  const finalizeStrippedSection = () => {
    if (!textStopped || !strippedSection) return;
    if (sources.length > 0) {
      console.log('[Mistral-Agent] Bronnen-sectie definitief gedropt — chunks-sources zijn authoritatief (n=' + sources.length + ')');
      strippedSection = '';
      return;
    }
    const parsed = parseSourcesFromMarkdown(strippedSection);
    if (parsed.length > 0) {
      console.log('[Mistral-Agent] Bronnen-sectie geparsed naar ' + parsed.length + ' URL+title paren — wordt grounding-event');
      for (const p of parsed) {
        if (!seenUrls.has(p.uri)) {
          seenUrls.add(p.uri);
          sources.push(p);
        }
      }
    } else {
      console.log('[Mistral-Agent] Bronnen-sectie buffered (' + strippedSection.length + ' chars) maar geen URL\'s te extracten — sectie wordt gedropt');
    }
    strippedSection = '';
  };

  let unknownChunkLogCount = 0;
  // Diagnostiek: tel events per type + chunks per type (binnen
  // message.output.delta) zodat we kunnen zien waarom sources leeg
  // blijven. Wordt aan 't eind van de stream gelogd.
  const eventTypeCounts = {};
  const chunkTypeCounts = {};
  // Counter voor 't loggen van eerste tool.execution.delta/done-payloads
  // (cap op 2 elk, anders dump je 11x dezelfde payload-shape in de log).
  const toolEventLogged = {};
  try {
    for await (const event of stream) {
      const data = event?.data;
      if (!data || !data.type) continue;
      eventTypeCounts[data.type] = (eventTypeCounts[data.type] || 0) + 1;

      switch (data.type) {
        case 'message.output.delta': {
          const c = data.content;
          if (typeof c === 'string') {
            chunkTypeCounts['<string>'] = (chunkTypeCounts['<string>'] || 0) + 1;
            streamText(c);
          } else if (c && typeof c === 'object') {
            const ctype = c.type || '<no-type>';
            chunkTypeCounts[ctype] = (chunkTypeCounts[ctype] || 0) + 1;
            if (c.type === 'text' && typeof c.text === 'string') {
              streamText(c.text);
            } else if (c.type === 'tool_reference') {
              // Log de eerste 5 tool_reference chunks volledig zodat we
              // hun exacte velden zien (URL? title? andere props?). Helpt
              // om te debuggen waarom sources soms leeg zijn.
              if (sources.length < 5) {
                console.log('[Mistral-Agent] tool_reference chunk:', JSON.stringify(c));
              }
              // Versoepeld: niet alle tool_reference chunks hebben een url
              // (sommige hebben alleen title). Liever een title-only source
              // tonen dan helemaal niks. Dedupe op url als die er is, anders
              // op title.
              const dedupeKey = c.url || c.title;
              if (dedupeKey && !seenUrls.has(dedupeKey)) {
                seenUrls.add(dedupeKey);
                sources.push({
                  uri: c.url || '',
                  title: c.title || c.url || '(geen titel)',
                  description: c.description || null,
                });
              }
            } else if ((c.type === 'document_url' || c.type === 'image_url') && c.url && !seenUrls.has(c.url)) {
              seenUrls.add(c.url);
              sources.push({
                uri: c.url,
                title: c.title || c.documentName || c.url,
                description: null,
              });
            } else if (c.type === 'thinking') {
              // Mistral's internal reasoning chunks — niet door naar UI sturen.
              // Stilletjes negeren zodat unknownChunkLogCount niet vol loopt
              // met thinking-ruis (die kan tientallen chunks per response zijn).
            } else if (unknownChunkLogCount < 5) {
              unknownChunkLogCount++;
              console.log('[Mistral-Agent] onbekend chunk-type:', ctype, JSON.stringify(c).slice(0, 300));
            }
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
            console.log('[Mistral-Agent] tool.execution.started — Premium Search gestart');
            send({ type: 'tool', value: ['search_web'] });
          }
          // Diagnostiek: log de eerste 2 .delta- en .done-payloads volledig
          // zodat we Mistral's agent-mode source-shape kunnen identificeren.
          // In agent-mode komen tool_reference chunks NIET in message.output.delta
          // (zoals in de niet-agent variant) — de Premium Search-resultaten
          // moeten ergens hier zitten. Cap op 2 om Vercel-log-buffer te sparen.
          if ((data.type === 'tool.execution.delta' || data.type === 'tool.execution.done')) {
            const counter = data.type === 'tool.execution.delta' ? 'deltaLogged' : 'doneLogged';
            toolEventLogged[counter] = (toolEventLogged[counter] || 0) + 1;
            if (toolEventLogged[counter] <= 2) {
              const truncated = JSON.stringify(data).slice(0, 1500);
              console.log(`[Mistral-Agent] ${data.type} #${toolEventLogged[counter]} payload:`, truncated);
            }
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
          console.log('[Mistral-Agent] event-counts:', eventTypeCounts);
          console.log('[Mistral-Agent] chunk-counts (binnen message.output.delta):', chunkTypeCounts);
          if (sources.length > 0) {
            console.log('[Mistral-Agent] sources sample:',
              sources.slice(0, 3).map(s => ({ title: s.title, uri: s.uri ? s.uri.slice(0, 60) : '(no-url)' }))
            );
          }
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

  // Post-loop summary — fired ALTIJD na stream-end (in tegenstelling tot
  // de response.done-handler die alleen draait als Mistral dat event
  // expliciet stuurt). Geeft 't volledige diagnostische beeld zelfs als
  // de Vercel-logs de response.done-block hebben afgekapt.
  console.log('[Mistral-Agent] stream ended — sawText:', sawText,
    '· sources:', sources.length,
    '· textStopped:', textStopped,
    '· strippedSection-len:', strippedSection.length,
    '· sawPremiumSearch:', sawPremiumSearch);
  console.log('[Mistral-Agent] event-counts (final):', eventTypeCounts);
  console.log('[Mistral-Agent] chunk-counts (final, binnen message.output.delta):', chunkTypeCounts);

  // Flush de tail-buffer (laatste 80 chars die we vasthielden om een trigger
  // op chunk-grens te kunnen detecteren). Geen-op als textStopped al getriggerd
  // werd door een Bronnen-sectie-detectie.
  flushTextTail();

  // Beslis wat te doen met een eventueel gebufferde Bronnen-sectie: dropt als
  // er tool_reference-sources zijn (chip toont 'm), flush als fallback anders.
  finalizeStrippedSection();

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

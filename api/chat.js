// Vercel Serverless Function — streaming chat endpoint voor de Sales Navigator assistent.
// Gebruikt Google Gemini 2.5 Flash + function calling tegen Supabase + Google Search grounding.
//
// Env vars (Vercel + .env.local):
//   GEMINI_API_KEY       — aistudio.google.com
//   SUPABASE_URL         — zelfde waarde als VITE_SUPABASE_URL
//   SUPABASE_ANON_KEY    — zelfde waarde als VITE_SUPABASE_ANON_KEY (read-only, geen RLS-issue)

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_lib/auth.js';

const SYSTEM_PROMPT = `Je bent Nova, de sales-assistent voor Creates — een data & analytics consultancy.
Je helpt de gebruiker (sales) om zich voor te bereiden op klantgesprekken en erin te sparren.
Je bent géén bibliothecaris die cases opsomt — je bent een sparring-partner die meedenkt, synthetiseert en het gesprek scherper maakt.

CONTEXT OVER HET AANBOD:
- 2 Doelen: "Meer waarde halen uit data", "Data als business model"
- 4 Behoeften: "Veilig en betrouwbaar", "Wendbaar", "AI ready", "Realtime data"
- 4 Diensten: "Data modernisatie", "Governance", "Data kwaliteit", "Training"
Doelen → vertalen in behoeften → worden ingevuld door diensten.

Daarnaast zijn cases gekoppeld aan persona's (rollen waarmee sales in gesprek gaat) én aan een of meer branches (sectoren, bv. Financial services, Onderwijs, Retail). Gebruik die koppelingen om advies écht op de rol én sector te richten — niet generiek. Als de gebruiker een branche noemt, filter er ook op via \`search_cases\` met de \`branche\`-parameter.

WAT JE KUNT DOEN (bied dit proactief aan als de vraag er om vraagt):
- **Voorbereiding**: maak een mini-belscript-draaiboek (opening → discovery-vragen → relevante case → bezwaren → afsluiting).
- **Synthese**: combineer een case + persona → concrete openingszin of pitch op maat voor dít gesprek.
- **Rollenspel**: speel een persona (CFO, IT-manager, CDO, …) en stel kritische vragen zodat sales kan oefenen. Blijf in karakter tot de gebruiker "stop" of "uit rol" zegt. Val aan op zwakke plekken; ben niet te aardig.
- **Checklist/review**: toets een pitch of mail van de gebruiker tegen de talking points en follow-ups — benoem wat ontbreekt.
- **Vergelijken**: zet meerdere cases naast elkaar (bijv. per doel of per sector) met korte duiding waar ze verschillen.
- **Follow-up mail**: zet ruwe gespreksnotities om in een kort follow-up mailconcept in Creates-toon, met duidelijke samenvatting en volgende stap.
- **Actielijst uit notities**: haal uit ruwe notes een concrete wie-doet-wat-wanneer lijst. Gebruik een markdown-checklist en benoem open punten expliciet.
- **Prospect-briefing (vast 7-bucket raamwerk)**: telkens als de gebruiker om een briefing/voorbereiding/research over een bedrijf vraagt, werk je in deze vaste volgorde:
  1. Roep \`prospect_brief({company})\` aan — dat doet intern 3 parallelle web-zoekopdrachten en levert al het materiaal.
  2. Roep daarna \`search_cases({branche})\` op de branche die je in cluster 1 oppikte — om case-fit te checken (niet om er per se eentje aan te plakken).
  3. Synthetiseer naar exact dit format (markdown, met **vetgedrukte** kopjes voor de 7 categorieën zodat de UI ze duidelijk zet):

  \`\`\`
  ## Briefing — <Bedrijfsnaam>

  **1. Bedrijfssnapshot**
  - Sector / branche: <waarde>
  - Omvang: <FTE / omzet>
  - HQ + structuur: <locatie, moeder/dochters>
  - Kerntaken: <2–3 zinnen>

  **2. Strategische prioriteiten**
  Wat zegt het bedrijf publiekelijk te willen (1–3 jaar) — uit jaarverslag, keynotes, persberichten.

  **3. Data-volwassenheid**
  Huidige stack + grove Gartner DMM-stage (1=Basic, 2=Opportunistic, 3=Systematic, 4=Differentiating, 5=Transformational). Onderbouw de stage in 1 zin.

  **4. AI-initiatieven**
  Concrete projecten / aankondigingen 2024–2025 met kort bron-haakje.

  **5. Team & sourcing-houding**
  CDO/Head of Data (naam indien gevonden), teamomvang, vacature-signalen, historiek met externe partners — concluderend: open of gesloten cultuur t.o.v. consultancy?

  **6. Concurrentiepositie**
  Top 2–3 concurrenten, marktaandeel-signaal, druk-indicatoren (waarom moeten ze nú bewegen?).

  **7. Buying signals & budget-indicatoren**
  Recente investeringen / M&A / tenders / financiële kerngetallen → ruwe budget-band (bv. "100k–500k", "1M+", "onbekend").

  ---
  **BANT-samenvatting** (sales-qualification)
  - **B**: <budget-band uit cat 1+7>
  - **A**: <wie beslist, uit cat 5>
  - **N**: <kern-need uit cat 2+3+4>
  - **T**: <timing uit cat 2+4>

  **Sales-fit (regel)** — Nova's voorgestelde openingshoek voor dit gesprek.

  **Gap-flag** — wat Creates' portfolio écht niet kan dekken (zwakke of ontbrekende bewijsstukken t.o.v. wat dit bedrijf nodig heeft). Benoem concreet, zo nuttig als een sterkte.
  \`\`\`

  **Regels voor de inhoud:**
  - Baseer alle feiten alléén op tool-output (\`prospect_brief\`-clusters + \`search_cases\`); verzin geen cijfers, namen of strategieën.
  - Mis je voor een categorie data, schrijf "geen publieke info gevonden" — niet bluffen.
  - **Sales-fit** mag pitch-toon hebben; **Gap-flag** moet eerlijk en concreet zijn (geen verkooppraatje verpakt als gat).
  - Wanneer je een Creates-case noemt: bedrijfsnaam **vet** zodat de UI er een link van maakt.

- **Follow-up op een briefing**: na een briefing zijn vervolgvragen standaard over hetzelfde prospect — gebruik \`search_web\` (niet \`prospect_brief\`, dat is voor de eerste pass) met een gerichte query, bv. "<bedrijf> CDO 2025" of "<bedrijf> data-strategie persbericht". Switch alléén naar \`search_cases\` als de gebruiker letterlijk om "een case", "referentie" of "voorbeeld uit jullie portfolio" vraagt.

- **Gap-analyse (kritisch op eigen portfolio)**: als de gebruiker apart vraagt om een kritische blik op Creates zelf ("waar hebben we gaten?", "wat zouden we moeten ontwikkelen?", "waar zijn we zwak tegenover deze prospect?"), werk je zo:
  1. \`search_cases({})\` zonder filters — zodat je het volledige huidige portfolio ziet.
  2. \`list_personas()\` — om te checken welke rollen wel/niet expliciet bediend worden.
  3. Vergelijk expliciet met de prospect-context uit de briefing. 3–5 punten, per punt: prospect-behoefte → Creates wel/niet → concrete ontwikkelkans. Eindig met één aanbeveling welk gat 't eerst verdient. Dit is breder dan de Gap-flag in de briefing — meer diepgang en scope.

- **Follow-up op een briefing**: wanneer de vorige turn een briefing was over een specifiek prospect-bedrijf, gaat elke vervolgvraag **standaard ook over dát bedrijf** — tenzij de gebruiker expliciet iets anders aangeeft. Bij vragen als "kan je iets vinden over hun dataplatform?", "wie is hun CDO?", "wat doen ze met AI?" → dit is géén vraag om een Creates-case, maar om méér publieke info over het prospect. Doe onmiddellijk een nieuwe \`search_web({query: "<prospectnaam> <angle>"})\` en presenteer het resultaat met bronnen. Switch alléén naar \`search_cases\` als de gebruiker letterlijk vraagt om "een case", "referentie", "voorbeeld uit jullie portfolio" o.i.d.

WERKWIJZE:
1. **Begrijp** eerst wat de gebruiker écht nodig heeft. Als de vraag ambigu is (bijv. "maak een belscript"), vraag één gerichte vervolgvraag: welke klant/sector, welke rol, welk doel.
2. **Haal op** met je tools — doe gerust *meerdere* tool-calls na elkaar als dat nodig is. Bijvoorbeeld: eerst \`list_personas\` om de juiste persona te vinden, dan \`search_cases\` met \`persona\` als filter (zodat je alléén cases krijgt die expliciet aan die rol zijn gekoppeld), dan \`get_topic\` voor de talking points. Verzamel alle bouwstenen vóór je het antwoord schrijft.
   - Let op: \`search_cases\` geeft bij een persona-filter ook \`persona_match_reasons\` terug — gebruik die expliciet in je antwoord ("**CITO** past bij een CFO omdat: [reden uit de data]").
   - Bij follow-up mails en actielijsten uit gespreksnotities: scan de notes altijd actief op persona, branche, doel, behoefte, dienst, klantvraag en case-haakjes. Als je ook maar één plausibel haakje ziet, moet je eerst relevante tools gebruiken (\`list_personas\`, \`get_topic\`, \`search_cases\`) vóór je schrijft. Alleen als de notes echt géén enkel bruikbaar haakje bevatten, mag je zonder tool-call een generieke versie maken.
3. **Synthetiseer** — vat niet samen wat de tools terugstuurden, maar *gebruik* het om een antwoord op maat te maken. Koppel altijd expliciet: "voor [persona] is [case] sterk omdat [reden uit de data]".

BIJ GESPREKSNOTITIES:
- Behandel ruwe notes niet als losse tekstredactie, maar als sales-context die je mag verrijken met feiten uit de tools.
- Voor follow-up mails geldt: probeer eerst altijd te achterhalen of er herkenbare Creates-context in de notes zit. Denk aan een rol (CFO, CDO, IT-manager), een sector, een dienst, een behoefte, een concreet probleem of een case-achtig voorbeeld. Als dat er is, moet je eerst tool-context ophalen voordat je de mail schrijft.
- Voeg alleen een case, talking point of persona-haakje toe als je dat eerst via een tool hebt onderbouwd.
- Voor een follow-up mail: houd de mail kort en bruikbaar. Structuur standaard als: onderwerpregel, korte bedank/opening, samenvatting van wat besproken is, afgesproken vervolgstap, afsluiting.
- Als je tool-context hebt gevonden voor een follow-up mail, laat die dan ook echt terugkomen in het resultaat: subtiel in de formulering of als een korte slotregel / apart blokje "Relevant haakje". Laat die kans niet liggen en val niet terug op een volledig generieke mail.
- Voor een actielijst: gebruik een markdown-checklist. Zet per punt zo concreet mogelijk eigenaar en actie. Als een deadline ontbreekt, benoem dat als open punt in plaats van te gokken.
- Als de notes te dun zijn voor inhoudelijke verrijking, lever dan een strakke generieke versie op en zeg kort welke context ontbrak.

REGELS:
- Altijd in het Nederlands.
- Bondig en zakelijk, geen marketingpraat.
- Noem jezelf Nova alleen als iemand vraagt wie je bent.
- Gebruik je tools om échte cases, talking points en persona-coaching op te halen — verzin nooit cases, cijfers of klantnamen.
- Als de gebruiker ruwe notities plakt: structureer en herschrijf ze, maar verzin geen besluiten, acties, deadlines of toezeggingen die niet uit de input of tool-data volgen. Markeer ontbrekende info expliciet als open punt.
- Voor follow-up mails is "goede generieke mail" niet genoeg als de notes herkenbare haakjes bevatten. Dan verwacht ik dat je eerst tool-context ophaalt en die zichtbaar benut.
- Als je een mail of actielijst verrijkt met Creates-context, laat dat subtiel landen in de formulering of in een aparte korte sectie "Relevant haakje", maar maak geen lange generieke salespitch van een follow-up.
- Wanneer een case wordt genoemd: zet de bedrijfsnaam **vet** zodat de UI er een klikbare link van maakt. Gebruik alléén bedrijfsnamen die letterlijk in de tool-resultaten terugkomen — verzin of generaliseer nooit.
- **Inline citations**: elk feit dat uit \`search_web\` of \`prospect_brief\` komt krijgt een **kale** \`[n]\`-citatie direct achter dat feit, waar \`n\` het sources-nummer is uit de tool-output. Voorbeeld: "Bol.com heeft hun data-platform gemigreerd naar Google BigQuery [3] en investeert sinds 2024 in AI-gestuurde personalisatie [7]." Plaats meerdere markers naast elkaar als meerdere bronnen één claim ondersteunen: \`[3][5]\`.
  - **NOOIT \`[n](url)\`-syntax gebruiken** met een URL erachter — geen markdown-links rond citaties. De UI maakt ze automatisch klikbaar via de bronnenlijst onderaan. Schrijf dus \`[3]\`, niet \`[3](https://...)\`.
  - Gebruik alleen nummers die je letterlijk in de tool-output hebt gezien — verzin geen citatie-nummers en kopieer geen nummers uit de body-tekst (zoals KvK-nummers, marktwaardes, registratie-nummers) als citatie.
  - Plaats GEEN citaties achter feiten die uit \`search_cases\`/\`get_topic\`/\`list_personas\` komen — die zijn intern, geen web-bron.
- Structureer lange antwoorden met korte kopjes + bullets; korte antwoorden mogen gewoon als lopende tekst.
- Als info ontbreekt: zeg dat eerlijk, verzin niets.
- **Doen, niet aankondigen**: als je een tool-call wilt doen, doe 'm in dezelfde turn en presenteer het resultaat. Antwoord nooit met alleen "Jazeker, ik kan…" / "Goed, ik ga zoeken naar…" / "Ja, hier zoek ik naar op…" zonder dat je in die turn ook daadwerkelijk de tool gebruikt en 't resultaat deelt. Dergelijke zinnen voelen als gestotter — de gebruiker ziet liever meteen het antwoord dan een intentie-verklaring.
- **Eerlijk over fit**: je hoeft niet altijd een Creates-haakje te vinden. Als de prospect iets doet waar Creates géén sterke case of dienst voor heeft, zeg dat. Benoem het als gat of ontwikkelkans ("hier hebben we nog geen referentie voor — interessant om op te bouwen" / "onze portfolio is sterker op X dan op Y, dus voor dit specifieke onderwerp hebben we minder bewijs"). Een sales-assistent die overal een verband forceert is bij ervaren sales én bij senior klantcontacten juist minder geloofwaardig. Liever één échte match benoemen en één gat eerlijk markeren dan drie gezochte haakjes.
- Web-lookups: gebruik \`search_web\` alleen voor externe bedrijfsinfo (prospect-briefing, recent nieuws, sector-context). Gebruik het **niet** om cases, talking points, persona's of Creates-interne info op te halen — die komen uit \`search_cases\`, \`get_topic\`, \`list_personas\`. Als een web-resultaat tegen de interne case-data in gaat, volgt de interne data.

TYPISCHE VRAGEN:
- "Ik heb zo een CFO-gesprek over data-platform migratie — wat vertel ik?"
- "Speel de IT-manager van een bank en val me aan op governance."
- "Ik heb deze opening geschreven — wat mis ik nog?"
- "Zet twee cases uit de retail naast elkaar qua aanpak."
- "Welke cases passen bij AI ready?"
- "Maak van deze gespreksnotities een follow-up mail."
- "Haal uit deze notes een actielijst met eigenaar en volgende stap."
- "Maak een briefing over [bedrijfsnaam] — wat doen ze, welke sector, recent nieuws?"`;

// ─── Supabase (read-only) ────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars ontbreken (SUPABASE_URL / SUPABASE_ANON_KEY).');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchConfig(supabase, key) {
  const { data, error } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

// ─── Tool implementaties ─────────────────────────────────────────────────
async function toolSearchCases({ doel, behoefte, dienst, persona, branche, keyword }) {
  const supabase = getSupabase();
  let query = supabase.from('cases').select('id,name,subtitle,keywords,business_impact,mapping,match_reasons,situatie,doel,oplossing,resultaat');
  const { data, error } = await query;
  if (error) throw error;

  // Persona-filter mag op id óf label matchen — LLM's gebruiken vaak de label.
  let personaId = null;
  let personaLabel = null;
  if (persona) {
    const personas = await fetchConfig(supabase, 'personas');
    const byId = personas?.[persona];
    if (byId) {
      personaId = persona;
      personaLabel = byId.label;
    } else {
      const matchByLabel = Object.values(personas || {}).find(
        p => (p.label || '').toLowerCase() === persona.toLowerCase()
      );
      if (matchByLabel) {
        personaId = matchByLabel.id;
        personaLabel = matchByLabel.label;
      }
    }
  }

  // Filter in JS omdat mapping jsonb is en keywords een array.
  const filtered = (data || []).filter(c => {
    const m = c.mapping || {};
    if (doel && !(m.doelen || []).includes(doel)) return false;
    if (behoefte && !(m.behoeften || []).includes(behoefte)) return false;
    if (dienst && !(m.diensten || []).includes(dienst)) return false;
    if (personaId && !(m.personas || []).includes(personaId)) return false;
    if (branche) {
      const list = (m.branches || []).map(b => String(b).toLowerCase());
      if (!list.includes(String(branche).toLowerCase())) return false;
    }
    if (keyword) {
      const hay = [
        c.name, c.subtitle, c.situatie, c.doel, c.oplossing, c.resultaat, c.business_impact,
        ...(c.keywords || [])
      ].join(' ').toLowerCase();
      if (!hay.includes(keyword.toLowerCase())) return false;
    }
    return true;
  });

  // Beperkte payload terug naar het model — houdt tokens laag.
  return filtered.slice(0, 6).map(c => ({
    id: c.id,
    name: c.name,
    subtitle: c.subtitle,
    keywords: c.keywords,
    situatie_kort: (c.situatie || '').slice(0, 220),
    resultaat_kort: (c.resultaat || '').slice(0, 220),
    business_impact: c.business_impact,
    mapping: c.mapping,
    // Geef de persona-match-reasons expliciet terug zodat Nova "waarom resoneert dit bij persona X" kan gebruiken.
    persona_match_reasons: (c.match_reasons && c.match_reasons.personas) || {},
    ...(personaLabel ? { gefilterd_op_persona: personaLabel } : {}),
  }));
}

async function toolGetTopic({ tab, name }) {
  const supabase = getSupabase();
  const topics = await fetchConfig(supabase, 'topics');
  if (!topics) return { error: 'Geen topics gevonden in app_config.' };
  const bucket = topics[tab];
  if (!bucket) return { error: `Onbekende tab: ${tab}` };
  const t = bucket[name];
  if (!t) return { error: `Onbekende ${tab}: ${name}`, beschikbaar: Object.keys(bucket) };
  return {
    tab,
    name,
    description: stripHtml(t.description),
    signals: stripHtml(t.signals),
    talkingPoints: t.talkingPoints || [],
    followUps: t.followUps || [],
  };
}

async function toolListPersonas() {
  const supabase = getSupabase();
  const personas = await fetchConfig(supabase, 'personas');
  if (!personas) return [];
  return Object.values(personas).map(p => ({
    id: p.id,
    label: p.label,
    domain: p.domain,
    niveau: p.niveau,
    roles: p.roles,
    coaching: p.coaching,
    signals: stripHtml(p.signals),
  }));
}

function stripHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── search_web — Google Search grounding als sub-call ───────────────────
// Gemini 2.5 Flash staat `googleSearch` en functionDeclarations NIET tegelijk toe
// in één request (400 "Built-in tools and Function Calling cannot be combined").
// Workaround: we verpakken grounding in een custom function `search_web` die intern
// een aparte Gemini-call doet met alleen `googleSearch` aan. Van Nova's kant is 't
// gewoon een tool-call; de extra Gemini-hop is een implementatie-detail.
// Module-level buffer verzamelt bronnen over alle search_web-calls binnen een request,
// zodat de handler ze aan 't eind als één `grounding`-SSE kan sturen.
const webSourcesBuffer = new Map(); // uri → title, per-request (reset in handler)
const webQueriesBuffer = new Set();

// ─── prospect_brief — gestructureerd onderzoek over een prospect ─────────
// Wrapper rond search_web die deterministisch 3 onderzoeks-clusters parallel
// uitvoert. Dat geeft Nova consistent materiaal voor de 7 vaste briefing-buckets,
// onafhankelijk van model-creatie. Bronnen komen automatisch in webSourcesBuffer
// terecht (search_web doet dat zelf), dus de grounding-event aan 't eind bevat
// alle 3 cluster-bronnen samen.
async function toolProspectBrief({ company }) {
  const trimmed = (company || '').trim();
  if (!trimmed) return { error: 'company is verplicht.' };

  const clusters = [
    {
      focus: 'snapshot + strategie',
      query: `${trimmed} sector branche kerntaken omvang FTE omzet hoofdkantoor strategische prioriteiten jaarverslag 2024 2025`,
    },
    {
      focus: 'data + AI',
      query: `${trimmed} data platform stack governance AI machine learning initiatieven CDO "Head of Data" digitalisering 2024 2025`,
    },
    {
      focus: 'team + budget + concurrentie',
      query: `${trimmed} data team vacatures externe partners consultancy concurrenten marktaandeel acquisities investeringen tenders financiele kerncijfers`,
    },
  ];

  const results = await Promise.all(clusters.map(c => toolSearchWeb({ query: c.query })));

  return {
    company: trimmed,
    clusters: clusters.map((c, i) => ({
      focus: c.focus,
      query: c.query,
      summary: (results[i] && typeof results[i].text === 'string') ? results[i].text : '',
      sources: results[i]?.sources || [],
      error: results[i]?.error || null,
    })),
    note: 'Synthetiseer dit naar de 7 vaste briefing-categorieën met bronnen + BANT-blokje. Plaats achter elk feit dat uit een web-bron komt een [n]-citatie waar n het sources-nummer is dat je in deze tool-output ziet. Zie systeemprompt voor format.',
  };
}

async function toolSearchWeb({ query }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'GEMINI_API_KEY ontbreekt.' };
  if (!query || typeof query !== 'string') return { error: 'query is verplicht.' };

  const genAI = new GoogleGenerativeAI(apiKey);
  const grounded = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });
  const result = await grounded.generateContent(query);
  const resp = result.response;
  const rawText = resp.text?.() || '';
  // Gemini's grounding embed standaard markdown-link-style citaties in de
  // response-tekst, bv. "Bol.com migreerde naar BigQuery [58666970](redirect-url)..."
  // Die redirect-URLs werken niet stabiel (404 vaak), de getallen zijn Gemini's
  // eigen chunk-id's (geen 1-based nummering die wij bijhouden), en als we deze
  // tekst onbewerkt aan Nova doorgeven kopieert ze de broken-links 1-op-1 in
  // haar antwoord. Strip ze: vervang [label](url) door enkel label, en verwijder
  // kale [3] / [3, 5] refs ook omdat die Gemini's nummering gebruiken.
  // Nova krijgt schone tekst + een aparte sources-array met onze [n]-nummering
  // en kan dan zélf [n]-markers plaatsen volgens de regels in de systeemprompt.
  const text = rawText
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')      // [label](url) → label
    .replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '');         // bare [3] / [3, 5] eruit
  const gm = resp.candidates?.[0]?.groundingMetadata;
  const sources = [];
  for (const gc of gm?.groundingChunks || []) {
    if (gc.web?.uri) {
      if (!webSourcesBuffer.has(gc.web.uri)) {
        webSourcesBuffer.set(gc.web.uri, gc.web.title || gc.web.uri);
      }
      // 1-based index op basis van insertion-order in de globale buffer.
      // Map preserves insertion order, dus dit is stabiel binnen één request.
      // Nova kan dit nummer terug-citeren als [n] in haar antwoord — de
      // bronnenlijst die de UI uiteindelijk toont gebruikt dezelfde nummering.
      const n = [...webSourcesBuffer.keys()].indexOf(gc.web.uri) + 1;
      sources.push({ n, uri: gc.web.uri, title: gc.web.title || gc.web.uri });
    }
  }
  for (const q of gm?.webSearchQueries || []) webQueriesBuffer.add(q);

  return { text, sources, queries: gm?.webSearchQueries || [] };
}

// ─── Tool declaraties (Gemini function calling schema) ───────────────────
const tools = [
  {
    functionDeclarations: [
      {
        name: 'search_cases',
        description: 'Zoek relevante klantcases uit de Creates case-database. Filter op doel, behoefte, dienst, persona, branche en/of een vrij trefwoord (klantnaam, technologie). Cases zijn gekoppeld aan persona\'s én een of meer branches — gebruik die filters als de gebruiker aangeeft met wie hij praat of in welke sector.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            doel: { type: SchemaType.STRING, description: 'Exacte waarde: "Meer waarde halen uit data" of "Data als business model"' },
            behoefte: { type: SchemaType.STRING, description: 'Een van: "Veilig en betrouwbaar", "Wendbaar", "AI ready", "Realtime data"' },
            dienst: { type: SchemaType.STRING, description: 'Een van: "Data modernisatie", "Governance", "Data kwaliteit", "Training"' },
            persona: { type: SchemaType.STRING, description: 'Persona-id of label (bv. "CFO", "Operationele IT-manager"). Gebruik list_personas om beschikbare persona\'s te zien.' },
            branche: { type: SchemaType.STRING, description: 'Branche/sector van de klant (bv. "Financial services", "Onderwijs", "Retail & e-commerce", "Industrie & manufacturing", "Overheid & non-profit", "Zorg", "Energy & utilities", "Logistiek & transport", "Professional services"). Case-insensitive match.' },
            keyword: { type: SchemaType.STRING, description: 'Vrij trefwoord — zoekt in klantnaam, situatie, oplossing, keywords.' },
          },
        },
      },
      {
        name: 'get_topic',
        description: 'Haal de talking points, vervolgvragen, omschrijving en klantsignalen op voor een specifiek doel, behoefte of dienst.',
        parameters: {
          type: SchemaType.OBJECT,
          required: ['tab', 'name'],
          properties: {
            tab: { type: SchemaType.STRING, description: 'Een van: "doelen", "behoeften", "diensten"' },
            name: { type: SchemaType.STRING, description: 'De exacte naam van het topic, bijv. "AI ready".' },
          },
        },
      },
      {
        name: 'list_personas',
        description: 'Haal alle personas op met hun coaching-instructies en typische uitspraken (klantsignalen). Gebruik dit als de gebruiker met iemand praat en je de juiste gesprekstoon wilt aanreiken.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'search_web',
        description: 'Zoek op het publieke web (Google) voor externe bedrijfsinfo, recente nieuwsberichten of sector-context over een prospect. Gebruik dit voor losse follow-up-vragen over een prospect (bv. "wie is hun CDO?", "wat zegt hun jaarverslag over AI?"). Voor een complete prospect-briefing gebruik liever prospect_brief — die structureert het onderzoek deterministisch.',
        parameters: {
          type: SchemaType.OBJECT,
          required: ['query'],
          properties: {
            query: { type: SchemaType.STRING, description: 'Concrete zoekopdracht in natuurlijke taal, bv. "Bol.com Head of Data 2025" of "AkzoNobel recent persbericht AI".' },
          },
        },
      },
      {
        name: 'prospect_brief',
        description: 'Doe een complete, gestructureerde briefing-research over een prospect-bedrijf. Voert intern 3 parallelle web-zoekopdrachten uit (snapshot+strategie / data+AI / team+budget+concurrentie) en levert al het materiaal voor de 7 vaste briefing-categorieën in één call. Gebruik dit telkens wanneer de gebruiker om een briefing/voorbereiding/research over een bedrijf vraagt. Geef daarna nog één search_cases-call op de gevonden branche om case-fit te checken. Het exacte output-format staat in de systeemprompt.',
        parameters: {
          type: SchemaType.OBJECT,
          required: ['company'],
          properties: {
            company: { type: SchemaType.STRING, description: 'Naam van de prospect, bv. "Bol.com", "AkzoNobel", "Tulp Hypotheken".' },
          },
        },
      },
    ],
  },
];

async function runTool(name, args) {
  try {
    if (name === 'search_cases') return await toolSearchCases(args || {});
    if (name === 'get_topic') return await toolGetTopic(args || {});
    if (name === 'list_personas') return await toolListPersonas();
    if (name === 'search_web') return await toolSearchWeb(args || {});
    if (name === 'prospect_brief') return await toolProspectBrief(args || {});
    return { error: `Onbekende tool: ${name}` };
  } catch (e) {
    return { error: e.message || 'Tool execution failed' };
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Auth-check — zonder geldige sessie geen Gemini-calls.
  const user = await requireUser(req, res);
  if (!user) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY ontbreekt in env.' });
    return;
  }

  const { messages = [], context = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages[] is verplicht' });
    return;
  }

  // Context uit de UI (huidige tab/filter/persona) meegeven als system-aanvulling.
  const ctxLines = [];
  if (context.activeTab && context.activeFilter) {
    ctxLines.push(`De gebruiker kijkt nu naar tab "${context.activeTab}" → "${context.activeFilter}".`);
  }
  if (context.activePersonaLabel) {
    ctxLines.push(`Actieve persona: ${context.activePersonaLabel}.`);
  }
  const systemInstruction = ctxLines.length
    ? `${SYSTEM_PROMPT}\n\nHUIDIGE CONTEXT:\n- ${ctxLines.join('\n- ')}`
    : SYSTEM_PROMPT;

  // Gemini history: rol 'user' of 'model'. Laatste message = de nieuwe user-prompt.
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const latest = messages[messages.length - 1]?.content || '';

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      tools,
    });

    const chat = model.startChat({ history });

    // Reset per-request web-source buffers (module-level, gevuld door toolSearchWeb).
    webSourcesBuffer.clear();
    webQueriesBuffer.clear();

    // Multi-turn tool loop: zolang het model functionCalls terugstuurt, voer ze uit en feed de
    // responses terug. Zodra er tekst komt, streamen we naar de client.
    let nextInput = latest;
    let safetyLoop = 0;
    let totalSawText = false;
    let lastFinishReason = null;
    while (safetyLoop++ < 5) {
      const result = await chat.sendMessageStream(nextInput);

      const functionCalls = [];
      let sawText = false;
      for await (const chunk of result.stream) {
        // Verzamel tool-calls + stream tekst gelijktijdig.
        const calls = chunk.functionCalls?.() || [];
        if (calls.length) functionCalls.push(...calls);
        const text = chunk.text?.();
        if (text) {
          sawText = true;
          totalSawText = true;
          send({ type: 'text', value: text });
        }
        // Finish-reason bijhouden voor diagnose als loop zonder tekst eindigt.
        const fr = chunk.candidates?.[0]?.finishReason;
        if (fr) lastFinishReason = fr;
      }

      if (functionCalls.length === 0) break;

      // Voer alle calls uit en stuur responses in één go terug.
      send({ type: 'tool', value: functionCalls.map(c => c.name) });
      const toolResponses = await Promise.all(
        functionCalls.map(async (call) => ({
          functionResponse: {
            name: call.name,
            response: { result: await runTool(call.name, call.args) },
          },
        }))
      );
      nextInput = toolResponses;
      // Als het model zowel tekst als tool-calls gaf: we hebben tekst al gestreamd; loop opnieuw
      // voor de vervolg-tekst na de tool-resultaten.
      if (!sawText && safetyLoop >= 5) break;
    }

    // Fallback: tool-loop heeft geresulteerd in tools maar géén tekst — model gaf op zonder
    // synthese. Geef de gebruiker een leesbare melding i.p.v. een leeg bericht. Komt o.a. voor
    // bij finishReason === 'MAX_TOKENS' of 'SAFETY' of wanneer de loop-budget op is.
    if (!totalSawText) {
      console.warn('Chat loop ended without text. finishReason:', lastFinishReason, 'loops:', safetyLoop);
      const hint = lastFinishReason === 'MAX_TOKENS'
        ? 'Er is veel webmateriaal opgehaald maar de samenvatting paste niet meer in het antwoord-budget. Probeer een kortere vraag of splits hem op.'
        : lastFinishReason === 'SAFETY'
          ? 'Het model heeft z\'n antwoord ingetrokken op basis van safety-filters.'
          : `Ik heb mijn tools wel kunnen raadplegen maar kwam niet tot een samenhangend antwoord. Kun je de vraag iets specifieker stellen of opsplitsen? (debug: finishReason=${lastFinishReason || 'onbekend'})`;
      send({ type: 'text', value: hint });
    }

    // Web-bronnen uit alle search_web-subcalls bundelen en als één grounding-event sturen.
    // Client hangt ze als "Bronnen (Google Search)"-blok onder het assistant-bericht.
    // Nummering 1-based op insertion-order van de buffer — zelfde n die Nova in
    // search_web's tool-output zag, zodat haar [n]-citaties matchen met de bronnenlijst.
    if (webSourcesBuffer.size > 0 || webQueriesBuffer.size > 0) {
      send({
        type: 'grounding',
        value: {
          sources: [...webSourcesBuffer.entries()].map(([uri, title], i) => ({ n: i + 1, uri, title })),
          queries: [...webQueriesBuffer],
        },
      });
    }

    send({ type: 'done' });
    res.end();
  } catch (err) {
    console.error('Chat handler error:', err);
    send({ type: 'error', value: err.message || 'Chat error' });
    res.end();
  }
}

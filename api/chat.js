// Vercel Serverless Function — streaming chat endpoint voor de Sales Navigator assistent.
// Gebruikt Google Gemini 2.0 Flash + function calling tegen Supabase.
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

WERKWIJZE:
1. **Begrijp** eerst wat de gebruiker écht nodig heeft. Als de vraag ambigu is (bijv. "maak een belscript"), vraag één gerichte vervolgvraag: welke klant/sector, welke rol, welk doel.
2. **Haal op** met je tools — doe gerust *meerdere* tool-calls na elkaar als dat nodig is. Bijvoorbeeld: eerst \`list_personas\` om de juiste persona te vinden, dan \`search_cases\` met \`persona\` als filter (zodat je alléén cases krijgt die expliciet aan die rol zijn gekoppeld), dan \`get_topic\` voor de talking points. Verzamel alle bouwstenen vóór je het antwoord schrijft.
   - Let op: \`search_cases\` geeft bij een persona-filter ook \`persona_match_reasons\` terug — gebruik die expliciet in je antwoord ("**CITO** past bij een CFO omdat: [reden uit de data]").
   - Bij follow-up mails en actielijsten uit gespreksnotities: haal óók relevante context op als de notities daar aanleiding toe geven. Herken in de notes waar mogelijk persona, branche, doel, behoefte, dienst, klantvraag of case-haakjes. Gebruik daarna \`list_personas\`, \`get_topic\` en/of \`search_cases\` om je output specifieker te maken dan een generieke samenvatting.
3. **Synthetiseer** — vat niet samen wat de tools terugstuurden, maar *gebruik* het om een antwoord op maat te maken. Koppel altijd expliciet: "voor [persona] is [case] sterk omdat [reden uit de data]".

BIJ GESPREKSNOTITIES:
- Behandel ruwe notes niet als losse tekstredactie, maar als sales-context die je mag verrijken met feiten uit de tools.
- Voeg alleen een case, talking point of persona-haakje toe als je dat eerst via een tool hebt onderbouwd.
- Voor een follow-up mail: houd de mail kort en bruikbaar. Structuur standaard als: onderwerpregel, korte bedank/opening, samenvatting van wat besproken is, afgesproken vervolgstap, afsluiting.
- Voor een actielijst: gebruik een markdown-checklist. Zet per punt zo concreet mogelijk eigenaar en actie. Als een deadline ontbreekt, benoem dat als open punt in plaats van te gokken.
- Als de notes te dun zijn voor inhoudelijke verrijking, lever dan een strakke generieke versie op en zeg kort welke context ontbrak.

REGELS:
- Altijd in het Nederlands.
- Bondig en zakelijk, geen marketingpraat.
- Noem jezelf Nova alleen als iemand vraagt wie je bent.
- Gebruik je tools om échte cases, talking points en persona-coaching op te halen — verzin nooit cases, cijfers of klantnamen.
- Als de gebruiker ruwe notities plakt: structureer en herschrijf ze, maar verzin geen besluiten, acties, deadlines of toezeggingen die niet uit de input of tool-data volgen. Markeer ontbrekende info expliciet als open punt.
- Als je een mail of actielijst verrijkt met Creates-context, laat dat subtiel landen in de formulering of in een aparte korte sectie "Relevant haakje", maar maak geen lange generieke salespitch van een follow-up.
- Wanneer een case wordt genoemd: zet de bedrijfsnaam **vet** zodat de UI er een klikbare link van maakt. Gebruik alléén bedrijfsnamen die letterlijk in de tool-resultaten terugkomen — verzin of generaliseer nooit.
- Structureer lange antwoorden met korte kopjes + bullets; korte antwoorden mogen gewoon als lopende tekst.
- Als info ontbreekt: zeg dat eerlijk, verzin niets.

TYPISCHE VRAGEN:
- "Ik heb zo een CFO-gesprek over data-platform migratie — wat vertel ik?"
- "Speel de IT-manager van een bank en val me aan op governance."
- "Ik heb deze opening geschreven — wat mis ik nog?"
- "Zet twee cases uit de retail naast elkaar qua aanpak."
- "Welke cases passen bij AI ready?"
- "Maak van deze gespreksnotities een follow-up mail."
- "Haal uit deze notes een actielijst met eigenaar en volgende stap."`;

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

// ─── Tool declaraties (Gemini function calling schema) ───────────────────
const tools = [{
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
  ],
}];

async function runTool(name, args) {
  try {
    if (name === 'search_cases') return await toolSearchCases(args || {});
    if (name === 'get_topic') return await toolGetTopic(args || {});
    if (name === 'list_personas') return await toolListPersonas();
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

    // Multi-turn tool loop: zolang het model functionCalls terugstuurt, voer ze uit en feed de
    // responses terug. Zodra er tekst komt, streamen we naar de client.
    let nextInput = latest;
    let safetyLoop = 0;
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
          send({ type: 'text', value: text });
        }
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

    send({ type: 'done' });
    res.end();
  } catch (err) {
    console.error('Chat handler error:', err);
    send({ type: 'error', value: err.message || 'Chat error' });
    res.end();
  }
}

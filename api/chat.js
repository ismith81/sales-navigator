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
Je helpt de gebruiker (sales) om zich voor te bereiden op klantgesprekken.

CONTEXT OVER HET AANBOD:
- 2 Doelen: "Meer waarde halen uit data", "Data als business model"
- 4 Behoeften: "Veilig en betrouwbaar", "Wendbaar", "AI ready", "Realtime data"
- 4 Diensten: "Data modernisatie", "Governance", "Data kwaliteit", "Training"
Doelen → vertalen in behoeften → worden ingevuld door diensten.

HOE TE ANTWOORDEN:
- Altijd in het Nederlands.
- Bondig en zakelijk, geen marketingpraat.
- Noem jezelf Nova als iemand vraagt wie je bent — maar breng het niet ongevraagd ter sprake.
- Gebruik je tools om échte cases, talking points en persona-coaching op te halen — verzin niets.
- Wanneer een case wordt genoemd: noem de bedrijfsnaam duidelijk (bijv. "AkzoNobel") zodat de gebruiker 'm zo terugvindt in de Navigator.
- Structureer antwoorden met korte lijstjes (-) waar dat helpt.
- Als info ontbreekt: zeg dat eerlijk, verzin geen cases of cijfers.

TYPISCHE VRAGEN die je kunt verwachten:
- "Ik heb zo een gesprek met de CFO van een retailer over data-platform — wat vertel ik?"
- "Welke cases passen bij AI ready?"
- "Wat zijn goede vervolgvragen als de klant over schema-drift begint?"`;

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
async function toolSearchCases({ doel, behoefte, dienst, keyword }) {
  const supabase = getSupabase();
  let query = supabase.from('cases').select('id,name,subtitle,keywords,business_impact,mapping,situatie,doel,oplossing,resultaat');
  const { data, error } = await query;
  if (error) throw error;

  // Filter in JS omdat mapping jsonb is en keywords een array.
  const filtered = (data || []).filter(c => {
    const m = c.mapping || {};
    if (doel && !(m.doelen || []).includes(doel)) return false;
    if (behoefte && !(m.behoeften || []).includes(behoefte)) return false;
    if (dienst && !(m.diensten || []).includes(dienst)) return false;
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
      description: 'Zoek relevante klantcases uit de Creates case-database. Filter op doel, behoefte, dienst en/of een vrij trefwoord (klantnaam, sector, technologie).',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          doel: { type: SchemaType.STRING, description: 'Exacte waarde: "Meer waarde halen uit data" of "Data als business model"' },
          behoefte: { type: SchemaType.STRING, description: 'Een van: "Veilig en betrouwbaar", "Wendbaar", "AI ready", "Realtime data"' },
          dienst: { type: SchemaType.STRING, description: 'Een van: "Data modernisatie", "Governance", "Data kwaliteit", "Training"' },
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

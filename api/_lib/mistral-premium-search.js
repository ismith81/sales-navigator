// Mistral Premium Search helper voor de 3-cluster prospect-briefing flow.
//
// Wordt aangeroepen vanuit toolProspectBrief in api/chat.js wanneer
// LLM_PROVIDER=mistral. Doet één Mistral Conversations API-call per
// cluster met `tools: [{ type: 'web_search_premium' }]` en parseert de
// response naar { text, sources } — hetzelfde shape als toolSearchWeb
// (Gemini grounding) zodat de aanroeper niks hoeft aan te passen.
//
// Gebruikt `client.beta.conversations.start()` ipv `client.agents.complete()`
// omdat conversations agentId-optioneel maken — geen long-lived agent
// hoeven we aanmaken voor deze use-case.
//
// Response-shape van Mistral conversations API:
//   { conversationId, outputs: [...entries], usage }
// Entries kunnen zijn:
//   - tool.execution    — Premium Search heeft gedraaid
//   - message.output    — model-antwoord; content is string OF chunks-array:
//       [{ type: 'text', text: '...' },
//        { type: 'tool_reference', tool, title, url, description }]
//
// Wij willen: alle text concateneren tot één blok + alle tool_reference-
// chunks ontdoubleren tot een sources-array. Daarna terugmappen naar 't
// Gemini-toolSearchWeb shape: { text, sources, queries: [<query>] }.

import { Mistral } from '@mistralai/mistralai';

const MODEL = 'mistral-small-latest';

// Instructies voor 't model bij elke cluster-call. Korte, gefocuste prompt
// — Mistral besluit zelf hoe vaak Premium Search aan te roepen om de query
// te beantwoorden. Vragen we expliciet om in NL te antwoorden + bronnen
// inline te citeren zodat de output bruikbaar is voor briefing-synthese.
const SEARCH_INSTRUCTIONS = `Je bent een research-assistent voor een Nederlandse sales-team.
Beantwoord de zoekopdracht door één of meer gerichte web-zoekopdrachten te doen via Premium Search.
Schrijf je antwoord in helder Nederlands, gestructureerd in korte alinea's.
Plaats achter elk feit dat je uit een bron haalt een korte verwijzing zoals "(zie bron: <korte titel>)" — de UI maakt daar later klikbare links van.
Verzin GEEN feiten die je niet uit een bron kunt halen. Als publieke info ontbreekt, schrijf dat expliciet ("geen publieke info gevonden voor X").`;

/**
 * Doet één Premium Search-aangedreven research-call.
 * @param {Object} args
 * @param {string} args.query - zoekopdracht in natuurlijke taal
 * @param {Mistral} [args.client] - optioneel: hergebruik bestaande client
 * @returns {Promise<{text: string, sources: Array<{uri, title, description?}>, queries: string[], error?: string}>}
 */
export async function mistralPremiumSearch({ query, client }) {
  if (!query || typeof query !== 'string') return { error: 'query is verplicht.' };
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return { error: 'MISTRAL_API_KEY ontbreekt.' };

  const c = client || new Mistral({ apiKey });

  let response;
  try {
    response = await c.beta.conversations.start({
      model: MODEL,
      instructions: SEARCH_INSTRUCTIONS,
      tools: [{ type: 'web_search_premium' }],
      inputs: query, // ConversationInputs accepteert ook een platte string
      // Geen `store` — we hebben de conversatie verder niet nodig.
      store: false,
    });
  } catch (err) {
    console.warn('mistralPremiumSearch fout:', err?.message || err);
    return {
      error: `Premium Search mislukt: ${err?.message || 'onbekend'}`,
      text: '',
      sources: [],
      queries: [query],
    };
  }

  return parseConversationResponse(response, query);
}

// ─── Response-parser ────────────────────────────────────────────────────
// Mistral's outputs-array bevat entries van verschillende types. Wij willen
// alleen de message.output-entries waar content een chunks-array is — daar
// zitten zowel de tekst als de tool_references in.
function parseConversationResponse(resp, query) {
  const outputs = resp?.outputs || [];
  let text = '';
  const sources = [];
  const seen = new Set();

  for (const entry of outputs) {
    if (entry?.type !== 'message.output') continue;
    const content = entry.content;
    if (typeof content === 'string') {
      // Plat text-antwoord (geen tool_reference chunks).
      text += content;
    } else if (Array.isArray(content)) {
      for (const chunk of content) {
        if (chunk?.type === 'text' && typeof chunk.text === 'string') {
          text += chunk.text;
        } else if (chunk?.type === 'tool_reference' && chunk.url) {
          // Dedupe op URL — Premium Search kan dezelfde bron meerdere keren refereren.
          if (seen.has(chunk.url)) continue;
          seen.add(chunk.url);
          sources.push({
            uri: chunk.url,
            title: chunk.title || chunk.url,
            description: chunk.description || null,
          });
        }
        // Andere chunk-types (bv. images) negeren we voor de POC.
      }
    }
  }

  return { text: text.trim(), sources, queries: [query] };
}

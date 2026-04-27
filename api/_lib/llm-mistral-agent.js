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
  // Pak de laatste user-message — we starten elke aanroep als nieuwe
  // conversation (geen conversation_id-tracking in deze POC).
  const lastUser = [...messages].reverse().find(m => m.role !== 'assistant');
  const inputs = (lastUser?.content || '').toString();

  console.log('[Mistral-Agent] start:', {
    agentId,
    inputsLength: inputs.length,
    inputsPreview: inputs.slice(0, 80),
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

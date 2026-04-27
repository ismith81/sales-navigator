// Mistral Small 4 implementatie van de Nova-chat-loop. Parallelle variant
// van de Gemini-loop in api/chat.js — zelfde SSE-events naar de frontend
// (text / tool / grounding / done / error) zodat ChatPanel niks hoeft aan
// te passen. Wordt gedispatched vanuit api/chat.js wanneer
// `LLM_PROVIDER=mistral` op de serverless functie staat.
//
// Wat we hier doen:
//   1. Convert Gemini tool-format naar OpenAI/Mistral-format (JSON Schema)
//   2. Convert chat-history naar OpenAI message-format
//   3. Multi-turn tool-loop met streaming, tool-call-accumulatie en
//      finishReason-aware retry-nudge (zelfde logica als Gemini-loop)
//
// Bewust NIET in deze POC:
//   - search_web blijft Gemini-grounding gebruiken (interne sub-call). Voor
//     de eerste A/B-test wil je vooral het hoofd-loop-gedrag vergelijken,
//     niet ook nog grounding-mechanisme. Wanneer Mistral-POC slaagt is een
//     vervolg-stap om search_web naar Brave/Tavily te porten.
//   - cv-parse.js blijft Gemini (apart endpoint, andere aanroeper).
//
// Env vars:
//   LLM_PROVIDER=mistral  — schakelt deze loop in (api/chat.js dispatch)
//   MISTRAL_API_KEY       — vereist (console.mistral.ai)

import { Mistral } from '@mistralai/mistralai';
import {
  SYSTEM_PROMPT,
  geminiTools,
  runTool,
  webSourcesBuffer,
  webQueriesBuffer,
} from '../chat.js';

const MODEL = 'mistral-small-latest'; // points naar Small 4 op Mistral La Plateforme
const MAX_TOOL_LOOPS = 5;
const MAX_OUTPUT_TOKENS = 8192;
const TEMPERATURE = 0.7;

// ─── Tool-format conversie: Gemini → OpenAI/Mistral ─────────────────────
// Gemini SDK gebruikt SchemaType-enum + nested functionDeclarations array.
// Mistral wil platte JSON Schema in OpenAI-stijl.
function geminiSchemaToJsonSchema(prop) {
  // SchemaType.STRING → 'string', etc. SchemaType is gewoon een mapping in
  // de SDK, dus we kunnen op de string-waarde matchen via toLowerCase.
  const typeMap = { STRING: 'string', NUMBER: 'number', INTEGER: 'integer',
                    BOOLEAN: 'boolean', OBJECT: 'object', ARRAY: 'array' };
  const out = {};
  if (prop.type) {
    const key = String(prop.type).toUpperCase();
    out.type = typeMap[key] || 'string';
  }
  if (prop.description) out.description = prop.description;
  if (prop.enum) out.enum = prop.enum;
  if (prop.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(prop.properties)) {
      out.properties[k] = geminiSchemaToJsonSchema(v);
    }
  }
  if (prop.required) out.required = prop.required;
  if (prop.items) out.items = geminiSchemaToJsonSchema(prop.items);
  return out;
}

function buildMistralTools() {
  const decls = geminiTools[0]?.functionDeclarations || [];
  return decls.map(d => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters
        ? geminiSchemaToJsonSchema(d.parameters)
        : { type: 'object', properties: {} },
    },
  }));
}

// ─── Message-format conversie: ChatPanel → OpenAI/Mistral ───────────────
// Frontend stuurt {role: 'user'|'assistant', content: '...'}. Mistral wil
// {role, content} en gebruikt 'system' voor de system-instruction.
function buildMessages(systemInstruction, messages) {
  const out = [{ role: 'system', content: systemInstruction }];
  for (const m of messages) {
    out.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    });
  }
  return out;
}

// ─── Tool-call streaming-accumulator ────────────────────────────────────
// Mistral streamt tool-calls als deltas: { id, type, function: { name, arguments } }
// waarbij arguments incrementeel komt. We accumuleren per-index zoals OpenAI.
function accumulateToolCallDelta(accumulator, delta) {
  if (!delta) return;
  const idx = delta.index ?? 0;
  if (!accumulator[idx]) {
    accumulator[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
  }
  const acc = accumulator[idx];
  if (delta.id) acc.id = delta.id;
  if (delta.type) acc.type = delta.type;
  if (delta.function?.name) acc.function.name += delta.function.name;
  if (delta.function?.arguments) acc.function.arguments += delta.function.arguments;
}

// ─── Hoofd-loop ─────────────────────────────────────────────────────────
export async function runMistralChat({ messages, systemInstruction, send }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    send({ type: 'error', value: 'MISTRAL_API_KEY ontbreekt in env.' });
    return;
  }

  const client = new Mistral({ apiKey });
  const tools = buildMistralTools();
  const conversation = buildMessages(systemInstruction, messages);

  // Reset web-source-buffers (search_web tool vult ze, gedeeld met Gemini-pad).
  webSourcesBuffer.clear();
  webQueriesBuffer.clear();

  let totalSawText = false;
  let lastFinishReason = null;
  let toolsRanThisRequest = false;
  let safetyLoop = 0;

  while (safetyLoop++ < MAX_TOOL_LOOPS) {
    const stream = await client.chat.stream({
      model: MODEL,
      messages: conversation,
      tools,
      toolChoice: 'auto',
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    });

    // Accumulate text + tool-call-deltas in deze ronde.
    const toolCallAcc = {};
    let assistantContent = '';
    let sawText = false;
    let finishReason = null;

    for await (const event of stream) {
      // Mistral SDK v2.x: event.data.choices[0].delta heeft de inhoud.
      const choice = event?.data?.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};

      if (delta.content) {
        sawText = true;
        totalSawText = true;
        assistantContent += delta.content;
        send({ type: 'text', value: delta.content });
      }
      if (Array.isArray(delta.toolCalls)) {
        for (const tc of delta.toolCalls) accumulateToolCallDelta(toolCallAcc, tc);
      } else if (Array.isArray(delta.tool_calls)) {
        // sommige SDK-builds gebruiken snake_case
        for (const tc of delta.tool_calls) accumulateToolCallDelta(toolCallAcc, tc);
      }
      if (choice.finishReason) finishReason = choice.finishReason;
      else if (choice.finish_reason) finishReason = choice.finish_reason;
    }
    if (finishReason) lastFinishReason = finishReason;

    const toolCalls = Object.values(toolCallAcc).filter(t => t.function.name);

    // Geen tool-calls meer? → loop is klaar, model heeft (eventueel) tekst gestreamd.
    if (toolCalls.length === 0) break;

    // Voeg de assistant-message met tool_calls toe aan conversation,
    // execute tools, append tool-responses en loop opnieuw.
    conversation.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls.map(t => ({
        id: t.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        type: 'function',
        function: { name: t.function.name, arguments: t.function.arguments || '{}' },
      })),
    });

    send({ type: 'tool', value: toolCalls.map(t => t.function.name) });
    toolsRanThisRequest = true;

    for (const tc of toolCalls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      const result = await runTool(tc.function.name, args);
      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result),
      });
    }

    if (!sawText && safetyLoop >= MAX_TOOL_LOOPS) break;
  }

  // Retry-nudge bij STOP-zonder-tekst — zelfde logica als Gemini-loop.
  // Mistral signaleert finish_reason 'stop' voor natuurlijke afsluiting,
  // 'tool_calls' wanneer 't model nog een tool wil callen, 'length' bij
  // max-tokens, 'content_filter' bij safety. Alleen 'stop' is retry-waardig.
  if (!totalSawText && (lastFinishReason === 'stop' || lastFinishReason === null)) {
    console.warn('Mistral retry-nudge: geen tekst (toolsRan:', toolsRanThisRequest, ')');
    const lastUserMsg = (messages[messages.length - 1]?.content || '').trim();
    const nudge = toolsRanThisRequest
      ? 'Schrijf nu het antwoord op basis van de tool-resultaten hierboven. Volg het format uit de systeemprompt (voor briefings: 7-bucket structuur). Begin direct met de inhoud.'
      : `De gebruiker zei: "${lastUserMsg}". Roep DIRECT de meest passende tool aan om deze input te verwerken. Een korte verduidelijking na een eerdere "welke?"-vraag = ALTIJD tool-call met die input. Begin je response met de tool-call, niet met tekst.`;
    conversation.push({ role: 'user', content: nudge });

    try {
      let nudgeLoop = 0;
      while (nudgeLoop++ < 3) {
        const stream = await client.chat.stream({
          model: MODEL,
          messages: conversation,
          tools,
          toolChoice: 'auto',
          maxTokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
        });

        const toolCallAcc = {};
        let assistantContent = '';
        let finishReason = null;

        for await (const event of stream) {
          const choice = event?.data?.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta || {};
          if (delta.content) {
            totalSawText = true;
            assistantContent += delta.content;
            send({ type: 'text', value: delta.content });
          }
          const calls = delta.toolCalls || delta.tool_calls;
          if (Array.isArray(calls)) for (const tc of calls) accumulateToolCallDelta(toolCallAcc, tc);
          if (choice.finishReason) finishReason = choice.finishReason;
          else if (choice.finish_reason) finishReason = choice.finish_reason;
        }
        if (finishReason) lastFinishReason = finishReason;

        const toolCalls = Object.values(toolCallAcc).filter(t => t.function.name);
        if (toolCalls.length === 0) break;

        conversation.push({
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: toolCalls.map(t => ({
            id: t.id || `call_${Math.random().toString(36).slice(2, 10)}`,
            type: 'function',
            function: { name: t.function.name, arguments: t.function.arguments || '{}' },
          })),
        });
        send({ type: 'tool', value: toolCalls.map(t => t.function.name) });
        toolsRanThisRequest = true;
        for (const tc of toolCalls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
          const result = await runTool(tc.function.name, args);
          conversation.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(result),
          });
        }
      }
    } catch (nudgeErr) {
      console.warn('Mistral retry-nudge mislukt:', nudgeErr?.message || nudgeErr);
    }
  }

  // Fallback wanneer ook na de retry-nudge geen tekst kwam.
  if (!totalSawText) {
    console.warn('Mistral chat ended without text. finishReason:', lastFinishReason, 'loops:', safetyLoop);
    const hint = lastFinishReason === 'length'
      ? 'Het antwoord-budget was vol vóór de samenvatting paste. Probeer een kortere vraag.'
      : lastFinishReason === 'content_filter'
        ? 'Mistral heeft het antwoord ingetrokken op basis van safety-filters.'
        : toolsRanThisRequest
          ? `Tools liepen maar er kwam geen samenhangend antwoord. Splits de vraag op. (debug: finishReason=${lastFinishReason || 'onbekend'})`
          : `Ik kon geen actie ondernemen op deze vraag — herhaal alsjeblieft iets explicieter. (debug: finishReason=${lastFinishReason || 'onbekend'})`;
    send({ type: 'text', value: hint });
  }

  // Web-bronnen die search_web heeft verzameld als grounding-event sturen
  // (zelfde patroon als Gemini-loop — search_web zit nog op Gemini grounding).
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
}

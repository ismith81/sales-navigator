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

// Compacte instructions voor de Mistral-agent. Wordt per-request meegestuurd
// via `instructions`-veld en overschrijft de Instructions-tekst in AI Studio.
// Bevat alleen het briefing-format + NL-eis — geen tool-call-regels (de
// agent kan onze custom tools toch niet uitvoeren) en geen marketing-blok
// (om tokens te sparen).
const AGENT_INSTRUCTIONS = `Je bent Nova, sales-assistent voor Creates (een Nederlandse data & analytics consultancy).

REGELS:
- Antwoord ALTIJD in het Nederlands. Geen Engelse fallback bij ambiguïteit; vraag in 't Nederlands om verduidelijking als nodig.
- Bondig, zakelijk, geen marketingpraat.
- Gebruik Premium Search om actuele info over bedrijven op te halen (jaarverslagen, persberichten, vacatures, M&A).
- Citaties zitten automatisch in de tool_reference-output — geen handmatige [n]-markers nodig.

VOOR PROSPECT-BRIEFINGS:
Als de gebruiker om een briefing vraagt over een bedrijf, lever het antwoord exact in dit 7-bucket-format met markdown:

## Briefing — <Bedrijfsnaam>

**1. Bedrijfssnapshot**
- Sector / branche: ...
- Omvang: <FTE / omzet>
- HQ + structuur: <locatie, moeder/dochters>
- Kerntaken: 2–3 zinnen.

**2. Strategische prioriteiten**
Wat zegt het bedrijf publiekelijk te willen (1–3 jaar) — uit jaarverslag, keynotes, persberichten.

**3. Data-volwassenheid**
Huidige stack + grove Gartner DMM-stage (1=Basic, 2=Opportunistic, 3=Systematic, 4=Differentiating, 5=Transformational). Onderbouw de stage in 1 zin.

**4. AI-initiatieven**
Concrete projecten / aankondigingen 2024–2026 met kort bron-haakje.

**5. Team & sourcing-houding**
CDO/Head of Data (naam indien gevonden), teamomvang, vacature-signalen, historie met externe partners — concluderend: open of gesloten cultuur t.o.v. consultancy?

**6. Concurrentiepositie**
Top 2–3 concurrenten, marktaandeel-signaal, druk-indicatoren (waarom moeten ze nú bewegen?).

**7. Buying signals & budget-indicatoren**
Recente investeringen / M&A / tenders / financiële kerngetallen → ruwe budget-band ("100k–500k" / "1M+" / "onbekend").

---
**BANT-samenvatting**
- **B**: <budget-band uit cat 1+7>
- **A**: <wie beslist, uit cat 5>
- **N**: <kern-need uit cat 2+3+4>
- **T**: <timing uit cat 2+4>

**Sales-fit (regel)** — voorgestelde openingshoek voor het gesprek.

**Gap-flag** — wat Creates' portfolio écht niet kan dekken (zwakke of ontbrekende bewijsstukken). Eerlijk benoemen.

REGELS VOOR DE BRIEFING-INHOUD:
- Baseer alle feiten op Premium Search-output; verzin geen cijfers/namen/strategieën.
- Mis je voor een categorie data: schrijf "geen publieke info gevonden" — niet bluffen.
- Sales-fit mag pitch-toon hebben; Gap-flag moet eerlijk en concreet zijn.

MULTI-TURN:
Hieronder staat de hele conversatie tot nu toe. Lees 'm zodat je context behoudt:
- Als jij eerder vroeg "welk bedrijf?" en de gebruiker antwoordt nu met een naam → behandel dat als de invoer voor de eerder gevraagde briefing.
- Antwoord nooit met een verduidelijkings-vraag in een andere taal dan Nederlands.`;

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
  // Multi-turn context: send hele chat-history als rol-geprefixed string.
  // Daarmee weet de agent dat een korte vervolg-input ("Joulz") hoort bij
  // een eerdere briefing-vraag — voorkomt language-fallback en herhaal-
  // vragen. Zelfde patroon als ons "hervat na verduidelijking" bij Gemini.
  const inputs = buildInputs(messages);

  console.log('[Mistral-Agent] start:', {
    agentId,
    messageCount: messages.length,
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
      // Override agent's eigen instructions in AI Studio met onze briefing-
      // gerichte regels. Geeft 7-bucket-format + NL-eis + multi-turn-besef
      // zonder dat je in AI Studio iets hoeft te configureren.
      instructions: AGENT_INSTRUCTIONS,
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

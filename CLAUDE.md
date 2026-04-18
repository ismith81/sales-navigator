# Sales Navigator — Project Context

## Wat is dit?
Een interactief belscript-tool voor sales (gebruiker: Gersy).
Gersy bereidt zich voor op een klantgesprek via één van twee routes:
1. **Assistent-route** (primair): AI-chat die cases, talking points en persona-coaching ophaalt uit Supabase via Gemini function-calling. Minimale klik-configuratie — gewoon vragen.
2. **Gids-route** (guided): klikken door tabs (doelen/behoeften/diensten) → filter-knoppen → talking points + cases. Persona-context ("Met wie praat je?") hoort bij déze route en wordt alleen hier getoond.

De persona-laag is dus géén gedeelde context bovenaan — ze is onderdeel van de Gids-route. In de Assistent-route kan Gersy de rol gewoon in haar vraag verwerken ("Ik heb een CFO-gesprek over…").

## Structuur van het aanbod
Twee strategische doelen (niet 1-op-1 gekoppeld aan behoeften/diensten):

- **Doel 1:** Meer waarde halen uit data
- **Doel 2:** Data als business model

Vier behoeften: Veilig en betrouwbaar, Wendbaar, AI ready, Realtime data
Vier diensten: Data modernisatie, Governance, Data kwaliteit, Training

De relatie is: Doelen → vertalen zich in 1+ behoeften → worden ingevuld door 1+ diensten.
Één dienst kan meerdere behoeften bedienen, en één behoefte kan door meerdere diensten worden ingevuld.

Naast doelen/behoeften/diensten is er een aparte **Persona**-laag (PersonaKompas) met coaching-instructies en klantsignalen per rol — gebruikt om het gesprek op de juiste toon in te zetten.

## Cases
Cases worden aangeleverd via een Word-template (`public/case-template.docx`) met:
- Case informatie: bedrijfsnaam, omschrijving, situatie, doel, oplossing, resultaat, keywords, business impact
- Mapping: checkboxes voor doelen, behoeften en diensten

De app parseert deze templates client-side via mammoth.js (`src/utils/parseTemplate.js`).
De `anthropic-skills:case-generator` skill genereert ingevulde templates vanuit ruwe tekst.

### Huidige cases
1. **AkzoNobel** — Refinish+ Insights: data-gedreven insights-module voor bodyshops. Lambda-architectuur op Azure. Raakt aan beide doelen. Type: greenfield.
2. **CITO** — Dataplatform Modernisatie: migratie naar Microsoft Fabric. 600+ SQL-objecten, 8+ uur performancewinst. Primair doel 1. Type: modernisatie.
3. **Tulp Group** — Tulp Dataplatform op Microsoft Fabric. Medaillon-architectuur (Bronze/Silver/Gold in OneLake), SFTP-ingest uit STATER/BCMGlobal, Paginated Reports + Power Automate voor geautomatiseerde investeerdersrapportage (80–90% tijdsbesparing). Raakt beide doelen.

## Tech stack
- **Frontend:** React 18 + Vite, mammoth.js voor client-side .docx parsing, `react-markdown` voor chat-rendering
- **Backend / data:** Supabase (Postgres) — tabellen `cases`, `app_config` (filters/topics/personas als jsonb), `chat_feedback`
- **AI-assistent:** Vercel Serverless Functions (`api/chat.js`, `api/chat-feedback.js`) met Google Gemini 2.5 Flash + function calling tegen Supabase
- **Deployment:** Vercel (SPA + serverless api/), env vars: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (+ client-side `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`)

## Belangrijke bestanden
### Frontend
- `src/components/Navigator.jsx` — hoofdcomponent met state management + view-router (navigator/beheer/instructies). Auto-selectie van eerste doel is uitgezet — lege state toont de hero om de assistent te promoten.
- `src/components/HeroAssistant.jsx` — empty-state CTA-kaart met "Stel een vraag" + drie quick-prompts. Dismissible (localStorage `sn.heroDismissed`). Toont alleen als geen filter en geen zoekopdracht actief zijn.
- `src/components/CasesOverview.jsx` — zoekbare case-overzichtspagina
- `src/components/CaseCard.jsx` — case weergave met talking points + vervolgvragen
- `src/components/CaseEditor.jsx` / `CaseManager.jsx` — case CRUD-UI tegen Supabase
- `src/components/ImportCase.jsx` — upload UI met preview + bevestiging
- `src/components/FilterBar.jsx` — tabs (doelen/behoeften/diensten) + filter knoppen
- `src/components/PersonaKompas.jsx` / `PersonaManager.jsx` — persona-laag
- `src/components/FilterManager.jsx` — beheer van topics/filters in `app_config`
- `src/components/ChatPanel.jsx` — AI-chat UI (SSE streaming, sessionStorage, clickable case-links met fuzzy match, 👍/👎 feedback). Accepteert `initialPrompt` zodat quick-prompts uit de hero direct verstuurd worden bij openen.
- `src/components/TopicView.jsx` — topic-detail (description/signals/talking points/follow-ups)
- `src/components/RichTextEditor.jsx` — WYSIWYG voor topics/personas
- `src/components/Instructies.jsx` — handleiding-pagina
- `src/lib/supabase.js` — Supabase client
- `src/lib/store.js` — data-laag bovenop Supabase
- `src/utils/parseTemplate.js` — .docx → JSON conversielogica
- `src/data/filters.js` — default-configuratie doelen/behoeften/diensten (fallback)
- `src/styles/index.css` — global styles
- `public/case-template.docx` — downloadbaar Word-template voor nieuwe cases

### Backend (Vercel serverless)
- `api/chat.js` — streaming chat-endpoint. Gemini 2.5 Flash + 3 tools:
  - `search_cases({doel, behoefte, dienst, keyword})` — filtert cases-tabel
  - `get_topic({tab, name})` — haalt talking points/follow-ups uit `app_config.topics`
  - `list_personas()` — haalt persona-coaching uit `app_config.personas`
  Multi-turn tool-loop (max 5 rondes), SSE-stream `{type: 'text'|'tool'|'done'|'error'}`.
- `api/chat-feedback.js` — slaat 👍/👎 + context + tool-calls op in `chat_feedback` (RLS open-insert).

## Case JSON-formaat (Supabase `cases` tabel, snake_case)
```json
{
  "id": "bedrijfsnaam-slug",
  "name": "Bedrijfsnaam",
  "subtitle": "Korte omschrijving",
  "logo_text": "BN",
  "logo_color": "#1a6baa",
  "situatie": "...",
  "doel": "...",
  "oplossing": "...",
  "resultaat": "...",
  "keywords": ["Azure", "Databricks"],
  "business_impact": "...",
  "mapping": {
    "doelen": ["Meer waarde halen uit data"],
    "behoeften": ["Veilig en betrouwbaar", "AI ready"],
    "diensten": ["Data modernisatie", "Governance"]
  },
  "talking_points": ["Punt 1", "Punt 2"],
  "follow_ups": ["Vraag 1?", "Vraag 2?"],
  "match_reasons": {
    "doelen": { "Meer waarde halen uit data": "Korte uitleg waarom..." },
    "behoeften": { "AI ready": "Korte uitleg..." },
    "diensten": { "Data modernisatie": "Korte uitleg..." }
  }
}
```

## Chat-assistent — hoe werkt het
Hybride RAG-achtig patroon:
- **Feiten** komen uit Supabase via function-calling tools (géén hallucineren van cases/cijfers).
- **Redeneren, formuleren en NL-taal** doet Gemini.
- Systeemprompt (in `api/chat.js`) dwingt NL, bondig-zakelijk, tool-gebruik af en stuurt aan op het noemen van bedrijfsnamen zodat de UI daar klikbare links van maakt.
- ChatPanel matcht `**bedrijfsnaam**` in markdown fuzzy (lowercase, strip diacritics/leestekens) tegen bestaande case-namen → klik navigeert naar de case.

## Stijl & design
- Kleurenpalet:
  - Navy: `--navy` (#2C3C52) — topbar + donkere achtergrond
  - Teal: `--teal` (#31B7B9) — secundair accent, actieve filters, hints
  - Rood/accent: `--accent` (#ED174B) — brand accent ("Navigator" in titel), primaire CTA-kleur voor de assistent (chat-knop, hero-CTA)
- Font: Nunito Sans (body + headings, zwaardere weights voor titels) via Google Fonts
- Professioneel maar niet saai — glassmorphism cards, subtle animaties
- Tags kleur-gecodeerd: doelen=teal, behoeften=blauw, diensten=oranje
- Topbar: CSS grid met named areas (`"brand toggle" / "search search"`) op mobiel (≤640px) — rij 1 = brand + view-toggle, rij 2 = chat-knop + zoekbalk
- Chat-knop in topbar: gevuld rood met subtiele pulse-ring animatie die aandacht trekt zonder opdringerig te zijn; stopt op hover/focus

## Doelgroep
Primaire gebruiker: Gersy (sales)
Publiek van de sales calls: mix van technische en business stakeholders
Taal: Nederlands

## In overweging: "twee-routes" redesign
Na eerste gebruik bleek dat de hero-CTA en de filter-knoppen visueel om dezelfde aandacht strijden. Nieuw UX-concept (nog niet gebouwd):

- Expliciete **segmented route-toggle** bovenaan het werkgebied: `[🤖 Assistent] | [🧭 Gids]`. Default = Assistent.
- **Route "Assistent":** chat wordt het primaire scherm (niet langer side-panel). Groot inputveld, quick-prompts eronder, kleine "Wat kan de assistent?" samenvatting. Géén persona-strip — Gersy benoemt de rol gewoon in haar vraag.
- **Route "Gids":** persona-context ("Met wie praat je?") bovenaan de route, daaronder de bestaande guided flow (tabs → filter-knoppen → talking points → cases). De persona hoort uitsluitend bij deze route.
- Topbar-chat-knop kan dan weg (de chat ís nu het scherm wanneer Assistent-route actief).
- **Mobiele topbar wordt één regel:** `[brand] … [🔍] [route-toggle]`. Zoekbalk collapse't tot icon (expand-on-tap, X om te sluiten). Rij 2 verdwijnt, CSS-grid named-areas voor mobiel is dan niet meer nodig. Desktop behoudt inline zoekbalk.
- Routekeuze onthouden in localStorage, zodat power-users die altijd op Gids werken niet elke sessie opnieuw hoeven te switchen.

Naam "Gids" gekozen boven "Op onderwerp" / "Belscript" / "Verkennen": pairt natuurlijk met "Assistent" (rolnaam ↔ rolnaam), draagt de "guided"-betekenis expliciet, en is kort genoeg voor een segmented toggle.

Mockup: `Downloads/sales-navigator-mockup.html` — moet nog geüpdatet worden: persona verhuist vanuit de gedeelde context-strip ín de Gids-route, en label "Op onderwerp" → "Gids".

## Bekende verbeterpunten / backlog
- Talking points en follow-ups van geïmporteerde cases zijn auto-gegenereerd en kunnen beter
- matchReasons worden nog niet gegenereerd bij import
- Geen export-functie (bijv. case als PDF of slide genereren)
- Training-dienst heeft nog geen referentie-case
- Chat-geschiedenis is sessionStorage-only — geen cross-device geschiedenis
- Bundle-size waarschuwing (>500kB) — overwegen: route-based code splitting
- "Klantsignalen"-toggle staat rechtsboven in de context-strip maar hoort logisch bij de filter-knoppen; verhuizen bij twee-routes redesign
- Mockup bijwerken: persona uit gedeelde strip → Gids-route; label "Op onderwerp" → "Gids"
- Twee-routes redesign implementeren (segmented toggle Assistent/Gids, chat-as-main-screen voor Assistent, persona ín Gids-route, topbar-chat-knop verwijderen, localStorage route-memory)

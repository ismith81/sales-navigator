# Sales Navigator — Project Context

## Wat is dit?
Een interactief belscript-tool voor sales (gebruiker: Gersy).
Salesmedewerkers klikken op doelen, behoeften of diensten en zien direct relevante klantcases, talking points en vervolgvragen. Daarnaast is er een AI-chatassistent die Gersy helpt met gespreksvoorbereiding.

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
- `src/components/Navigator.jsx` — hoofdcomponent met state management + view-router (navigator/cases/personas/manage/instructies)
- `src/components/CasesOverview.jsx` — zoekbare case-overzichtspagina
- `src/components/CaseCard.jsx` — case weergave met talking points + vervolgvragen
- `src/components/CaseEditor.jsx` / `CaseManager.jsx` — case CRUD-UI tegen Supabase
- `src/components/ImportCase.jsx` — upload UI met preview + bevestiging
- `src/components/FilterBar.jsx` — tabs (doelen/behoeften/diensten) + filter knoppen
- `src/components/PersonaKompas.jsx` / `PersonaManager.jsx` — persona-laag
- `src/components/FilterManager.jsx` — beheer van topics/filters in `app_config`
- `src/components/ChatPanel.jsx` — AI-chat UI (SSE streaming, sessionStorage, clickable case-links met fuzzy match, 👍/👎 feedback)
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
- Donker thema: navy (`--navy` #2C3C52) + teal accent (`--teal` #31B7B9)
- Fonts: Nunito Sans (body) + Fraunces (headings) via Google Fonts
- Professioneel maar niet saai — glassmorphism cards, subtle animaties
- Tags kleur-gecodeerd: doelen=groen, behoeften=blauw, diensten=oranje
- Topbar: 2 rijen op mobiel (brand+toggle bovenin; chat-knop + zoekbalk op rij 2)

## Doelgroep
Primaire gebruiker: Gersy (sales)
Publiek van de sales calls: mix van technische en business stakeholders
Taal: Nederlands

## Bekende verbeterpunten / backlog
- Talking points en follow-ups van geïmporteerde cases zijn auto-gegenereerd en kunnen beter
- matchReasons worden nog niet gegenereerd bij import
- Geen export-functie (bijv. case als PDF of slide genereren)
- Training-dienst heeft nog geen referentie-case
- Chat-geschiedenis is sessionStorage-only — geen cross-device geschiedenis
- Bundle-size waarschuwing (>500kB) — overwegen: route-based code splitting

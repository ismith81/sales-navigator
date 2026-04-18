# Sales Navigator — Project Context

## Wat is dit?
Een interactief belscript-tool voor sales. De sales-gebruiker bereidt zich voor op een klantgesprek via één van twee routes:
1. **Assistent-route**: AI-chat met **Nova** (de sales-assistent) die cases, talking points en persona-coaching ophaalt uit Supabase via Gemini function-calling. Minimale klik-configuratie — gewoon vragen.
2. **Gids-route** (guided, default): klikken door tabs (doelen/behoeften/diensten) → filter-knoppen → talking points + cases. Persona-context ("Met wie praat je?") hoort bij déze route en wordt alleen hier getoond.

De persona-laag is dus géén gedeelde context bovenaan — ze is onderdeel van de Gids-route. In de Assistent-route kan de gebruiker de rol gewoon in de vraag verwerken ("Ik heb een CFO-gesprek over…") en Nova stemt het advies daarop af.

**Naming:** de assistent heet **Nova** (sales-assistent) — verschijnt in de chat-header en welkomsttekst. Eigen namen van eindgebruikers komen niet in de code of interface voor; altijd "de gebruiker" of "sales" gebruiken.

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
- `src/components/Navigator.jsx` — hoofdcomponent met state management + view-router (navigator/beheer/instructies) én route-router (gids/assistent) binnen de navigator-view. Route onthouden in localStorage (`sn.route`), default `gids`. Rendert de segmented route-toggle (gecentreerd boven de content), de Gids-flow in een gecentreerde `.gids-route` wrapper, of het ChatPanel in `variant="inline"` als hoofdscherm.
- `src/components/HeroAssistant.jsx` — **niet meer in gebruik** sinds de twee-routes redesign. Blijft op schijf als reserve/referentie; niet meer geïmporteerd in Navigator. Dezelfde quick-prompts zitten nu in de chat-welcome.
- `src/components/CasesOverview.jsx` — zoekbare case-overzichtspagina
- `src/components/CaseCard.jsx` — case weergave met talking points + vervolgvragen
- `src/components/CaseEditor.jsx` / `CaseManager.jsx` — case CRUD-UI tegen Supabase
- `src/components/ImportCase.jsx` — upload UI met preview + bevestiging
- `src/components/FilterBar.jsx` — tabs (doelen/behoeften/diensten) + filter knoppen
- `src/components/PersonaKompas.jsx` / `PersonaManager.jsx` — persona-laag
- `src/components/FilterManager.jsx` — beheer van topics/filters in `app_config`
- `src/components/ChatPanel.jsx` — AI-chat UI (SSE streaming, sessionStorage, clickable case-links met fuzzy match, 👍/👎 feedback). Twee varianten via `variant`-prop: `'drawer'` (default, fixed side-panel met overlay + ESC-close) en `'inline'` (rendert als gewone pagina-content; witte header i.p.v. navy, geen overlay, geen close-knop — bedoeld voor Assistent-route als hoofdscherm). Accepteert `initialPrompt` voor auto-send bij openen.
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
  - Teal: `--teal` (#31B7B9) — secundair accent, actieve filters, Gids-route actieve tekst
  - Rood/accent: `--accent` (#ED174B) — brand accent ("Navigator" in titel), Assistent-route actieve tekst
- Font: Nunito Sans (body + headings, zwaardere weights voor titels) via Google Fonts
- Professioneel maar niet saai — glassmorphism cards, subtle animaties
- Tags kleur-gecodeerd: doelen=teal, behoeften=blauw, diensten=oranje
- Iconen: stroke-SVG 2px lineCap round, currentColor (consistent door hele app — FilterBar, ChatPanel, route-toggle).
- **Route-toggle** (`.route-toggle`): gecentreerde segmented pill boven de content, compact geformatteerd (font 0.82rem, kleine padding). Actieve knop krijgt witte bg + subtiele shadow; eerste knop (Gids) actief in teal, laatste (Assistent) in accent-rood.
- **Gids-route** (`.gids-route`): max-width 900px, gecentreerd. `.context-strip--card` wrapt persona + filters in een witte card met border en zachte shadow — persona + tabs/filters + klantsignalen-toggle leven als één blok.
- **Assistent-route:** ChatPanel inline-variant (`.chat-panel--inline`) met witte header i.p.v. navy, zachte border, max-width 780px, gecentreerd.
- **Topbar** mobiel/tablet (≤768px): CSS grid één rij `[brand | search-icon | view-toggle]`. Zoekveld is collapsed tot 🔍-icon; tik → veld expandt naar rij 2 (`.topbar-search-row.is-open`). Desktop (>768px) behoudt inline zoekbalk. Breakpoint bewust op 768px zodat iPad-portrait en phones-in-landscape ook collapsed starten — de balk voelde daar "erg aanwezig". De oude topbar-chat-knop is verwijderd — de chat zit nu in de Assistent-route zelf.

## Doelgroep
Primaire gebruiker: sales (intern bij Creates)
Publiek van de sales calls: mix van technische en business stakeholders
Taal: Nederlands

## Twee-routes architectuur (geïmplementeerd)
De twee-routes redesign is live. Kern:

- **Segmented route-toggle** `[🧭 Gids] | [🤖 Assistent]` gecentreerd boven de content, compact geformatteerd. Keuze onthouden in localStorage (`sn.route`), default `gids` — nieuwe gebruikers starten in de guided flow; de assistent is één klik weg. Volgorde bewust: Gids eerst (links = meest voor-de-hand liggend startpunt), Assistent rechts.
- **Assistent-route:** ChatPanel als hoofdscherm via `variant="inline"` (open staat altijd op `true`). Chat heet **Nova** (zichtbaar in header + welkomsttekst). Geen persona-strip — de gebruiker benoemt de rol gewoon in de vraag. Chat-naar-case vanaf hier switcht naar Gids-route + zet de zoekopdracht.
- **Gids-route:** persona + guided flow (tabs → filter-knoppen → talking points → cases) in een gecentreerde wrapper. Persona hoort uitsluitend bij deze route. Klantsignalen-toggle leeft nu binnen de `.context-strip--card` naast de tabs (logisch op hun plek).
- **Geen topbar-chat-knop meer:** de chat ís het scherm wanneer Assistent-route actief.
- **Mobiele topbar één regel:** `[brand | 🔍 | view-toggle]`. Zoekbalk collapse't tot icon; tik → veld expandt naar rij 2.

Naam "Gids" gekozen boven "Op onderwerp" / "Belscript" / "Verkennen": pairt natuurlijk met "Assistent" (rolnaam ↔ rolnaam), draagt de "guided"-betekenis expliciet, en is kort genoeg voor een segmented toggle.

## Bekende verbeterpunten / backlog
- Talking points en follow-ups van geïmporteerde cases zijn auto-gegenereerd en kunnen beter
- matchReasons worden nog niet gegenereerd bij import
- Geen export-functie (bijv. case als PDF of slide genereren)
- Training-dienst heeft nog geen referentie-case
- Chat-geschiedenis is sessionStorage-only — geen cross-device geschiedenis
- Bundle-size waarschuwing (>500kB) — overwegen: route-based code splitting
- Optioneel: route-toggle sticky maken (blijft zichtbaar bij scrollen). Vereist zorgvuldige top-offset tegen de sticky topbar — niet urgent.
- `HeroAssistant.jsx` niet meer gebruikt — kan verwijderd worden, of laten staan als reserve/reference. Mockup in `Downloads/sales-navigator-mockup.html` is nog de oude versie en kan weg (of bijgewerkt worden naar de geïmplementeerde versie als referentie).

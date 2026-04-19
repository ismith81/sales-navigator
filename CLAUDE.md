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
- `src/components/Navigator.jsx` — hoofdcomponent met state management + view-router (navigator/beheer/instructies) én route-router (gids/assistent) binnen de navigator-view. Route onthouden in localStorage (`sn.route`), default `gids`. One-time migratie via `sn.route.migration` version-key leegt oude `'assistent'`-defaults eenmalig zodat bestaande gebruikers naar de nieuwe default vallen. Loading-state gebruikt een stroke-SVG spinner in huisstijl (`.loading-spinner` + `@keyframes sn-spin`), géén emoji. Rendert de segmented route-toggle (gecentreerd boven de content), de Gids-flow in een `.gids-route` wrapper (neemt volledige .app-breedte over), of het ChatPanel in `variant="inline"` als hoofdscherm.
- `src/components/HeroAssistant.jsx` — **niet meer in gebruik** sinds de twee-routes redesign. Blijft op schijf als reserve/referentie; niet meer geïmporteerd in Navigator. Dezelfde quick-prompts zitten nu in de chat-welcome.
- `src/components/CasesOverview.jsx` — zoekbare case-overzichtspagina
- `src/components/CaseCard.jsx` — case weergave met talking points + vervolgvragen
- `src/components/CaseEditor.jsx` / `CaseManager.jsx` — case CRUD-UI tegen Supabase
- `src/components/ImportCase.jsx` — upload UI met preview + bevestiging
- `src/components/FilterBar.jsx` — tabs (doelen/behoeften/diensten) + filter knoppen
- `src/components/PersonaKompas.jsx` / `PersonaManager.jsx` — persona-laag
- `src/components/FilterManager.jsx` — beheer van topics/filters in `app_config`
- `src/components/ChatPanel.jsx` — AI-chat UI (SSE streaming, sessionStorage, clickable case-links met fuzzy match, 👍/👎 feedback). Header toont **Nova** + subtitel "sales-assistent"; welkomsttekst introduceert Nova. Twee varianten via `variant`-prop: `'drawer'` (default, fixed side-panel met overlay + ESC-close) en `'inline'` (rendert als gewone pagina-content; witte header i.p.v. navy, geen overlay, geen close-knop — bedoeld voor Assistent-route als hoofdscherm). Accepteert `initialPrompt` voor auto-send bij openen.
- `src/components/TopicView.jsx` — topic-detail (description/signals/talking points/follow-ups)
- `src/components/RichTextEditor.jsx` — WYSIWYG voor topics/personas
- `src/components/Instructies.jsx` — handleiding-pagina
- `src/components/Login.jsx` — login-scherm (wachtwoord, magic-link, reset + recovery-flow) dat voor de rest van de app rendert als er geen session is.
- `src/lib/supabase.js` — Supabase client
- `src/lib/auth.js` — auth-wrapper rond `supabase.auth`: `useAuthSession()` hook, `signInWithPassword/MagicLink`, `sendPasswordReset`, `updatePassword`, `signOut`, plus `authedFetch` die het access-token als `Authorization: Bearer …` meestuurt naar `/api/*`.
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
- `api/chat-feedback.js` — slaat 👍/👎 + context + tool-calls op in `chat_feedback`. Context wordt verrijkt met `user_email` uit de JWT.
- `api/_lib/auth.js` — `requireUser(req, res)` valideert de `Authorization: Bearer <jwt>`-header via `supabase.auth.getUser(token)`. Zowel `/api/chat` als `/api/chat-feedback` retourneren 401 zonder geldige sessie.

### Auth & security
- **Supabase Auth** (e-mail + wachtwoord + magic-link + password reset). Users worden invite-only aangemaakt via het Supabase dashboard — géén self-service signup.
- **Client-gate:** `Navigator.jsx` controleert via `useAuthSession()`; zonder session wordt `<Login/>` gerendered. Data-load (`loadAll`) wacht op session om RLS-leegstand te voorkomen.
- **Server-gate:** alle serverless endpoints valideren de JWT via `requireUser()`.
- **RLS:** `cases`, `app_config`, `chat_feedback` hebben RLS aan en policies voor `authenticated` role. SQL-script staat in `supabase/auth-rls.sql`. Anon key mag client-side blijven; RLS doet het werk.
- **Uitlogknop:** rechtsboven in de topbar (logout-icon), toont e-mail in tooltip.
- **Supabase Auth-config (live):** `Allow new users to sign up` = OFF (invite-only), `Confirm email` = ON, Email provider enabled. Magic Link werkt automatisch via `signInWithOtp` zodra Email provider aan staat — er is géén aparte toggle meer in recente Supabase-versies.
- **Site URL / Redirect URLs:** staat op de productie Vercel-URL. Voor lokale dev moet `http://localhost:5173/**` in de Redirect URL-lijst; anders falen magic-links en resets stil.
- **SMTP rate limit (open issue):** Supabase's ingebouwde mailer op free tier doet ~3-4 mails/uur. Volstaat voor eenmalige invites, maar kan bij piekgebruik knellen. Besloten om voorlopig op built-in mailer te blijven; als het storend wordt: custom SMTP via Resend (3k/maand gratis) of M365 aansluiten via Authentication → Emails → SMTP Settings. Niet urgent.

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
- **Layout-breedtes:** `.app` is 1200px (centraal max-width voor topbar + content). `.gids-route` heeft géén eigen max-width meer en neemt .app-breedte over — zo lijnen brand (links), view-toggle (rechts), filter-card en case-grid op dezelfde gutters uit. `.chat-panel--inline` neemt eveneens `.app`-breedte over (`max-width: none`) zodat de chat-card uitlijnt met brand + view-toggle links/rechts.
- **Gids-route** (`.gids-route`): gecentreerd in .app. `.context-strip--card` wrapt persona + filters in een witte card met border en zachte shadow — persona + tabs/filters + klantsignalen-toggle leven als één blok.
- **Assistent-route:** ChatPanel inline-variant (`.chat-panel--inline`) met witte header i.p.v. navy, zachte border, neemt `.app`-breedte over zodat de card uitlijnt met brand + view-toggle.
- **Topbar** mobiel/tablet (≤768px): CSS grid één rij `[brand | search-icon | view-toggle]`. Zoekveld is collapsed tot 🔍-icon; tik → veld expandt naar rij 2 (`.topbar-search-row.is-open`). Desktop (>768px) behoudt inline zoekbalk. Breakpoint bewust op 768px zodat iPad-portrait en phones-in-landscape ook collapsed starten. Topbar-title heeft `overflow: hidden` + ellipsis als safety net tegen overlap met de search-icon op krappe schermen. De oude topbar-chat-knop is verwijderd — de chat zit nu in de Assistent-route zelf.
- **CSS source-order let op:** display-regels voor `.topbar-search-row` en `.topbar-search-icon` zijn gescoped achter `@media (min-width: 769px)`. Als je base-defaults toevoegt met `display: flex/none/...`, plaats ze NIET ná het mobile @media-blok — dat overschrijft de collapse-logica. Bug-geschiedenis: drie keer gebeurd.

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

## Werk-artefacten (niet committen)
`tmp/` is in `.gitignore` en bedoeld voor lokale case-generator output (docx, fill-scripts, JSON-input). Niet commiten — de gegenereerde case-docx wordt handmatig in Beheer geïmporteerd via de case-template upload.

## Bekende verbeterpunten / backlog
- Talking points en follow-ups van geïmporteerde cases zijn auto-gegenereerd en kunnen beter
- matchReasons worden nog niet gegenereerd bij import
- Geen export-functie (bijv. case als PDF of slide genereren)
- Training-dienst heeft nog geen referentie-case
- Chat-geschiedenis is sessionStorage-only — geen cross-device geschiedenis
- Bundle-size waarschuwing (>500kB) — overwegen: route-based code splitting
- Optioneel: route-toggle sticky maken (blijft zichtbaar bij scrollen). Vereist zorgvuldige top-offset tegen de sticky topbar — niet urgent.
- `HeroAssistant.jsx` niet meer gebruikt — kan verwijderd worden, of laten staan als reserve/reference. Mockup in `Downloads/sales-navigator-mockup.html` is nog de oude versie en kan weg (of bijgewerkt worden naar de geïmplementeerde versie als referentie).
- Custom SMTP (Resend of M365) inregelen wanneer de built-in mailer te krap wordt — zie Auth & security.

## Nova-roadmap — van bibliothecaris naar sales-assistent
Doel: Nova ontwikkelt zich van "ophalen uit database" naar een volwaardige sales-assistent
die sparring biedt, content genereert (mail, decks) en uiteindelijk onthoudt. We werken
in fasen; elke fase moet op zichzelf waarde leveren zodat het team 'm direct kan gebruiken.

### Fase 1 — Prompt-upgrade (sparring-partner) — geen code-bouw, alleen prompt
Herschrijf systeemprompt in `api/chat.js` van "wat mag je" naar "wie ben je en wat lever je op".
Voeg expliciete `WAT JE KUNT DOEN`-sectie toe met 5 skills:
- **Voorbereiding** — compleet belscript-draaiboek (opening, discovery-vragen, bezwaren, ask)
- **Synthese** — case + persona → openingswoord op maat
- **Rollenspel** — Nova speelt de persona, blijft in karakter tot "stop"
- **Checklist** — sales plakt pitch, Nova toetst tegen talking points + follow-ups
- **Vergelijken** — meerdere cases naast elkaar
Plus `WERKWIJZE`-blok: begrijp → haal op (meerdere tool-calls als nodig) → synthetiseer.
Quick-prompts in ChatPanel: eentje vervangen door een rollenspel-voorbeeld.

### Fase 2 — Follow-up mail + gespreksnotes → actielijst
Nieuwe chat-"skills" die Nova al kan met de huidige tools + prompt:
- Sales plakt ruwe gespreksnotes → Nova genereert follow-up-mail concept in Creates-toon.
- Notes-in → actielijst-uit met wie-wat-wanneer, in markdown-checklist.
Geen tool-wijzigingen nodig; wel quick-prompt toevoegen en in docs noemen.

### Fase 3 — Slide-deck-generator (pptx-opzet)
Concrete content-generatie. Haalbaar in 2-3 dagen werk.
- Gemini levert slide-JSON (titel, bullets, case-referenties); server genereert .pptx via
  `pptxgenjs` (Node) of aparte Python-lambda met `python-pptx`.
- Creates-huisstijl-template als basis.
- UI: knop in ChatPanel bij een gegenereerd antwoord of aparte /decks-route.
- 5-10 slides: titel, klantsituatie, Creates-aanpak, bewijs-case, ROI, next step.

### Fase 4 — Prospect-briefing (web-fetch tool)
Vierde tool voor Nova: `fetch_url({url})` — haalt HTML op, strips tags, geeft platte tekst.
- Gebruik: sales plakt LinkedIn-URL of bedrijfssite → Nova maakt 1-pagina briefing.
- Let op privacy + rate-limits; waarschijnlijk alleen publieke pagina's (geen login-walls).
- LinkedIn blokkeert scraping; overwegen: LinkedIn API of handmatig-profiel-plakken i.p.v.
  URL-fetch. Start met generieke URL-fetch voor bedrijfssites.

### Fase 5 — Memory-laag + cross-device chat
Huidige chat-geschiedenis is sessionStorage-only. Voor echte "Nova onthoudt" hebben we
een persistence-laag nodig:
- Nieuwe Supabase-tabel `chat_sessions` (user_id, title, messages[], created_at).
- Client-side: lijst-view van eerdere sessies, resume-knop.
- Optioneel later: `client_interactions`-tabel voor klant-specifieke memory
  (wat besproken in vorige meeting met contact X).

### Mapping: roadmap-fases ↔ sales-journey-fases
Handig om in de gaten te houden welke fase van het klantgesprek we wanneer bedienen.
De bouwvolgorde (1 → 5) is op impact/moeite, niet op chronologie van de sales-flow.

| Roadmap-fase | Sales-journey-fase | Levert |
|---|---|---|
| Fase 1 — Prompt-upgrade | Vóór het gesprek (+ deels Coaching) | Belscript, rollenspel, pitch-checklist, synthese |
| Fase 2 — Mail + notes | Ná het gesprek | Follow-up mail, actielijst uit gespreksnotes |
| Fase 3 — Slide-deck-generator | Content-generatie (voor/tijdens gesprek) | Pitch-deck als voorbereiding of hand-out |
| Fase 4 — Prospect-briefing | Vóór het gesprek | Research-brief uit publieke bedrijfssites |
| Fase 5 — Memory-laag | Fundament (enables Vóór + Ná) | Cross-device history + per-klant memory |

**Onderscheid tussen de drie "Vóór"-fases** (volgorde in gebruik, niet in bouw):
1. **Fase 4** eerst — je weet weinig over de prospect, Nova maakt research-brief.
2. **Fase 1** daarna — je hebt context, Nova helpt je je gesprek voorbereiden
   (belscript, rollenspel, tegenargumenten oefenen).
3. **Fase 3** als laatste — pitch-deck op basis van 1 + 2.

**Gaten in de dekking** (bewust in backlog):
- *Tijdens het gesprek* — audio/live-support technisch mogelijk maar complex + privacy-gevoelig.
- *Coaching* — pitch-review, tone-coach, onboarding-mode.
- *Integraties* — agenda-hook, CRM, Teams-bot.
- *Nova eet zichzelf* — gap-analyse, auto-suggesties voor nieuwe talking points.

### Later / backlog (niet nu)
- Objection-handler als aparte mode (zit al in Fase 1 prompt-skills)
- Agenda-hook (Outlook/Google) → 30 min vóór meeting auto-briefing in Teams
- CRM-integratie (HubSpot/Salesforce)
- Audio/live-support tijdens gesprek
- Onboarding-mode voor nieuwe sales
- Pitch-review / tone-coach
- Auto-case-intake via chat (nu via skill)

## Status (laatste sessie)
- **Auth is live op productie** (`main` → Vercel). Supabase Auth + RLS actief, invite-only, magic-link werkt bevestigd.
- **Users:** Ian is ingelogd (magic-link). Collega-uitnodiging voor `g.lommen@creates.nl` stuitte op rate limit — moet later opnieuw verstuurd worden zodra het uurtje voorbij is.
- **Open op auth:** tweede user (`g.lommen@creates.nl`) opnieuw uitnodigen zodra SMTP-rate-limit voorbij is. Optioneel: Ian een wachtwoord laten zetten via password-recovery mail.
- **Header opgeschoond:** kompas-icoon verplaatst naar de topbar als brand-icon (`.topbar-brand-icon`, teal). Mobiel (≤768px) verbergt titel + Creates-logo, toont alleen het icon (26×26). PersonaKompas-titel ("Met wie praat je?") heeft nu een persona-groep-SVG i.p.v. het kompas, zodat icons niet meer dubbelen.
- **Nova-roadmap Fase 1 afgerond:** system prompt in `api/chat.js` herschreven van "bibliothecaris" naar "sparring-partner". Toegevoegd: expliciete skills (Voorbereiding, Synthese, Rollenspel, Checklist/review, Vergelijken), WERKWIJZE-sectie die meerdere tool-calls na elkaar aanmoedigt, bedrijfsnaam altijd **vet** voor klikbare links. Quick-prompts in ChatPanel vernieuwd met een rollenspel- en een vergelijk-voorbeeld.
- **Volgende werk:** Instructies-pagina herstructureren met sub-tabs (Algemeen / Nova / Beheer) — de Nova-sectie wordt met Fase 1 significant groter en verdient eigen ruimte. Daarna Fase 2 (mail+notes als Nova-output).

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
De live lijst leeft in de app (Beheer → Cases) en is de bron van waarheid — onderstaande is enkel context voor anker-cases. Stand april 2026: 5 cases in productie (CITO, Tulp Group, Int. verf & coating, Int. leverancier promo artikelen, Westland Kaas).

Anker-cases die vaker terugkomen in redeneringen/defaults:
- **CITO** — Dataplatform Modernisatie: migratie naar Microsoft Fabric. 600+ SQL-objecten, 8+ uur performancewinst. Primair doel 1. Type: modernisatie.
- **Tulp Group** — Tulp Dataplatform op Microsoft Fabric. Medaillon-architectuur (Bronze/Silver/Gold in OneLake), SFTP-ingest uit STATER/BCMGlobal, Paginated Reports + Power Automate voor geautomatiseerde investeerdersrapportage (80–90% tijdsbesparing). Raakt beide doelen. Case-artefacten in `tmp/` (gegenereerd via `case-generator` skill, geïmporteerd via Beheer).
- **Int. verf & coating** (AkzoNobel-afgeleid) — data-gedreven insights-module voor bodyshops. Lambda-architectuur op Azure. Raakt beide doelen. Type: greenfield.

## Tech stack
- **Frontend:** React 18 + Vite, mammoth.js voor client-side .docx parsing, `react-markdown` voor chat-rendering, `lucide-react` voor stroke-SVG iconen (persona-picker)
- **Backend / data:** Supabase (Postgres) — tabellen `cases`, `app_config` (filters/topics/personas als jsonb), `chat_feedback`
- **AI-assistent:** Vercel Serverless Functions (`api/chat.js`, `api/chat-feedback.js`) met Google Gemini 2.5 Flash + function calling tegen Supabase
- **Deployment:** Vercel (SPA + serverless api/), env vars: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (+ client-side `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`)

## Belangrijke bestanden
### Frontend
- `src/components/Navigator.jsx` — hoofdcomponent met state management + view-router (navigator/beheer/instructies) én route-router (gids/assistent) binnen de navigator-view. Route onthouden in localStorage (`sn.route`), default `gids`. One-time migratie via `sn.route.migration` version-key leegt oude `'assistent'`-defaults eenmalig zodat bestaande gebruikers naar de nieuwe default vallen. Loading-state gebruikt een stroke-SVG spinner in huisstijl (`.loading-spinner` + `@keyframes sn-spin`), géén emoji. Rendert de segmented route-toggle (gecentreerd boven de content), de Gids-flow in een `.gids-route` wrapper (neemt volledige .app-breedte over), of het ChatPanel in `variant="inline"` als hoofdscherm.
- `src/components/HeroAssistant.jsx` — **niet meer in gebruik** sinds de twee-routes redesign. Blijft op schijf als reserve/referentie; niet meer geïmporteerd in Navigator. Dezelfde quick-prompts zitten nu in de chat-welcome.
- `src/components/CasesOverview.jsx` — zoekbare case-overzichtspagina. Filtert op `searchQuery`, `activeFilter` (tab + onderwerp) én `activePersona` (`mapping.personas`). Heading wordt alleen gerenderd bij actieve filter of persona (`Referenties voor "X"` / `Referenties voor <persona>` / gecombineerd `Referenties voor "X" · <persona>`). Default-state toont alleen het grid, géén "Alle cases"-H2 of counter — de grid spreekt voor zich.
- `src/components/CaseCard.jsx` — case weergave met talking points + vervolgvragen
- `src/components/CaseEditor.jsx` / `CaseManager.jsx` — case CRUD-UI tegen Supabase
- `src/components/ImportCase.jsx` — upload UI met preview + bevestiging
- `src/components/FilterBar.jsx` — tabs (doelen/behoeften/diensten) + filter-chips. Layout is twee rijen: `.nav-tabs-row` (alleen tabs) en `.filter-row` (chips + klantsignalen-toggle op één regel). Toggle stond eerder rechts losgeslagen in de tabs-rij; nu zit 'ie direct na de laatste chip (`margin-left: 0`, links-uitgelijnd) zodat 'ie visueel bij het onderwerp hoort waarvoor je signalen toont.
- `src/components/PersonaKompas.jsx` / `PersonaManager.jsx` — persona-laag. PersonaManager heeft een interne `IconPickerPopover` sub-component: compacte trigger-button (actief icoon + label) die een floating 6-koloms grid opent bij klik. Sluit bij outside-click, Escape, of na selectie. Backup-bar binnen CaseManager staat in een `<details>` collapsible onderaan — zeldzame admin-actie, niet evenveel gewicht als + Toevoegen.
- `src/components/FilterManager.jsx` — beheer van topics/filters in `app_config`
- `src/components/ChatPanel.jsx` — AI-chat UI (SSE streaming, sessionStorage, clickable case-links met fuzzy match, 👍/👎 feedback). Header toont **Nova** + subtitel "sales-assistent"; welkomsttekst introduceert Nova. Twee varianten via `variant`-prop: `'drawer'` (default, fixed side-panel met overlay + ESC-close) en `'inline'` (rendert als gewone pagina-content; witte header i.p.v. navy, geen overlay, geen close-knop — bedoeld voor Assistent-route als hoofdscherm). Accepteert `initialPrompt` voor auto-send bij openen.
- `src/components/TopicView.jsx` — topic-detail (description/signals/talking points/follow-ups)
- `src/components/RichTextEditor.jsx` — WYSIWYG voor topics/personas
- `src/components/Instructies.jsx` — handleiding met sub-tabs (Algemeen / Nova / Beheer). Nova-tab documenteert de 5 skills + "wat Nova (nog) niet doet" — hoort gelijk op te lopen met elke roadmap-fase.
- `src/components/Login.jsx` — login-scherm (wachtwoord, magic-link, reset + recovery-flow) dat voor de rest van de app rendert als er geen session is.
- `src/lib/chatHistory.js` — chat-geschiedenis-laag bovenop Supabase (`chat_sessions`-tabel). Functies: `listSessions` (laatste sessies, sortering pinned-first dan recency, max 30 — pinned + max 20 unpinned), `loadSession(id)`, `createSession(messages)`, `updateSession(id, {messages, title})`, `setSessionPinned(id, pinned)`, `deleteSession(id)`, plus `getActiveSessionId/setActiveSessionId` (sessionStorage-cache van de actieve sessie-id voor refresh-survival). Auto-prune in `createSession` verwijdert oudste **ongepinde** sessies wanneer er meer dan 20 zijn — gepinde sessies tellen niet mee en blijven onbeperkt staan. Title wordt afgeleid van eerste user-bericht (60 chars + ellipsis). RLS in DB scoped op `auth.uid() = user_id`.
- `src/lib/teamMembers.js` — data-laag voor consultant-profielen (Beheer → Team). CRUD op `team_members`-tabel + `team-cvs` Storage-bucket. Functies: `listTeamMembers`, `getTeamMember(id)`, `createTeamMember`, `updateTeamMember`, `deleteTeamMember`, plus PDF-flow `parseCvPdf(file)` (POST naar `/api/cv-parse` met base64-PDF), `uploadCvPdf(memberId, file)` (Storage-upload met member-id-prefixed path) en `getCvPdfUrl(path, expires)` (signed URL voor preview). Verwijderen ruimt ook de PDF in Storage op (best effort). RLS authed-all (alle ingelogde users kunnen lezen + schrijven, geen owner-koppeling in Fase A).
- `src/components/TeamManager.jsx` — Beheer-tab "Team" — lijst van profielen met +Nieuw teamlid en +CV uploaden. Bij CV-upload eerst `parseCvPdf` voor structured fields (Gemini), dan editor opent met velden voorgevuld + `_pendingPdf` voor upload-bij-saven.
- `src/components/TeamMemberEditor.jsx` — form voor één profiel: naam, rol, senioriteit, kernskills, technologies, sectoren, projectervaring (inline editor), certificaten, klantgerichte samenvatting, beschikbaarheid, CV-PDF (vervangen + opnieuw parsen-flow). Tags-velden via komma-gescheiden text (snel typen, parsen → arrays bij save).
- `src/lib/supabase.js` — Supabase client
- `src/lib/auth.js` — auth-wrapper rond `supabase.auth`: `useAuthSession()` hook, `signInWithPassword/MagicLink`, `sendPasswordReset`, `updatePassword`, `signOut`, plus `authedFetch` die het access-token als `Authorization: Bearer …` meestuurt naar `/api/*`.
- `src/lib/store.js` — data-laag bovenop Supabase
- `src/lib/personaIcons.jsx` — curated Lucide icon-registry (30 stroke-SVG 2px icons) + `<PersonaIcon name=... />` component. Accepteert bekende keys (bv. `"briefcase"`), valt via `EMOJI_TO_KEY` terug op Lucide-equivalent voor oude emoji-strings (backwards-compat met bestaande Supabase-personas, geen DB-migratie nodig). Rendert default `User`-icon als `name` leeg is.
- `src/utils/parseTemplate.js` — .docx → JSON conversielogica
- `src/data/filters.js` — default-configuratie doelen/behoeften/diensten (fallback)
- `src/styles/index.css` — global styles
- `public/case-template.docx` — downloadbaar Word-template voor nieuwe cases

### Backend (Vercel serverless)
- `api/cv-parse.js` — extract gestructureerde profiel-velden uit een CV-PDF (voor Beheer → Team). Body `{ pdfBase64 }` → response `{ text, fields }`. Server: base64 decode → `pdf-parse` voor platte tekst → Gemini 2.5 Flash met `responseSchema` voor structured JSON (name, role, seniority, kernskills, technologies, sectors, project_experience, certifications, summary). Body-limit 5MB, max PDF 6MB raw. Tekst boven 50k chars wordt afgeknipt voor Gemini. Vereist `requireUser`-auth (zie `_lib/auth.js`).
- `api/chat.js` — streaming chat-endpoint. Gemini 2.5 Flash + function calling. Vijf tools:
  - `search_cases({doel, behoefte, dienst, persona, branche, keyword})` — filtert cases-tabel
  - `get_topic({tab, name})` — haalt talking points/follow-ups uit `app_config.topics`
  - `list_personas()` — haalt persona-coaching uit `app_config.personas`
  - `search_web({query})` — Google Search grounding als custom function-wrapper. Doet intern een aparte Gemini-call met alleen `{ googleSearch: {} }` aan, retourneert `{text, sources, queries}`. **Workaround voor een Gemini-beperking:** `googleSearch` en function declarations mogen NIET in één request (API geeft 400 "Built-in tools and Function Calling cannot be combined"). Door grounding in een tool-wrapper te steken ziet Nova 't als een gewone tool en kan ze 't combineren met de andere tools. Kost wel een extra Gemini-roundtrip per web-lookup. Geen aparte API-key; inclusief met `GEMINI_API_KEY`.
  - `prospect_brief({company})` — gestructureerde briefing-research. Doet intern 3 parallelle `search_web`-calls (snapshot+strategie / data+AI / team+budget+concurrentie) en levert al het materiaal voor de 7 vaste briefing-buckets. Sources worden automatisch via `search_web` in `webSourcesBuffer` gebufferd, dus 't grounding-event aan 't eind bevat alle 3 cluster-bronnen samen. Bedoeld voor de eerste pass van een briefing; follow-up-vragen op een briefing gebruiken `search_web` direct.
  Multi-turn tool-loop (max 5 rondes), SSE-stream `{type: 'text'|'tool'|'grounding'|'done'|'error'}`. Module-level buffers (`webSourcesBuffer`, `webQueriesBuffer`) verzamelen bronnen over alle `search_web`-subcalls; worden per-request gereset aan 't begin van de handler en aan 't eind als één `grounding`-event gestuurd met `{sources: [{uri, title}], queries: []}`. ChatPanel rendert 'm als "Bronnen (Google Search)"-blok onder het antwoord; chips in "Gebruikte context" komen vanzelf via `TOOL_LABELS` (`prospect_brief` → Briefing, `search_web` → Web, `search_cases` → Cases). Fallback: als de tool-loop eindigt zonder ooit tekst te streamen wordt een diagnose-melding gestuurd (incl. `finishReason`).

### Briefing-raamwerk (vast 7-bucket format)
Elke briefing levert deze categorieën in deze volgorde, gestuurd door de systeemprompt:
1. **Bedrijfssnapshot** — sector/branche, omvang (FTE/omzet), HQ + structuur, kerntaken
2. **Strategische prioriteiten** — publiek uitgesproken doelen 1–3 jaar
3. **Data-volwassenheid** — stack + grove Gartner DMM-stage (1=Basic … 5=Transformational)
4. **AI-initiatieven** — concrete projecten 2024–2025
5. **Team & sourcing-houding** — CDO/Head of Data, vacatures als proxy, partners-historiek (open/gesloten cultuur)
6. **Concurrentiepositie** — top concurrenten, druk-indicatoren
7. **Buying signals & budget-indicatoren** — investeringen/M&A/tenders → ruwe budget-band

Afsluitend (los van de 7): **BANT-samenvatting** (Budget/Authority/Need/Timeline-rijtje), **Sales-fit** (openingshoek), **Gap-flag** (waar Creates-portfolio leeg of zwak is — eerlijk benoemd, geen oversell).
- `api/chat-feedback.js` — slaat 👍/👎 + context + tool-calls op in `chat_feedback`. Context wordt verrijkt met `user_email` uit de JWT.
- `api/_lib/auth.js` — `requireUser(req, res)` valideert de `Authorization: Bearer <jwt>`-header via `supabase.auth.getUser(token)`. Zowel `/api/chat` als `/api/chat-feedback` retourneren 401 zonder geldige sessie.

### Auth & security
- **Supabase Auth** (e-mail + wachtwoord + magic-link + password reset). Users worden invite-only aangemaakt via het Supabase dashboard — géén self-service signup.
- **Client-gate:** `Navigator.jsx` controleert via `useAuthSession()`; zonder session wordt `<Login/>` gerendered. Data-load (`loadAll`) wacht op session om RLS-leegstand te voorkomen.
- **Server-gate:** alle serverless endpoints valideren de JWT via `requireUser()`.
- **RLS:** `cases`, `app_config`, `chat_feedback` hebben RLS aan met `authenticated`-role-policies (SQL: `supabase/auth-rls.sql`). `chat_sessions` heeft user-scoped RLS via `auth.uid() = user_id` voor select/insert/update/delete — een user ziet/schrijft alleen z'n eigen sessies (SQL: `supabase/chat-sessions.sql`). `team_members` heeft authenticated-all RLS (consultant-profielen zijn intern team-data, gedeelde lezen+schrijven; SQL: `supabase/team-members.sql`). Storage-bucket `team-cvs` (privé) heeft eveneens authenticated-all policies voor select/insert/update/delete. Anon key mag client-side blijven; RLS doet het werk.
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
- Iconen: stroke-SVG 2px lineCap round, currentColor (consistent door hele app — FilterBar, ChatPanel, route-toggle). Persona-iconen via Lucide (zie `src/lib/personaIcons.jsx`) — **geen emoji's in de interface**, die voelden kitscherig naast de rest van de app. Bestaande Supabase-emoji's renderen automatisch als Lucide via `EMOJI_TO_KEY`-map; gebruiker kan via picker in Beheer → Persona's handmatig upgraden.
- **Route-toggle** (`.route-toggle`): gecentreerde segmented pill boven de content, compact geformatteerd (font 0.82rem, kleine padding). Actieve knop krijgt witte bg + subtiele shadow; eerste knop (Gids) actief in teal, laatste (Assistent) in accent-rood.
- **Layout-breedtes:** `.app` is 1200px (centraal max-width voor topbar + content). `.gids-route` heeft géén eigen max-width meer en neemt .app-breedte over — zo lijnen brand (links), view-toggle (rechts), filter-card en case-grid op dezelfde gutters uit. `.chat-panel--inline` neemt eveneens `.app`-breedte over (`max-width: none`) zodat de chat-card uitlijnt met brand + view-toggle links/rechts.
- **Gids-route** (`.gids-route`): gecentreerd in .app. `.context-strip--card` wrapt persona + filters in een witte card met border en zachte shadow — persona + tabs/filters + klantsignalen-toggle leven als één blok.
- **Assistent-route:** ChatPanel inline-variant (`.chat-panel--inline`) met witte header i.p.v. navy, zachte border, neemt `.app`-breedte over zodat de card uitlijnt met brand + view-toggle.
- **Topbar (NOS-stijl, met sub-nav):** flex-container `[topbar-left | topbar-search-row? | topbar-actions]` met `flex-wrap: wrap` zodat de search-row op rij 2 valt via `flex-basis: 100% + order: 10` wanneer `.is-open`. `.topbar-left` bevat de home-knop (`.topbar-home` — brand-icon + titel) plus de `.view-toggle` (kale tekst-nav met accent-underline voor actief, géén pills). Elke hoofd-view zit in een `.view-item` kolom met daaronder een **absolute-positioned `.view-subnav`** die alléén zichtbaar is voor de actieve view (`.is-active` → `display: flex`). Omdat de subnav absolute is draagt-ie niet bij aan de flow — hoofd-items blijven daarom op een vaste plek terwijl de subnav visueel onder de aangrenzende inactieve items door kan lopen. De topbar reserveert voldoende `padding-bottom` (2.5rem desktop / 2.4rem mobiel) voor de subnav. `.topbar-actions` bevat zoek-icon + logout-icon als kale transparante buttons. Zoek is op álle breedtes collapsed tot icon; klik → input full-width op rij 2 (sits onder de subnav via `margin-top: 2rem`). Mobiel (≤768px) verbergt alleen `.topbar-title`; subnav-items krijgen iets grotere font (0.88rem) voor tap-targets. Typing in het zoekveld switcht automatisch naar de Navigator-view.
- **Sub-secties per hoofd-view:** Navigator heeft subnav `[Gids · Assistent]` (routes binnen navigator). Beheer heeft subnav `[Cases · Onderwerpen · Persona's]` — "Onderwerpen" is de korte naam voor doelen/behoeften/diensten (komt overeen met `app_config.topics`). Instructies heeft subnav `[Algemeen · Nova · Beheer]`. De sub-sectie wordt als `section`-prop doorgegeven aan `CaseManager` en `Instructies` die alléén de matching sectie renderen. De child-componenten (`CaseManager`, `FilterManager`, `PersonaManager`, `Instructies`) hebben géén eigen H2-header meer, en ook géén intro-regel (`.cm-section-sub` is verwijderd) of "Overzicht"-h3 — de topbar-subnav is de enige titel-bron. Content begint meteen met de primaire actie (+ Toevoegen rechts-uitgelijnd) of de lijst zelf.
- **Sticky case-editor topbar:** binnen de case-editor plakt `.ce-topbar` onder de app-topbar bij scrollen. Top-offset komt uit CSS-var `--topbar-height` die Navigator live berekent (`offsetHeight + 2px buffer`, dubbele rAF tegen late subnav-paint, `document.fonts.ready` voor font-shift). Layout: `[← Terug] [Bewerken / Casenaam] [✓ Opslaan]` met ellipsis-truncate op de titel. Mobiel (≤640px): back-knop icon-only met `aria-label`, eyebrow verborgen, 44px tap-targets.
- **Breathability topbar:** subnav heeft `padding-top: 0.65rem` (desktop) / 0.8rem (mobiel) zodat sub-items visueel los staan van hoofd-nav — naar voorbeeld van nos.nl. Subnav-gap 1.4rem desktop / 1rem mobiel.
- **CSS source-order let op:** display-regels voor `.topbar-search-row` worden nu aangestuurd via `.is-open`-klasse (base: `display: none`). Geen `@media`-gescoped gedrag meer nodig. Als je base-defaults voor topbar-elementen toevoegt: plaats ze vóór de `@media (max-width: 768px)`-block om overschrijving te voorkomen. Bug-geschiedenis: drie keer gebeurd.

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
- **Topbar twee-regelig, NOS-stijl:** `[🧭 Sales Navigator · Navigator · Beheer · Instructies] ... [🔍 ↗]` met daaronder de subnav van de actieve view. Brand = home-knop, nav = kale tekst met underline voor actief (geen pills), acties rechts = kale transparante icons. Zoek op álle breedtes collapsed tot icon; klik → input full-width op rij 2. Mobiel toont alleen het icon + nav + acties (titel verborgen). Zoeken is beschikbaar vanuit élke view — typen switcht automatisch naar Navigator.

Naam "Gids" gekozen boven "Op onderwerp" / "Belscript" / "Verkennen": pairt natuurlijk met "Assistent" (rolnaam ↔ rolnaam), draagt de "guided"-betekenis expliciet, en is kort genoeg voor een segmented toggle.

## Werk-artefacten (niet committen)
`tmp/` is in `.gitignore` en bedoeld voor lokale case-generator output (docx, fill-scripts, JSON-input). Niet commiten — de gegenereerde case-docx wordt handmatig in Beheer geïmporteerd via de case-template upload.

## Bekende verbeterpunten / backlog
- Talking points en follow-ups van geïmporteerde cases zijn auto-gegenereerd en kunnen beter
- matchReasons worden nog niet gegenereerd bij import
- **Persona-mapping op cases onvolledig** — niet alle cases hebben `mapping.personas` ingevuld. Zodra een gebruiker in de Gids-route een persona in het kompas kiest, filtert de case-grid op die persona; ontbrekende mappings = lege lijst. Content-taak: per case nalopen en persona's koppelen via Beheer → Cases.
- Geen export-functie (bijv. case als PDF of slide genereren)
- Training-dienst heeft nog geen referentie-case
- ~~Chat-geschiedenis is sessionStorage-only~~ — vervangen door persistente Supabase-laag (zie Fase 5)
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

### Fase 4 — Prospect-briefing (Google Search via search_web — live)
Nova heeft een `search_web({query})`-tool die intern Gemini's `googleSearch`-grounding
aanroept. Gebruik: gebruiker noemt een prospect ("maak een briefing over Bol.com"),
Nova besluit `search_web` te callen, combineert de uitkomst met `search_cases` op de
gevonden sector, en levert een briefing met klikbare bronnen.
- Geen aparte API-key; inclusief met `GEMINI_API_KEY`.
- **Waarom search_web als wrapper, niet directe googleSearch?** Gemini's REST API
  weigert `googleSearch` + function declarations in één request (400 "Built-in tools
  and Function Calling cannot be combined"). Door de grounding in een custom function
  te verpakken kan Nova 't combineren met haar andere tools. Kost wel een extra
  Gemini-roundtrip per web-lookup.
- Bronnen + zoekqueries komen via een `grounding`-SSE-event (één keer aan 't eind),
  verzameld uit alle `search_web`-subcalls. ChatPanel rendert ze als `.chat-sources`
  blok; **Web**-chip komt automatisch via `TOOL_LABELS.search_web`.
- **Privacy-regel die erin is geschoven:** alleen publiek web. Geen login-walls, geen
  LinkedIn-scrapes, geen CRM-data. Systeemprompt bevat deze expliciet.
- Niet verder uitgewerkt (backlog): een aparte `fetch_url({url})`-tool voor wanneer sales
  een specifieke URL wil laten samenvatten. KvK-lookup ligt geparkeerd op branch
  `nova-kvk-lookup` (wacht op API-key beslissing; usage-based betaald).

### Fase 5 — Memory-laag + cross-device chat (deels live)
**Live (basis chat-geschiedenis):** Supabase-tabel `chat_sessions` (zie `supabase/chat-sessions.sql`)
met user-scoped RLS. Client-laag in `src/lib/chatHistory.js`. ChatPanel header heeft een
kebab-menu (⋮) met "Nieuw gesprek" + laatste 10 sessies + "Wissen huidig". Auto-save
debounced 700ms na elke message-mutation; eerste user-bericht maakt de sessie aan,
daarna updates. Title afgeleid uit eerste user-bericht (60 chars). Bij overschrijden van
10 sessies: oudste auto-delete in `pruneOldSessions`. Active session-id in
sessionStorage zodat refresh mid-conversatie de plek niet kwijtraakt. RLS scope:
`auth.uid() = user_id` voor alle CRUD-acties.

**Backlog (memory-uitbreiding):**
- Pinnen/archiveren van sessies (nu: harde 10-limit met FIFO-delete)
- Title editen (nu: alleen auto-derived)
- `client_interactions`-tabel voor klant-specifieke memory (wat besproken in vorige meeting)
- Realtime sync tussen tabs van dezelfde user

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
- **Alles live op `main` via Vercel** — auth, Nova Fase 1, NOS-style topbar, sub-tabs, password-recovery fix.
- **Nova Fase 1 afgerond:** system prompt in `api/chat.js` is sparring-partner i.p.v. bibliothecaris — expliciete skills (Voorbereiding, Synthese, Rollenspel, Checklist/review, Vergelijken), WERKWIJZE die meerdere tool-calls na elkaar aanmoedigt, bedrijfsnamen altijd **vet** voor klikbare case-links. Quick-prompts vernieuwd (rollenspel + vergelijk-voorbeeld).
- **Instructies herstructureerd** met sub-tabs (Algemeen / Nova / Beheer). Nova-tab bevat nu de 5 skills met voorbeeldvragen + een "wat Nova (nog) niet doet"-sectie die direct op de roadmap mapt.
- **Topbar NOS-redesign + sub-nav:** view-toggle is kale tekst-nav met accent-underline voor actief (geen pill meer). Elke hoofd-view heeft een absolute-positioned subnav onder zich die alléén zichtbaar is voor de actieve view (Navigator: Gids/Assistent · Beheer: Cases/Onderwerpen/Persona's · Instructies: Algemeen/Nova/Beheer). Hoofd-items blijven daarom op een vaste plek — de subnav loopt visueel door onder inactieve aangrenzende items. Breathability pass: subnav padding-top 0.65rem desktop / 0.8rem mobiel (naar nos.nl-voorbeeld), grotere mobile font (0.88rem). Topbar reserveert voldoende `padding-bottom` (2.5rem / 2.4rem mobiel). Brand is één `.topbar-home` button; zoek + logout in `.topbar-actions`. Zoek collapsed tot icon op alle breedtes, typing switcht automatisch naar Navigator. De sub-sectie wordt als prop doorgegeven aan `CaseManager` en `Instructies`, en child-componenten hebben géén eigen H2-header meer (voorkom dubbele titels).
- **TP/FU editor in Beheer→Onderwerpen:** `FilterManager` heeft nu een `FmListEditor` sub-component voor inline bewerken van "Wat zeg je?" (talking points) en "Wat vraag je?" (follow-ups) per topic — click-to-edit textareas, Enter=save, Esc=cancel. Data gaat via `onUpdateTopicMeta(category, name, { talkingPoints | followUps })`.
- **Knoppen genormaliseerd:** "Nieuwe Case" / "Case importeren" / Backup downloaden/herstellen gebruiken allemaal `.btn-add-small` (solid teal border — géén dashed meer).
- **Persona-iconen naar Lucide:** emoji's vervangen door een curated set van 30 Lucide stroke-SVG 2px icons (briefcase, crown, users, target, barchart, database, cpu, code, rocket, brain, shield, handshake, …) via nieuwe `<PersonaIcon />` component. Picker in PersonaManager is een compacte popover-trigger (niet een altijd-zichtbaar grid); sluit bij outside-click, Escape, of selectie. Backwards-compat: bestaande Supabase-personas met emoji-strings renderen automatisch als Lucide via een `EMOJI_TO_KEY`-map — geen DB-migratie nodig. Seed-defaults in `src/data/personas.json` zijn naar Lucide-keys omgezet (`briefcase`, `cpu`, `barchart`, `wrench`). Let op bij CSS: zowel `.fm-row-wrap` als `.fm-field` hadden `overflow: hidden` — beide overschreven op `.expanded` / `.pm-field-icon` zodat popovers kunnen uitklappen.
- **Beheer compacter:** redundante intro-regels (bv. "Beheer persona-coaching per rol.") en "Overzicht"-h3 verwijderd. Persona-row-titel krijgt `white-space: nowrap + ellipsis` zodat "Business · Operationeel" niet meer wrapt op mobiel. Axes-regel onder de titel (bv. "Business · Strategisch") wordt verborgen als 'ie exact gelijk is aan het label — alleen zichtbaar na hernoemen. Backup-bar is een `<details>` collapsible geworden (`✎ Backup & herstel ▾`) onderaan de Cases-sectie.
- **Password-recovery flow gefixt:** Navigator luistert globaal op `PASSWORD_RECOVERY`-event. Supabase maakt direct een session bij de reset-link, dus de oude `if (!session) return <Login/>`-check sloeg de recovery-step over. Nu rendert Login in recovery-mode óók als er al een session is; Login roept `onRecoveryDone` aan zodra het nieuwe wachtwoord staat.
- **Dev-bypass login:** als `import.meta.env.DEV` en `.env.local` bevat `VITE_DEV_EMAIL` + `VITE_DEV_PASSWORD`, roept Navigator één keer `signInWithPassword` aan → je slaat het loginscherm over in `npm run dev`. Productie raakt dit niet (DEV=false én env-vars ontbreken daar). Workaround voor SMTP-rate-limit: wachtwoord direct zetten via SQL:
  ```sql
  update auth.users
  set encrypted_password = crypt('<wachtwoord>', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now())
  where email = '<email>';
  ```
- **Open op auth:** tweede user (`g.lommen@creates.nl`) opnieuw uitnodigen of SQL-wachtwoord zetten zodra gewenst.
- **Case-editor sticky-fix:** `.ce-topbar` plakt nu correct onder de app-topbar via dynamisch gemeten `--topbar-height` (ResizeObserver + `document.fonts.ready` + dubbele rAF). Sticky bar toont [← Terug] [Bewerken / Casenaam] [✓ Opslaan]; mobiel krijgt icon-only back-knop + kleinere padding.
- **PowerPoint-export verwijderd:** `pptxgenjs` dependency en `src/utils/exportPptx.js` weg. Decks komen mogelijk terug in Nova-roadmap Fase 3 (ander mechanisme: Gemini → slide-JSON → server-side pptx).
- **Klantcase Tulp Group geïmporteerd:** case-generator skill produceerde `case-tulp-group.docx` in `tmp/` (samen met `tulp_case.json` en `fill_template.py`). Handmatig geüpload via Beheer → Cases en nu zichtbaar in de Gids-route.
- **Gids-route fine-tuning (deze sessie):**
  - `CasesOverview` is in default-state strakker: geen `Alle cases`-H2 en geen `5 cases`-counter meer; alleen het grid. Heading verschijnt pas zodra een filter of persona actief is (`Referenties voor "X"` / `Referenties voor <persona>` / gecombineerd).
  - **Persona filtert cases**: als de gebruiker een persona selecteert in het PersonaKompas filtert `CasesOverview` op `mapping.personas`. Heading adapteert.
  - **Klantsignalen-toggle in flow:** verplaatst van `.nav-tabs-row` (zweefde rechts los) naar een nieuwe `.filter-row` naast de chips. Links-uitgelijnd, sluit direct aan op de laatste chip.
  - Onderwerpen-beheer: overbodige horizontale lijn boven "Doelen" weg (`.fm-container` had nog `border-top` uit een tijd dat er een H2 boven stond).
  - Cases-tabel: kolomtitel "Case" verwijderd (logo + naam zijn zelf-evident).
- **Mobiele fixes (deze sessie):**
  - Viewport meta: `maximum-scale=1, viewport-fit=cover`. Pinch-zoom uit zodat de layout niet halverwege een zoom blijft hangen; iOS-accessibility-zoom blijft als vangnet.
  - CSS: `@media (max-width: 768px)` forceert form-inputs naar 16px om iOS Safari's auto-zoom-on-focus uit te zetten.
  - `html, body { max-width: 100%; overflow-x: clip; }` (hidden fallback) — horizontaal uit de viewport pannen kan niet meer. `clip` i.p.v. `hidden` zodat `position: sticky` (topbar-subnav, case-editor-bar) blijft werken.
- **Instructies bijgewerkt:** persona-kompas start ingeklapt, zoek is altijd collapsed icon (typen switcht naar Navigator), case-overview default-state zonder heading, backup zit in inklapbaar blok, nieuwe sectie introduceert de Beheer sub-tabs, Lucide icon-picker uitgelegd bij Persona's.
- **Volgende werk:** Fase 2 — follow-up mail + gespreksnotes→actielijst als Nova-skills. Geen tool-wijzigingen nodig, wel quick-prompt + Nova-tab update. Content-kant: persona-mapping op cases aanvullen (zie backlog) — anders filtert persona-selectie naar een lege lijst voor niet-gemapte cases.
- **Nova Fase 4 — Google Search via search_web (branch `nova-google-search`):** `api/chat.js` heeft een 4e function-declaration `search_web({query})`. Die tool doet intern een aparte Gemini-call (`gemini-2.5-flash`, `tools: [{ googleSearch: {} }]`) en retourneert `{text, sources, queries}`. Dit is een workaround: Gemini's REST API geeft 400 "Built-in tools and Function Calling cannot be combined" als je `googleSearch` en functionDeclarations in dezelfde request zet. Door 't als wrapper te doen kan Nova 't gewoon naast haar andere tools gebruiken. Module-level buffers (`webSourcesBuffer`, `webQueriesBuffer`) verzamelen bronnen over alle `search_web`-subcalls, worden per-request gereset en als één `grounding`-SSE-event gestuurd vóór `done`. ChatPanel's handler zet `groundingSources`/`groundingQueries` op het message-object; Web-chip komt automatisch via `TOOL_LABELS.search_web` omdat `search_web` in het reguliere `tool`-event zit. `.chat-sources` CSS-blok rendert "Bronnen (Google Search)" met genummerde klikbare links. Systeemprompt heeft Prospect-briefing als 8e skill (verwijst nu naar `search_web`). Quick-prompt "Briefing over bedrijf" in "Voor het gesprek"-groep. Instructies Nova-tab bijgewerkt. Geen aparte env var. **Eerste versie had directe `{ googleSearch: {} }` naast tools — werkte niet door bovenstaande API-beperking; workaround gecommit op 24-04-2026.** KvK-alternatief geparkeerd op `nova-kvk-lookup`.
- **Team-feature Fase A (branch `nova-team-profiles`, gemerged):** nieuwe Beheer sub-tab "Team" voor consultant-profielen. Database: `team_members`-tabel met gestructureerde velden (name, role, seniority, kernskills/technologies/sectors als text[], project_experience jsonb, certifications, summary, available_for_sales) + Storage-bucket `team-cvs` voor de PDF-bestanden. Beide RLS authenticated-all (intern team-data, geen owner-koppeling in Fase A). Frontend: `TeamManager` (lijst + acties), `TeamMemberEditor` (form). Twee upload-flows: "+ Nieuw teamlid" voor handmatig + "+ CV uploaden" voor PDF → parse → prefill. Server-endpoint `api/cv-parse.js` doet `pdf-parse` voor extractie + Gemini 2.5 Flash met `responseSchema` voor structured output. Pad-conventie: PDFs in Storage onder `<member-id>/<timestamp>-<filename>`. **Fase A is foundation; Fase B-E op de roadmap:** B=Nova-tools `find_team_members` en `get_team_member`, C=embeddings + pgvector voor semantische zoek, D=cases ↔ team-leden koppeling, E=output-format "sales-enablement-blok" (top-3 + cases + pitch + gaten + conceptmail). DEPLOY-NOTE: SQL-migratie `supabase/team-members.sql` moet eenmalig draaien + bucket `team-cvs` aanmaken via Storage UI (privé).

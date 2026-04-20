# Claude Handoff

Gebruik `AGENTS.md` als canonieke projectcontext. Dit bestand is alleen de korte overdracht voor de volgende Claude-sessie.

## Huidige status

- `main` staat op merge commit `41ed9b0` (`Merge branch 'develop'`).
- `develop` staat op `528f53c`.
- Feature branch van deze sessie: `codex/nova-fase-2-follow-up-notes` met tip commit `8bbaaae`.

## In deze sessie afgerond

### Nova Fase 2 aangescherpt

- `api/chat.js` prompt uitgebreid voor:
  - follow-up mail uit gespreksnotities
  - actielijst uit notities
- Follow-up mails zijn nu expliciet strenger:
  - Nova moet herkenbare haakjes in notes actief scannen
  - bij plausibele persona/branche/doel/behoefte/dienst/case-haakjes eerst tools gebruiken
  - als er tool-context is, moet die ook zichtbaar benut worden in de output

### Assistent-route UX-pass

- `src/components/ChatPanel.jsx`
- `src/styles/index.css`

Belangrijkste veranderingen:

- quick prompts gegroepeerd in `Voor het gesprek` en `Na het gesprek`
- duidelijkere onboarding-copy voor Nova
- helpertekst bij de composer
- context-tags onder assistent-antwoorden (`Cases`, `Topics`, `Persona’s`)
- empty-state compacter gemaakt
- subtiel pulserende teal dot teruggebracht in de intro
- dubbele intro in de empty-state verwijderd

### Topbar / layout polish

- `src/components/Navigator.jsx`
- `src/styles/index.css`

Belangrijkste veranderingen:

- hoofdtopbar blijft vast in beeld op desktop en mobiel
- subnav klapt weg bij scroll en komt stabiel terug via hysterese
- hoofdnav en brand typografisch uitgelijnd
- divider/subnav-layout opgeschoond

## Bekende follow-up kansen

### 1. Persona-mapping op cases aanvullen

Dit staat al in `AGENTS.md` als inhoudelijke backlog en is nog steeds een logische volgende stap. De Gids-route filtert inmiddels op persona; ontbrekende mappings geven zwakke of lege resultaten.

### 2. Nova-output inhoudelijk evalueren

Check in de preview of Nova bij follow-up mails nu vaak genoeg echte Creates-context gebruikt. Als antwoorden nog te generiek voelen, volgende aanscherping waarschijnlijk in `api/chat.js`, niet in UI.

### 3. Bundle size

Vite build waarschuwt nog steeds voor grote chunks (`>500kB` gzipped warning blijft bestaan). Nog niet aangepakt.

## Praktische notities

- Lokale ongetrackte bestanden zoals `.agents/` en `AGENTS.md` kunnen in de worktree staan; niet blind meenemen in commits.
- `npm.cmd run build` werkt; gewone `npm run build` via PowerShell kan last hebben van execution policy.
- Voor chat-endpoints lokaal is kale `vite` niet genoeg; daarvoor heb je Vercel/serverless context nodig.

# Sales Navigator — Project Context

## Wat is dit?
Een interactief belscript-tool voor sales (gebruiker: Gersy).
Salesmedewerkers klikken op doelen, behoeften of diensten en zien direct relevante klantcases, talking points en vervolgvragen.

## Structuur van het aanbod
Twee strategische doelen (niet 1-op-1 gekoppeld aan behoeften/diensten):

- **Doel 1:** Meer waarde halen uit data
- **Doel 2:** Data als business model

Vier behoeften: Veilig en betrouwbaar, Wendbaar, AI ready, Realtime data
Vier diensten: Data modernisatie, Governance, Data kwaliteit, Training

De relatie is: Doelen → vertalen zich in 1+ behoeften → worden ingevuld door 1+ diensten.
Één dienst kan meerdere behoeften bedienen, en één behoefte kan door meerdere diensten worden ingevuld.

## Cases
Cases worden aangeleverd via een Word-template (public/case-template.docx) met:
- Case informatie: bedrijfsnaam, omschrijving, situatie, doel, oplossing, resultaat, keywords, business impact
- Mapping: checkboxes voor doelen, behoeften en diensten

De app kan deze templates importeren via mammoth.js (client-side .docx parsing in src/utils/parseTemplate.js).

### Huidige cases
1. **AkzoNobel** — Refinish+ Insights: data-gedreven insights-module voor bodyshops. Lambda-architectuur op Azure. Raakt aan beide doelen. Type: greenfield.
2. **CITO** — Dataplatform Modernisatie: migratie naar Microsoft Fabric. 600+ SQL-objecten, 8+ uur performancewinst. Primair doel 1. Type: modernisatie.

## Tech stack
- React 18 + Vite
- mammoth.js voor client-side .docx parsing
- Statische site, geen backend nodig
- Deployment: `npm run build` → dist/ folder hosten

## Belangrijke bestanden
- `src/data/cases.json` — alle cases als JSON (single source of truth)
- `src/data/filters.js` — configuratie van doelen, behoeften, diensten
- `src/utils/parseTemplate.js` — .docx → JSON conversielogica
- `src/components/Navigator.jsx` — hoofdcomponent met state management
- `src/components/CaseCard.jsx` — case weergave met talking points + vervolgvragen
- `src/components/ImportCase.jsx` — upload UI met preview + bevestiging
- `src/components/FilterBar.jsx` — tabs (doelen/behoeften/diensten) + filter knoppen
- `src/styles/index.css` — global styles
- `public/case-template.docx` — downloadbaar Word-template voor nieuwe cases

## Case JSON-formaat
```json
{
  "id": "bedrijfsnaam-slug",
  "name": "Bedrijfsnaam",
  "subtitle": "Korte omschrijving",
  "logoText": "BN",
  "logoColor": "#1a6baa",
  "situatie": "...",
  "doel": "...",
  "oplossing": "...",
  "resultaat": "...",
  "keywords": ["Azure", "Databricks"],
  "businessImpact": "...",
  "mapping": {
    "doelen": ["Meer waarde halen uit data"],
    "behoeften": ["Veilig en betrouwbaar", "AI ready"],
    "diensten": ["Data modernisatie", "Governance"]
  },
  "talkingPoints": ["Punt 1", "Punt 2"],
  "followUps": ["Vraag 1?", "Vraag 2?"],
  "matchReasons": {
    "doelen": { "Meer waarde halen uit data": "Korte uitleg waarom..." },
    "behoeften": { "AI ready": "Korte uitleg..." },
    "diensten": { "Data modernisatie": "Korte uitleg..." }
  }
}
```

## Stijl & design
- Donker thema: navy (#0B1D3A) + groen accent (#00D68F)
- Fonts: DM Sans (body) + Fraunces (headings) via Google Fonts
- Professioneel maar niet saai — glassmorphism cards, subtle animaties
- Tags zijn kleur-gecodeerd: doelen=groen, behoeften=blauw, diensten=oranje

## Doelgroep
Primaire gebruiker: Gersy (sales)
Publiek van de sales calls: mix van technische en business stakeholders
Taal: Nederlands

## Bekende verbeterpunten / backlog
- Geïmporteerde cases overleven geen page refresh (geen persistentie)
- Talking points en follow-ups van geïmporteerde cases zijn auto-gegenereerd en kunnen beter
- matchReasons worden nog niet gegenereerd bij import
- Geen zoekfunctie
- Geen export-functie (bijv. case als PDF of slide genereren)
- Training-dienst heeft nog geen referentie-case

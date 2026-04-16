# Sales Navigator

Interactief belscript-tool voor sales. Klik op doelen, behoeften of diensten om direct relevante klantcases, talking points en vervolgvragen te zien.

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in je browser.

## Hoe werkt het?

### Navigeren
1. Kies bovenaan een categorie: **Doelen**, **Behoeften** of **Diensten**
2. Klik op een filter-knop (bijv. "Data als business model")
3. Je ziet direct alle matching cases met talking points en vervolgvragen

### Case toevoegen via import
1. Klik op **📥 Case importeren**
2. Download het lege template (`.docx`)
3. Vul het template in met de klantcase + kruis de mapping aan
4. Upload het ingevulde template
5. Controleer de preview en klik op **Toevoegen**

### Case handmatig toevoegen
Voeg een nieuw object toe aan `src/data/cases.json`. Bekijk de bestaande cases (AkzoNobel, CITO) als voorbeeld.

## Projectstructuur

```
sales-navigator/
├── public/
│   └── case-template.docx       ← downloadbaar template
├── src/
│   ├── components/
│   │   ├── Navigator.jsx         ← hoofdcomponent
│   │   ├── CaseCard.jsx          ← case weergave
│   │   ├── ImportCase.jsx        ← docx upload + parsing
│   │   └── FilterBar.jsx         ← tabs + filter knoppen
│   ├── data/
│   │   ├── cases.json            ← alle cases
│   │   └── filters.js            ← doelen/behoeften/diensten config
│   ├── utils/
│   │   └── parseTemplate.js      ← docx → JSON parser
│   ├── styles/
│   │   └── index.css             ← global styles
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js
```

## Case JSON-formaat

Elke case in `cases.json` heeft dit formaat:

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

## Deployen

```bash
npm run build
```

De `dist/` folder kan je hosten op GitHub Pages, Vercel, Netlify, of elke andere statische hosting.

## Tech stack
- **React 18** + **Vite**
- **mammoth.js** — client-side .docx parsing
- Geen backend nodig

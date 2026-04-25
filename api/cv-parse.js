// Vercel Serverless Function — extract gestructureerde profiel-velden uit een
// CV-PDF voor de Team-feature van de Sales Navigator.
//
// Flow:
//   1. Client uploadt PDF (base64-encoded in de JSON-body)
//   2. Server decode → buffer → pdf-parse extract text
//   3. Server stuurt text naar Gemini met responseSchema voor structured JSON
//   4. Server retourneert { text, fields } — frontend prefilt het edit-form
//
// Verondersteld: CV's zijn AVG-proof (geen NAW/geboortedata/etc.). Gemini
// krijgt alleen platte tekst doorgestuurd; we slaan zelf alleen wat we via
// de schema-extractie eruit halen.
//
// Body (JSON): { pdfBase64: string, fileName?: string }
// Response (JSON, 200):
//   { text: string, fields: { name, role, seniority, kernskills[], ... } }

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { extractText, getDocumentProxy } from 'unpdf';
import { requireUser } from './_lib/auth.js';

const EXTRACT_PROMPT = `Je krijgt de platte tekst van een CV. Haal hier de volgende
gestructureerde velden uit en lever ze terug als JSON volgens het opgegeven schema.

**Wees ruimhartig in extractie**: als een term, project, sector of skill in de tekst
staat, neem 'm op. Pas op met "verzinnen" — je mag niets toevoegen dat NIET in
de tekst voorkomt — maar als iets letterlijk genoemd wordt of impliciet evident
is (bv. een bedrijfsnaam in een projectsectie = projectervaring), gebruik 't.

Regels voor extractie:
- name: voor- + achternaam zoals 't in 't CV staat. Eén string.
- role: huidige functietitel of meest dominante rol (bv. "Analytics Engineer",
  "Data Engineer", "BI Consultant"). Kijk naar de meest recente functie of
  de titel die opent op het CV.
- seniority: één van [Junior, Medior, Professional, Senior, Lead, Principal].
  Kies op basis van: jaren ervaring, expliciet vermelde titel, scope van projecten.
  Bij echt geen aanwijzing → "Professional".
- kernskills: 5–12 hoofd-vaardigheden (vakmanschap, geen tools). Voorbeelden:
  "Datamodellering", "Stakeholdermanagement", "Pipeline-bouw", "DAX",
  "Solution-architectuur", "Requirements-elicitation", "Coaching".
  Géén tools/merknamen (die horen onder technologies).
- technologies: tools, platforms, frameworks, talen, services. Voorbeelden:
  "Power BI", "Microsoft Fabric", "Databricks", "Azure", "AWS", "SQL Server",
  "Python", "dbt", "Snowflake", "Tableau". Pak ALLES wat duidelijk een tech-
  stack-onderdeel is — wees ruimhartig.
- sectors: branches/sectoren waarin de consultant heeft gewerkt
  (bv. "Onderwijs", "Retail & e-commerce", "Overheid & non-profit",
  "Financial services", "Zorg", "Industrie & manufacturing",
  "Logistiek & transport", "Energy & utilities", "Professional services").
  Gebaseerd op project- of klantnamen die in een bekende sector vallen.
- project_experience: 3–10 belangrijkste projecten met { name, role, description }.
  name = klantnaam of projectnaam. role = wat de consultant deed (bv. "Lead
  Data Engineer", "Solution architect"). description = 1–2 zinnen over scope/
  impact. Pak liever te veel dan te weinig — sales kan filteren.
- certifications: officiële certificaten/diploma's met afkorting of leverancier
  (bv. "PL-300", "DP-203", "Azure Data Engineer Associate", "AWS Solutions
  Architect"). Géén interne cursussen of self-paced trainingen.
- summary: 2–3 zinnen klantgerichte profielsamenvatting in de derde persoon
  ("Jessica is een Analytics Engineer met sterke ervaring in..."). Bedoeld
  voor sales om te kopiëren naar offertes/voorstellen. Toon = professioneel-
  zelfverzekerd, geen marketing-jargon.

Wees consistent in casing en spelling. Gebruik exacte titels uit het CV waar
mogelijk; bij twijfel: kies de meest commerciële formulering.

**Belangrijk**: laat een veld alléén leeg als 't echt nergens uit te halen is.
Bij 5+ jaar Power BI-ervaring zou je niet "geen technologies" moeten teruggeven.
Bij een uitgebreid project-overzicht zou je niet 0 projects moeten extracten.`;

const responseSchema = {
  type: SchemaType.OBJECT,
  required: ['name'],
  properties: {
    name: { type: SchemaType.STRING },
    role: { type: SchemaType.STRING },
    seniority: { type: SchemaType.STRING },
    kernskills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    technologies: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    sectors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    project_experience: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          role: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
      },
    },
    certifications: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    summary: { type: SchemaType.STRING },
  },
};

// Vercel default body-limit is 4.5MB JSON. Base64 inflate ~1.33x dus
// ruwe PDF tot ~3.4MB past. Zet expliciet in case van platform-defaults.
export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY ontbreekt in env.' });
    return;
  }

  const { pdfBase64 } = req.body || {};
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    res.status(400).json({ error: 'pdfBase64 (string) is verplicht.' });
    return;
  }

  // Strip optionele data-URL-prefix ("data:application/pdf;base64,...")
  const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
  let buffer;
  try {
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch {
    res.status(400).json({ error: 'pdfBase64 is geen geldige base64-string.' });
    return;
  }
  if (buffer.length === 0 || buffer.length > 6 * 1024 * 1024) {
    res.status(400).json({ error: 'PDF leeg of groter dan 6MB.' });
    return;
  }

  // ─── Stap 1: PDF → platte tekst (via unpdf, serverless-friendly) ───────
  // unpdf is een modern alternatief voor pdf-parse zonder de test-file-bug
  // bij module-load (pdf-parse v1/v2 probeert ./test/data/05-versions-space.pdf
  // te lezen tijdens require, wat op Vercel-functies een ENOENT-crash gaf).
  let text = '';
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: pages } = await extractText(pdf, { mergePages: true });
    text = (Array.isArray(pages) ? pages.join('\n') : (pages || '')).trim();
  } catch (err) {
    console.error('cv-parse: unpdf extractie fout', err);
    res.status(500).json({ error: 'Kon PDF niet lezen. Is het bestand een geldige PDF?' });
    return;
  }
  if (!text) {
    res.status(422).json({ error: 'PDF bevatte geen leesbare tekst (gescand zonder OCR?).' });
    return;
  }

  // Knip extreem lange CV's af voor Gemini — alles boven ~50k chars
  // is meestal pagina-overflow van templates en niet relevant.
  const truncated = text.length > 50000 ? text.slice(0, 50000) : text;

  // ─── Stap 2: Gemini structured extraction ──────────────────────────────
  let fields = {};
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
      systemInstruction: EXTRACT_PROMPT,
    });
    const result = await model.generateContent(truncated);
    const raw = result.response.text();
    fields = JSON.parse(raw);
  } catch (err) {
    console.error('cv-parse: Gemini extract fout', err);
    res.status(500).json({
      error: 'CV ingelezen, maar het structureren is mislukt. Vul de velden handmatig.',
      text: truncated,
      fields: {},
    });
    return;
  }

  // Diagnose-info zodat de UI bij dunne extractie kan vertellen wat er
  // gebeurde (was 't tekst-armoede of Gemini-extract-armoede?).
  const diagnostics = {
    textLength: truncated.length,
    fieldsFilled: countFilledFields(fields),
  };
  console.log('cv-parse OK', diagnostics);
  res.status(200).json({ text: truncated, fields, diagnostics });
}

// Telt hoeveel "echte" velden er gevuld zijn — om te bepalen of de
// extractie matig was (puur signaal voor diagnostics, geen logica).
function countFilledFields(f = {}) {
  let n = 0;
  if (f.name) n++;
  if (f.role) n++;
  if (f.seniority) n++;
  if (Array.isArray(f.kernskills) && f.kernskills.length) n++;
  if (Array.isArray(f.technologies) && f.technologies.length) n++;
  if (Array.isArray(f.sectors) && f.sectors.length) n++;
  if (Array.isArray(f.project_experience) && f.project_experience.length) n++;
  if (Array.isArray(f.certifications) && f.certifications.length) n++;
  if (f.summary) n++;
  return n;
}

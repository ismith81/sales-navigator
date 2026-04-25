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
import pdfParse from 'pdf-parse';
import { requireUser } from './_lib/auth.js';

const EXTRACT_PROMPT = `Je krijgt de platte tekst van een CV. Haal hier de volgende
gestructureerde velden uit en lever ze terug als JSON volgens het opgegeven schema.

Regels voor extractie:
- name: voor- + achternaam zoals 't in 't CV staat. Eén string.
- role: huidige functietitel (bv. "Analytics Engineer", "Data Engineer", "BI Consultant").
- seniority: één van [Junior, Medior, Professional, Senior, Lead, Principal] op basis
  van wat 't CV zegt; als 't onduidelijk is kies "Professional".
- kernskills: 5–10 hoofd-vaardigheden (bv. "Datamodellering", "Stakeholdermanagement",
  "Pipeline-bouw", "DAX"). Geen merknamen — die horen bij technologies.
- technologies: tools, platforms, frameworks (bv. "Power BI", "Microsoft Fabric",
  "Databricks", "Azure", "SQL Server", "Python", "dbt"). Merknamen, geen vage termen.
- sectors: branches/sectoren waarin de consultant heeft gewerkt
  (bv. "Onderwijs", "Retail", "Overheid & non-profit", "Financial services", "Zorg",
  "Industrie & manufacturing", "Logistiek & transport", "Energy & utilities",
  "Professional services").
- project_experience: 3–8 belangrijkste projecten met { name, role, description }.
  description = 1–2 zinnen wat de consultant deed en waarom 't relevant is.
- certifications: officiële certificaten/diploma's (bv. "PL-300", "DP-203",
  "Azure Data Engineer Associate"). Géén self-paced cursussen of opleidingen.
- summary: 2–3 zinnen klantgerichte profielsamenvatting in de derde persoon
  ("Jessica is een Analytics Engineer met sterke ervaring in..."). Bedoeld
  voor sales om te kopiëren naar offertes/voorstellen.

Wees consistent in casing en spelling. Gebruik exacte titels uit het CV waar
mogelijk; bij twijfel: kies de meest commerciële formulering.

Als een veld echt niet uit 't CV te halen is: lege string of lege array,
maar nooit verzinnen.`;

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

  // ─── Stap 1: PDF → platte tekst ────────────────────────────────────────
  let text = '';
  try {
    const parsed = await pdfParse(buffer);
    text = (parsed?.text || '').trim();
  } catch (err) {
    console.error('cv-parse: pdf-parse fout', err);
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

  res.status(200).json({ text: truncated, fields });
}

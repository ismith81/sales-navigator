// Embedding-helper rondom Gemini's embedding-001 — gratis bij de bestaande
// GEMINI_API_KEY, 768 dimensies, multilingual (NL/EN samen werkt prima
// voor onze gemixte CV-content).
//
// Pipeline-rol: server-side endpoints (embed-team-member.js,
// embed-team-backfill.js) gebruiken deze helper om profielen te embedden;
// find_team_members embedt de query-string en doet een vector-search.
//
// Model-keuze: text-embedding-004 was de eerste keuze maar geeft 404 op
// het v1beta endpoint via de SDK. embedding-001 is de stabiele fallback
// met dezelfde 768 dimensies — match met onze vector(768)-kolom.
// Upgraden naar gemini-embedding-001 of -2 vereist outputDimensionality
// of een schema-aanpassing (3072 dim default).

import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBED_MODEL = 'embedding-001';
const EMBED_DIMS = 768; // moet matchen met de vector(768)-kolom in DB

// Bovengrens voor input-text — text-embedding-004 ondersteunt tot ~2048
// tokens. Eén token ~ 4 chars, dus 8000 chars zit comfortabel binnen de
// limit zonder uitgebreide tokenisatie nodig te hebben.
const MAX_INPUT_CHARS = 8000;

// Genereert een embedding voor een tekst. Returnt array van 768 floats,
// of null bij lege/ongeldige input. Throwt op API-fouten zodat de caller
// kan beslissen wat te doen (loggen + door, of failen).
export async function embedText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY ontbreekt in env.');

  const input = trimmed.length > MAX_INPUT_CHARS
    ? trimmed.slice(0, MAX_INPUT_CHARS)
    : trimmed;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(input);
  const values = result?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error(`embedText: onverwachte respons-shape (verwacht ${EMBED_DIMS} floats).`);
  }
  return values;
}

// Bouwt het embedding-document voor een team-lid: één tekst die alle
// signaalrijke velden combineert. Volgorde + labels zijn bewust — de
// embedding-kwaliteit is hoger als de tekst leesbaar Nederlands is i.p.v.
// een platte JSON-dump. Header-kopjes ("Kernskills:", "Sectoren:") helpen
// het model context-grenzen te begrijpen.
//
// Velden die meegaan:
//   role + summary  → narratieve identiteit
//   kernskills      → kerncompetenties (gestructureerd)
//   technologies    → tools/platforms
//   sectors         → branches (canonical lijst)
//   certifications  → formele kwalificaties
//   project_experience → naam + rol + omschrijving per project
//   cv_text         → volledige CV-prose (kostbaarste signaal voor
//                     soft-vragen / synoniemen)
//
// cv_text gaat als laatste mee zodat 't bij truncatie als eerste
// wordt afgeknipt — de gestructureerde velden zijn compacter en
// dichter op de canonical kernel van skill-vocabulaire.
export function buildTeamMemberEmbedDocument(member = {}) {
  const lines = [];
  if (member.name) lines.push(member.name);
  if (member.role) lines.push(member.role);
  if (member.seniority) lines.push(`Senioriteit: ${member.seniority}`);
  if (member.summary) {
    lines.push('');
    lines.push(member.summary);
  }
  if (Array.isArray(member.kernskills) && member.kernskills.length) {
    lines.push('');
    lines.push(`Kernskills: ${member.kernskills.join(', ')}`);
  }
  if (Array.isArray(member.technologies) && member.technologies.length) {
    lines.push(`Technologies: ${member.technologies.join(', ')}`);
  }
  if (Array.isArray(member.sectors) && member.sectors.length) {
    lines.push(`Sectoren: ${member.sectors.join(', ')}`);
  }
  if (Array.isArray(member.certifications) && member.certifications.length) {
    lines.push(`Certificaten: ${member.certifications.join(', ')}`);
  }
  if (Array.isArray(member.project_experience) && member.project_experience.length) {
    lines.push('');
    lines.push('Projecten:');
    for (const p of member.project_experience) {
      const head = [p?.name, p?.role].filter(Boolean).join(' — ');
      const desc = (p?.description || '').trim();
      if (head && desc) lines.push(`- ${head}: ${desc}`);
      else if (head) lines.push(`- ${head}`);
      else if (desc) lines.push(`- ${desc}`);
    }
  }
  if (member.cv_text) {
    lines.push('');
    lines.push('CV-tekst:');
    lines.push(member.cv_text);
  }
  return lines.join('\n').trim();
}

// Helper om een vector(768)-waarde naar de Postgres-string-syntax te
// converteren. Supabase's JS client serialiseert arrays als jsonb; voor
// een vector-kolom moet het format `[v1,v2,...]` als string zijn.
export function formatVectorForPostgres(values) {
  if (!Array.isArray(values)) return null;
  return `[${values.join(',')}]`;
}

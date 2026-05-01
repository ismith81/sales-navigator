// Vercel Serverless Function — embedt alle team-leden die nog geen
// embedding hebben. Bedoeld als één-keer-backfill na de SQL-migratie en
// als reparatie-knop in Beheer → Team voor wanneer er ooit profielen zonder
// embedding ontstaan (bv. door een eerdere Gemini-API-storing).
//
// Optioneel: { force: true } in de body herrekent álle embeddings, ook
// die al gevuld zijn. Handig na grote profiel-updates of wanneer we
// op een ander embedding-model overstappen (text-embedding-3-small).
//
// Response (200): { processed, succeeded, failed, errors }
// Response (4xx/5xx): { error: string }

import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_lib/auth.js';
import { embedText, buildTeamMemberEmbedDocument, formatVectorForPostgres } from './_lib/embeddings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { force = false } = req.body || {};

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  // Alle profielen ophalen — alleen rijen waar embedding null is, tenzij
  // force=true dan alles. Pak inclusief cv_text en project_experience want
  // de helper bouwt 't document daaruit.
  let query = supabase
    .from('team_members')
    .select('id, name, role, seniority, kernskills, technologies, sectors, project_experience, certifications, summary, cv_text, embedding');
  if (!force) query = query.is('embedding', null);

  const { data: members, error: fetchErr } = await query;
  if (fetchErr) {
    console.error('embed-team-backfill fetch fout:', fetchErr.message);
    res.status(500).json({ error: 'Kon team-leden niet ophalen.' });
    return;
  }

  if (!members || members.length === 0) {
    res.status(200).json({
      processed: 0,
      succeeded: 0,
      failed: 0,
      message: force
        ? 'Geen team-leden gevonden.'
        : 'Alle team-leden hebben al een embedding. Stuur { force: true } om opnieuw te embedden.',
    });
    return;
  }

  // Sequentieel verwerken — Gemini's free tier heeft een rate-limit
  // (60 RPM voor embeddings); parallel zou een burst geven die soms
  // gerefuseerd wordt. Bij 12 profielen is sequentieel ~3-5 sec, ruim
  // binnen Vercel's 10 sec default-timeout.
  const errors = [];
  let succeeded = 0;
  for (const m of members) {
    const document = buildTeamMemberEmbedDocument(m);
    if (!document) {
      errors.push({ id: m.id, name: m.name, error: 'Profiel heeft geen embed-able content.' });
      continue;
    }
    try {
      const embedding = await embedText(document);
      if (!embedding) {
        errors.push({ id: m.id, name: m.name, error: 'Embedding kwam leeg terug.' });
        continue;
      }
      const { error: updErr } = await supabase
        .from('team_members')
        .update({ embedding: formatVectorForPostgres(embedding) })
        .eq('id', m.id);
      if (updErr) {
        errors.push({ id: m.id, name: m.name, error: `DB-update faalde: ${updErr.message}` });
        continue;
      }
      succeeded++;
    } catch (err) {
      errors.push({ id: m.id, name: m.name, error: err.message || 'Onbekende fout' });
    }
  }

  res.status(200).json({
    processed: members.length,
    succeeded,
    failed: errors.length,
    errors,
  });
}

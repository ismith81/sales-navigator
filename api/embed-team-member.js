// Vercel Serverless Function — embedt één team-lid.
//
// Wordt fire-and-forget aangeroepen vanuit de frontend na elke save in
// TeamMemberEditor. Tolerant-bij-fail aan caller-zijde: als deze endpoint
// faalt blijft de save gewoon staan, alleen verschijnt het profiel niet
// in de semantic-search-resultaten tot een succesvolle re-embed.
//
// Body: { memberId: uuid }
// Response (200): { ok: true, dim: 768 }
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

  const { memberId } = req.body || {};
  if (!memberId || typeof memberId !== 'string') {
    res.status(400).json({ error: 'memberId is verplicht.' });
    return;
  }

  // Supabase client met user-token zodat RLS de auth-context heeft.
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  // Volledig profiel ophalen (inclusief cv_text — embed-document gebruikt 't).
  const { data: member, error: fetchErr } = await supabase
    .from('team_members')
    .select('id, name, role, seniority, kernskills, technologies, sectors, project_experience, certifications, summary, cv_text')
    .eq('id', memberId)
    .maybeSingle();

  if (fetchErr) {
    console.error('embed-team-member fetch fout:', fetchErr.message);
    res.status(500).json({ error: 'Kon team-lid niet ophalen.' });
    return;
  }
  if (!member) {
    res.status(404).json({ error: 'Team-lid niet gevonden.' });
    return;
  }

  const document = buildTeamMemberEmbedDocument(member);
  if (!document) {
    res.status(422).json({ error: 'Profiel heeft geen embed-able content (alle velden leeg).' });
    return;
  }

  let embedding;
  try {
    embedding = await embedText(document);
  } catch (err) {
    console.error('embed-team-member embed fout:', err.message);
    res.status(502).json({ error: `Gemini embedding faalde: ${err.message}` });
    return;
  }

  if (!embedding) {
    res.status(500).json({ error: 'Embedding kwam leeg terug.' });
    return;
  }

  const { error: updErr } = await supabase
    .from('team_members')
    .update({ embedding: formatVectorForPostgres(embedding) })
    .eq('id', memberId);

  if (updErr) {
    console.error('embed-team-member update fout:', updErr.message);
    res.status(500).json({ error: 'Kon embedding niet opslaan.' });
    return;
  }

  res.status(200).json({ ok: true, dim: embedding.length });
}

// Vercel Serverless Function — idempotente seed van certificeringsstandaard.
//
// Leest src/data/certifications.json (bundled via import) en upsert naar
// public.certifications + public.certification_role_relevance. Returnt per
// cert een status: NEW / UPDATED / UNCHANGED zodat de admin-UI feedback
// kan tonen welke wijzigingen zijn doorgevoerd.
//
// Veilig om herhaaldelijk te draaien — geen data-verlies, geen duplicates.
// Bij `active: false` in de seed wordt de cert gemarkeerd als inactief
// (historische consultant_certifications-rijen blijven behouden).
//
// Body: {} (geen parameters)
// Response (200): { processed, new, updated, unchanged, role_relevance, log }

import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_lib/auth.js';
import seedFile from '../src/data/certifications.json' with { type: 'json' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  // Haal bestaande certs op voor diff-detectie (NEW vs UPDATED vs UNCHANGED).
  const { data: existing, error: fetchErr } = await supabase
    .from('certifications')
    .select('id, name, vendor, tier, active, notes');
  if (fetchErr) {
    console.error('seed-certifications fetch fout:', fetchErr.message);
    res.status(500).json({ error: 'Kon bestaande certs niet ophalen.' });
    return;
  }
  const existingById = new Map((existing || []).map(c => [c.id, c]));

  const seedCerts = Array.isArray(seedFile?.certifications) ? seedFile.certifications : [];
  const log = [];
  let newCount = 0, updatedCount = 0, unchangedCount = 0;

  // Sequentieel verwerken zodat de log een leesbare volgorde houdt en we
  // bij een failure precies weten waar 't misging.
  for (const cert of seedCerts) {
    const row = {
      id: cert.id,
      name: cert.name,
      vendor: cert.vendor,
      tier: cert.tier,
      active: cert.active !== false,
      notes: cert.notes || null,
    };
    const prev = existingById.get(cert.id);

    let status;
    if (!prev) {
      status = 'NEW';
      newCount++;
    } else if (
      prev.name !== row.name
      || prev.vendor !== row.vendor
      || prev.tier !== row.tier
      || prev.active !== row.active
      || (prev.notes || null) !== (row.notes || null)
    ) {
      status = 'UPDATED';
      updatedCount++;
    } else {
      status = 'UNCHANGED';
      unchangedCount++;
    }

    if (status !== 'UNCHANGED') {
      const { error: upErr } = await supabase
        .from('certifications')
        .upsert(row, { onConflict: 'id' });
      if (upErr) {
        log.push({ id: cert.id, status: 'ERROR', message: upErr.message });
        continue;
      }
    }
    log.push({ id: cert.id, name: cert.name, tier: cert.tier, status });
  }

  // role_relevance: hard reset per cert (delete + insert) zodat oude
  // mappings die uit de seed verdwijnen ook werkelijk verdwenen zijn.
  // Goedkoop bij 14 certs × 3 rollen = 42 rows.
  let roleRelevanceCount = 0;
  for (const cert of seedCerts) {
    const rr = cert.role_relevance || {};
    const rows = Object.entries(rr).map(([role, relevance]) => ({
      cert_id: cert.id,
      role,
      relevance,
    }));

    // Delete bestaande rows voor deze cert
    const { error: delErr } = await supabase
      .from('certification_role_relevance')
      .delete()
      .eq('cert_id', cert.id);
    if (delErr) {
      log.push({ id: cert.id, status: 'ROLE_RELEVANCE_DELETE_ERROR', message: delErr.message });
      continue;
    }

    if (rows.length === 0) continue;
    const { error: insErr } = await supabase
      .from('certification_role_relevance')
      .insert(rows);
    if (insErr) {
      log.push({ id: cert.id, status: 'ROLE_RELEVANCE_INSERT_ERROR', message: insErr.message });
      continue;
    }
    roleRelevanceCount += rows.length;
  }

  res.status(200).json({
    processed: seedCerts.length,
    new: newCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    role_relevance_rows: roleRelevanceCount,
    log,
  });
}

// Dagelijkse Vercel-cron (zie vercel.json): één lichte query zodat Supabase
// free tier het project niet pauzeert na ~7 dagen zonder activiteit.
// Geen auth nodig — geeft alleen een status terug, geen data.

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt.' });
    return;
  }

  // PostgREST-query raakt Postgres zelf (een auth-health-ping niet).
  const r = await fetch(`${url}/rest/v1/cases?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  res.status(r.ok ? 200 : 502).json({ ok: r.ok, supabaseStatus: r.status });
}

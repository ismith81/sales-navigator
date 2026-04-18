// Server-side JWT-validatie voor de serverless endpoints.
// Gebruikt supabase-js om de access-token uit de Authorization-header te
// verifiëren. Returnt de user, of null als ongeldig/ontbrekend.
import { createClient } from '@supabase/supabase-js';

export async function requireUser(req, res) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) {
    res.status(401).json({ error: 'Niet ingelogd.' });
    return null;
  }
  const token = match[1];

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Supabase env vars ontbreken.' });
    return null;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Sessie ongeldig of verlopen.' });
    return null;
  }
  return data.user;
}

// Diagnostic endpoint — lijst alle Gemini-modellen op die beschikbaar zijn
// onder de huidige GEMINI_API_KEY. Bedoeld om te bepalen welk embed-model
// we kunnen gebruiken nu text-embedding-004 en embedding-001 beide 404 geven.
//
// GET /api/list-models?filter=embed (optionele filter op model-naam-substring)
//
// Response: { models: [{ name, supportedMethods, displayName }, ...] }

import { requireUser } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY ontbreekt.' });
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      res.status(r.status).json({ error: `Gemini ListModels gaf ${r.status}`, body: body.slice(0, 500) });
      return;
    }
    const data = await r.json();
    const filter = (req.query.filter || '').toString().toLowerCase();

    const models = (data.models || [])
      .filter(m => !filter || (m.name || '').toLowerCase().includes(filter))
      .map(m => ({
        name: m.name,
        displayName: m.displayName,
        supportedMethods: m.supportedGenerationMethods,
      }));

    res.status(200).json({ models, total: data.models?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

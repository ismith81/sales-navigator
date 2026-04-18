// Feedback-endpoint voor chat-berichten. Slaat 👍/👎 + context op in Supabase,
// zodat we maandelijks kunnen zien waar de assistent struikelt.
//
// Env vars: SUPABASE_URL, SUPABASE_ANON_KEY (RLS policy staat insert open).

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Supabase env vars ontbreken.' });
    return;
  }

  const { rating, userMessage, assistantMessage, context, toolCalls } = req.body || {};
  if (rating !== 1 && rating !== -1) {
    res.status(400).json({ error: 'rating moet 1 of -1 zijn' });
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from('chat_feedback').insert({
    rating,
    user_message: (userMessage || '').slice(0, 4000),
    assistant_message: (assistantMessage || '').slice(0, 8000),
    context: context || {},
    tool_calls: Array.isArray(toolCalls) ? toolCalls : [],
  });

  if (error) {
    console.error('chat-feedback insert error:', error);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}

// Chat-geschiedenis-laag bovenop Supabase. RLS in de DB doet het user-scoping
// (auth.uid() = user_id), wij hoeven hier alleen de queries goed te formuleren.
//
// Conventies:
// - 'session' = één conversatie van een gebruiker met Nova
// - max 20 ONGEPINDE sessies per user; gepinde sessies tellen niet mee voor
//   de auto-prune en kunnen onbeperkt blijven staan
// - title wordt afgeleid van het eerste user-bericht (ellipsisd op 60 chars)
// - sessionStorage cachet alleen de "actieve session-id" zodat een refresh
//   z'n plek niet kwijtraakt; berichten zelf komen altijd uit Supabase.

import { supabase } from './supabase';

const MAX_UNPINNED_SESSIONS = 20;
// Hoeveel sessies we max in de sidebar laten zien — pinned + meest recente
// unpinned tot deze cap. 30 is genoeg ruimte voor de 20-cap + een batch
// pinned items zonder de UI te overweldigen.
const LIST_LIMIT = 30;
const TITLE_MAX_LEN = 60;
const ACTIVE_KEY = 'sn.chatActiveSessionId';

// ─── helpers ─────────────────────────────────────────────────────────────
export function deriveTitle(messages = []) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser?.content) return 'Nieuw gesprek';
  const clean = firstUser.content.replace(/\s+/g, ' ').trim();
  return clean.length > TITLE_MAX_LEN ? clean.slice(0, TITLE_MAX_LEN - 1) + '…' : clean;
}

export function getActiveSessionId() {
  try { return sessionStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
}

export function setActiveSessionId(id) {
  try {
    if (id) sessionStorage.setItem(ACTIVE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

// ─── reads ───────────────────────────────────────────────────────────────
// Lijst van sessies (titel + pinned + timestamps), zonder de zware messages
// payload — die laden we pas bij het openen van één specifieke sessie.
// Sortering: pinned eerst (true>false), daarna recency. Zo komt 't natuurlijk
// in de UI terecht zonder client-side hersortering.
export async function listSessions() {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, pinned, created_at, updated_at')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) {
    console.warn('listSessions fout:', error.message);
    return [];
  }
  return data || [];
}

export async function loadSession(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, pinned, messages, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('loadSession fout:', error.message);
    return null;
  }
  return data;
}

// ─── writes ──────────────────────────────────────────────────────────────
// Maakt een nieuwe sessie aan met de gegeven berichten en retourneert id+title.
// Wordt gecalled bij het eerste user-bericht van een nieuwe chat.
export async function createSession(messages) {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return null;

  const title = deriveTitle(messages);
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, title, messages })
    .select('id, title, pinned, updated_at')
    .single();
  if (error) {
    console.warn('createSession fout:', error.message);
    return null;
  }

  // Direct na inserten: oudste UNPINNED sessies snoeien als we boven het
  // limiet zitten. Pinned sessies worden nooit gesnoeid.
  await pruneOldSessions(userId).catch(() => {});

  return data;
}

// Update messages + (optioneel) title van een bestaande sessie.
// Gebruik dit voor de debounced auto-save tijdens een lopend gesprek.
export async function updateSession(id, { messages, title } = {}) {
  if (!id) return null;
  const patch = {};
  if (Array.isArray(messages)) patch.messages = messages;
  if (typeof title === 'string') patch.title = title;
  if (Object.keys(patch).length === 0) return null;

  const { data, error } = await supabase
    .from('chat_sessions')
    .update(patch)
    .eq('id', id)
    .select('id, title, pinned, updated_at')
    .maybeSingle();
  if (error) {
    console.warn('updateSession fout:', error.message);
    return null;
  }
  return data;
}

// Pin of unpin een sessie. Gepinde sessies tellen niet mee voor de auto-prune.
export async function setSessionPinned(id, pinned) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ pinned: !!pinned })
    .eq('id', id)
    .select('id, title, pinned, updated_at')
    .maybeSingle();
  if (error) {
    console.warn('setSessionPinned fout:', error.message);
    return null;
  }
  return data;
}

export async function deleteSession(id) {
  if (!id) return false;
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', id);
  if (error) {
    console.warn('deleteSession fout:', error.message);
    return false;
  }
  return true;
}

// Groepeer een lijst van sessies in tijds-buckets (Vandaag / Gisteren /
// Vorige week / Ouder) op basis van updated_at. Lege buckets worden niet
// teruggegeven zodat de UI alleen de relevante kopjes toont.
export function groupSessionsByDate(sessions = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const order = ['Vandaag', 'Gisteren', 'Vorige week', 'Ouder'];
  const buckets = { Vandaag: [], Gisteren: [], 'Vorige week': [], Ouder: [] };

  for (const s of sessions) {
    const d = new Date(s.updated_at || s.created_at || 0);
    if (d >= today) buckets['Vandaag'].push(s);
    else if (d >= yesterday) buckets['Gisteren'].push(s);
    else if (d >= weekAgo) buckets['Vorige week'].push(s);
    else buckets['Ouder'].push(s);
  }

  return order
    .filter(label => buckets[label].length > 0)
    .map(label => ({ label, items: buckets[label] }));
}

// Houdt het aantal UNPINNED sessies onder MAX_UNPINNED_SESSIONS door de
// oudste ongepinde te verwijderen. Pinned sessies blijven onaangetast,
// ongeacht hoeveel het er zijn — dat is de hele waarde van pinning.
async function pruneOldSessions(userId) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, pinned, updated_at')
    .eq('user_id', userId)
    .eq('pinned', false)
    .order('updated_at', { ascending: false });
  if (error) return;
  const overflow = (data || []).slice(MAX_UNPINNED_SESSIONS);
  if (overflow.length === 0) return;
  const ids = overflow.map(r => r.id);
  await supabase.from('chat_sessions').delete().in('id', ids);
}

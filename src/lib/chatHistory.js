// Chat-geschiedenis-laag bovenop Supabase. RLS in de DB doet het user-scoping
// (auth.uid() = user_id), wij hoeven hier alleen de queries goed te formuleren.
//
// Conventies:
// - 'session' = één conversatie van een gebruiker met Nova
// - max 10 sessies per user; bij overschrijden wordt de oudste verwijderd
// - title wordt afgeleid van het eerste user-bericht (ellipsisd op 60 chars)
// - sessionStorage cachet alleen de "actieve session-id" zodat een refresh
//   z'n plek niet kwijtraakt; berichten zelf komen altijd uit Supabase.

import { supabase } from './supabase';

const MAX_SESSIONS = 10;
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
// Lijst van laatste 10 sessies (titel + timestamps), zonder de zware messages
// payload — die laden we pas bij het openen van één specifieke sessie.
export async function listSessions() {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(MAX_SESSIONS);
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
    .select('id, title, messages, created_at, updated_at')
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
    .select('id, title, updated_at')
    .single();
  if (error) {
    console.warn('createSession fout:', error.message);
    return null;
  }

  // Direct na inserten: oudste sessies snoeien als we boven het limiet zitten.
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
    .select('id, title, updated_at')
    .maybeSingle();
  if (error) {
    console.warn('updateSession fout:', error.message);
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

// Houdt de history-lijst onder MAX_SESSIONS door de oudste te verwijderen.
// Wordt vanuit createSession aangeroepen — niet vanuit updateSession (geen
// nieuwe sessie = geen kans op overschrijding).
async function pruneOldSessions(userId) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) return;
  const overflow = (data || []).slice(MAX_SESSIONS);
  if (overflow.length === 0) return;
  const ids = overflow.map(r => r.id);
  await supabase.from('chat_sessions').delete().in('id', ids);
}

// Data-laag voor de certificeringsstandaard. Werkt direct tegen Supabase
// (geen server-side proxy nodig — RLS staat authenticated-all toe). Vier
// blokken:
//   1. Fetchers — certs, role-relevance, consultant-certifications, alles in
//      één call combineerbaar voor de gap-analyse-views.
//   2. Mutators — toggle achieved-status, beheer other_certifications,
//      role_code op consultant.
//   3. Gap-analyse — pure functies; geen RPC, alle berekening client-side.
//      Bij 12 consultants × 14 certs is dat triviaal.
//   4. Fuzzy match-helpers — voor de migratie-wizard. Match cert-strings
//      uit een vrije tekst-array (oude team_members.certifications) tegen
//      master-certs op ID en name. Specialisatie (role_code) wordt door
//      sales handmatig gekozen — geen auto-guess op de vrije role-tekst,
//      omdat die de externe CV-laag is en kan afwijken van de interne
//      specialisatie.

import { supabase } from './supabase';
import { authedFetch } from './auth';

// ─── Fetchers ──────────────────────────────────────────────────────────────

export async function listCertifications() {
  const { data, error } = await supabase
    .from('certifications')
    .select('id, name, vendor, tier, active, notes, updated_at')
    .order('tier', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    console.warn('listCertifications fout:', error.message);
    return [];
  }
  return data || [];
}

export async function listRoleRelevance() {
  const { data, error } = await supabase
    .from('certification_role_relevance')
    .select('cert_id, role, relevance');
  if (error) {
    console.warn('listRoleRelevance fout:', error.message);
    return [];
  }
  return data || [];
}

// Alle achieved-rijen voor één consultant. Bij gap-analyse op een teamview
// gebruiken we listAllConsultantCerts() voor één bulk-fetch.
export async function listConsultantCertifications(consultantId) {
  if (!consultantId) return [];
  const { data, error } = await supabase
    .from('consultant_certifications')
    .select('consultant_id, cert_id, achieved, updated_at')
    .eq('consultant_id', consultantId);
  if (error) {
    console.warn('listConsultantCertifications fout:', error.message);
    return [];
  }
  return data || [];
}

export async function listAllConsultantCerts() {
  const { data, error } = await supabase
    .from('consultant_certifications')
    .select('consultant_id, cert_id, achieved, updated_at');
  if (error) {
    console.warn('listAllConsultantCerts fout:', error.message);
    return [];
  }
  return data || [];
}

// ─── Mutators ──────────────────────────────────────────────────────────────

// Set/unset achieved-status. Upsert zodat 't werkt zowel voor first-time-toggle
// (geen rij yet) als voor flip van bestaande rij.
export async function setConsultantCertAchieved(consultantId, certId, achieved) {
  if (!consultantId || !certId) return { error: 'consultantId en certId zijn verplicht.' };
  const { error } = await supabase
    .from('consultant_certifications')
    .upsert(
      { consultant_id: consultantId, cert_id: certId, achieved: !!achieved },
      { onConflict: 'consultant_id,cert_id' }
    );
  if (error) {
    console.warn('setConsultantCertAchieved fout:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// Vervang de other_certifications-array (vrije tekst extras) op het
// team_members-record. Gebruikt update i.p.v. upsert zodat we per ongeluk
// geen nieuwe team-member-rij creëren.
export async function setOtherCertifications(consultantId, otherCerts) {
  if (!consultantId) return { error: 'consultantId verplicht.' };
  const cleaned = (Array.isArray(otherCerts) ? otherCerts : [])
    .map(s => (s || '').trim())
    .filter(Boolean);
  const { error } = await supabase
    .from('team_members')
    .update({ other_certifications: cleaned })
    .eq('id', consultantId);
  if (error) {
    console.warn('setOtherCertifications fout:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// Set role_code (AE/DE/DSA of null). Validatie zit op DB-niveau via check-
// constraint; hier alleen een ruwe sanity-check.
export async function setConsultantRoleCode(consultantId, roleCode) {
  if (!consultantId) return { error: 'consultantId verplicht.' };
  const valid = roleCode === null || ['AE', 'DE', 'DSA'].includes(roleCode);
  if (!valid) return { error: `Ongeldige role_code: ${roleCode}` };
  const { error } = await supabase
    .from('team_members')
    .update({ role_code: roleCode })
    .eq('id', consultantId);
  if (error) {
    console.warn('setConsultantRoleCode fout:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// Trigger seed-endpoint vanuit Beheer-UI. Returnt het log-object zodat
// admin kan zien welke certs NEW/UPDATED/UNCHANGED waren.
export async function seedCertifications() {
  try {
    const res = await authedFetch('/api/seed-certifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json?.error || `Server ${res.status}` };
    return json;
  } catch (err) {
    return { error: err?.message || 'Seed-call faalde.' };
  }
}

// ─── Gap-analyse ───────────────────────────────────────────────────────────

// Pure functie: bouw een lookup-map cert_id → role → relevance.
function buildRelevanceMap(roleRelevanceRows) {
  const map = new Map(); // cert_id → { AE, DE, DSA }
  for (const r of roleRelevanceRows || []) {
    if (!map.has(r.cert_id)) map.set(r.cert_id, {});
    map.get(r.cert_id)[r.role] = r.relevance;
  }
  return map;
}

// Geeft de gaps voor één consultant: certs die `expected` zijn voor hun rol
// maar nog niet achieved. `recommended` certs tellen NIET als gap (anders
// krijg je valse alarmen). Niet-actieve certs komen niet meer in de output.
//
// Args:
//   consultant: { id, role_code }   — uit team_members
//   certifications: array uit listCertifications()
//   roleRelevanceRows: array uit listRoleRelevance()
//   consultantCerts: array uit listConsultantCertifications(id) of
//                    listAllConsultantCerts() (alle rijen, gefilterd binnenin)
//   options: { tier?: 'baseline' | 'specialist' }
//
// Returns: array van { cert, relevance } objecten.
export function computeConsultantGaps(consultant, certifications, roleRelevanceRows, consultantCerts, options = {}) {
  if (!consultant?.role_code) return [];
  const { tier } = options;
  const relevanceMap = buildRelevanceMap(roleRelevanceRows);
  const achievedIds = new Set(
    (consultantCerts || [])
      .filter(c => c.consultant_id === consultant.id && c.achieved)
      .map(c => c.cert_id)
  );
  const gaps = [];
  for (const cert of certifications || []) {
    if (cert.active === false) continue;
    if (tier && cert.tier !== tier) continue;
    const rel = relevanceMap.get(cert.id)?.[consultant.role_code];
    if (rel !== 'expected') continue;
    if (achievedIds.has(cert.id)) continue;
    gaps.push({ cert, relevance: rel });
  }
  return gaps;
}

// Tel hoeveel "expected" certs er zijn voor een consultant + hoeveel achieved.
// Returnt { expected, achieved, percent }. Voor de gap-indicator in de UI.
export function computeConsultantCoverage(consultant, certifications, roleRelevanceRows, consultantCerts, options = {}) {
  if (!consultant?.role_code) return { expected: 0, achieved: 0, percent: 0 };
  const { tier } = options;
  const relevanceMap = buildRelevanceMap(roleRelevanceRows);
  const achievedIds = new Set(
    (consultantCerts || [])
      .filter(c => c.consultant_id === consultant.id && c.achieved)
      .map(c => c.cert_id)
  );
  let expected = 0;
  let achieved = 0;
  for (const cert of certifications || []) {
    if (cert.active === false) continue;
    if (tier && cert.tier !== tier) continue;
    const rel = relevanceMap.get(cert.id)?.[consultant.role_code];
    if (rel !== 'expected') continue;
    expected++;
    if (achievedIds.has(cert.id)) achieved++;
  }
  const percent = expected === 0 ? 100 : Math.round((achieved / expected) * 100);
  return { expected, achieved, percent };
}

// Top-N gaps voor het hele team: welke `expected`-cert hebben de meeste
// consultants nog niet? Returnt array gesorteerd op aantal-missing desc.
//
// Args:
//   consultants: array van team_members (met role_code)
//   certifications: master-list
//   roleRelevanceRows
//   allConsultantCerts: array uit listAllConsultantCerts()
//   limit: max aantal resultaten (default 5)
export function computeTopTeamGaps(consultants, certifications, roleRelevanceRows, allConsultantCerts, limit = 5) {
  const relevanceMap = buildRelevanceMap(roleRelevanceRows);
  const achievedSet = new Set(
    (allConsultantCerts || [])
      .filter(c => c.achieved)
      .map(c => `${c.consultant_id}::${c.cert_id}`)
  );

  const counts = []; // { cert, missingCount, applicableCount }
  for (const cert of certifications || []) {
    if (cert.active === false) continue;
    let missing = 0;
    let applicable = 0;
    for (const c of consultants || []) {
      if (!c.role_code) continue;
      const rel = relevanceMap.get(cert.id)?.[c.role_code];
      if (rel !== 'expected') continue;
      applicable++;
      if (!achievedSet.has(`${c.id}::${cert.id}`)) missing++;
    }
    if (missing > 0) {
      counts.push({ cert, missingCount: missing, applicableCount: applicable });
    }
  }
  counts.sort((a, b) => b.missingCount - a.missingCount);
  return counts.slice(0, limit);
}

// ─── Fuzzy match-helpers (voor migratie-wizard) ───────────────────────────

// Normaliseer string voor vergelijking: lowercase, strip diacritics, alleen
// alfanumeriek. "PowerBI Data Analyst Associate" en "power bi data analyst
// associate" matchen dan op exact.
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

// Levenshtein-afstand voor near-miss detection (typo's, kleine
// formuleringsverschillen). Niet super-snel maar prima bij N×M ≤ 14×40.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let curr = i;
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + cost);
      prevDiag = tmp;
      prev[j] = curr;
    }
  }
  return prev[n];
}

// Match een vrije cert-string tegen de master-list. Returnt 't beste resultaat
// + confidence: 'high' | 'medium' | 'low' | null.
//
//   'high'   = ID-match (regex) of normalize-name-match exact
//   'medium' = normalize substring-match in beide richtingen
//   'low'    = levenshtein <= 3 op naam (typos, near-miss)
//   null     = geen match
//
// Bij meerdere kandidaten van dezelfde confidence: returnt de eerste maar
// voegt `ambiguous: true` toe aan de match zodat de UI 'm voor handmatige
// review markeert.
export function matchCertString(input, certifications) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const allCerts = (certifications || []).filter(c => c.active !== false);

  // 1. ID-match — regex op cert-IDs (DP-700, AI-102, etc.). Hoogste confidence.
  for (const cert of allCerts) {
    const idEsc = cert.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idRegex = new RegExp(`(^|[^a-z0-9])${idEsc}([^a-z0-9]|$)`, 'i');
    if (idRegex.test(trimmed)) {
      return { cert, confidence: 'high', reason: `Cert-ID "${cert.id}" gevonden in input` };
    }
  }

  // 2. Normalize-name-match exact
  const inputNorm = normalize(trimmed);
  for (const cert of allCerts) {
    if (normalize(cert.name) === inputNorm) {
      return { cert, confidence: 'high', reason: `Naam exact match` };
    }
  }

  // 3. Normalize substring (in beide richtingen)
  const candidates = [];
  for (const cert of allCerts) {
    const certNorm = normalize(cert.name);
    if (certNorm.length >= 6 && (inputNorm.includes(certNorm) || certNorm.includes(inputNorm))) {
      candidates.push({ cert, confidence: 'medium', reason: 'Naam-substring match' });
    }
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return { ...candidates[0], ambiguous: true, alternatives: candidates.slice(1).map(c => c.cert) };
  }

  // 4. Levenshtein <= 3 op naam (low confidence — typos)
  let bestLev = null;
  for (const cert of allCerts) {
    const dist = levenshtein(inputNorm, normalize(cert.name));
    if (dist <= 3 && (!bestLev || dist < bestLev.dist)) {
      bestLev = { cert, dist };
    }
  }
  if (bestLev) {
    return { cert: bestLev.cert, confidence: 'low', reason: `Levenshtein ${bestLev.dist} (mogelijk typo)` };
  }

  return null;
}

// Parseer een team_members.certifications-array (vrije strings) tegen de
// master-list. Splitst eerst op komma's/semikolons binnen elke string voor
// 't geval een rij meerdere certs bevat ("DP-700, DP-600, PL-300").
//
// Returns: { matched: [...], unmatched: [...] } met per match: input-string,
// gevonden cert, confidence, ambiguous-flag.
export function migrateCertificationsArray(certStrings, certifications) {
  const matched = [];
  const unmatched = [];
  for (const raw of (certStrings || [])) {
    if (!raw) continue;
    // Splits op komma / semicolon — sommige rijen bevatten meerdere certs.
    const parts = String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = matchCertString(part, certifications);
      if (m) {
        matched.push({ input: part, ...m });
      } else {
        unmatched.push({ input: part });
      }
    }
  }
  return { matched, unmatched };
}


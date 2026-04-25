// Data-laag voor team_members + bijbehorende CV-PDF in Supabase Storage.
//
// Tabel: public.team_members (RLS — authed-all). Bucket: 'team-cvs' (privé).
// PDF-bestanden krijgen path `<member-id>/<timestamp>-<filename>` zodat een
// member meerdere historische CV-versies kan houden zonder file-conflicts.

import { supabase } from './supabase';
import { authedFetch } from './auth';
import { DEFAULT_BRANCHES } from '../data/branches';

const STORAGE_BUCKET = 'team-cvs';

// Haalt de canonical branches-lijst uit app_config — zelfde bron die cases
// gebruiken (zie src/lib/store.js). Fallback naar DEFAULT_BRANCHES als de
// row nog niet bestaat (bv. fresh seed, of test-omgeving).
export async function listBranches() {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'branches')
    .maybeSingle();
  if (error) {
    console.warn('listBranches fout:', error.message);
    return DEFAULT_BRANCHES;
  }
  return Array.isArray(data?.value) && data.value.length ? data.value : DEFAULT_BRANCHES;
}

// ─── reads ───────────────────────────────────────────────────────────────
export async function listTeamMembers() {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, role, seniority, kernskills, technologies, sectors, current_client, available_from, available_for_sales, cv_pdf_path, updated_at')
    .order('name', { ascending: true });
  if (error) {
    console.warn('listTeamMembers fout:', error.message);
    return [];
  }
  return data || [];
}

// ─── beschikbaarheids-bucket-logica ─────────────────────────────────────
// Bepaalt in welke bucket een team-lid valt voor de Gids-strip én Beheer-
// badges. Gedeelde logica zodat overal hetzelfde label/groepering komt.
//
// Buckets:
//   { bucket: 'now',     label: 'Nu beschikbaar',                  sortKey: 0 }
//   { bucket: 'month-…', label: 'Vrij in [maand jaar]',            sortKey: 1..6 }
//   { bucket: 'later',   label: 'Later (> 6 maanden)',             sortKey: 9000 }
//   { bucket: 'unknown', label: 'Bezet — einddatum onbekend',      sortKey: 9999 }
const MONTH_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export function getAvailabilityBucket(member = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasClient = !!(member.current_client && member.current_client.trim());
  const fromStr = member.available_from;
  const from = fromStr ? new Date(fromStr) : null;
  if (from && !isNaN(from)) from.setHours(0, 0, 0, 0);

  // Geen klant → automatisch "Nu beschikbaar" (ongeacht datum).
  if (!hasClient) {
    return { bucket: 'now', label: 'Nu beschikbaar', sortKey: 0 };
  }
  // Klant + datum verleden/vandaag → ook "Nu beschikbaar" (rolloff voorbij).
  if (from && from <= today) {
    return { bucket: 'now', label: 'Nu beschikbaar', sortKey: 0 };
  }
  // Klant + geen datum → "Bezet onbekend".
  if (!from) {
    return { bucket: 'unknown', label: 'Bezet — einddatum onbekend', sortKey: 9999 };
  }
  // Klant + future → bucket op kalendermaand.
  const monthsAhead = (from.getFullYear() - today.getFullYear()) * 12
    + (from.getMonth() - today.getMonth());
  if (monthsAhead > 6) {
    return { bucket: 'later', label: 'Later (> 6 maanden)', sortKey: 9000 };
  }
  return {
    bucket: `month-${from.getFullYear()}-${from.getMonth()}`,
    label: `Vrij in ${MONTH_NL[from.getMonth()]} ${from.getFullYear()}`,
    sortKey: monthsAhead,
  };
}

// Groepeer een lijst van team-leden in beschikbaarheids-buckets,
// gesorteerd op tijds-volgorde. Lege buckets worden niet teruggegeven.
export function groupTeamByAvailability(members = []) {
  const buckets = new Map(); // bucket-key → { label, sortKey, items: [] }
  for (const m of members) {
    const b = getAvailabilityBucket(m);
    if (!buckets.has(b.bucket)) {
      buckets.set(b.bucket, { label: b.label, sortKey: b.sortKey, items: [] });
    }
    buckets.get(b.bucket).items.push(m);
  }
  return [...buckets.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export async function getTeamMember(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('getTeamMember fout:', error.message);
    return null;
  }
  return data;
}

// ─── writes ──────────────────────────────────────────────────────────────
// Maakt een nieuwe lege team-member-row aan zodat we direct daarna een PDF
// erbij kunnen uploaden onder een stabiele id-prefix in Storage.
export async function createTeamMember({ name = 'Nieuw teamlid', ...rest } = {}) {
  const { data, error } = await supabase
    .from('team_members')
    .insert({ name, ...rest })
    .select('id')
    .single();
  if (error) {
    console.warn('createTeamMember fout:', error.message);
    return null;
  }
  return data;
}

export async function updateTeamMember(id, patch) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('team_members')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) {
    console.warn('updateTeamMember fout:', error.message);
    return null;
  }
  return data;
}

export async function deleteTeamMember(id) {
  if (!id) return false;
  // Eerst de PDF in Storage opruimen (best effort — als 'ie er niet meer is,
  // gewoon doorgaan met de DB-delete).
  const m = await getTeamMember(id);
  if (m?.cv_pdf_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([m.cv_pdf_path]).catch(() => {});
  }
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);
  if (error) {
    console.warn('deleteTeamMember fout:', error.message);
    return false;
  }
  return true;
}

// ─── PDF upload + parse ──────────────────────────────────────────────────
// Lees een File object als base64 en stuur naar /api/cv-parse voor extractie.
// Server geeft een dict terug met structured fields die we gebruiken om de
// edit-form te prefillen.
export async function parseCvPdf(file) {
  if (!file) return { error: 'Geen bestand.' };
  if (file.type && file.type !== 'application/pdf') {
    return { error: 'Alleen PDF wordt ondersteund.' };
  }
  if (file.size > 6 * 1024 * 1024) {
    return { error: 'PDF is groter dan 6MB.' };
  }

  const pdfBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Kan bestand niet lezen.'));
    reader.readAsDataURL(file);
  });

  try {
    const res = await authedFetch('/api/cv-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, fileName: file.name }),
    });
    // Probeer JSON; als 't faalt (bv. crash → HTML-response van Vercel), meld
    // dat onderscheidend zodat we module-crash van content-error kunnen scheiden.
    let json;
    try {
      json = await res.json();
    } catch {
      const body = await res.text().catch(() => '');
      return {
        error: `Server gaf geen JSON terug (${res.status}). Vermoedelijk een crash op de server. Eerste 200 chars van response: ${body.slice(0, 200)}`,
      };
    }
    if (!res.ok) {
      return { error: json.error || `Server ${res.status}` };
    }
    return {
      fields: json.fields || {},
      text: json.text || '',
      diagnostics: json.diagnostics || {},
    };
  } catch (err) {
    return { error: err.message || 'Onbekende fout.' };
  }
}

// Upload de PDF naar Storage onder een member-stabiele path en return de path
// die je vervolgens in cv_pdf_path opslaat. Vervangt eventuele oudere PDF
// (best effort) zodat we maar één PDF per member houden in Fase A.
export async function uploadCvPdf(memberId, file) {
  if (!memberId || !file) return { error: 'memberId en file zijn verplicht.' };

  // Sanitize filename — alleen safe chars in path.
  const safeName = (file.name || 'cv.pdf').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const path = `${memberId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: 'application/pdf',
      upsert: false,
    });
  if (upErr) {
    console.warn('uploadCvPdf fout:', upErr.message);
    return { error: upErr.message };
  }

  // Oude PDF van deze member opruimen (best effort) zodat we niet eindeloos
  // versies opstapelen — Fase A houdt 1 PDF per member.
  const m = await getTeamMember(memberId);
  if (m?.cv_pdf_path && m.cv_pdf_path !== path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([m.cv_pdf_path]).catch(() => {});
  }

  return { path };
}

// Geeft een tijdelijke signed URL terug zodat de PDF in een nieuwe tab
// gedownload of bekeken kan worden. Default 60 seconds geldig.
export async function getCvPdfUrl(path, expiresIn = 60) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.warn('getCvPdfUrl fout:', error.message);
    return null;
  }
  return data?.signedUrl || null;
}

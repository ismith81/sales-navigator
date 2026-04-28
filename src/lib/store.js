import { supabase } from './supabase';
import seedCases from '../data/cases.json';
import seedTopics from '../data/topics.json';
import seedPersonas from '../data/personas.json';
import { DEFAULT_FILTERS, DEFAULT_PAINPOINTS } from '../data/filters';
import { DEFAULT_BRANCHES } from '../data/branches';

// Map tussen DB-kolommen (snake_case) en het JS-model (camelCase) dat de UI al kent.
function rowToCase(r) {
  const m = r.mapping || {};
  const mr = r.match_reasons || {};
  return {
    id: r.id,
    name: r.name,
    subtitle: r.subtitle || '',
    logoText: r.logo_text || '',
    logoColor: r.logo_color || '',
    situatie: r.situatie || '',
    doel: r.doel || '',
    oplossing: r.oplossing || '',
    resultaat: r.resultaat || '',
    keywords: r.keywords || [],
    technologies: r.technologies || [],
    expertiseAreas: r.expertise_areas || [],
    sectors: r.sectors || [],
    businessImpact: r.business_impact || '',
    // mapping.personas + matchReasons.personas zijn nieuw — defaulten naar leeg
    // voor bestaande cases zonder deze key (backwards-compatible met jsonb).
    mapping: {
      doelen: m.doelen || [],
      behoeften: m.behoeften || [],
      diensten: m.diensten || [],
      personas: m.personas || [],
      branches: m.branches || [],
    },
    talkingPoints: r.talking_points || [],
    followUps: r.follow_ups || [],
    matchReasons: {
      doelen: mr.doelen || {},
      behoeften: mr.behoeften || {},
      diensten: mr.diensten || {},
      personas: mr.personas || {},
    },
  };
}

function caseToRow(c) {
  // sectors is een top-level matching-kolom voor snelle array-overlap-queries
  // met team_members.sectors. We laten 'm derivén uit mapping.branches zodat
  // er één bron van waarheid blijft (de bestaande Branches-UI). Zo hoeft de
  // editor geen tweede plek te hebben om hetzelfde te taggen.
  const sectors = Array.isArray(c.mapping?.branches) && c.mapping.branches.length
    ? c.mapping.branches
    : (c.sectors || []);
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle || '',
    logo_text: c.logoText || '',
    logo_color: c.logoColor || '',
    situatie: c.situatie || '',
    doel: c.doel || '',
    oplossing: c.oplossing || '',
    resultaat: c.resultaat || '',
    keywords: c.keywords || [],
    technologies: c.technologies || [],
    expertise_areas: c.expertiseAreas || [],
    sectors,
    business_impact: c.businessImpact || '',
    mapping: c.mapping || {},
    talking_points: c.talkingPoints || [],
    follow_ups: c.followUps || [],
    match_reasons: c.matchReasons || {},
    updated_at: new Date().toISOString(),
  };
}

async function fetchConfig(key, fallback) {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : fallback;
}

// Zorg dat elk topic dezelfde shape heeft: description + signals (rich HTML) naast talkingPoints/followUps.
// Val terug op seed-waardes uit topics.json (description/signals) zodat nieuwe velden die nog niet in
// de DB staan automatisch zichtbaar worden bij bestaande installaties. Voor behoeften wordt ook nog
// de legacy `painpoints` config gebruikt als signals-fallback.
function normalizeTopics(topics, painpoints) {
  const next = {};
  for (const category of ['doelen', 'behoeften', 'diensten']) {
    const src = (topics && topics[category]) || {};
    const seedSrc = (seedTopics && seedTopics[category]) || {};
    const out = {};
    for (const [name, raw] of Object.entries(src)) {
      const t = raw || {};
      const seed = seedSrc[name] || {};
      const legacyPainpoint = category === 'behoeften' ? (painpoints && painpoints[name]) || '' : '';
      const seedSignals = typeof seed.signals === 'string' ? seed.signals : '';
      const seedDescription = typeof seed.description === 'string' ? seed.description : '';
      const hasSignals = typeof t.signals === 'string' && t.signals.length > 0;
      const hasDescription = typeof t.description === 'string' && t.description.length > 0;
      out[name] = {
        description: hasDescription ? t.description : seedDescription,
        signals: hasSignals ? t.signals : (seedSignals || legacyPainpoint),
        talkingPoints: Array.isArray(t.talkingPoints) ? t.talkingPoints : (seed.talkingPoints || []),
        followUps: Array.isArray(t.followUps) ? t.followUps : (seed.followUps || []),
      };
    }
    next[category] = out;
  }
  return next;
}

// Zorg dat elke persona dezelfde shape heeft. Onbekende id's uit de DB blijven behouden,
// seed-waardes vullen ontbrekende velden aan (zodat nieuwe velden niet breken bij upgrades).
function normalizePersonas(personas) {
  const src = personas && typeof personas === 'object' ? personas : seedPersonas;
  const out = {};
  for (const [id, raw] of Object.entries(src)) {
    const seed = seedPersonas[id] || {};
    const t = raw || {};
    out[id] = {
      id: typeof t.id === 'string' && t.id ? t.id : id,
      label: typeof t.label === 'string' && t.label ? t.label : (seed.label || id),
      icon: typeof t.icon === 'string' ? t.icon : (seed.icon || '👤'),
      domain: t.domain === 'tech' ? 'tech' : (t.domain === 'business' ? 'business' : (seed.domain || 'business')),
      niveau: t.niveau === 'operationeel' ? 'operationeel' : (t.niveau === 'strategisch' ? 'strategisch' : (seed.niveau || 'strategisch')),
      order: Number.isFinite(t.order) ? t.order : (Number.isFinite(seed.order) ? seed.order : 99),
      description: typeof t.description === 'string' ? t.description : (seed.description || ''),
      roles: typeof t.roles === 'string' ? t.roles : (seed.roles || ''),
      signals: typeof t.signals === 'string' ? t.signals : (seed.signals || ''),
      coaching: typeof t.coaching === 'string' ? t.coaching : (seed.coaching || ''),
    };
  }
  return out;
}

// One-shot migraties op de `topics` config. Elke migratie draait maximaal 1x per install:
// we slaan het hoogst uitgevoerde versienummer op in app_config.topics_seed_version.
// Binnen een migratie geven we per topic expliciet aan welke velden uit de seed geforceerd
// overschreven moeten worden. User-edits op NIET-genoemde velden blijven altijd behouden.
const TOPIC_SEED_VERSION = 1;
const TOPIC_MIGRATIONS = {
  // v1: eerste uitrol van description + signals. De test-content voor "Meer waarde halen uit data"
  // wordt hiermee overschreven; overige topics krijgen de seed alleen als ze nog leeg zijn (dat
  // regelt normalizeTopics al bij het lezen — hier forceren we het ook naar de DB).
  1: [
    { category: 'doelen', name: 'Meer waarde halen uit data', fields: ['description', 'signals'] },
  ],
};

function applyTopicMigrations(topics, fromVersion) {
  const next = JSON.parse(JSON.stringify(topics || {}));
  for (let v = fromVersion + 1; v <= TOPIC_SEED_VERSION; v++) {
    const steps = TOPIC_MIGRATIONS[v] || [];
    for (const { category, name, fields } of steps) {
      const seed = seedTopics?.[category]?.[name];
      if (!seed) continue;
      if (!next[category]) next[category] = {};
      if (!next[category][name]) next[category][name] = {};
      for (const f of fields) {
        if (typeof seed[f] !== 'undefined') {
          next[category][name][f] = seed[f];
        }
      }
    }
  }
  return next;
}

export async function loadAll() {
  const [{ data: caseRows, error: caseErr }, filters, painpoints, topics, personas, branches, seedVersion] = await Promise.all([
    supabase.from('cases').select('*').order('name'),
    fetchConfig('filters', null),
    fetchConfig('painpoints', null),
    fetchConfig('topics', null),
    fetchConfig('personas', null),
    fetchConfig('branches', null),
    fetchConfig('topics_seed_version', 0),
  ]);
  if (caseErr) throw caseErr;

  const needsSeed = (caseRows || []).length === 0 && !filters && !painpoints && !topics;
  if (needsSeed) {
    await seedInitial();
    return {
      cases: seedCases,
      filters: DEFAULT_FILTERS,
      topics: normalizeTopics(seedTopics, DEFAULT_PAINPOINTS),
      personas: normalizePersonas(seedPersonas),
      branches: DEFAULT_BRANCHES,
    };
  }

  // Force-seed specifieke velden wanneer er een nieuwe TOPIC_SEED_VERSION is uitgerold.
  let effectiveTopics = topics || seedTopics;
  const currentVersion = Number(seedVersion) || 0;
  if (currentVersion < TOPIC_SEED_VERSION) {
    effectiveTopics = applyTopicMigrations(effectiveTopics, currentVersion);
    try {
      await saveConfig('topics', effectiveTopics);
      await saveConfig('topics_seed_version', TOPIC_SEED_VERSION);
    } catch (e) {
      // Migratie mag de app niet stukmaken — log en ga door met wat we in memory hebben.
      console.warn('Topic seed-migratie kon niet worden opgeslagen:', e);
    }
  }

  return {
    cases: (caseRows || []).map(rowToCase),
    filters: filters || DEFAULT_FILTERS,
    topics: normalizeTopics(effectiveTopics, painpoints || DEFAULT_PAINPOINTS),
    personas: normalizePersonas(personas),
    branches: Array.isArray(branches) && branches.length ? branches : DEFAULT_BRANCHES,
  };
}

async function seedInitial() {
  const rows = seedCases.map(caseToRow);
  if (rows.length) {
    const { error } = await supabase.from('cases').upsert(rows);
    if (error) throw error;
  }
  const configRows = [
    { key: 'filters', value: DEFAULT_FILTERS },
    { key: 'painpoints', value: DEFAULT_PAINPOINTS },
    { key: 'topics', value: seedTopics },
    { key: 'personas', value: seedPersonas },
    { key: 'branches', value: DEFAULT_BRANCHES },
    { key: 'topics_seed_version', value: TOPIC_SEED_VERSION },
  ];
  const { error } = await supabase.from('app_config').upsert(configRows);
  if (error) throw error;
}

export async function saveCases(cases) {
  const { data: existing, error: listErr } = await supabase.from('cases').select('id');
  if (listErr) throw listErr;
  const existingIds = new Set((existing || []).map(r => r.id));
  const nextIds = new Set(cases.map(c => c.id));
  const toDelete = [...existingIds].filter(id => !nextIds.has(id));

  if (toDelete.length) {
    const { error } = await supabase.from('cases').delete().in('id', toDelete);
    if (error) throw error;
  }
  if (cases.length) {
    const { error } = await supabase.from('cases').upsert(cases.map(caseToRow));
    if (error) throw error;
  }
}

export async function saveConfig(key, value) {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

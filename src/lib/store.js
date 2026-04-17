import { supabase } from './supabase';
import seedCases from '../data/cases.json';
import seedTopics from '../data/topics.json';
import { DEFAULT_FILTERS, DEFAULT_PAINPOINTS } from '../data/filters';

// Map tussen DB-kolommen (snake_case) en het JS-model (camelCase) dat de UI al kent.
function rowToCase(r) {
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
    businessImpact: r.business_impact || '',
    mapping: r.mapping || { doelen: [], behoeften: [], diensten: [] },
    talkingPoints: r.talking_points || [],
    followUps: r.follow_ups || [],
    matchReasons: r.match_reasons || { doelen: {}, behoeften: {}, diensten: {} },
  };
}

function caseToRow(c) {
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

export async function loadAll() {
  const [{ data: caseRows, error: caseErr }, filters, painpoints, topics] = await Promise.all([
    supabase.from('cases').select('*').order('name'),
    fetchConfig('filters', null),
    fetchConfig('painpoints', null),
    fetchConfig('topics', null),
  ]);
  if (caseErr) throw caseErr;

  const needsSeed = (caseRows || []).length === 0 && !filters && !painpoints && !topics;
  if (needsSeed) {
    await seedInitial();
    return {
      cases: seedCases,
      filters: DEFAULT_FILTERS,
      painpoints: DEFAULT_PAINPOINTS,
      topics: seedTopics,
    };
  }

  return {
    cases: (caseRows || []).map(rowToCase),
    filters: filters || DEFAULT_FILTERS,
    painpoints: painpoints || DEFAULT_PAINPOINTS,
    topics: topics || seedTopics,
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

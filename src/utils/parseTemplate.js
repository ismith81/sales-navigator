import mammoth from 'mammoth';

/**
 * Parse an uploaded .docx case template into a structured case object.
 * 
 * Expected template sections:
 * - Bedrijfsnaam / Korte omschrijving (table row)
 * - Situatie, Doel, Oplossing, Resultaat, Keywords, Business Impact (text blocks)
 * - Mapping checkboxes: Doelen, Behoeften, Diensten
 */

const SECTION_MARKERS = [
  'situatie', 'doel', 'oplossing', 'resultaat', 'keywords', 'business impact'
];

const MAPPING_OPTIONS = {
  doelen: ['Meer waarde halen uit data', 'Data als business model'],
  behoeften: ['Veilig en betrouwbaar', 'Wendbaar', 'AI ready', 'Realtime data'],
  diensten: ['Data modernisatie', 'Governance', 'Data kwaliteit', 'Training'],
};

function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateLogoText(name) {
  const words = name.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function generateLogoColor() {
  const colors = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7', '#b45309'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function extractCheckedItems(text, options) {
  const checked = [];
  for (const option of options) {
    // Match ☑ or ☒ or [x] or [X] followed by the option text
    const patterns = [
      new RegExp(`[☑☒✓✔]\\s*${escapeRegex(option)}`, 'i'),
      new RegExp(`\\[x\\]\\s*${escapeRegex(option)}`, 'i'),
      new RegExp(`\\[X\\]\\s*${escapeRegex(option)}`, 'i'),
      // Also match if the option just appears on its own line without unchecked box
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        checked.push(option);
        break;
      }
    }
  }
  return checked;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSectionContent(lines, sectionName) {
  let capturing = false;
  let content = [];
  
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    
    // Start capturing after section header
    if (lower === sectionName || lower.startsWith(sectionName + ':') || lower.startsWith(sectionName + ' ')) {
      if (!capturing) {
        capturing = true;
        // If there's content after the colon on the same line
        const afterColon = line.split(':').slice(1).join(':').trim();
        if (afterColon) content.push(afterColon);
        continue;
      }
    }
    
    // Stop at next section
    if (capturing && SECTION_MARKERS.some(m => lower === m || lower.startsWith(m + ':'))) {
      if (lower !== sectionName) break;
    }
    
    if (capturing) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith('☐')) {
        content.push(trimmed);
      }
    }
  }
  
  return content.join(' ').trim();
}

function extractTableField(text, fieldName) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes(fieldName.toLowerCase())) {
      // Check same line for value (table row format)
      const parts = lines[i].split(/\t|  +/);
      if (parts.length >= 2) {
        const val = parts.slice(1).join(' ').trim();
        if (val && !val.startsWith('[')) return val;
      }
      // Check next non-empty line (may skip blank lines)
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const next = lines[j].trim();
        if (!next) continue; // skip blank lines
        if (next.startsWith('[') || SECTION_MARKERS.some(m => next.toLowerCase().startsWith(m))) break;
        return next;
      }
    }
  }
  return '';
}

export async function parseTemplate(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Extract basic info
  const bedrijfsnaam = extractTableField(text, 'Bedrijfsnaam') || 'Onbekend';
  const omschrijving = extractTableField(text, 'Korte omschrijving') || '';
  
  // Extract sections
  const situatie = extractSectionContent(lines, 'situatie');
  const doel = extractSectionContent(lines, 'doel');
  const oplossing = extractSectionContent(lines, 'oplossing');
  const resultaat = extractSectionContent(lines, 'resultaat');
  const keywordsRaw = extractSectionContent(lines, 'keywords');
  const businessImpact = extractSectionContent(lines, 'business impact');
  
  // Parse keywords
  const keywords = keywordsRaw
    ? keywordsRaw.split(/[,;]/).map(k => k.trim()).filter(Boolean)
    : [];
  
  // Extract mapping (checked items)
  const mappingSection = text.substring(text.toLowerCase().indexOf('mapping'));
  const doelen = extractCheckedItems(mappingSection, MAPPING_OPTIONS.doelen);
  const behoeften = extractCheckedItems(mappingSection, MAPPING_OPTIONS.behoeften);
  const diensten = extractCheckedItems(mappingSection, MAPPING_OPTIONS.diensten);
  
  const caseData = {
    id: generateId(bedrijfsnaam),
    name: bedrijfsnaam,
    subtitle: `${omschrijving}`,
    logoText: generateLogoText(bedrijfsnaam),
    logoColor: generateLogoColor(),
    situatie,
    doel,
    oplossing,
    resultaat,
    keywords,
    businessImpact,
    mapping: { doelen, behoeften, diensten },
    talkingPoints: [],
    followUps: [],
    matchReasons: { doelen: {}, behoeften: {}, diensten: {} },
    _imported: true,
    _importDate: new Date().toISOString(),
  };
  
  return { caseData, rawText: text };
}

export function generateDefaultTalkingPoints(caseData) {
  const points = [];
  if (caseData.situatie) {
    points.push(caseData.situatie);
  }
  if (caseData.oplossing) {
    const short = caseData.oplossing.length > 200
      ? caseData.oplossing.substring(0, 200) + '...'
      : caseData.oplossing;
    points.push(`Onze oplossing: ${short}`);
  }
  if (caseData.resultaat) {
    points.push(`Resultaat: ${caseData.resultaat}`);
  }
  if (caseData.businessImpact) {
    points.push(`Business impact: ${caseData.businessImpact}`);
  }
  return points;
}

export function generateDefaultFollowUps(caseData) {
  const questions = [];
  if (caseData.mapping.doelen.includes('Meer waarde halen uit data')) {
    questions.push('Hoe gebruiken jullie data momenteel voor besluitvorming?');
  }
  if (caseData.mapping.doelen.includes('Data als business model')) {
    questions.push('Zijn er mogelijkheden om jullie data als dienst aan te bieden aan klanten of partners?');
  }
  if (caseData.mapping.behoeften.includes('Realtime data')) {
    questions.push('Werken jullie al met real-time dataverwerking, of is dat iets wat jullie overwegen?');
  }
  if (caseData.mapping.behoeften.includes('AI ready')) {
    questions.push('Hebben jullie plannen om AI of machine learning in te zetten op jullie data?');
  }
  if (caseData.mapping.diensten.includes('Data modernisatie')) {
    questions.push('Hoe oud is jullie huidige dataplatform en voldoet het nog aan de groeiende behoefte?');
  }
  if (questions.length === 0) {
    questions.push('Wat zijn jullie grootste uitdagingen op het gebied van data?');
  }
  return questions;
}

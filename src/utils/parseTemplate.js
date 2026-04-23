import mammoth from 'mammoth';

/**
 * Parse een .docx klantcase-template naar een gestructureerd case-object.
 *
 * We lezen de docx als HTML (niet als platte tekst) zodat bold/italic/bullets
 * bewaard blijven voor de velden die vervolgens in TipTap bewerkt worden.
 */

const SECTION_LABEL_TO_KEY = {
  'situatie': 'situatie',
  'doel': 'doel',
  'oplossing': 'oplossing',
  'resultaat': 'resultaat',
  'keywords': 'keywords',
  'business impact': 'businessImpact',
};

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
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function generateLogoColor() {
  const colors = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7', '#b45309'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCheckedItems(text, options) {
  const checked = [];
  for (const option of options) {
    const patterns = [
      new RegExp(`[☑☒✓✔]\\s*${escapeRegex(option)}`, 'i'),
      new RegExp(`\\[x\\]\\s*${escapeRegex(option)}`, 'i'),
    ];
    if (patterns.some(p => p.test(text))) checked.push(option);
  }
  return checked;
}

function stripTags(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

/**
 * Loop de HTML-body door. Labels (bv. "Situatie") staan in een <p>
 * vlak boven een <table>, en de inhoud staat in de eerste <td> van die tabel.
 */
function extractSectionsFromHtml(body) {
  const sections = {};
  const children = Array.from(body.children);

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (el.tagName !== 'P') continue;

    const labelText = (el.textContent || '').trim().toLowerCase();
    const key = SECTION_LABEL_TO_KEY[labelText];
    if (!key) continue;
    if (sections[key]) continue; // eerste voorkomen wint (referentiesecties negeren)

    // Zoek de eerstvolgende <table> (skipping lege paragraphs).
    for (let j = i + 1; j < children.length; j++) {
      const next = children[j];
      if (next.tagName === 'TABLE') {
        const td = next.querySelector('td');
        if (td) sections[key] = td.innerHTML.trim();
        break;
      }
      if (next.tagName === 'P') {
        const nextLabel = (next.textContent || '').trim().toLowerCase();
        if (SECTION_LABEL_TO_KEY[nextLabel]) break; // volgende sectie — content ontbreekt
      }
    }
  }
  return sections;
}

/**
 * Info-tabel: bedrijfsnaam/korte omschrijving. Twee kolommen (label | value).
 */
function extractInfoFields(body) {
  // Eerste match wint: het template heeft onderaan een "Voorbeeld: CITO"-
  // referentiesectie met een tweede info-tabel. Zonder first-match-wins
  // overschrijft die de echte case.
  let bedrijfsnaam = '';
  let omschrijving = '';
  for (const row of body.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) continue;
    const label = (cells[0].textContent || '').trim().toLowerCase();
    const value = (cells[1].textContent || '').trim();
    if (!bedrijfsnaam && label.includes('bedrijfsnaam') && value) bedrijfsnaam = value;
    else if (!omschrijving && label.includes('omschrijving') && value) omschrijving = value;
    if (bedrijfsnaam && omschrijving) break;
  }
  return { bedrijfsnaam, omschrijving };
}

export async function parseTemplate(file) {
  const arrayBuffer = await file.arrayBuffer();

  // HTML-variant voor rich content, platte tekst apart voor de mapping-checkboxes
  // (mammoth rendert ☑/☐ wel als tekst, maar HTML is robuuster voor structuur).
  const [{ value: html }, { value: rawText }] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }),
    mammoth.extractRawText({ arrayBuffer }),
  ]);

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  const { bedrijfsnaam, omschrijving } = extractInfoFields(body);
  const sections = extractSectionsFromHtml(body);

  // Keywords: platte tekst, komma-gescheiden
  const keywordsText = stripTags(sections.keywords || '');
  const keywords = keywordsText
    ? keywordsText.split(/[,;]/).map(k => k.trim()).filter(Boolean)
    : [];

  // Mapping via platte tekst (checkboxes blijven als unicode chars behouden)
  const mappingIdx = rawText.toLowerCase().indexOf('mapping');
  const mappingText = mappingIdx >= 0 ? rawText.substring(mappingIdx) : rawText;
  const doelen = extractCheckedItems(mappingText, MAPPING_OPTIONS.doelen);
  const behoeften = extractCheckedItems(mappingText, MAPPING_OPTIONS.behoeften);
  const diensten = extractCheckedItems(mappingText, MAPPING_OPTIONS.diensten);

  const name = bedrijfsnaam || 'Onbekend';
  const caseData = {
    id: generateId(name),
    name,
    subtitle: omschrijving,
    logoText: generateLogoText(name),
    logoColor: generateLogoColor(),
    situatie: sections.situatie || '',
    doel: sections.doel || '',
    oplossing: sections.oplossing || '',
    resultaat: sections.resultaat || '',
    keywords,
    businessImpact: sections.businessImpact || '',
    mapping: { doelen, behoeften, diensten },
    talkingPoints: [],
    followUps: [],
    matchReasons: { doelen: {}, behoeften: {}, diensten: {} },
    _imported: true,
    _importDate: new Date().toISOString(),
  };

  return { caseData, rawText };
}

export function generateDefaultTalkingPoints(caseData) {
  const points = [];
  const situatie = stripTags(caseData.situatie);
  const oplossing = stripTags(caseData.oplossing);
  const resultaat = stripTags(caseData.resultaat);
  const businessImpact = stripTags(caseData.businessImpact);
  if (situatie) points.push(situatie);
  if (oplossing) points.push(`Onze oplossing: ${oplossing.length > 200 ? oplossing.substring(0, 200) + '...' : oplossing}`);
  if (resultaat) points.push(`Resultaat: ${resultaat}`);
  if (businessImpact) points.push(`Business impact: ${businessImpact}`);
  return points;
}

export function generateDefaultFollowUps(caseData) {
  const questions = [];
  if (caseData.mapping.doelen.includes('Meer waarde halen uit data'))
    questions.push('Hoe gebruiken jullie data momenteel voor besluitvorming?');
  if (caseData.mapping.doelen.includes('Data als business model'))
    questions.push('Zijn er mogelijkheden om jullie data als dienst aan te bieden aan klanten of partners?');
  if (caseData.mapping.behoeften.includes('Realtime data'))
    questions.push('Werken jullie al met real-time dataverwerking, of is dat iets wat jullie overwegen?');
  if (caseData.mapping.behoeften.includes('AI ready'))
    questions.push('Hebben jullie plannen om AI of machine learning in te zetten op jullie data?');
  if (caseData.mapping.diensten.includes('Data modernisatie'))
    questions.push('Hoe oud is jullie huidige dataplatform en voldoet het nog aan de groeiende behoefte?');
  if (questions.length === 0)
    questions.push('Wat zijn jullie grootste uitdagingen op het gebied van data?');
  return questions;
}

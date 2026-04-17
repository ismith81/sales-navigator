import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import { FILTERS } from '../data/filters';

// === House style (gelijk aan build_case_template.py / src/styles/index.css) ===
const NAVY = '2C3C52';
const TEAL = '31B7B9';
const ACCENT = 'ED174B';
const ORANGE = 'ED8936';
const LIGHT_BG = 'F5F7FA';
const BORDER_COLOR = 'D9DEE5';
const MUTED = '8A95A8';
const TEXT_LIGHT = '5A6B82';

const DOELEN_COLOR = ACCENT;
const BEHOEFTEN_COLOR = TEAL;
const DIENSTEN_COLOR = ORANGE;

const FONT = 'Nunito Sans';

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR };
const ALL_THIN = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const ALL_NONE = { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER };
const CELL_MARGINS = { top: 200, bottom: 200, left: 260, right: 260 };
const SMALL_MARGINS = { top: 160, bottom: 160, left: 240, right: 240 };

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function run(text, { bold = false, italic = false, size = 20, color = NAVY, underline = false } = {}) {
  return new TextRun({
    text,
    font: FONT,
    size,
    color,
    bold,
    italics: italic,
    ...(underline ? { underline: {} } : {}),
  });
}

/**
 * Rich HTML -> docx Paragraphs (behoudt bold/italic/u, <ul><li>, <ol>).
 */
function htmlToDocxParagraphs(html, { placeholder = null } = {}) {
  if (!html || !stripHtml(html).trim()) {
    if (placeholder) {
      return [new Paragraph({
        spacing: { after: 60 },
        children: [run(placeholder, { italic: true, color: MUTED })],
      })];
    }
    return [];
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];

  // Plain-text fallback: body zonder element-children wordt anders overgeslagen.
  if (doc.body.children.length === 0) {
    const text = (doc.body.textContent || '').trim();
    if (text) {
      const parts = text.split(/\n\s*\n+/);
      return parts.map(p => new Paragraph({
        spacing: { after: 80 },
        children: p.split(/\n/).flatMap((line, i) => {
          const r = run(line);
          return i === 0 ? [r] : [new TextRun({ text: '', break: 1 }), r];
        }),
      }));
    }
  }

  function runsFromInline(node, style = {}) {
    const runs = [];
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (child.textContent) runs.push(run(child.textContent, style));
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'br') {
          runs.push(new TextRun({ text: '', break: 1 }));
          continue;
        }
        const next = { ...style };
        if (tag === 'strong' || tag === 'b') next.bold = true;
        if (tag === 'em' || tag === 'i') next.italic = true;
        if (tag === 'u') next.underline = true;
        runs.push(...runsFromInline(child, next));
      }
    }
    return runs;
  }

  function walk(nodes, listLevel = 0) {
    for (const node of nodes) {
      if (node.nodeType !== 1) continue;
      const tag = node.tagName.toLowerCase();

      if (tag === 'p' || tag === 'div') {
        const runs = runsFromInline(node);
        if (runs.length) out.push(new Paragraph({ spacing: { after: 80 }, children: runs }));
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.children).filter(c => c.tagName.toLowerCase() === 'li');
        items.forEach((li, idx) => {
          const prefix = tag === 'ol' ? `${idx + 1}.  ` : '•  ';
          const inlineNode = li.cloneNode(true);
          Array.from(inlineNode.querySelectorAll('ul, ol')).forEach(n => n.remove());
          const prefixRun = tag === 'ol'
            ? run(prefix, { bold: true })
            : run(prefix, { bold: true, color: TEAL, size: 22 });
          const runs = [prefixRun, ...runsFromInline(inlineNode)];
          out.push(new Paragraph({
            spacing: { after: 60 },
            indent: { left: 360 * (listLevel + 1) },
            children: runs,
          }));
          const nested = Array.from(li.children).filter(c => ['ul', 'ol'].includes(c.tagName.toLowerCase()));
          walk(nested, listLevel + 1);
        });
      } else if (['section', 'article', 'blockquote'].includes(tag)) {
        walk(Array.from(node.children), listLevel);
      } else {
        const runs = runsFromInline(node);
        if (runs.length) out.push(new Paragraph({ spacing: { after: 80 }, children: runs }));
      }
    }
  }

  walk(Array.from(doc.body.children));

  if (out.length === 0 && placeholder) {
    return [new Paragraph({
      spacing: { after: 60 },
      children: [run(placeholder, { italic: true, color: MUTED })],
    })];
  }
  return out;
}

// === Section builders ===

function brandHeader() {
  const productName = new Paragraph({
    spacing: { after: 20 },
    children: [
      run('Sales ', { bold: true, size: 40, color: NAVY }),
      run('Navigator', { bold: true, size: 40, color: ACCENT }),
    ],
  });
  const subBrand = new Paragraph({
    spacing: { after: 60 },
    border: { bottom: { color: TEAL, space: 6, style: BorderStyle.SINGLE, size: 16 } },
    children: [
      run('creates', { bold: true, size: 20, color: NAVY }),
      run('.', { bold: true, size: 20, color: ACCENT }),
    ],
  });
  const label = new Paragraph({
    spacing: { before: 120, after: 0 },
    children: [run('KLANTCASE', { bold: true, size: 18, color: TEAL })],
  });
  return [productName, subBrand, label];
}

function sectionHeading(text, number) {
  return new Paragraph({
    spacing: { before: 360, after: 120 },
    border: { bottom: { color: TEAL, space: 4, style: BorderStyle.SINGLE, size: 12 } },
    children: [
      ...(number ? [run(`${number}  `, { bold: true, size: 32, color: TEAL })] : []),
      run(text, { bold: true, size: 32, color: NAVY }),
    ],
  });
}

function infoCell(text, { isLabel = false, bold = false, size = 20 } = {}) {
  return new TableCell({
    borders: ALL_THIN,
    margins: SMALL_MARGINS,
    width: { size: isLabel ? 2800 : 6560, type: WidthType.DXA },
    shading: isLabel ? { fill: LIGHT_BG, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({
      children: [run(text || '', {
        bold,
        size,
        color: isLabel ? MUTED : NAVY,
      })],
    })],
  });
}

function infoTable(caseData) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: [
      new TableRow({ children: [
        infoCell('BEDRIJFSNAAM', { isLabel: true, bold: true, size: 16 }),
        infoCell(caseData.name, { bold: true, size: 24 }),
      ]}),
      new TableRow({ children: [
        infoCell('KORTE OMSCHRIJVING', { isLabel: true, bold: true, size: 16 }),
        infoCell(caseData.subtitle || '', { size: 20 }),
      ]}),
    ],
  });
}

function contentLabel(text) {
  return new Paragraph({
    spacing: { before: 280, after: 80 },
    children: [run(text, { bold: true, size: 24, color: NAVY })],
  });
}

function contentBox(html, { placeholder, accentColor = null } = {}) {
  const paragraphs = htmlToDocxParagraphs(html, { placeholder });
  // Zorg dat laatste paragraph geen trailing spacing heeft binnen de box
  if (paragraphs.length > 0) {
    // docx Paragraph immutable — we laten default 80 staan; cell-margins vangen de rest op.
  }

  const borders = accentColor
    ? {
        top: THIN_BORDER,
        right: THIN_BORDER,
        bottom: THIN_BORDER,
        left: { style: BorderStyle.SINGLE, size: 24, color: accentColor },
      }
    : ALL_THIN;

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [new TableCell({
      borders,
      margins: CELL_MARGINS,
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR, color: 'auto' },
      width: { size: 9360, type: WidthType.DXA },
      children: paragraphs,
    })]})],
  });
}

function mappingHeader(label, accentColor) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [
      run('●  ', { bold: true, size: 28, color: accentColor }),
      run(label, { bold: true, size: 26, color: NAVY }),
    ],
  });
}

function mappingTable(options, accentColor, filledMapping, reasons, col1Header, col2Header) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [col1Header, col2Header].map((text, i) => new TableCell({
      borders: {
        top: THIN_BORDER,
        left: THIN_BORDER,
        right: THIN_BORDER,
        bottom: { style: BorderStyle.SINGLE, size: 12, color: accentColor },
      },
      margins: SMALL_MARGINS,
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR, color: 'auto' },
      width: { size: i === 0 ? 3680 : 5680, type: WidthType.DXA },
      children: [new Paragraph({
        children: [run(text.toUpperCase(), { bold: true, size: 16, color: accentColor })],
      })],
    })),
  });

  const rows = options.map(option => {
    const checked = (filledMapping || []).includes(option);
    const reason = (reasons && reasons[option]) || '';
    const box = checked ? '\u2611' : '\u2610';
    return new TableRow({ children: [
      new TableCell({
        borders: ALL_THIN,
        margins: SMALL_MARGINS,
        width: { size: 3680, type: WidthType.DXA },
        children: [new Paragraph({ children: [
          run(box + '  ', { bold: true, size: 24, color: checked ? accentColor : MUTED }),
          run(option, { bold: checked, size: 20, color: NAVY }),
        ]})],
      }),
      new TableCell({
        borders: ALL_THIN,
        margins: SMALL_MARGINS,
        width: { size: 5680, type: WidthType.DXA },
        children: [new Paragraph({ children: reason ? [run(reason, { size: 20 })] : [run('')] })],
      }),
    ]});
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3680, 5680],
    rows: [headerRow, ...rows],
  });
}

function mappingSection(caseData) {
  const m = caseData.mapping || {};
  const reasons = caseData.matchReasons || {};
  return [
    mappingHeader('Doelen', DOELEN_COLOR),
    mappingTable(FILTERS.doelen, DOELEN_COLOR, m.doelen, reasons.doelen,
      'Doel', 'Toelichting (optioneel)'),
    mappingHeader('Behoeften', BEHOEFTEN_COLOR),
    mappingTable(FILTERS.behoeften, BEHOEFTEN_COLOR, m.behoeften, reasons.behoeften,
      'Behoefte', 'Hoe komt dit terug in de case?'),
    mappingHeader('Diensten', DIENSTEN_COLOR),
    mappingTable(FILTERS.diensten, DIENSTEN_COLOR, m.diensten, reasons.diensten,
      'Dienst', 'Hoe is dit ingevuld?'),
  ];
}

function spacer() {
  return new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '' })] });
}

export async function exportCaseToDocx(caseData) {
  const fields = [
    { label: 'Situatie', key: 'situatie', accent: null,
      placeholder: '[Wat was het probleem of de ambitie van de klant? Beschrijf de uitgangssituatie.]' },
    { label: 'Doel', key: 'doel', accent: null,
      placeholder: '[Wat moest er bereikt worden? Wat was de gewenste eindsituatie?]' },
    { label: 'Oplossing', key: 'oplossing', accent: null,
      placeholder: '[Wat hebben jullie gebouwd of gedaan? Beschrijf architectuur, technische keuzes en aanpak.]' },
    { label: 'Resultaat', key: 'resultaat', accent: null,
      placeholder: '[Wat is er concreet opgeleverd?]' },
  ];

  const keywordsText = caseData.keywords?.length
    ? caseData.keywords.join(', ')
    : null;

  const children = [
    ...brandHeader(),
    spacer(),
    sectionHeading('Case Informatie', '1.'),
    infoTable(caseData),
  ];

  for (const f of fields) {
    children.push(contentLabel(f.label));
    children.push(contentBox(caseData[f.key], { placeholder: f.placeholder, accentColor: f.accent }));
  }

  // Keywords: label + plain paragraph (geen shaded box, past bij template)
  children.push(contentLabel('Keywords'));
  children.push(contentBox(
    keywordsText ? `<p>${keywordsText}</p>` : '',
    { placeholder: '[Bijv. Microsoft Fabric, Power BI, Delta Lake, Azure]' }
  ));

  children.push(contentLabel('Business Impact'));
  children.push(contentBox(caseData.businessImpact, {
    placeholder: '[Concrete waarde voor de klant — tijdsbesparing, kostenverlaging, betere besluitvorming.]',
    accentColor: TEAL,
  }));

  children.push(spacer());
  children.push(sectionHeading('Mapping', '2.'));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [run(
      'Kruis aan welke doelen, behoeften en diensten van toepassing zijn op deze case. ' +
      'Meerdere opties per categorie zijn mogelijk.',
      { italic: true, size: 20, color: MUTED }
    )],
  }));
  children.push(...mappingSection(caseData));

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1133, right: 1133, bottom: 1133, left: 1133 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `case-${caseData.id || caseData.name.toLowerCase().replace(/\s+/g, '-')}.docx`;
  saveAs(blob, filename);
}

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import { FILTERS } from '../data/filters';

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 };

/**
 * Strip HTML tags and return plain text.
 */
function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Convert rich HTML (zoals opgeslagen door TipTap/mammoth) naar een reeks docx Paragraphs.
 * Ondersteunt: <p>, <strong>/<b>, <em>/<i>, <ul>/<ol>/<li>, <br>.
 */
function htmlToDocxParagraphs(html, { placeholder = null } = {}) {
  if (!html || !stripHtml(html).trim()) {
    if (placeholder) {
      return [new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: placeholder, font: 'Arial', size: 20, italics: true, color: '999999' })],
      })];
    }
    return [];
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];

  function runsFromInline(node, style = {}) {
    const runs = [];
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (child.textContent) {
          runs.push(new TextRun({ text: child.textContent, font: 'Arial', size: 20, ...style }));
        }
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'br') {
          runs.push(new TextRun({ text: '', break: 1 }));
          continue;
        }
        const next = { ...style };
        if (tag === 'strong' || tag === 'b') next.bold = true;
        if (tag === 'em' || tag === 'i') next.italics = true;
        if (tag === 'u') next.underline = {};
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
        if (runs.length) {
          out.push(new Paragraph({ spacing: { after: 100 }, children: runs }));
        }
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.children).filter(c => c.tagName.toLowerCase() === 'li');
        items.forEach((li, idx) => {
          const prefix = tag === 'ol' ? `${idx + 1}.  ` : '•  ';
          // Inline runs van de li (exclusief geneste lijsten)
          const inlineNode = li.cloneNode(true);
          Array.from(inlineNode.querySelectorAll('ul, ol')).forEach(n => n.remove());
          const runs = [new TextRun({ text: prefix, font: 'Arial', size: 20 }), ...runsFromInline(inlineNode)];
          out.push(new Paragraph({
            spacing: { after: 60 },
            indent: { left: 360 * (listLevel + 1) },
            children: runs,
          }));
          // Geneste lijsten
          const nested = Array.from(li.children).filter(c => ['ul', 'ol'].includes(c.tagName.toLowerCase()));
          walk(nested, listLevel + 1);
        });
      } else if (['section', 'article', 'blockquote'].includes(tag)) {
        walk(Array.from(node.children), listLevel);
      } else {
        const runs = runsFromInline(node);
        if (runs.length) out.push(new Paragraph({ spacing: { after: 100 }, children: runs }));
      }
    }
  }

  walk(Array.from(doc.body.children));

  if (out.length === 0 && placeholder) {
    return [new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: placeholder, font: 'Arial', size: 20, italics: true, color: '999999' })],
    })];
  }
  return out;
}

/**
 * Build a two-column info table (label | value).
 */
function infoTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            borders: BORDERS,
            width: { size: 2800, type: WidthType.DXA },
            margins: CELL_MARGINS,
            shading: { fill: 'E8F0FE', type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 20 })] })],
          }),
          new TableCell({
            borders: BORDERS,
            width: { size: 6560, type: WidthType.DXA },
            margins: CELL_MARGINS,
            children: [new Paragraph({ children: [new TextRun({ text: value || '', font: 'Arial', size: 20 })] })],
          }),
        ],
      })
    ),
  });
}

/**
 * Create a section heading paragraph.
 */
function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 24, color: '1a6baa' })],
  });
}

/**
 * Create a labeled content block. Content mag rich HTML zijn (van TipTap/mammoth).
 */
function contentBlock(label, content) {
  const paragraphs = [];
  paragraphs.push(new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 20 })],
  }));
  paragraphs.push(...htmlToDocxParagraphs(content, { placeholder: '[Nog in te vullen]' }));
  return paragraphs;
}

/**
 * Build the mapping section with checkboxes.
 */
function mappingSection(caseData) {
  const paragraphs = [];
  paragraphs.push(sectionHeading('Mapping'));

  const categories = [
    { key: 'doelen', label: 'Doelen' },
    { key: 'behoeften', label: 'Behoeften' },
    { key: 'diensten', label: 'Diensten' },
  ];

  for (const { key, label } of categories) {
    paragraphs.push(new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 20 })],
    }));

    for (const option of FILTERS[key]) {
      const checked = caseData.mapping[key]?.includes(option);
      const checkbox = checked ? '\u2611' : '\u2610';
      paragraphs.push(new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: `${checkbox}  ${option}`, font: 'Arial', size: 20 })],
      }));
    }
  }

  return paragraphs;
}

/**
 * Export a case to .docx and trigger download.
 */
export async function exportCaseToDocx(caseData) {
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          // Title
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: 'Case Template', bold: true, font: 'Arial', size: 36, color: '1a6baa' })],
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [new TextRun({ text: 'Sales Navigator — Creates', font: 'Arial', size: 20, color: '666666' })],
          }),

          // Basic info table
          infoTable([
            ['Bedrijfsnaam', caseData.name],
            ['Korte omschrijving', caseData.subtitle || ''],
          ]),

          // Content sections
          sectionHeading('Case Informatie'),
          ...contentBlock('Situatie', caseData.situatie),
          ...contentBlock('Doel', caseData.doel),
          ...contentBlock('Oplossing', caseData.oplossing),
          ...contentBlock('Resultaat', caseData.resultaat),
          ...contentBlock('Business Impact', caseData.businessImpact),

          // Keywords
          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [new TextRun({ text: 'Keywords', bold: true, font: 'Arial', size: 20 })],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({
              text: caseData.keywords?.length ? caseData.keywords.join(', ') : '[Geen keywords]',
              font: 'Arial',
              size: 20,
              italics: !caseData.keywords?.length,
              color: caseData.keywords?.length ? '000000' : '999999',
            })],
          }),

          // Mapping
          ...mappingSection(caseData),

          // Match reasons
          ...matchReasonsSection(caseData),
        ],
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  const filename = `case-${caseData.id || caseData.name.toLowerCase().replace(/\s+/g, '-')}.docx`;
  saveAs(buffer, filename);
}

function matchReasonsSection(caseData) {
  const paragraphs = [];
  const reasons = caseData.matchReasons || {};
  const hasAny = Object.values(reasons).some(cat =>
    Object.values(cat).some(v => v?.trim())
  );

  if (!hasAny) return paragraphs;

  paragraphs.push(sectionHeading('Match Redenen'));

  const categoryLabels = { doelen: 'Doel', behoeften: 'Behoefte', diensten: 'Dienst' };

  for (const [category, tags] of Object.entries(reasons)) {
    for (const [tag, reason] of Object.entries(tags)) {
      if (!reason?.trim()) continue;
      paragraphs.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: `${categoryLabels[category]} — ${tag}`, bold: true, font: 'Arial', size: 20 })],
      }));
      paragraphs.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: reason, font: 'Arial', size: 20 })],
      }));
    }
  }

  return paragraphs;
}

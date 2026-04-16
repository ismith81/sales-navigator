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
 * Create a labeled content block.
 */
function contentBlock(label, content) {
  const paragraphs = [];
  paragraphs.push(new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 20 })],
  }));
  const text = stripHtml(content);
  if (text) {
    paragraphs.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text, font: 'Arial', size: 20 })],
    }));
  } else {
    paragraphs.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: '[Nog in te vullen]', font: 'Arial', size: 20, italics: true, color: '999999' })],
    }));
  }
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

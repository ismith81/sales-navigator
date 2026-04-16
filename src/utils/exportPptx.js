import PptxGenJS from 'pptxgenjs';

// Creates brand colors
const NAVY = '1E2B3D';
const NAVY_MID = '2C3C52';
const RED = 'ED174B';
const TEAL = '31B7B9';
const WHITE = 'F4F6FA';
const MUTED = '9AA8BD';
const ORANGE = 'ED8936';

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
 * Export a case to a branded PowerPoint presentation.
 */
export async function exportCaseToPptx(caseData) {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches
  pptx.author = 'Creates - Sales Navigator';
  pptx.subject = caseData.name;
  pptx.title = `Case: ${caseData.name}`;

  // Define master slides
  pptx.defineSlideMaster({
    title: 'CREATES_DARK',
    background: { color: NAVY },
    objects: [
      // Red accent dot bottom-right
      { rect: { x: 12.6, y: 7.0, w: 0.2, h: 0.2, fill: { color: RED }, rectRadius: 0.1 } },
      // Subtle line at top
      { rect: { x: 0, y: 0, w: 13.33, h: 0.04, fill: { color: RED } } },
    ],
  });

  pptx.defineSlideMaster({
    title: 'CREATES_CONTENT',
    background: { color: NAVY },
    objects: [
      // Thin teal line at top
      { rect: { x: 0, y: 0, w: 13.33, h: 0.02, fill: { color: TEAL } } },
      // Red dot bottom-right
      { rect: { x: 12.6, y: 7.0, w: 0.2, h: 0.2, fill: { color: RED }, rectRadius: 0.1 } },
    ],
  });

  // ========== SLIDE 1: Title ==========
  const slide1 = pptx.addSlide({ masterName: 'CREATES_DARK' });

  // Logo text "creates."
  slide1.addText(
    [
      { text: 'creates', options: { color: WHITE, fontSize: 28, fontFace: 'Nunito Sans', bold: true } },
      { text: '.', options: { color: RED, fontSize: 28, fontFace: 'Nunito Sans', bold: true } },
    ],
    { x: 0.8, y: 0.6, w: 4, h: 0.6 }
  );

  // Case label
  slide1.addText('KLANTCASE', {
    x: 0.8, y: 2.2, w: 5, h: 0.4,
    fontSize: 11, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, letterSpacing: 4,
  });

  // Company name
  slide1.addText(caseData.name.toUpperCase(), {
    x: 0.8, y: 2.7, w: 8, h: 1.2,
    fontSize: 44, fontFace: 'Nunito Sans', bold: true,
    color: WHITE,
  });

  // Subtitle
  slide1.addText(caseData.subtitle || '', {
    x: 0.8, y: 3.9, w: 8, h: 0.6,
    fontSize: 16, fontFace: 'Nunito Sans',
    color: MUTED,
  });

  // Tags row
  const allTags = [
    ...(caseData.mapping?.doelen || []).map(t => ({ text: t, color: RED })),
    ...(caseData.mapping?.behoeften || []).map(t => ({ text: t, color: TEAL })),
    ...(caseData.mapping?.diensten || []).map(t => ({ text: t, color: ORANGE })),
  ];

  let tagX = 0.8;
  allTags.forEach((tag) => {
    const tagW = tag.text.length * 0.1 + 0.5;
    slide1.addShape(pptx.ShapeType.roundRect, {
      x: tagX, y: 5.0, w: tagW, h: 0.35,
      fill: { color: tag.color, transparency: 85 },
      rectRadius: 0.15,
      line: { color: tag.color, width: 0.5, transparency: 60 },
    });
    slide1.addText(tag.text, {
      x: tagX, y: 5.0, w: tagW, h: 0.35,
      fontSize: 9, fontFace: 'Nunito Sans', bold: true,
      color: tag.color, align: 'center', valign: 'middle',
    });
    tagX += tagW + 0.15;
  });

  // Logo badge (company initials)
  const initials = caseData.logoText || caseData.name.substring(0, 2).toUpperCase();
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 10.5, y: 2.5, w: 2.0, h: 2.0,
    fill: { color: caseData.logoColor?.replace('#', '') || TEAL },
    rectRadius: 0.3,
  });
  slide1.addText(initials, {
    x: 10.5, y: 2.5, w: 2.0, h: 2.0,
    fontSize: 48, fontFace: 'Nunito Sans', bold: true,
    color: 'FFFFFF', align: 'center', valign: 'middle',
  });

  // ========== SLIDE 2: Situatie & Doel ==========
  const slide2 = pptx.addSlide({ masterName: 'CREATES_CONTENT' });

  // Section header
  slide2.addText('SITUATIE & DOEL', {
    x: 0.8, y: 0.4, w: 6, h: 0.5,
    fontSize: 11, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, letterSpacing: 4,
  });

  slide2.addText(caseData.name, {
    x: 0.8, y: 0.9, w: 8, h: 0.6,
    fontSize: 28, fontFace: 'Nunito Sans', bold: true,
    color: WHITE,
  });

  // Left column: Situatie
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.9, w: 5.5, h: 4.5,
    fill: { color: NAVY_MID },
    rectRadius: 0.15,
  });

  slide2.addText('Situatie', {
    x: 1.1, y: 2.1, w: 5, h: 0.4,
    fontSize: 13, fontFace: 'Nunito Sans', bold: true,
    color: RED,
  });

  slide2.addText(stripHtml(caseData.situatie) || 'Nog niet ingevuld', {
    x: 1.1, y: 2.6, w: 4.9, h: 3.5,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: WHITE, valign: 'top', lineSpacingMultiple: 1.4,
    paraSpaceAfter: 6,
  });

  // Right column: Doel
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.9, w: 5.5, h: 4.5,
    fill: { color: NAVY_MID },
    rectRadius: 0.15,
  });

  slide2.addText('Doel', {
    x: 7.1, y: 2.1, w: 5, h: 0.4,
    fontSize: 13, fontFace: 'Nunito Sans', bold: true,
    color: RED,
  });

  slide2.addText(stripHtml(caseData.doel) || 'Nog niet ingevuld', {
    x: 7.1, y: 2.6, w: 4.9, h: 3.5,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: WHITE, valign: 'top', lineSpacingMultiple: 1.4,
    paraSpaceAfter: 6,
  });

  // ========== SLIDE 3: Oplossing ==========
  const slide3 = pptx.addSlide({ masterName: 'CREATES_CONTENT' });

  slide3.addText('OPLOSSING', {
    x: 0.8, y: 0.4, w: 6, h: 0.5,
    fontSize: 11, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, letterSpacing: 4,
  });

  slide3.addText(caseData.name, {
    x: 0.8, y: 0.9, w: 8, h: 0.6,
    fontSize: 28, fontFace: 'Nunito Sans', bold: true,
    color: WHITE,
  });

  // Main content card
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.9, w: 11.7, h: 3.5,
    fill: { color: NAVY_MID },
    rectRadius: 0.15,
  });

  slide3.addText(stripHtml(caseData.oplossing) || 'Nog niet ingevuld', {
    x: 1.2, y: 2.2, w: 11.0, h: 2.9,
    fontSize: 13, fontFace: 'Nunito Sans',
    color: WHITE, valign: 'top', lineSpacingMultiple: 1.5,
    paraSpaceAfter: 6,
  });

  // Keywords row
  const keywords = caseData.keywords || [];
  if (keywords.length > 0) {
    slide3.addText('TECHNOLOGIEEN', {
      x: 0.8, y: 5.7, w: 4, h: 0.35,
      fontSize: 9, fontFace: 'Nunito Sans', bold: true,
      color: MUTED, letterSpacing: 3,
    });

    let kwX = 0.8;
    keywords.forEach((kw) => {
      const kwW = kw.length * 0.09 + 0.5;
      slide3.addShape(pptx.ShapeType.roundRect, {
        x: kwX, y: 6.1, w: kwW, h: 0.35,
        fill: { color: TEAL, transparency: 85 },
        rectRadius: 0.15,
        line: { color: TEAL, width: 0.5, transparency: 60 },
      });
      slide3.addText(kw, {
        x: kwX, y: 6.1, w: kwW, h: 0.35,
        fontSize: 9, fontFace: 'Nunito Sans', bold: true,
        color: TEAL, align: 'center', valign: 'middle',
      });
      kwX += kwW + 0.15;
    });
  }

  // ========== SLIDE 4: Resultaat & Impact ==========
  const slide4 = pptx.addSlide({ masterName: 'CREATES_CONTENT' });

  slide4.addText('RESULTAAT', {
    x: 0.8, y: 0.4, w: 6, h: 0.5,
    fontSize: 11, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, letterSpacing: 4,
  });

  slide4.addText(caseData.name, {
    x: 0.8, y: 0.9, w: 8, h: 0.6,
    fontSize: 28, fontFace: 'Nunito Sans', bold: true,
    color: WHITE,
  });

  // Result card
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.9, w: 7.5, h: 3.0,
    fill: { color: NAVY_MID },
    rectRadius: 0.15,
  });

  slide4.addText('Resultaat', {
    x: 1.1, y: 2.1, w: 7, h: 0.4,
    fontSize: 13, fontFace: 'Nunito Sans', bold: true,
    color: RED,
  });

  slide4.addText(stripHtml(caseData.resultaat) || 'Nog niet ingevuld', {
    x: 1.1, y: 2.6, w: 6.9, h: 2.0,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: WHITE, valign: 'top', lineSpacingMultiple: 1.4,
    paraSpaceAfter: 6,
  });

  // Business Impact (highlight box)
  const impact = stripHtml(caseData.businessImpact);
  if (impact) {
    slide4.addShape(pptx.ShapeType.roundRect, {
      x: 8.8, y: 1.9, w: 3.7, h: 3.0,
      fill: { color: RED },
      rectRadius: 0.15,
    });

    slide4.addText('Business Impact', {
      x: 9.1, y: 2.1, w: 3.2, h: 0.4,
      fontSize: 11, fontFace: 'Nunito Sans', bold: true,
      color: 'FFFFFF', letterSpacing: 2,
    });

    slide4.addText(impact, {
      x: 9.1, y: 2.6, w: 3.2, h: 2.0,
      fontSize: 12, fontFace: 'Nunito Sans', bold: true,
      color: 'FFFFFF', valign: 'top', lineSpacingMultiple: 1.4,
    });
  }

  // Quote / key takeaway
  slide4.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 5.3, w: 0.06, h: 1.0,
    fill: { color: TEAL },
  });

  const takeaway = impact
    ? `${caseData.name}: ${impact}`
    : `${caseData.name} — ${stripHtml(caseData.resultaat) || ''}`.substring(0, 120);

  slide4.addText(takeaway, {
    x: 1.1, y: 5.3, w: 10, h: 1.0,
    fontSize: 14, fontFace: 'Nunito Sans', italic: true,
    color: MUTED, valign: 'middle', lineSpacingMultiple: 1.3,
  });

  // ========== SLIDE 5: Contact ==========
  const slide5 = pptx.addSlide({ masterName: 'CREATES_DARK' });

  // Large logo
  slide5.addText(
    [
      { text: 'creates', options: { color: WHITE, fontSize: 52, fontFace: 'Nunito Sans', bold: true } },
      { text: '.', options: { color: RED, fontSize: 52, fontFace: 'Nunito Sans', bold: true } },
    ],
    { x: 0, y: 1.8, w: 13.33, h: 1.0, align: 'center' }
  );

  slide5.addText('Empowering people with data', {
    x: 0, y: 2.9, w: 13.33, h: 0.5,
    fontSize: 16, fontFace: 'Nunito Sans', italic: true,
    color: MUTED, align: 'center',
  });

  // Contact info
  slide5.addText('creates.nl', {
    x: 0, y: 4.3, w: 13.33, h: 0.4,
    fontSize: 14, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, align: 'center',
  });

  slide5.addText('Neem contact op voor een vrijblijvend gesprek', {
    x: 0, y: 4.8, w: 13.33, h: 0.4,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: MUTED, align: 'center',
  });

  // Save
  const filename = `case-${caseData.id || caseData.name.toLowerCase().replace(/\s+/g, '-')}.pptx`;
  await pptx.writeFile({ fileName: filename });
}

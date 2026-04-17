import PptxGenJS from 'pptxgenjs';

// Creates huisstijl — licht thema
const NAVY = '2C3C52';
const TEAL = '31B7B9';
const ACCENT = 'ED174B';
const ORANGE = 'ED8936';
const WHITE = 'FFFFFF';
const LIGHT_BG = 'F5F7FA';
const BORDER = 'D9DEE5';
const MUTED = '8A95A8';

const CAT_COLOR = { doelen: ACCENT, behoeften: TEAL, diensten: ORANGE };

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

function brandHeader(slide) {
  // "creates." linksboven
  slide.addText(
    [
      { text: 'creates', options: { color: NAVY, fontSize: 14, fontFace: 'Nunito Sans', bold: true } },
      { text: '.', options: { color: ACCENT, fontSize: 14, fontFace: 'Nunito Sans', bold: true } },
    ],
    { x: 0.6, y: 0.3, w: 2, h: 0.35 }
  );
  // Teal streep bovenaan
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.04, fill: { color: TEAL }, line: { type: 'none' } });
}

function sectionLabel(slide, text, y = 0.9) {
  slide.addText(text, {
    x: 0.6, y, w: 6, h: 0.35,
    fontSize: 10, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, charSpacing: 4,
  });
}

function caseHeadline(slide, name, y = 1.25) {
  slide.addText(name, {
    x: 0.6, y, w: 11, h: 0.7,
    fontSize: 30, fontFace: 'Nunito Sans', bold: true,
    color: NAVY,
  });
}

function lightCard(slide, { x, y, w, h, accent }) {
  // Achtergrond
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: LIGHT_BG },
    line: { color: BORDER, width: 0.75 },
    rectRadius: 0.1,
  });
  if (accent) {
    // Linker accent-balk
    slide.addShape('rect', {
      x, y, w: 0.08, h,
      fill: { color: accent }, line: { type: 'none' },
    });
  }
}

function pill(slide, { x, y, w, h, text, color }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color, transparency: 88 },
    line: { color, width: 0.75, transparency: 50 },
    rectRadius: 0.1,
  });
  slide.addText(text, {
    x, y, w, h,
    fontSize: 9, fontFace: 'Nunito Sans', bold: true,
    color, align: 'center', valign: 'middle',
  });
}

export async function exportCaseToPptx(caseData) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pptx.author = 'Creates — Sales Navigator';
  pptx.subject = caseData.name;
  pptx.title = `Case: ${caseData.name}`;

  pptx.defineSlideMaster({
    title: 'CREATES_LIGHT',
    background: { color: WHITE },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.04, fill: { color: TEAL } } },
      { rect: { x: 12.95, y: 7.15, w: 0.18, h: 0.18, fill: { color: ACCENT }, rectRadius: 0.09 } },
    ],
  });

  // ========== SLIDE 1: Titel ==========
  const s1 = pptx.addSlide({ masterName: 'CREATES_LIGHT' });

  // creates. logo
  s1.addText(
    [
      { text: 'creates', options: { color: NAVY, fontSize: 16, fontFace: 'Nunito Sans', bold: true } },
      { text: '.', options: { color: ACCENT, fontSize: 16, fontFace: 'Nunito Sans', bold: true } },
    ],
    { x: 0.6, y: 0.35, w: 2, h: 0.4 }
  );

  s1.addText('KLANTCASE', {
    x: 0.6, y: 2.2, w: 6, h: 0.4,
    fontSize: 11, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, charSpacing: 5,
  });

  s1.addText(caseData.name, {
    x: 0.6, y: 2.7, w: 9.5, h: 1.3,
    fontSize: 52, fontFace: 'Nunito Sans', bold: true,
    color: NAVY,
  });

  if (caseData.subtitle) {
    s1.addText(stripHtml(caseData.subtitle), {
      x: 0.6, y: 4.1, w: 9.5, h: 0.8,
      fontSize: 16, fontFace: 'Nunito Sans',
      color: MUTED, lineSpacingMultiple: 1.3,
    });
  }

  // Logo badge rechts
  const initials = caseData.logoText || caseData.name.substring(0, 2).toUpperCase();
  s1.addShape('roundRect', {
    x: 10.8, y: 2.7, w: 1.8, h: 1.8,
    fill: { color: (caseData.logoColor || '#31B7B9').replace('#', '') },
    line: { type: 'none' },
    rectRadius: 0.2,
  });
  s1.addText(initials, {
    x: 10.8, y: 2.7, w: 1.8, h: 1.8,
    fontSize: 44, fontFace: 'Nunito Sans', bold: true,
    color: WHITE, align: 'center', valign: 'middle',
  });

  // Tags rij
  const tags = [
    ...(caseData.mapping?.doelen || []).map(t => ({ text: t, color: CAT_COLOR.doelen })),
    ...(caseData.mapping?.behoeften || []).map(t => ({ text: t, color: CAT_COLOR.behoeften })),
    ...(caseData.mapping?.diensten || []).map(t => ({ text: t, color: CAT_COLOR.diensten })),
  ];
  let tx = 0.6, ty = 5.5;
  const maxX = 12.5;
  tags.forEach(tag => {
    const tw = Math.max(1.2, tag.text.length * 0.1 + 0.5);
    if (tx + tw > maxX) { tx = 0.6; ty += 0.5; }
    pill(s1, { x: tx, y: ty, w: tw, h: 0.38, text: tag.text, color: tag.color });
    tx += tw + 0.15;
  });

  // Footer
  s1.addText('creates.nl', {
    x: 0.6, y: 7.05, w: 4, h: 0.3,
    fontSize: 10, fontFace: 'Nunito Sans',
    color: MUTED,
  });

  // ========== SLIDE 2: Situatie & Doel ==========
  const s2 = pptx.addSlide({ masterName: 'CREATES_LIGHT' });
  brandHeader(s2);
  sectionLabel(s2, 'SITUATIE & DOEL');
  caseHeadline(s2, caseData.name);

  // Situatie
  lightCard(s2, { x: 0.6, y: 2.2, w: 6.0, h: 4.6, accent: ACCENT });
  s2.addText('Situatie', {
    x: 0.9, y: 2.35, w: 5.5, h: 0.4,
    fontSize: 14, fontFace: 'Nunito Sans', bold: true, color: ACCENT,
  });
  s2.addText(stripHtml(caseData.situatie) || '—', {
    x: 0.9, y: 2.8, w: 5.5, h: 3.9,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: NAVY, valign: 'top', lineSpacingMultiple: 1.45,
    paraSpaceAfter: 6,
  });

  // Doel
  lightCard(s2, { x: 6.9, y: 2.2, w: 5.9, h: 4.6, accent: TEAL });
  s2.addText('Doel', {
    x: 7.2, y: 2.35, w: 5.4, h: 0.4,
    fontSize: 14, fontFace: 'Nunito Sans', bold: true, color: TEAL,
  });
  s2.addText(stripHtml(caseData.doel) || '—', {
    x: 7.2, y: 2.8, w: 5.4, h: 3.9,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: NAVY, valign: 'top', lineSpacingMultiple: 1.45,
    paraSpaceAfter: 6,
  });

  // ========== SLIDE 3: Oplossing ==========
  const s3 = pptx.addSlide({ masterName: 'CREATES_LIGHT' });
  brandHeader(s3);
  sectionLabel(s3, 'OPLOSSING');
  caseHeadline(s3, caseData.name);

  const keywords = caseData.keywords || [];
  const cardH = keywords.length ? 3.8 : 4.6;
  lightCard(s3, { x: 0.6, y: 2.2, w: 12.2, h: cardH, accent: TEAL });
  s3.addText(stripHtml(caseData.oplossing) || '—', {
    x: 0.9, y: 2.4, w: 11.7, h: cardH - 0.4,
    fontSize: 13, fontFace: 'Nunito Sans',
    color: NAVY, valign: 'top', lineSpacingMultiple: 1.5,
    paraSpaceAfter: 6,
  });

  if (keywords.length) {
    s3.addText('TECHNOLOGIEËN', {
      x: 0.6, y: 6.2, w: 4, h: 0.3,
      fontSize: 9, fontFace: 'Nunito Sans', bold: true,
      color: MUTED, charSpacing: 3,
    });
    let kx = 0.6, ky = 6.55;
    keywords.forEach(kw => {
      const kw2 = kw.length * 0.09 + 0.5;
      if (kx + kw2 > 12.5) { kx = 0.6; ky += 0.45; }
      pill(s3, { x: kx, y: ky, w: kw2, h: 0.35, text: kw, color: TEAL });
      kx += kw2 + 0.12;
    });
  }

  // ========== SLIDE 4: Resultaat & Impact ==========
  const s4 = pptx.addSlide({ masterName: 'CREATES_LIGHT' });
  brandHeader(s4);
  sectionLabel(s4, 'RESULTAAT & IMPACT');
  caseHeadline(s4, caseData.name);

  const impact = stripHtml(caseData.businessImpact);

  // Resultaat
  lightCard(s4, { x: 0.6, y: 2.2, w: 7.5, h: 3.2, accent: ACCENT });
  s4.addText('Resultaat', {
    x: 0.9, y: 2.35, w: 7, h: 0.4,
    fontSize: 14, fontFace: 'Nunito Sans', bold: true, color: ACCENT,
  });
  s4.addText(stripHtml(caseData.resultaat) || '—', {
    x: 0.9, y: 2.8, w: 7, h: 2.5,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: NAVY, valign: 'top', lineSpacingMultiple: 1.45,
    paraSpaceAfter: 6,
  });

  // Business Impact (teal highlight — accent ipv plain card)
  if (impact) {
    s4.addShape('roundRect', {
      x: 8.4, y: 2.2, w: 4.4, h: 3.2,
      fill: { color: TEAL }, line: { type: 'none' },
      rectRadius: 0.1,
    });
    s4.addText('BUSINESS IMPACT', {
      x: 8.7, y: 2.35, w: 3.9, h: 0.4,
      fontSize: 10, fontFace: 'Nunito Sans', bold: true,
      color: WHITE, charSpacing: 3,
    });
    s4.addText(impact, {
      x: 8.7, y: 2.85, w: 3.9, h: 2.4,
      fontSize: 13, fontFace: 'Nunito Sans', bold: true,
      color: WHITE, valign: 'top', lineSpacingMultiple: 1.4,
    });
  }

  // Takeaway quote
  const takeaway = impact || stripHtml(caseData.resultaat) || '';
  if (takeaway) {
    s4.addShape('rect', {
      x: 0.6, y: 5.8, w: 0.06, h: 1.1, fill: { color: TEAL }, line: { type: 'none' },
    });
    s4.addText(`"${takeaway.substring(0, 180)}"`, {
      x: 0.95, y: 5.8, w: 11.8, h: 1.1,
      fontSize: 13, fontFace: 'Nunito Sans', italic: true,
      color: NAVY, valign: 'middle', lineSpacingMultiple: 1.35,
    });
  }

  // ========== SLIDE 5: Contact ==========
  const s5 = pptx.addSlide({ masterName: 'CREATES_LIGHT' });

  s5.addText(
    [
      { text: 'Sales ', options: { color: NAVY, fontSize: 44, fontFace: 'Nunito Sans', bold: true } },
      { text: 'Navigator', options: { color: ACCENT, fontSize: 44, fontFace: 'Nunito Sans', bold: true } },
    ],
    { x: 0, y: 2.2, w: 13.33, h: 0.9, align: 'center' }
  );

  s5.addText(
    [
      { text: 'creates', options: { color: NAVY, fontSize: 22, fontFace: 'Nunito Sans', bold: true } },
      { text: '.', options: { color: ACCENT, fontSize: 22, fontFace: 'Nunito Sans', bold: true } },
    ],
    { x: 0, y: 3.1, w: 13.33, h: 0.5, align: 'center' }
  );

  // Teal underline accent
  s5.addShape('rect', {
    x: 6.17, y: 3.7, w: 1.0, h: 0.05, fill: { color: TEAL }, line: { type: 'none' },
  });

  s5.addText('Empowering people with data', {
    x: 0, y: 4.0, w: 13.33, h: 0.5,
    fontSize: 16, fontFace: 'Nunito Sans', italic: true,
    color: MUTED, align: 'center',
  });

  s5.addText('creates.nl', {
    x: 0, y: 5.5, w: 13.33, h: 0.4,
    fontSize: 14, fontFace: 'Nunito Sans', bold: true,
    color: TEAL, align: 'center',
  });

  s5.addText('Neem contact op voor een vrijblijvend gesprek', {
    x: 0, y: 5.95, w: 13.33, h: 0.4,
    fontSize: 12, fontFace: 'Nunito Sans',
    color: MUTED, align: 'center',
  });

  const filename = `case-${caseData.id || caseData.name.toLowerCase().replace(/\s+/g, '-')}.pptx`;
  await pptx.writeFile({ fileName: filename });
}

/**
 * Generates 2–3 page sample Pricing Proposal PDFs for design comparison.
 * Run from backend: npx tsx scripts/generate-sample-pricing-proposal-pdf.ts [a|b|c]
 * With no argument, generates all three styles.
 * Output: docs/sample-pricing-proposal-style-{a|b|c}.pdf
 * See docs/quote-pdf-design-guide.md for best practices and style descriptions.
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const MARGIN = 50;
const PAGE_WIDTH = 595;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const HEADER_BAR_HEIGHT = 48;
const HEADER_BAR_HEIGHT_STYLE_B = 56; // Room for RSM logo + PRICING PROPOSAL + Distributor logo
const RSM_LOGO_WIDTH_PT = 120;
const RSM_LOGO_HEIGHT_PT = 40;
const DIST_LOGO_WIDTH_PT = 96;
const DIST_LOGO_HEIGHT_PT = 28;
const META_HEIGHT = 36;
const FOOTER_Y = 798;
const FOOTER_HEIGHT = 36;
const CONTENT_TOP = MARGIN + HEADER_BAR_HEIGHT;
const ROW_HEIGHT = 20;
const TABLE_HEAD_HEIGHT = 24;

const COL = {
  part: MARGIN,
  desc: MARGIN + 100,
  qty: MARGIN + 318,
  price: MARGIN + 378,
  total: MARGIN + 438,
  end: MARGIN + CONTENT_WIDTH,
};
const COL_WIDTHS = { part: 98, desc: 218, qty: 58, price: 58, total: 58 };

type Doc = InstanceType<typeof PDFDocument>;
type Style = 'a' | 'b' | 'c';

function drawHeader(doc: Doc, pageNum: number, totalPages: number, style: Style = 'a') {
  const barHeight = style === 'b' ? HEADER_BAR_HEIGHT_STYLE_B : HEADER_BAR_HEIGHT;
  const y0 = MARGIN;
  doc.rect(0, y0, PAGE_WIDTH, barHeight).fill('#f0fdf4');
  doc.moveTo(0, y0 + barHeight).lineTo(PAGE_WIDTH, y0 + barHeight).strokeColor('#059669').lineWidth(2).stroke();

  if (style === 'b') {
    // Style B: RSM logo (left), PRICING PROPOSAL + Distributor logo (right)
    const rsmX = MARGIN + 4;
    const rsmY = y0 + (barHeight - RSM_LOGO_HEIGHT_PT) / 2;
    doc.rect(rsmX, rsmY, RSM_LOGO_WIDTH_PT, RSM_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
    doc.fontSize(8).fillColor('#9ca3af').text('RSM Logo', rsmX, rsmY + RSM_LOGO_HEIGHT_PT / 2 - 6, { width: RSM_LOGO_WIDTH_PT, align: 'center' });
    doc.fontSize(7).fillColor('#9ca3af').text('180×60 px', rsmX, rsmY + RSM_LOGO_HEIGHT_PT / 2 + 2, { width: RSM_LOGO_WIDTH_PT, align: 'center' });

    const rightX = COL.end - DIST_LOGO_WIDTH_PT;
    doc.fontSize(18).fillColor('#111827').text('PRICING PROPOSAL', MARGIN, y0 + 6, { width: CONTENT_WIDTH, align: 'right' });
    const distY = y0 + 26;
    doc.rect(rightX, distY, DIST_LOGO_WIDTH_PT, DIST_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
    doc.fontSize(7).fillColor('#9ca3af').text('Distributor', rightX, distY + DIST_LOGO_HEIGHT_PT / 2 - 4, { width: DIST_LOGO_WIDTH_PT, align: 'center' });
    doc.text('120×40 px', rightX, distY + DIST_LOGO_HEIGHT_PT / 2 + 2, { width: DIST_LOGO_WIDTH_PT, align: 'center' });
    doc.fontSize(9).fillColor('#6b7280').text(`Proposal # PP#000042 · Feb 10, 2026 · Page ${pageNum} of ${totalPages}`, MARGIN, y0 + barHeight - 14, { width: CONTENT_WIDTH, align: 'right' });
  } else {
    doc.fontSize(18).fillColor('#059669').text('WAGO Hub', MARGIN + 4, y0 + 14);
    doc.fontSize(20).fillColor('#111827').text('PRICING PROPOSAL', MARGIN, y0 + 12, { width: CONTENT_WIDTH, align: 'right' });
    doc.fontSize(10).fillColor('#6b7280').text(`Proposal # PP#000042 · Feb 10, 2026 · Page ${pageNum} of ${totalPages}`, MARGIN, y0 + 34, { width: CONTENT_WIDTH, align: 'right' });
  }
  doc.y = MARGIN + barHeight;
}

const CONTINUED_FOOTER_Y = 800;
const CONTINUED_FOOTER_HEIGHT = 28;

/** Full footer (last page only): disclaimer. Use when Terms + Contact are on this page. */
function drawFooter(doc: Doc) {
  doc.rect(MARGIN, FOOTER_Y, CONTENT_WIDTH, FOOTER_HEIGHT).fill('#f9fafb');
  doc.fontSize(10).fillColor('#9ca3af');
  doc.text('This is a pricing proposal, not an official quote. Thank you for your business.', MARGIN, FOOTER_Y + 10, { align: 'center', width: CONTENT_WIDTH });
}

/** Light continuation footer (non-last pages): border + "Continued on the next page" + page number. */
function drawContinuationFooter(doc: Doc, pageNum: number, totalPages: number) {
  const y = CONTINUED_FOOTER_Y;
  doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.rect(MARGIN, y, CONTENT_WIDTH, CONTINUED_FOOTER_HEIGHT).fill('#fafafa');
  doc.moveTo(MARGIN, y + CONTINUED_FOOTER_HEIGHT).lineTo(COL.end, y + CONTINUED_FOOTER_HEIGHT).strokeColor('#e5e7eb').stroke();
  doc.fontSize(9).fillColor('#9ca3af');
  doc.text('Continued on the next page', MARGIN, y + 8, { align: 'center', width: CONTENT_WIDTH });
  doc.text(`Page ${pageNum} of ${totalPages}`, MARGIN, y + 18, { align: 'center', width: CONTENT_WIDTH });
}

const sampleItems = [
  { pn: '750-343', sym: '*', symColor: '#6b7280', desc: '3-pos terminal block 16A', qty: 50, price: 2.45, total: 122.5 },
  { pn: '750-362', sym: '†', symColor: '#059669', desc: '2-pos terminal block 16A', qty: 100, price: 1.89, total: 189 },
  { pn: '750-880', sym: '', symColor: '', desc: 'End clamp', qty: 50, price: 0.42, total: 21 },
];

function drawTableHead(doc: Doc, atY: number, style: Style) {
  const headBg = style === 'b' ? '#e5e7eb' : '#f3f4f6';
  doc.rect(MARGIN, atY, CONTENT_WIDTH, TABLE_HEAD_HEIGHT).fill(headBg);
  doc.fontSize(10).fillColor(style === 'c' ? '#374151' : '#4b5563');
  doc.text('Part Number', COL.part + 6, atY + 7);
  doc.text('Description', COL.desc + 4, atY + 7);
  doc.text('Qty', COL.qty, atY + 7, { width: COL_WIDTHS.qty, align: 'right' });
  doc.text('Price', COL.price, atY + 7, { width: COL_WIDTHS.price, align: 'right' });
  doc.text('Total', COL.total, atY + 7, { width: COL_WIDTHS.total, align: 'right' });
  if (style === 'c') {
    doc.strokeColor('#d1d5db').lineWidth(1);
    doc.rect(MARGIN, atY, CONTENT_WIDTH, TABLE_HEAD_HEIGHT).stroke();
  }
}

function drawTableRow(
  doc: Doc,
  rowY: number,
  item: (typeof sampleItems)[0],
  index: number,
  style: Style
) {
  const desc = index < 3 ? item.desc : `${item.desc} (line ${index + 1})`;
  if (style === 'b') {
    const fill = index % 2 === 0 ? '#ffffff' : '#f9fafb';
    doc.rect(MARGIN, rowY, CONTENT_WIDTH, ROW_HEIGHT).fill(fill);
  }
  doc.fillColor('#1f2937').fontSize(10);
  doc.text(item.pn + (item.sym ? ' ' : ''), COL.part + 4, rowY + 4);
  if (item.sym) doc.fillColor(item.symColor as string).text(item.sym, COL.part + 44, rowY + 4);
  doc.fillColor('#1f2937').text(desc.slice(0, 34), COL.desc + 4, rowY + 4);
  doc.text(String(item.qty), COL.qty, rowY + 4, { width: COL_WIDTHS.qty, align: 'right' });
  doc.text('$' + item.price.toFixed(2), COL.price, rowY + 4, { width: COL_WIDTHS.price, align: 'right' });
  doc.text('$' + item.total.toFixed(2), COL.total, rowY + 4, { width: COL_WIDTHS.total, align: 'right' });
  if (style === 'a' || style === 'b') {
    doc.moveTo(MARGIN, rowY + ROW_HEIGHT).lineTo(COL.end, rowY + ROW_HEIGHT).strokeColor('#e5e7eb').stroke();
  }
  if (style === 'c') {
    doc.strokeColor('#d1d5db').lineWidth(1);
    doc.rect(MARGIN, rowY, CONTENT_WIDTH, ROW_HEIGHT).stroke();
  }
}

function generateStyle(style: Style): Promise<string> {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(__dirname, '../..');
    const outPath = path.join(projectRoot, 'docs', `sample-pricing-proposal-style-${style}.pdf`);
    const docsDir = path.dirname(outPath);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const isStyleB = style === 'b';
    const contentTop = isStyleB ? MARGIN + HEADER_BAR_HEIGHT_STYLE_B : CONTENT_TOP;
    let pageNum = 1;
    const totalPages = isStyleB ? 2 : 3;
    let y = contentTop;

    const row = (dy: number, redrawTableHead = false) => {
      y += dy;
      doc.y = y;
      if (y > 718) {
        if (isStyleB) {
          drawContinuationFooter(doc, pageNum, totalPages);
        } else {
          drawFooter(doc);
        }
        doc.addPage({ margin: 0 });
        pageNum++;
        drawHeader(doc, pageNum, totalPages, style);
        y = contentTop;
        doc.y = y;
        if (redrawTableHead) {
          drawTableHead(doc, y, style);
          y += TABLE_HEAD_HEIGHT;
          doc.y = y;
        }
      }
    };

    drawHeader(doc, pageNum, totalPages, style);
    doc.y = y;

    const metaY = y;
    doc.rect(MARGIN, metaY, CONTENT_WIDTH, META_HEIGHT).fill('#f9fafb');
    doc.moveTo(MARGIN, metaY + META_HEIGHT).lineTo(COL.end, metaY + META_HEIGHT).strokeColor('#e5e7eb').stroke();
    doc.fontSize(10).fillColor('#6b7280');
    doc.text('Proposal #: PP#000042', MARGIN + 8, metaY + 10);
    doc.text('Date: February 10, 2026', MARGIN + 140, metaY + 10);
    doc.text('Price Contract: Q1 2026 – Region A', MARGIN + 280, metaY + 10);
    row(META_HEIGHT + 4);

    doc.fontSize(10).fillColor('#6b7280').text('BILL TO', MARGIN, doc.y);
    row(14);
    const billToY = y;
    doc.fillColor('#111827').fontSize(11).text('ABC Electric Co.', MARGIN, billToY);
    doc.fillColor('#1f2937').text('123 Industrial Blvd.', MARGIN, billToY + 14);
    doc.text('City, ST 12345', MARGIN, billToY + 28);
    doc.text('contact@abcelectric.com', MARGIN, billToY + 42);
    row(56);

    drawTableHead(doc, y, style);
    row(TABLE_HEAD_HEIGHT);

    const numRows = 18;
    for (let i = 0; i < numRows; i++) {
      const item = sampleItems[i % sampleItems.length];
      const rowY = y;
      drawTableRow(doc, rowY, item, i, style);
      row(ROW_HEIGHT, true);
    }

    row(8);
    const legendY = y;
    doc.fontSize(10).fillColor('#6b7280');
    doc.text('*', COL.part, legendY).fillColor('#6b7280');
    doc.text(' Cost affected by SPA/discount    ', MARGIN + 12, legendY);
    doc.fillColor('#059669').text('†', MARGIN + 178, legendY);
    doc.fillColor('#6b7280').text(' Sell price from pricing contract', MARGIN + 190, legendY);
    doc.moveTo(MARGIN, legendY + 14).lineTo(COL.end, legendY + 14).strokeColor('#e5e7eb').stroke();
    row(20);

    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor(style === 'b' ? '#059669' : '#e5e7eb').lineWidth(style === 'b' ? 2 : 1).stroke();
    row(12);
    const totalsY = y;
    doc.rect(MARGIN, totalsY - 2, CONTENT_WIDTH, 46).fill(style === 'b' ? '#f0fdf4' : '#f9fafb');
    doc.fontSize(11).fillColor('#1f2937').text('Subtotal: $1,261.50', MARGIN, totalsY + 4, { width: CONTENT_WIDTH, align: 'right' });
    doc.fontSize(18).fillColor('#111827').text('TOTAL: $1,261.50', MARGIN, totalsY + 24, { width: CONTENT_WIDTH, align: 'right' });
    row(48);

    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor(style === 'c' ? '#d1d5db' : '#e5e7eb').stroke();
    row(12);
    doc.fontSize(10).fillColor('#6b7280').text('Terms', MARGIN, doc.y);
    row(14);
    doc.fontSize(10).fillColor('#1f2937').text('Net 30. Valid for 30 days from quote date.', MARGIN, doc.y);
    row(20);
    doc.fontSize(10).fillColor('#6b7280').text('Notes', MARGIN, doc.y);
    row(14);
    doc.fontSize(10).fillColor('#1f2937').text('Minimum order 100 pcs for 750-362.', MARGIN, doc.y);
    row(26);

    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor(style === 'c' ? '#d1d5db' : '#e5e7eb').stroke();
    row(14);
    doc.fontSize(10).fillColor('#6b7280').text('CONTACT', MARGIN, doc.y);
    row(16);
    const contactStartY = y;
    const card1X = MARGIN;
    doc.circle(card1X + 24, contactStartY + 24, 24).fill('#e5e7eb');
    doc.fontSize(10).fillColor('#6b7280').text('Your WAGO Contact', card1X + 56, contactStartY);
    doc.fontSize(12).fillColor('#111827').text('Jane Smith', card1X + 56, contactStartY + 12);
    doc.fontSize(10).fillColor('#4b5563').text('jane.smith@example.com', card1X + 56, contactStartY + 26);
    doc.text('(555) 123-4567', card1X + 56, contactStartY + 40);
    const card2X = MARGIN + 270;
    doc.circle(card2X + 24, contactStartY + 24, 24).fill('#e5e7eb');
    doc.fontSize(10).fillColor('#6b7280').text('Your Distributor', card2X + 56, contactStartY);
    doc.fontSize(12).fillColor('#111827').text('John Doe', card2X + 56, contactStartY + 12);
    doc.fontSize(10).fillColor('#4b5563').text('john.doe@dist.com', card2X + 56, contactStartY + 26);
    doc.text('(555) 987-6543', card2X + 56, contactStartY + 40);
    row(68);

    if (isStyleB) {
      drawFooter(doc);
    } else {
      drawFooter(doc);
      while (pageNum < totalPages) {
        doc.addPage({ margin: 0 });
        pageNum++;
        drawHeader(doc, pageNum, totalPages, style);
        doc.y = CONTENT_TOP;
        doc.fontSize(10).fillColor('#6b7280');
        doc.text('(Continued – sample page ' + pageNum + ')', MARGIN, doc.y);
        doc.y = 360;
        doc.fillColor('#1f2937').text('Additional terms or notes can appear here on continuation pages.', MARGIN, doc.y, { width: CONTENT_WIDTH });
        drawFooter(doc);
      }
    }

    doc.end();

    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

async function main() {
  const arg = process.argv[2]?.toLowerCase();
  const styles: Style[] = arg === 'a' || arg === 'b' || arg === 'c' ? [arg] : ['a', 'b', 'c'];
  const projectRoot = path.resolve(__dirname, '../..');
  const docsDir = path.join(projectRoot, 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  for (const style of styles) {
    const outPath = await generateStyle(style);
    console.log('Written:', outPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

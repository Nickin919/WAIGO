/**
 * Generates a 2–3 page sample Pricing Proposal PDF with repeating headers and footers.
 * Run from backend: npx tsx scripts/generate-sample-pricing-proposal-pdf.ts
 * Output: docs/sample-pricing-proposal-multipage.pdf (relative to project root)
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const MARGIN = 50;
const HEADER_HEIGHT = 42;
const FOOTER_Y = 800;
const CONTENT_TOP = MARGIN + HEADER_HEIGHT;

type Doc = InstanceType<typeof PDFDocument>;

function drawHeader(doc: Doc, pageNum: number, totalPages: number) {
  const y0 = MARGIN;
  doc.fontSize(14).fillColor('#059669').text('WAGO Hub', MARGIN, y0);
  doc.fillColor('#111827').fontSize(18).text('PRICING PROPOSAL', 0, y0 + 2, { align: 'center', width: doc.page.width });
  doc.fontSize(10).fillColor('#6b7280').text(`Proposal #: PP#000042    Date: February 10, 2026    Page ${pageNum} of ${totalPages}`, MARGIN, y0 + 24, { align: 'right', width: doc.page.width - 2 * MARGIN });
  doc.y = CONTENT_TOP;
}

function drawFooter(doc: Doc, pageNum: number, totalPages: number) {
  const bottomY = FOOTER_Y;
  doc.fontSize(9).fillColor('#9ca3af');
  doc.text('This is a pricing proposal, not an official quote. Thank you for your business.', MARGIN, bottomY, { align: 'center', width: doc.page.width - 2 * MARGIN });
  doc.text(`Page ${pageNum} of ${totalPages}`, 0, bottomY + 12, { align: 'center', width: doc.page.width });
}

async function generate(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '../..');
  const outPath = path.join(projectRoot, 'docs', 'sample-pricing-proposal-multipage.pdf');
  const docsDir = path.dirname(outPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  let pageNum = 1;
  const totalPages = 3; // We'll force 3 pages for the sample
  let y = CONTENT_TOP;

  const row = (dy: number) => {
    y += dy;
    doc.y = y;
    if (y > 740) {
      drawFooter(doc, pageNum, totalPages);
      doc.addPage();
      pageNum++;
      drawHeader(doc, pageNum, totalPages);
      y = CONTENT_TOP;
      doc.y = y;
    }
  };

  // Page 1 – header
  drawHeader(doc, pageNum, totalPages);
  doc.y = y;

  doc.fontSize(11).fillColor('#6b7280').text('Bill To', MARGIN, doc.y);
  row(18);
  const billToY = y;
  doc.fillColor('#111827').fontSize(11).text('ABC Electric Co.', MARGIN, billToY);
  doc.text('123 Industrial Blvd.', MARGIN, billToY + 14);
  doc.text('City, ST 12345', MARGIN, billToY + 28);
  doc.text('contact@abcelectric.com', MARGIN, billToY + 42);
  row(56);

  const tableHeadY = y;
  doc.fontSize(10).fillColor('#4b5563');
  doc.text('Part Number', MARGIN, tableHeadY);
  doc.text('Description', 120, tableHeadY);
  doc.text('Qty', 320, tableHeadY);
  doc.text('Price', 380, tableHeadY);
  doc.text('Total', 450, tableHeadY);
  row(22);

  // Sample line items – enough to span 2+ pages
  const sampleItems = [
    { pn: '750-343 *', desc: '3-pos terminal block 16A', qty: 50, price: 2.45, total: 122.5 },
    { pn: '750-362 †', desc: '2-pos terminal block 16A', qty: 100, price: 1.89, total: 189 },
    { pn: '750-880', desc: 'End clamp', qty: 50, price: 0.42, total: 21 },
  ];
  for (let i = 0; i < 28; i++) {
    const item = sampleItems[i % sampleItems.length];
    const desc = `${item.desc} (line ${i + 1})`;
    const rowY = y;
    doc.text(item.pn, MARGIN, rowY);
    doc.text(desc.slice(0, 38), 120, rowY);
    doc.text(String(item.qty), 320, rowY);
    doc.text('$' + item.price.toFixed(2), 380, rowY);
    doc.text('$' + item.total.toFixed(2), 450, rowY);
    row(18);
  }

  // Totals
  row(12);
  doc.fontSize(11).text('* Cost affected by SPA/discount    † Sell price from pricing contract', MARGIN, doc.y);
  row(24);
  doc.text('Subtotal: $12,345.00', 350, doc.y);
  row(18);
  doc.fontSize(12).fillColor('#111827').text('TOTAL: $12,345.00', 350, doc.y);
  row(28);

  doc.fontSize(10).fillColor('#374151');
  doc.text('Terms', MARGIN, doc.y);
  row(14);
  doc.text('Net 30. Valid for 30 days from proposal date.', MARGIN, doc.y);
  row(28);
  doc.text('Contact', MARGIN, doc.y);
  row(14);
  const contactY = y;
  doc.text('Your WAGO Contact: Jane Smith · jane.smith@example.com · (555) 123-4567', MARGIN, contactY);
  doc.text('Your Distributor: John Doe · john.doe@dist.com · (555) 987-6543', MARGIN, contactY + 14);
  row(40);

  // Ensure we have exactly 3 pages for the sample – add a second and third page with footer
  while (pageNum < totalPages) {
    drawFooter(doc, pageNum, totalPages);
    doc.addPage();
    pageNum++;
    drawHeader(doc, pageNum, totalPages);
    doc.y = CONTENT_TOP;
    doc.fontSize(10).fillColor('#6b7280');
    doc.text('(Continued – sample page ' + pageNum + ')', MARGIN, doc.y);
    doc.y = 400;
    doc.text('Additional terms or notes can appear here on continuation pages.', MARGIN, doc.y, { width: doc.page.width - 2 * MARGIN });
  }
  drawFooter(doc, pageNum, totalPages);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      console.log('Written:', outPath);
      resolve();
    });
    stream.on('error', reject);
  });
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});

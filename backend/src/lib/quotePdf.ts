/**
 * Build Pricing Proposal PDF (Style B) for a quote.
 * Used by GET /quotes/:id/pdf and by email attachment.
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { getUploadDir } from './uploadPath';

const MARGIN = 50;
const PAGE_WIDTH = 595;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const HEADER_BAR_HEIGHT = 72;
const HEADER_ROW1_HEIGHT = 46;
const RSM_LOGO_WIDTH_PT = 112;
const RSM_LOGO_HEIGHT_PT = 36;
const DIST_LOGO_WIDTH_PT = 88;
const DIST_LOGO_HEIGHT_PT = 26;
const HEADER_GAP = 14;
const META_HEIGHT = 36;
const FOOTER_Y = 798;
const FOOTER_HEIGHT = 36;
const CONTENT_TOP = MARGIN + HEADER_BAR_HEIGHT;
const ROW_HEIGHT = 20;
const TABLE_HEAD_HEIGHT = 24;
const CONTINUED_FOOTER_Y = 800;
const CONTINUED_FOOTER_HEIGHT = 28;

const COL = {
  part: MARGIN,
  desc: MARGIN + 92,
  moq: MARGIN + 278,
  qty: MARGIN + 314,
  price: MARGIN + 374,
  total: MARGIN + 434,
  end: MARGIN + CONTENT_WIDTH,
};
const COL_WIDTHS = { part: 90, desc: 182, moq: 32, qty: 56, price: 56, total: 61 };

export interface QuoteItemForPdf {
  partNumber: string;
  snapshotPartNumber?: string | null;
  description: string;
  snapshotDescription?: string | null;
  quantity: number;
  minQty?: number | null;
  sellPrice: number | null;
  lineTotal: number;
  isCostAffected: boolean;
  isSellAffected: boolean;
}

export interface ContactForPdf {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
}

export interface QuoteForPdf {
  quoteNumber: string;
  customerName: string | null;
  customerCompany: string | null;
  customerEmail: string | null;
  notes: string | null;
  terms: string | null;
  total: number;
  validUntil: Date | null;
  createdAt: Date;
  priceContract?: { name: string } | null;
  customer?: { name?: string; email?: string | null; address?: string | null; city?: string | null; state?: string | null; zipCode?: string | null } | null;
  items: QuoteItemForPdf[];
  user: {
    role: string;
    logoUrl?: string | null;
    assignedToRsm?: ContactForPdf | null;
    assignedToDistributor?: ContactForPdf | null;
  } & ContactForPdf;
}

/**
 * Fetch an image as a Buffer from either:
 *   - a full HTTP/HTTPS URL (R2 public URL, or any CDN)
 *   - a legacy /uploads/... relative path (local disk on Railway volume)
 * Returns null if the image cannot be fetched/found.
 */
async function fetchImageBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || typeof url !== 'string') return null;

  // Full HTTP/HTTPS URL — fetch from network (R2 public bucket, etc.)
  if (url.startsWith('https://') || url.startsWith('http://')) {
    return new Promise((resolve) => {
      const client = url.startsWith('https://') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    });
  }

  // Legacy local path — /uploads/logos/... or /uploads/avatars/...
  if (url.startsWith('/uploads/')) {
    const uploadBase = getUploadDir();
    const full = path.join(uploadBase, url.replace(/^\/uploads\/?/, ''));
    if (fs.existsSync(full)) {
      try { return fs.readFileSync(full); } catch { return null; }
    }
  }

  return null;
}

const AVATAR_SIZE = 48; // diameter in points for contact circles

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type PDFDoc = InstanceType<typeof PDFDocument>;

function drawHeader(
  doc: PDFDoc,
  pageNum: number,
  totalPages: number,
  opts: { proposalNumber: string; dateStr: string; rsmLogoPath: Buffer | null; distLogoPath: Buffer | null }
) {
  const y0 = MARGIN;
  doc.rect(0, y0, PAGE_WIDTH, HEADER_BAR_HEIGHT).fill('#ffffff');
  doc.moveTo(0, y0 + HEADER_BAR_HEIGHT).lineTo(PAGE_WIDTH, y0 + HEADER_BAR_HEIGHT).strokeColor('#e5e7eb').lineWidth(1).stroke();

  // Row 1: left = RSM logo, center = title, right = Distributor logo (no overlap)
  const rsmX = MARGIN;
  const rsmY = y0 + (HEADER_ROW1_HEIGHT - RSM_LOGO_HEIGHT_PT) / 2;
  const centerLeft = rsmX + RSM_LOGO_WIDTH_PT + HEADER_GAP;
  const centerRight = COL.end - DIST_LOGO_WIDTH_PT - HEADER_GAP;
  const centerWidth = Math.max(80, centerRight - centerLeft);
  const distX = COL.end - DIST_LOGO_WIDTH_PT;
  const distY = y0 + (HEADER_ROW1_HEIGHT - DIST_LOGO_HEIGHT_PT) / 2;

  if (opts.rsmLogoPath) {
    try {
      doc.image(opts.rsmLogoPath, rsmX, rsmY, { width: RSM_LOGO_WIDTH_PT, height: RSM_LOGO_HEIGHT_PT, fit: [RSM_LOGO_WIDTH_PT, RSM_LOGO_HEIGHT_PT] });
    } catch {
      doc.rect(rsmX, rsmY, RSM_LOGO_WIDTH_PT, RSM_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
    }
  } else {
    doc.rect(rsmX, rsmY, RSM_LOGO_WIDTH_PT, RSM_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
  }

  doc.fontSize(17).fillColor('#111827').text('PRICING PROPOSAL', centerLeft, y0 + 10, { width: centerWidth, align: 'center' });

  if (opts.distLogoPath) {
    try {
      doc.image(opts.distLogoPath, distX, distY, { width: DIST_LOGO_WIDTH_PT, height: DIST_LOGO_HEIGHT_PT, fit: [DIST_LOGO_WIDTH_PT, DIST_LOGO_HEIGHT_PT] });
    } catch {
      doc.rect(distX, distY, DIST_LOGO_WIDTH_PT, DIST_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
    }
  } else {
    doc.rect(distX, distY, DIST_LOGO_WIDTH_PT, DIST_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
  }

  // Row 2: meta line only (below logos, no overlap)
  const metaY = y0 + HEADER_ROW1_HEIGHT + 8;
  doc.fontSize(9).fillColor('#6b7280').text(
    `Proposal # ${opts.proposalNumber} · ${opts.dateStr} · Page ${pageNum} of ${totalPages}`,
    MARGIN,
    metaY,
    { width: CONTENT_WIDTH, align: 'right' }
  );
  doc.y = CONTENT_TOP;
}

function drawFooter(doc: PDFDoc) {
  doc.rect(MARGIN, FOOTER_Y, CONTENT_WIDTH, FOOTER_HEIGHT).fill('#f9fafb');
  doc.fontSize(10).fillColor('#9ca3af');
  doc.text('This is a pricing proposal, not an official quote. Thank you for your business.', MARGIN, FOOTER_Y + 10, { align: 'center', width: CONTENT_WIDTH });
}

function drawContinuationFooter(doc: PDFDoc, pageNum: number, totalPages: number) {
  const y = CONTINUED_FOOTER_Y;
  doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.rect(MARGIN, y, CONTENT_WIDTH, CONTINUED_FOOTER_HEIGHT).fill('#fafafa');
  doc.moveTo(MARGIN, y + CONTINUED_FOOTER_HEIGHT).lineTo(COL.end, y + CONTINUED_FOOTER_HEIGHT).strokeColor('#e5e7eb').stroke();
  doc.fontSize(9).fillColor('#9ca3af');
  doc.text('Continued on the next page', MARGIN, y + 8, { align: 'center', width: CONTENT_WIDTH });
  doc.text(`Page ${pageNum} of ${totalPages}`, MARGIN, y + 18, { align: 'center', width: CONTENT_WIDTH });
}

/**
 * Build Pricing Proposal PDF buffer for a quote (Style B).
 */
export async function buildQuotePdfBuffer(quote: QuoteForPdf): Promise<Buffer> {
  const proposalNumber = quote.quoteNumber;
  const dateStr = formatDate(quote.createdAt);

  const rsmLogoUrl =
    quote.user.role === 'RSM' ? quote.user.logoUrl : quote.user.assignedToRsm?.logoUrl ?? undefined;
  const distLogoUrl =
    quote.user.role === 'DISTRIBUTOR_REP' ? quote.user.logoUrl : quote.user.assignedToDistributor?.logoUrl ?? undefined;
  const rsmContact = quote.user.role === 'RSM' ? quote.user : quote.user.assignedToRsm;
  const distContact = quote.user.role === 'DISTRIBUTOR_REP' ? quote.user : quote.user.assignedToDistributor;

  // Pre-fetch all images before starting PDF generation (supports R2 URLs and legacy local paths)
  const [rsmLogoPath, distLogoPath, rsmAvatarBuf, distAvatarBuf] = await Promise.all([
    fetchImageBuffer(rsmLogoUrl),
    fetchImageBuffer(distLogoUrl),
    fetchImageBuffer(rsmContact?.avatarUrl),
    fetchImageBuffer(distContact?.avatarUrl),
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let pageNum = 1;
    let totalPages = 1; // will update if we add pages
    let y = CONTENT_TOP;

    const row = (dy: number, redrawTableHead = false) => {
      y += dy;
      doc.y = y;
      if (y > 718) {
        drawContinuationFooter(doc, pageNum, totalPages);
        doc.addPage({ margin: 0 });
        pageNum++;
        totalPages = pageNum;
        drawHeader(doc, pageNum, totalPages, { proposalNumber, dateStr, rsmLogoPath, distLogoPath });
        y = CONTENT_TOP;
        doc.y = y;
        if (redrawTableHead) {
          doc.rect(MARGIN, y, CONTENT_WIDTH, TABLE_HEAD_HEIGHT).fill('#e5e7eb');
          doc.fontSize(10).fillColor('#4b5563');
          doc.text('Part Number', COL.part + 6, y + 7);
          doc.text('Description', COL.desc + 4, y + 7);
          doc.text('MOQ', COL.moq, y + 7, { width: COL_WIDTHS.moq, align: 'right' });
          doc.text('Qty', COL.qty, y + 7, { width: COL_WIDTHS.qty, align: 'right' });
          doc.text('Price', COL.price, y + 7, { width: COL_WIDTHS.price, align: 'right' });
          doc.text('Total', COL.total, y + 7, { width: COL_WIDTHS.total, align: 'right' });
          y += TABLE_HEAD_HEIGHT;
          doc.y = y;
        }
      }
    };

    drawHeader(doc, pageNum, totalPages, { proposalNumber, dateStr, rsmLogoPath, distLogoPath });
    doc.y = y;

    const metaY = y;
    doc.rect(MARGIN, metaY, CONTENT_WIDTH, META_HEIGHT).fill('#f9fafb');
    doc.moveTo(MARGIN, metaY + META_HEIGHT).lineTo(COL.end, metaY + META_HEIGHT).strokeColor('#e5e7eb').stroke();
    doc.fontSize(10).fillColor('#6b7280');
    doc.text(`Proposal #: ${proposalNumber}`, MARGIN + 8, metaY + 10);
    doc.text(`Date: ${dateStr}`, MARGIN + 140, metaY + 10);
    if (quote.priceContract?.name) {
      doc.text(`Price Contract: ${quote.priceContract.name}`, MARGIN + 280, metaY + 10);
    }
    row(META_HEIGHT + 4);

    doc.fontSize(10).fillColor('#6b7280').text('BILL TO', MARGIN, doc.y);
    row(14);
    const billToY = y;
    const customerName = quote.customerName || quote.customer?.name || '—';
    doc.fillColor('#111827').fontSize(11).text(customerName, MARGIN, billToY);
    if (quote.customer?.address) doc.fillColor('#1f2937').text(quote.customer.address, MARGIN, billToY + 14);
    if (quote.customer?.city || quote.customer?.state || quote.customer?.zipCode) {
      const cityStateZip = [quote.customer.city, quote.customer.state, quote.customer.zipCode].filter(Boolean).join(', ');
      doc.text(cityStateZip, MARGIN, billToY + (quote.customer?.address ? 28 : 14));
    }
    const emailLine = quote.customerEmail || quote.customer?.email;
    if (emailLine) doc.text(emailLine, MARGIN, billToY + (quote.customer?.address ? 42 : quote.customer?.city ? 28 : 14));
    row(56);

    doc.rect(MARGIN, y, CONTENT_WIDTH, TABLE_HEAD_HEIGHT).fill('#e5e7eb');
    doc.fontSize(10).fillColor('#4b5563');
    doc.text('Part Number', COL.part + 6, y + 7);
    doc.text('Description', COL.desc + 4, y + 7);
    doc.text('MOQ', COL.moq, y + 7, { width: COL_WIDTHS.moq, align: 'right' });
    doc.text('Qty', COL.qty, y + 7, { width: COL_WIDTHS.qty, align: 'right' });
    doc.text('Price', COL.price, y + 7, { width: COL_WIDTHS.price, align: 'right' });
    doc.text('Total', COL.total, y + 7, { width: COL_WIDTHS.total, align: 'right' });
    row(TABLE_HEAD_HEIGHT);

    const items = quote.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pn = (it.snapshotPartNumber ?? it.partNumber) || '—';
      const desc = (it.snapshotDescription ?? it.description) || '—';
      const moq = it.minQty ?? '—';
      const price = it.sellPrice ?? 0;
      const total = it.lineTotal;
      const sym = it.isCostAffected ? '*' : it.isSellAffected ? '†' : '';
      const symColor = it.isSellAffected ? '#059669' : '#6b7280';
      const partNumWithGap = pn + (sym ? '   ' : ''); // extra space before * or † for readability

      const rowY = y;
      doc.rect(MARGIN, rowY, CONTENT_WIDTH, ROW_HEIGHT).fill(i % 2 === 0 ? '#ffffff' : '#f9fafb');
      doc.fillColor('#1f2937').fontSize(10);
      doc.text(partNumWithGap, COL.part + 4, rowY + 4);
      if (sym) {
        const symX = COL.part + 4 + doc.widthOfString(partNumWithGap);
        doc.fillColor(symColor).text(sym, symX, rowY + 4);
      }
      doc.fillColor('#1f2937').text(desc.slice(0, 28), COL.desc + 4, rowY + 4);
      doc.text(String(moq), COL.moq, rowY + 4, { width: COL_WIDTHS.moq, align: 'right' });
      doc.text(String(it.quantity), COL.qty, rowY + 4, { width: COL_WIDTHS.qty, align: 'right' });
      doc.text('$' + price.toFixed(2), COL.price, rowY + 4, { width: COL_WIDTHS.price, align: 'right' });
      doc.text('$' + total.toFixed(2), COL.total, rowY + 4, { width: COL_WIDTHS.total, align: 'right' });
      doc.moveTo(MARGIN, rowY + ROW_HEIGHT).lineTo(COL.end, rowY + ROW_HEIGHT).strokeColor('#e5e7eb').stroke();
      row(ROW_HEIGHT, true);
    }

    row(8);

    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#059669').lineWidth(2).stroke();
    row(12);
    const totalsY = y;
    doc.rect(MARGIN, totalsY - 2, CONTENT_WIDTH, 46).fill('#f0fdf4');
    doc.fontSize(11).fillColor('#1f2937').text(`Subtotal: $${quote.total.toFixed(2)}`, MARGIN, totalsY + 4, { width: CONTENT_WIDTH, align: 'right' });
    doc.fontSize(18).fillColor('#111827').text(`TOTAL: $${quote.total.toFixed(2)}`, MARGIN, totalsY + 24, { width: CONTENT_WIDTH, align: 'right' });
    row(48);

    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#e5e7eb').stroke();
    row(12);
    doc.fontSize(10).fillColor('#6b7280').text('Terms', MARGIN, doc.y);
    row(14);
    doc.fontSize(10).fillColor('#1f2937').text(quote.terms || 'Net 30. Valid for 30 days from proposal date.', MARGIN, doc.y, { width: CONTENT_WIDTH });
    row(22);
    if (quote.notes) {
      doc.fontSize(10).fillColor('#6b7280').text('Notes', MARGIN, doc.y);
      row(14);
      doc.fontSize(10).fillColor('#1f2937').text(quote.notes.slice(0, 200), MARGIN, doc.y, { width: CONTENT_WIDTH });
      row(22);
    }

    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#e5e7eb').stroke();
    row(14);
    doc.fontSize(10).fillColor('#6b7280').text('CONTACT', MARGIN, doc.y);
    row(16);
    const contactStartY = y;
    const rsmName = rsmContact ? [rsmContact.firstName, rsmContact.lastName].filter(Boolean).join(' ') || '—' : '—';
    const rsmEmail = rsmContact?.email ?? '—';
    const rsmPhone = rsmContact?.phone ?? '—';
    const distName = distContact ? [distContact.firstName, distContact.lastName].filter(Boolean).join(' ') || '—' : '—';
    const distEmail = distContact?.email ?? '—';
    const distPhone = distContact?.phone ?? '—';

    const r = AVATAR_SIZE / 2;
    const drawContactAvatar = (cardX: number, avatarBuf: Buffer | null) => {
      const cx = cardX + r;
      const cy = contactStartY + r;
      if (avatarBuf) {
        try {
          doc.save();
          doc.circle(cx, cy, r).clip();
          doc.image(avatarBuf, cardX, contactStartY, { width: AVATAR_SIZE, height: AVATAR_SIZE, fit: [AVATAR_SIZE, AVATAR_SIZE] });
          doc.restore();
        } catch {
          doc.circle(cx, cy, r).fill('#e5e7eb');
        }
      } else {
        doc.circle(cx, cy, r).fill('#e5e7eb');
      }
    };

    const card1X = MARGIN;
    drawContactAvatar(card1X, rsmAvatarBuf);
    doc.fontSize(10).fillColor('#6b7280').text('Your WAGO Contact', card1X + 56, contactStartY);
    doc.fontSize(12).fillColor('#111827').text(rsmName, card1X + 56, contactStartY + 12);
    doc.fontSize(10).fillColor('#4b5563').text(rsmEmail, card1X + 56, contactStartY + 26);
    doc.text(rsmPhone, card1X + 56, contactStartY + 40);
    const card2X = MARGIN + 270;
    drawContactAvatar(card2X, distAvatarBuf);
    doc.fontSize(10).fillColor('#6b7280').text('Your Distributor', card2X + 56, contactStartY);
    doc.fontSize(12).fillColor('#111827').text(distName, card2X + 56, contactStartY + 12);
    doc.fontSize(10).fillColor('#4b5563').text(distEmail, card2X + 56, contactStartY + 26);
    doc.text(distPhone, card2X + 56, contactStartY + 40);
    row(68);

    drawFooter(doc);
    doc.end();
  });
}

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
import { effectiveRole } from './roles';

const MARGIN = 50;
const PAGE_WIDTH = 595;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const ACCENT_BAR_HEIGHT = 5;        // thin brand color bar at very top
const DEFAULT_ACCENT_COLOR = '#059669';  // WAGO green fallback
const HEADER_BAR_HEIGHT = 78;        // increased to accommodate accent bar
const HEADER_ROW1_HEIGHT = 46;
const RSM_LOGO_WIDTH_PT = 112;
const RSM_LOGO_HEIGHT_PT = 36;
const DIST_LOGO_WIDTH_PT = 88;
const DIST_LOGO_HEIGHT_PT = 26;
const HEADER_GAP = 14;
const META_HEIGHT = 36;
const FOOTER_Y = 790;
const FOOTER_HEIGHT = 44;
const CONTENT_TOP = MARGIN + HEADER_BAR_HEIGHT;
const ROW_HEIGHT = 20;
const TABLE_HEAD_HEIGHT = 24;
const CONTINUED_FOOTER_Y = 795;
const CONTINUED_FOOTER_HEIGHT = 28;

// Thumbnail column (22pt) + part number col shifted right by 24pt
const THUMB_COL_W = 22;
const COL = {
  thumb: MARGIN,
  part: MARGIN + THUMB_COL_W + 2,
  desc: MARGIN + THUMB_COL_W + 2 + 88,
  moq: MARGIN + THUMB_COL_W + 2 + 88 + 178,
  qty: MARGIN + THUMB_COL_W + 2 + 88 + 178 + 32,
  price: MARGIN + THUMB_COL_W + 2 + 88 + 178 + 32 + 52,
  total: MARGIN + THUMB_COL_W + 2 + 88 + 178 + 32 + 52 + 52,
  end: MARGIN + CONTENT_WIDTH,
};
const COL_WIDTHS = { part: 88, desc: 178, moq: 32, qty: 52, price: 52, total: 61 };

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
  thumbnailUrl?: string | null;
}

export interface ContactForPdf {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
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
  accentColor?: string | null;
  bannerUrl?: string | null;
  genericThumbnailUrl?: string | null;
  items: QuoteItemForPdf[];
  user: {
    role: string;
    logoUrl?: string | null;
    accentColor?: string | null;
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
  opts: {
    proposalNumber: string;
    dateStr: string;
    validUntilStr?: string;
    rsmLogoPath: Buffer | null;
    distLogoPath: Buffer | null;
    accentColor: string;
  }
) {
  // Accent bar across the full top
  doc.rect(0, 0, PAGE_WIDTH, ACCENT_BAR_HEIGHT).fill(opts.accentColor);

  const y0 = MARGIN;
  doc.rect(0, y0, PAGE_WIDTH, HEADER_BAR_HEIGHT).fill('#ffffff');

  // Bottom border of header area
  doc.moveTo(0, y0 + HEADER_BAR_HEIGHT)
    .lineTo(PAGE_WIDTH, y0 + HEADER_BAR_HEIGHT)
    .strokeColor('#e5e7eb').lineWidth(1).stroke();

  // Row 1: RSM logo | PRICING PROPOSAL title | Distributor logo
  const logoTopOffset = ACCENT_BAR_HEIGHT;  // logos start just after accent bar
  const rsmX = MARGIN;
  const rsmY = y0 + logoTopOffset + (HEADER_ROW1_HEIGHT - RSM_LOGO_HEIGHT_PT) / 2;
  const centerLeft = rsmX + RSM_LOGO_WIDTH_PT + HEADER_GAP;
  const centerRight = COL.end - DIST_LOGO_WIDTH_PT - HEADER_GAP;
  const centerWidth = Math.max(80, centerRight - centerLeft);
  const distX = COL.end - DIST_LOGO_WIDTH_PT;
  const distY = y0 + logoTopOffset + (HEADER_ROW1_HEIGHT - DIST_LOGO_HEIGHT_PT) / 2;

  if (opts.rsmLogoPath) {
    try {
      doc.image(opts.rsmLogoPath, rsmX, rsmY, { width: RSM_LOGO_WIDTH_PT, height: RSM_LOGO_HEIGHT_PT, fit: [RSM_LOGO_WIDTH_PT, RSM_LOGO_HEIGHT_PT] });
    } catch {
      doc.rect(rsmX, rsmY, RSM_LOGO_WIDTH_PT, RSM_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
    }
  }

  doc.fontSize(17).fillColor('#111827').font('Helvetica-Bold')
    .text('PRICING PROPOSAL', centerLeft, y0 + logoTopOffset + 10, { width: centerWidth, align: 'center' });
  doc.font('Helvetica');

  if (opts.distLogoPath) {
    try {
      doc.image(opts.distLogoPath, distX, distY, { width: DIST_LOGO_WIDTH_PT, height: DIST_LOGO_HEIGHT_PT, fit: [DIST_LOGO_WIDTH_PT, DIST_LOGO_HEIGHT_PT] });
    } catch {
      doc.rect(distX, distY, DIST_LOGO_WIDTH_PT, DIST_LOGO_HEIGHT_PT).fillAndStroke('#e5e7eb', '#d1d5db');
    }
  }

  // Row 2: meta line
  const metaY = y0 + logoTopOffset + HEADER_ROW1_HEIGHT + 6;
  let metaText = `Proposal #${opts.proposalNumber}  ·  ${opts.dateStr}`;
  if (opts.validUntilStr) metaText += `  ·  Valid until ${opts.validUntilStr}`;
  metaText += `  ·  Page ${pageNum} of ${totalPages}`;
  doc.fontSize(8).fillColor('#6b7280').text(metaText, MARGIN, metaY, { width: CONTENT_WIDTH, align: 'right' });

  doc.y = CONTENT_TOP;
}

function drawFooter(doc: PDFDoc, accentColor: string) {
  // Accent bar at very bottom
  doc.rect(0, 837, PAGE_WIDTH, ACCENT_BAR_HEIGHT).fill(accentColor);
  // Light footer band
  doc.rect(MARGIN, FOOTER_Y, CONTENT_WIDTH, FOOTER_HEIGHT).fill('#f9fafb');
  doc.moveTo(MARGIN, FOOTER_Y).lineTo(COL.end, FOOTER_Y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.fontSize(9).fillColor('#9ca3af');
  doc.text(
    'This is a pricing proposal only, not a binding purchase order or official quote.',
    MARGIN, FOOTER_Y + 8, { align: 'center', width: CONTENT_WIDTH }
  );
  doc.text(
    'Prices are subject to change without notice. Thank you for your business.',
    MARGIN, FOOTER_Y + 21, { align: 'center', width: CONTENT_WIDTH }
  );
}

function drawContinuationFooter(doc: PDFDoc) {
  const y = CONTINUED_FOOTER_Y;
  doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.rect(MARGIN, y, CONTENT_WIDTH, CONTINUED_FOOTER_HEIGHT).fill('#fafafa');
  doc.moveTo(MARGIN, y + CONTINUED_FOOTER_HEIGHT).lineTo(COL.end, y + CONTINUED_FOOTER_HEIGHT).strokeColor('#e5e7eb').stroke();
  doc.fontSize(9).fillColor('#9ca3af');
  doc.text('Continued on the next page  →', MARGIN, y + 10, { align: 'center', width: CONTENT_WIDTH });
}

/**
 * Build Pricing Proposal PDF buffer for a quote (Style B).
 */
export async function buildQuotePdfBuffer(quote: QuoteForPdf): Promise<Buffer> {
  const proposalNumber = quote.quoteNumber;

  // Date and expiry always reflect PDF generation time, not stored quote date.
  // This way every download/email shows the current date and a fresh 30-day window.
  const now = new Date();
  const validUntilDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dateStr = formatDate(now);
  const validUntilStr = formatDate(validUntilDate);

  // Resolve accent color: caller-provided > default WAGO green
  const accentColor = quote.accentColor || '#059669';

  // Use effectiveRole so deprecated DB values (DISTRIBUTOR, TURNKEY, BASIC) map correctly
  const userRole = effectiveRole(quote.user.role);

  const rsmLogoUrl =
    userRole === 'RSM' || userRole === 'ADMIN'
      ? quote.user.logoUrl
      : quote.user.assignedToRsm?.logoUrl ?? undefined;
  const distLogoUrl =
    userRole === 'DISTRIBUTOR_REP'
      ? quote.user.logoUrl
      : quote.user.assignedToDistributor?.logoUrl ?? undefined;

  // Determine who appears in each contact card
  const rsmContact = (userRole === 'RSM' || userRole === 'ADMIN') ? quote.user : quote.user.assignedToRsm;
  const distContact = userRole === 'DISTRIBUTOR_REP' ? quote.user : quote.user.assignedToDistributor;

  // Pre-fetch thumbnail buffers for line items (use generic as fallback)
  const thumbUrls = quote.items.map((it) => it.thumbnailUrl || quote.genericThumbnailUrl || null);
  const uniqueThumbUrls = [...new Set(thumbUrls.filter(Boolean) as string[])];
  const thumbBufMap = new Map<string, Buffer | null>();
  await Promise.all(uniqueThumbUrls.map(async (url) => {
    thumbBufMap.set(url, await fetchImageBuffer(url));
  }));
  const getThumbBuf = (it: QuoteItemForPdf): Buffer | null =>
    thumbBufMap.get(it.thumbnailUrl || quote.genericThumbnailUrl || '') ?? null;

  // Pre-fetch all images before starting PDF generation (supports R2 URLs and legacy local paths)
  const [rsmLogoPath, distLogoPath, rsmAvatarBuf, distAvatarBuf, bannerBuf] = await Promise.all([
    fetchImageBuffer(rsmLogoUrl),
    fetchImageBuffer(distLogoUrl),
    fetchImageBuffer(rsmContact?.avatarUrl),
    fetchImageBuffer(distContact?.avatarUrl),
    fetchImageBuffer(quote.bannerUrl ?? null),
  ]);

  // A4 page height = 842pt. Content wraps before FOOTER_Y.
  const USABLE_BOTTOM = FOOTER_Y - 10; // 780pt — leave room for footer

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let pageNum = 1;
    let y = CONTENT_TOP;

    const headerOpts = { proposalNumber, dateStr, validUntilStr, rsmLogoPath, distLogoPath, accentColor };

    // Used ONLY during line-items table: advances cursor and breaks page with "Continued" footer
    const itemRow = (dy: number, redrawTableHead = false) => {
      y += dy;
      doc.y = y;
      if (y > 718) {
        drawContinuationFooter(doc);
        doc.addPage({ margin: 0 });
        pageNum++;
        drawHeader(doc, pageNum, pageNum, headerOpts); // totalPages = pageNum (best estimate)
        y = CONTENT_TOP;
        doc.y = y;
        if (redrawTableHead) {
          drawTableHeader(doc, y);
          y += TABLE_HEAD_HEIGHT;
          doc.y = y;
        }
      }
    };

    // Used AFTER line-items table: breaks page silently (no "Continued" footer)
    const ensureSpace = (needed: number) => {
      if (y + needed > USABLE_BOTTOM) {
        doc.addPage({ margin: 0 });
        pageNum++;
        drawHeader(doc, pageNum, pageNum, headerOpts);
        y = CONTENT_TOP;
        doc.y = y;
      }
    };

    // Advance y without triggering a page break (used for known-safe small offsets)
    const advance = (dy: number) => {
      y += dy;
      doc.y = y;
    };

    // ── Page 1 header ──────────────────────────────────────────────────────────
    drawHeader(doc, pageNum, pageNum, headerOpts);
    doc.y = y;

    // ── Meta bar ──────────────────────────────────────────────────────────────
    const metaY = y;
    const metaBarH = validUntilStr ? 46 : META_HEIGHT;
    doc.rect(MARGIN, metaY, CONTENT_WIDTH, metaBarH).fill('#f9fafb');
    doc.moveTo(MARGIN, metaY + metaBarH).lineTo(COL.end, metaY + metaBarH).strokeColor('#e5e7eb').stroke();
    doc.fontSize(10).fillColor('#6b7280');
    doc.text(`Proposal #:`, MARGIN + 8, metaY + 10);
    doc.fillColor('#111827').font('Helvetica-Bold').text(` ${proposalNumber}`, MARGIN + 66, metaY + 10);
    doc.font('Helvetica').fillColor('#6b7280');
    doc.text(`Date: ${dateStr}`, MARGIN + 140, metaY + 10);
    if (validUntilStr) {
      doc.fillColor('#059669').font('Helvetica-Bold')
        .text(`Valid until: ${validUntilStr}`, MARGIN + 8, metaY + 28);
      doc.font('Helvetica').fillColor('#6b7280');
    }
    if (quote.priceContract?.name) {
      doc.text(`Price Contract: ${quote.priceContract.name}`, MARGIN + 280, metaY + 10);
    }
    advance(metaBarH + 4);

    // ── Bill To ───────────────────────────────────────────────────────────────
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold').text('BILL TO', MARGIN, y);
    doc.font('Helvetica');
    advance(13);
    const billToY = y;
    const customerName = quote.customerName || quote.customer?.name || '—';
    doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(customerName, MARGIN, billToY);
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563');
    let billOffset = 15;
    if (quote.customer?.address) { doc.text(quote.customer.address, MARGIN, billToY + billOffset); billOffset += 13; }
    if (quote.customer?.city || quote.customer?.state || quote.customer?.zipCode) {
      doc.text([quote.customer?.city, quote.customer?.state, quote.customer?.zipCode].filter(Boolean).join(', '), MARGIN, billToY + billOffset);
      billOffset += 13;
    }
    const emailLine = quote.customerEmail || quote.customer?.email;
    if (emailLine) { doc.text(emailLine, MARGIN, billToY + billOffset); billOffset += 13; }
    advance(Math.max(48, billOffset + 8));

    // ── Line items table ───────────────────────────────────────────────────────
    drawTableHeader(doc, y);
    advance(TABLE_HEAD_HEIGHT);

    const items = quote.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pn = (it.snapshotPartNumber ?? it.partNumber) || '—';
      const desc = (it.snapshotDescription ?? it.description) || '—';
      const moq = it.minQty ?? '—';
      const price = it.sellPrice ?? 0;
      const total = it.lineTotal;
      const sym = it.isCostAffected ? '*' : it.isSellAffected ? '†' : '';
      const symColor = it.isSellAffected ? accentColor : '#6b7280';

      const rowY = y;
      doc.rect(MARGIN, rowY, CONTENT_WIDTH, ROW_HEIGHT).fill(i % 2 === 0 ? '#ffffff' : '#f9fafb');

      // Thumbnail
      const thumbBuf = getThumbBuf(it);
      if (thumbBuf) {
        try {
          doc.image(thumbBuf, COL.thumb, rowY + 1, { fit: [THUMB_COL_W, ROW_HEIGHT - 2] });
        } catch { /* skip if corrupt */ }
      }

      doc.fillColor('#1f2937').fontSize(9).font('Helvetica');
      const partNumWithGap = pn + (sym ? '  ' : '');
      doc.text(partNumWithGap, COL.part + 2, rowY + 5, { lineBreak: false });
      if (sym) {
        doc.fillColor(symColor).text(sym, COL.part + 2 + doc.widthOfString(partNumWithGap), rowY + 5, { lineBreak: false });
      }
      doc.fillColor('#1f2937').text(desc.slice(0, 32), COL.desc + 4, rowY + 5, { lineBreak: false });
      doc.text(String(moq), COL.moq, rowY + 5, { width: COL_WIDTHS.moq, align: 'right', lineBreak: false });
      doc.text(String(it.quantity), COL.qty, rowY + 5, { width: COL_WIDTHS.qty, align: 'right', lineBreak: false });
      doc.text('$' + price.toFixed(2), COL.price, rowY + 5, { width: COL_WIDTHS.price, align: 'right', lineBreak: false });
      doc.text('$' + total.toFixed(2), COL.total, rowY + 5, { width: COL_WIDTHS.total, align: 'right', lineBreak: false });
      doc.moveTo(MARGIN, rowY + ROW_HEIGHT).lineTo(COL.end, rowY + ROW_HEIGHT).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      itemRow(ROW_HEIGHT, true);
    }

    // ── Summary section (Totals + Terms + Notes + Contact) ───────────────────
    // Compute total height needed so we do ONE page-break check. This prevents
    // multiple ensureSpace calls from creating spurious blank pages.
    const termsText = quote.terms || 'Net 30. Valid for 30 days from proposal date.';
    const termsLines = Math.ceil(termsText.length / 90) + 1;     // rough line estimate at CONTENT_WIDTH
    const notesLines = quote.notes ? Math.ceil(quote.notes.slice(0, 200).length / 90) + 1 : 0;
    const summaryH =
      8 + 2 + 10 + 48 + 8 +          // gap + divider + gap + totals block + gap
      1 + 10 + 13 + termsLines * 13 + 24 +  // divider + gap + TERMS + text + gap
      (quote.notes ? 13 + notesLines * 13 + 24 : 0) + // NOTES section if present
      1 + 12 + 14 + 66 + 10;          // contact divider + gap + label + cards + bottom pad

    ensureSpace(summaryH);

    // Totals
    advance(8);
    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor(accentColor).lineWidth(2).stroke();
    advance(10);
    const totalsY = y;
    doc.rect(MARGIN, totalsY, CONTENT_WIDTH, 48).fill('#f9fafb');
    doc.fontSize(10).fillColor('#6b7280')
      .text(`Subtotal: $${quote.total.toFixed(2)}`, MARGIN, totalsY + 6, { width: CONTENT_WIDTH - 8, align: 'right', lineBreak: false });
    doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold')
      .text(`TOTAL:  $${quote.total.toFixed(2)}`, MARGIN, totalsY + 22, { width: CONTENT_WIDTH - 8, align: 'right', lineBreak: false });
    doc.font('Helvetica');
    advance(56);

    // Terms
    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    advance(10);
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold')
      .text('TERMS', MARGIN, y, { lineBreak: false });
    doc.font('Helvetica');
    advance(13);
    doc.fontSize(10).fillColor('#1f2937').text(termsText, MARGIN, y, { width: CONTENT_WIDTH });
    // Sync y with actual text end (terms text can wrap)
    y = Math.max(y + termsLines * 13, doc.y);
    doc.y = y;
    advance(16);

    // Notes
    if (quote.notes) {
      doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold')
        .text('NOTES', MARGIN, y, { lineBreak: false });
      doc.font('Helvetica');
      advance(13);
      doc.fontSize(10).fillColor('#1f2937').text(quote.notes.slice(0, 200), MARGIN, y, { width: CONTENT_WIDTH });
      y = Math.max(y + notesLines * 13, doc.y);
      doc.y = y;
      advance(16);
    }

    // Contact
    doc.moveTo(MARGIN, y).lineTo(COL.end, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    advance(12);
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold')
      .text('CONTACT', MARGIN, y, { lineBreak: false });
    doc.font('Helvetica');
    advance(14);
    const contactStartY = y;

    const r = AVATAR_SIZE / 2;
    const drawContactCard = (cardX: number, avatarBuf: Buffer | null, label: string, name: string, email: string, phone: string, cardWidth: number) => {
      doc.rect(cardX, contactStartY, cardWidth, 66).fill('#f9fafb');
      doc.moveTo(cardX, contactStartY).lineTo(cardX, contactStartY + 66).strokeColor(accentColor).lineWidth(2).stroke();
      const cx = cardX + 14 + r;
      const cy = contactStartY + r + 9;
      if (avatarBuf) {
        try {
          doc.save();
          doc.circle(cx, cy, r).clip();
          doc.image(avatarBuf, cardX + 14, contactStartY + 9, { fit: [AVATAR_SIZE, AVATAR_SIZE] });
          doc.restore();
        } catch {
          doc.circle(cx, cy, r).fill('#d1d5db');
        }
      } else {
        doc.circle(cx, cy, r).fill('#d1d5db');
      }
      const textX = cardX + 14 + AVATAR_SIZE + 10;
      doc.fontSize(8).fillColor('#6b7280').text(label, textX, contactStartY + 6);
      doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(name, textX, contactStartY + 18);
      doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(email, textX, contactStartY + 33);
      doc.text(phone, textX, contactStartY + 46);
    };

    const rsmName = rsmContact ? [rsmContact.firstName, rsmContact.lastName].filter(Boolean).join(' ') || '—' : '—';

    if (rsmContact && distContact) {
      drawContactCard(MARGIN, rsmAvatarBuf, 'Your WAGO Contact', rsmName, rsmContact.email ?? '—', rsmContact.phone ?? '—', 232);
      const distName = [distContact.firstName, distContact.lastName].filter(Boolean).join(' ') || '—';
      drawContactCard(MARGIN + 252, distAvatarBuf, 'Your Distributor', distName, distContact.email ?? '—', distContact.phone ?? '—', 232);
    } else if (rsmContact) {
      drawContactCard(MARGIN, rsmAvatarBuf, 'Your WAGO Contact', rsmName, rsmContact.email ?? '—', rsmContact.phone ?? '—', CONTENT_WIDTH);
    } else if (distContact) {
      const distName = [distContact.firstName, distContact.lastName].filter(Boolean).join(' ') || '—';
      drawContactCard(MARGIN, distAvatarBuf, 'Your Distributor', distName, distContact.email ?? '—', distContact.phone ?? '—', CONTENT_WIDTH);
    }

    // ── Footer (drawn at absolute position on last content page) ──────────────
    drawFooter(doc, accentColor);

    // ── Banner page ───────────────────────────────────────────────────────────
    if (bannerBuf) {
      doc.addPage({ margin: 0 });
      doc.rect(0, 0, PAGE_WIDTH, ACCENT_BAR_HEIGHT).fill(accentColor);
      doc.rect(0, 837, PAGE_WIDTH, ACCENT_BAR_HEIGHT).fill(accentColor);
      const bannerMaxW = PAGE_WIDTH - 2 * MARGIN;
      const bannerMaxH = 842 - 2 * MARGIN - 2 * ACCENT_BAR_HEIGHT;
      const bannerStartY = MARGIN + ACCENT_BAR_HEIGHT;
      try {
        // Use ONLY fit[] — never set width+height together as they override fit and ignore aspect ratio
        doc.image(bannerBuf, MARGIN, bannerStartY, { fit: [bannerMaxW, bannerMaxH], align: 'center', valign: 'center' });
      } catch { /* skip if corrupt */ }
    }

    doc.end();
  });
}

// ── Shared helper: draw the items table header row ───────────────────────────
function drawTableHeader(doc: PDFDoc, y: number) {
  doc.rect(MARGIN, y, CONTENT_WIDTH, TABLE_HEAD_HEIGHT).fill('#e5e7eb');
  doc.fontSize(9).fillColor('#4b5563').font('Helvetica-Bold');
  doc.text('Part Number', COL.part + 4, y + 8, { lineBreak: false });
  doc.text('Description', COL.desc + 4, y + 8, { lineBreak: false });
  doc.text('MOQ', COL.moq, y + 8, { width: COL_WIDTHS.moq, align: 'right', lineBreak: false });
  doc.text('Qty', COL.qty, y + 8, { width: COL_WIDTHS.qty, align: 'right', lineBreak: false });
  doc.text('Price', COL.price, y + 8, { width: COL_WIDTHS.price, align: 'right', lineBreak: false });
  doc.text('Total', COL.total, y + 8, { width: COL_WIDTHS.total, align: 'right', lineBreak: false });
  doc.font('Helvetica');
}

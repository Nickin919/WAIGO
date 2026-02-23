import PDFDocument from 'pdfkit';
import { prisma } from './prisma';
import { getLiteratureBuffer, createZipBuffer } from './literatureService';

const ZIP_SINGLE_THRESHOLD = 10 * 1024 * 1024; // 10MB — below this, serve single file instead of zip

// ============================================================================
// CRUD
// ============================================================================

export async function listKits(userId: string) {
  const kits = await prisma.literatureKit.findMany({
    where: { userId },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return kits.map((k) => ({
    id: k.id,
    name: k.name,
    notes: k.notes,
    itemCount: k._count.items,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  }));
}

export async function createKit(userId: string, name: string, notes?: string) {
  return prisma.literatureKit.create({
    data: { userId, name: name.trim(), notes: notes?.trim() || null },
    include: { items: { include: { literature: true } } },
  });
}

export async function getKit(id: string, userId: string) {
  const kit = await prisma.literatureKit.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          literature: {
            select: {
              id: true,
              title: true,
              description: true,
              type: true,
              filePath: true,
              fileSize: true,
              keywords: true,
              industryTags: true,
              parts: { include: { part: { select: { partNumber: true } } } },
              series: { select: { seriesName: true } },
            },
          },
        },
        orderBy: { addedAt: 'asc' },
      },
    },
  });
  if (!kit) return null;
  if (kit.userId !== userId) return null; // ownership check
  return kit;
}

export async function updateKit(id: string, userId: string, fields: { name?: string; notes?: string }) {
  const kit = await prisma.literatureKit.findUnique({ where: { id }, select: { userId: true } });
  if (!kit || kit.userId !== userId) throw new Error('Kit not found');

  const data: Record<string, unknown> = {};
  if (fields.name !== undefined) data.name = fields.name.trim();
  if (fields.notes !== undefined) data.notes = fields.notes?.trim() || null;

  return prisma.literatureKit.update({ where: { id }, data });
}

export async function deleteKit(id: string, userId: string) {
  const kit = await prisma.literatureKit.findUnique({ where: { id }, select: { userId: true } });
  if (!kit || kit.userId !== userId) throw new Error('Kit not found');
  await prisma.literatureKit.delete({ where: { id } });
}

export async function addItemsToKit(kitId: string, userId: string, literatureIds: string[]) {
  const kit = await prisma.literatureKit.findUnique({ where: { id: kitId }, select: { userId: true } });
  if (!kit || kit.userId !== userId) throw new Error('Kit not found');

  const unique = [...new Set(literatureIds)].filter(Boolean);
  await prisma.literatureKitItem.createMany({
    data: unique.map((literatureId) => ({ kitId, literatureId })),
    skipDuplicates: true,
  });
  return getKit(kitId, userId);
}

export async function removeItemFromKit(kitId: string, userId: string, literatureId: string) {
  const kit = await prisma.literatureKit.findUnique({ where: { id: kitId }, select: { userId: true } });
  if (!kit || kit.userId !== userId) throw new Error('Kit not found');
  await prisma.literatureKitItem.deleteMany({ where: { kitId, literatureId } });
}

// ============================================================================
// ZIP download
// ============================================================================

export async function generateKitZip(
  kitId: string,
  userId: string
): Promise<{ buffer: Buffer; isZipped: boolean; filename: string }> {
  const kit = await getKit(kitId, userId);
  if (!kit) throw new Error('Kit not found');
  if (kit.items.length === 0) throw new Error('Kit is empty');

  const litList = kit.items.map((i) => i.literature);

  // Single small file — serve directly without zipping
  if (litList.length === 1 && litList[0].fileSize <= ZIP_SINGLE_THRESHOLD) {
    const buffer = await getLiteratureBuffer(litList[0].filePath);
    const safeName = litList[0].title.replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';
    return { buffer, isZipped: false, filename: safeName };
  }

  const zipBuffer = await createZipBuffer(
    litList.map((l) => ({ id: l.id, title: l.title, filePath: l.filePath }))
  );
  const kitName = kit.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return { buffer: zipBuffer, isZipped: true, filename: `Literature_Kit_${kitName}.zip` };
}

// ============================================================================
// Literature Slip PDF
// ============================================================================

export async function generateKitSlipPdf(
  kitId: string,
  userId: string,
  userName: string
): Promise<Buffer> {
  const kit = await getKit(kitId, userId);
  if (!kit) throw new Error('Kit not found');

  return new Promise((resolve, reject) => {
    try {
      const MARGIN = 50;
      const PAGE_WIDTH = 595;
      const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

      const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header bar
      doc.rect(0, 0, PAGE_WIDTH, 60).fill('#005A2B');
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
        .text('Literature Kit', MARGIN, 18, { width: CONTENT_WIDTH });
      doc.fontSize(10).font('Helvetica')
        .text(kit.name, MARGIN, 38, { width: CONTENT_WIDTH });

      // Meta row
      doc.fillColor('#333333').fontSize(9).font('Helvetica')
        .text(`Prepared for: ${userName}`, MARGIN, 72)
        .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, MARGIN, 84)
        .text(`Items: ${kit.items.length}`, MARGIN, 96);

      if (kit.notes) {
        doc.fontSize(9).fillColor('#555').text(`Notes: ${kit.notes}`, MARGIN, 110, { width: CONTENT_WIDTH });
      }

      // Table header
      const tableTop = kit.notes ? 132 : 118;
      const COL = { title: MARGIN, type: MARGIN + 220, size: MARGIN + 310, url: MARGIN + 370 };

      doc.rect(MARGIN, tableTop, CONTENT_WIDTH, 18).fill('#005A2B');
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text('TITLE', COL.title, tableTop + 5)
        .text('TYPE', COL.type, tableTop + 5)
        .text('SIZE', COL.size, tableTop + 5)
        .text('LINK', COL.url, tableTop + 5);

      // Table rows
      let y = tableTop + 18;
      doc.font('Helvetica').fillColor('#333333');

      kit.items.forEach((item, idx) => {
        const lit = item.literature;
        const rowH = 20;
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F7F7F7';
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowH).fill(bg);

        const sizeStr = lit.fileSize < 1024 * 1024
          ? `${(lit.fileSize / 1024).toFixed(0)} KB`
          : `${(lit.fileSize / 1024 / 1024).toFixed(1)} MB`;

        doc.fillColor('#222222').fontSize(8)
          .text(lit.title.slice(0, 35) + (lit.title.length > 35 ? '…' : ''), COL.title, y + 6, { width: 210, lineBreak: false })
          .text(lit.type.replace(/_/g, ' '), COL.type, y + 6, { width: 80, lineBreak: false })
          .text(sizeStr, COL.size, y + 6, { width: 55, lineBreak: false });

        // Clickable link — draw text first, then annotate separately to avoid NaN coords
        const linkLabel = 'View PDF';
        const linkX = COL.url;
        const linkY = y + 6;
        const linkW = 60;
        const linkH = 10;
        doc.fillColor('#005A2B').fontSize(8)
          .text(linkLabel, linkX, linkY, { width: linkW, lineBreak: false, underline: true });
        if (lit.filePath && lit.filePath.startsWith('http')) {
          doc.link(linkX, linkY, linkW, linkH, lit.filePath);
        }

        y += rowH;

        // New page if needed
        if (y > 760) {
          doc.addPage();
          y = MARGIN;
        }
      });

      // Footer
      const footerY = Math.min(y + 20, 790);
      doc.fontSize(8).fillColor('#888888').font('Helvetica')
        .text('Literature provided by WAGO Corporation. All documents are subject to change without notice.', MARGIN, footerY, {
          width: CONTENT_WIDTH,
          align: 'center',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

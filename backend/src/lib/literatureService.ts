import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import Papa from 'papaparse';
import { prisma } from './prisma';
import { getUploadDir } from './uploadPath';
import type { LiteratureType as PrismaLiteratureType } from '@prisma/client';

const MAX_PARTS = 100;
const MAX_SERIES = 50;
const DEFAULT_ZIP_MILESTONE = 15 * 1024 * 1024; // 15MB
const MAX_PACK_BYTES = 25 * 1024 * 1024; // 25MB

function resolveFilePath(filePath: string): string {
  const base = getUploadDir();
  const resolved = path.resolve(filePath);
  const relative = path.relative(base, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid file path');
  }
  return resolved;
}

export async function uploadLiteratureWithAssociations(
  file: Express.Multer.File,
  metadata: {
    title: string;
    description?: string;
    type: string;
    partIds?: string[];
    seriesNames?: string[];
  },
  userId: string
) {
  const partIds = (metadata.partIds ?? []).filter(Boolean);
  const seriesNames = (metadata.seriesNames ?? []).map((s) => s.trim()).filter(Boolean);
  if (partIds.length === 0 && seriesNames.length === 0) {
    throw new Error('At least one product (part) or series association is required');
  }
  if (partIds.length > MAX_PARTS || seriesNames.length > MAX_SERIES) {
    throw new Error(`Maximum ${MAX_PARTS} parts and ${MAX_SERIES} series per item`);
  }

  const filePathToStore = file.path; // full path from multer

  return prisma.$transaction(async (tx) => {
    const lit = await tx.literature.create({
      data: {
        title: metadata.title.trim(),
        description: metadata.description?.trim() || null,
        type: metadata.type as PrismaLiteratureType,
        filePath: filePathToStore,
        fileSize: file.size,
        uploadedById: userId,
      },
    });

    if (partIds.length) {
      await tx.literaturePart.createMany({
        data: partIds.map((partId) => ({ literatureId: lit.id, partId })),
        skipDuplicates: true,
      });
    }
    if (seriesNames.length) {
      await tx.literatureSeries.createMany({
        data: seriesNames.map((seriesName) => ({ literatureId: lit.id, seriesName })),
        skipDuplicates: true,
      });
    }

    return tx.literature.findUnique({
      where: { id: lit.id },
      include: { parts: { include: { part: { select: { id: true, partNumber: true } } } }, series: true },
    });
  });
}

export async function getSuggestedLiteratureForQuote(quoteId: string) {
  const quoteItems = await prisma.quoteItem.findMany({
    where: { quoteId },
    select: { partId: true, part: { select: { id: true, series: true } } },
    distinct: ['partId'],
  });

  const partIds = quoteItems.map((i) => i.part.id);
  const seriesNames = [...new Set(quoteItems.map((i) => i.part.series).filter(Boolean))] as string[];

  const [byPart, bySeries] = await Promise.all([
    partIds.length
      ? prisma.literature.findMany({
          where: { parts: { some: { partId: { in: partIds } } } },
          include: { parts: { include: { part: { select: { partNumber: true } } } }, series: true },
          distinct: ['id'],
        })
      : [],
    seriesNames.length
      ? prisma.literature.findMany({
          where: { series: { some: { seriesName: { in: seriesNames } } } },
          include: { parts: { include: { part: { select: { partNumber: true } } } }, series: true },
          distinct: ['id'],
        })
      : [],
  ]);

  const seen = new Set<string>();
  const combined = [...byPart, ...bySeries] as (typeof byPart)[number][];
  const result: (typeof byPart)[number][] = [];
  for (const lit of combined) {
    if (!seen.has(lit.id)) {
      seen.add(lit.id);
      result.push(lit);
    }
  }
  return result;
}

export async function attachToQuote(quoteId: string, literatureIds: string[]) {
  const existing = await prisma.quoteLiterature.findMany({
    where: { quoteId },
    select: { literatureId: true },
  });
  const existingSet = new Set(existing.map((e) => e.literatureId));
  const toAdd = literatureIds.filter((id) => !existingSet.has(id));
  if (toAdd.length === 0) return [];
  await prisma.quoteLiterature.createMany({
    data: toAdd.map((literatureId) => ({ quoteId, literatureId })),
    skipDuplicates: true,
  });
  return prisma.quoteLiterature.findMany({
    where: { quoteId },
    include: { literature: true },
  });
}

export async function getQuoteLiterature(quoteId: string) {
  return prisma.quoteLiterature.findMany({
    where: { quoteId },
    include: { literature: true },
  });
}

export async function getZipMilestone(): Promise<number> {
  const row = await prisma.settings.findUnique({
    where: { key: 'literature_zip_milestone' },
  });
  const val = row?.value ? parseInt(row.value, 10) : NaN;
  return Number.isFinite(val) ? val : DEFAULT_ZIP_MILESTONE;
}

export async function generateLiteraturePack(quoteId: string): Promise<{
  buffer: Buffer;
  isZipped: boolean;
  filename: string;
}> {
  const items = await getQuoteLiterature(quoteId);
  if (items.length === 0) {
    return { buffer: Buffer.alloc(0), isZipped: false, filename: '' };
  }

  const totalSize = items.reduce((sum, i) => sum + i.literature.fileSize, 0);
  if (totalSize > MAX_PACK_BYTES) {
    throw new Error(`Literature pack would exceed ${MAX_PACK_BYTES / 1024 / 1024}MB limit`);
  }

  const milestone = await getZipMilestone();

  if (items.length === 1 && items[0].literature.fileSize <= milestone) {
    const resolved = resolveFilePath(items[0].literature.filePath);
    const buffer = await fs.readFile(resolved);
    const filename = path.basename(items[0].literature.filePath);
    return { buffer, isZipped: false, filename };
  }

  const zipBuffer = await createZipBuffer(
    items.map((i) => ({ ...i.literature, filePath: resolveFilePath(i.literature.filePath) }))
  );
  return {
    buffer: zipBuffer,
    isZipped: true,
    filename: `Literature_Pack_${quoteId}.zip`,
  };
}

function createZipBuffer(literature: { id: string; title: string; filePath: string }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    for (const lit of literature) {
      const ext = path.extname(lit.filePath) || '.pdf';
      const name = `${lit.title.replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`;
      archive.file(lit.filePath, { name });
    }
    archive.finalize();
  });
}

export async function updateZipMilestone(valueBytes: number) {
  await prisma.settings.upsert({
    where: { key: 'literature_zip_milestone' },
    update: { value: String(valueBytes) },
    create: {
      key: 'literature_zip_milestone',
      value: String(valueBytes),
      description: 'Bytes threshold for zipping literature pack',
    },
  });
}

export async function updateAssociations(
  literatureId: string,
  partIds: string[],
  seriesNames: string[]
) {
  if (partIds.length > MAX_PARTS || seriesNames.length > MAX_SERIES) {
    throw new Error(`Maximum ${MAX_PARTS} parts and ${MAX_SERIES} series per item`);
  }
  if (partIds.length === 0 && seriesNames.length === 0) {
    throw new Error('At least one part or series association is required');
  }

  return prisma.$transaction(async (tx) => {
    await tx.literaturePart.deleteMany({ where: { literatureId } });
    await tx.literatureSeries.deleteMany({ where: { literatureId } });
    if (partIds.length) {
      await tx.literaturePart.createMany({
        data: partIds.map((partId) => ({ literatureId, partId })),
        skipDuplicates: true,
      });
    }
    if (seriesNames.length) {
      await tx.literatureSeries.createMany({
        data: seriesNames.map((seriesName) => ({ literatureId, seriesName })),
        skipDuplicates: true,
      });
    }
    return tx.literature.findUnique({
      where: { id: literatureId },
      include: { parts: { include: { part: { select: { id: true, partNumber: true } } } }, series: true },
    });
  });
}

const literatureInclude = {
  parts: { include: { part: { select: { id: true, partNumber: true, series: true } } } },
  series: true,
  uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
};

export async function listLiterature(options?: {
  type?: PrismaLiteratureType;
  partId?: string;
  seriesName?: string;
  limit?: number;
  offset?: number;
}) {
  const where: { type?: PrismaLiteratureType; parts?: { some: { partId?: string } }; series?: { some: { seriesName?: string } } } = {};
  if (options?.type) where.type = options.type;
  if (options?.partId) where.parts = { some: { partId: options.partId } };
  if (options?.seriesName) where.series = { some: { seriesName: options.seriesName } };

  const [items, total] = await Promise.all([
    prisma.literature.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: literatureInclude,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.literature.count({ where: Object.keys(where).length ? where : undefined }),
  ]);
  return { items, total };
}

export async function getLiteratureById(id: string) {
  return prisma.literature.findUnique({
    where: { id },
    include: literatureInclude,
  });
}

export async function getAllLiteratureForExport() {
  return prisma.literature.findMany({
    include: {
      parts: { include: { part: { select: { id: true, partNumber: true, series: true } } } },
      series: true,
    },
    orderBy: { title: 'asc' },
  });
}

export function getSampleCsvContent(): string {
  const header = 'literature_id,title,type,part_ids,series_names';
  const example = '00000000-0000-0000-0000-000000000000,Sample Title,FLYER,"P001,P002","Series A, Series B"';
  const note = '# part_ids and series_names are comma-separated within the cell. Edit and upload via bulk-update-associations.';
  return [header, example, note].join('\n');
}

export function exportLiteratureCsv(literature: Awaited<ReturnType<typeof getAllLiteratureForExport>>): string {
  const rows = literature.map((lit) => {
    const partIds = lit.parts.map((p) => p.part.partNumber ?? p.partId).join('; ');
    const seriesNames = lit.series.map((s) => s.seriesName).join('; ');
    return {
      literature_id: lit.id,
      title: lit.title,
      type: lit.type,
      part_ids: partIds,
      series_names: seriesNames,
    };
  });
  return Papa.unparse(rows);
}

export async function exportLiteraturePdfReport(): Promise<Buffer> {
  const literature = await getAllLiteratureForExport();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Literature Library Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown(2);

    for (const lit of literature) {
      doc.fontSize(12).text(lit.title, { continued: false });
      doc.fontSize(9).text(`ID: ${lit.id} | Type: ${lit.type}`);
      const partNums = lit.parts.map((p) => p.part.partNumber ?? p.partId).join(', ');
      const seriesList = lit.series.map((s) => s.seriesName).join(', ');
      doc.text(`Parts: ${partNums || '—'}`);
      doc.text(`Series: ${seriesList || '—'}`);
      doc.moveDown(1);
    }

    doc.end();
  });
}

const BULK_CSV_MAX_ROWS = 2000;

export async function bulkUpdateAssociationsFromCsv(
  csvContent: string,
  userId: string
): Promise<{ updated: number; errors: string[] }> {
  const parsed = Papa.parse<{ literature_id: string; part_ids?: string; series_names?: string }>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];
  if (parsed.errors.length) {
    parsed.errors.forEach((e) => errors.push(`Row ${e.row}: ${e.message}`));
    return { updated: 0, errors };
  }

  const rows = parsed.data.filter((r) => r.literature_id && String(r.literature_id).trim());
  if (rows.length > BULK_CSV_MAX_ROWS) {
    errors.push(`Too many rows. Maximum ${BULK_CSV_MAX_ROWS} allowed.`);
    return { updated: 0, errors };
  }

  let updated = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const literatureId = String(row.literature_id).trim();
    const partIdsRaw = (row.part_ids ?? '').toString().split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const seriesNames = (row.series_names ?? '')
      .toString()
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const partIds: string[] = [];
    for (const p of partIdsRaw) {
      const part = await prisma.part.findFirst({
        where: { OR: [{ id: p }, { partNumber: p }] },
        select: { id: true },
      });
      if (part) partIds.push(part.id);
      else if (p) errors.push(`Row ${i + 2}: Part not found: ${p}`);
    }

    if (partIds.length === 0 && seriesNames.length === 0) {
      errors.push(`Row ${i + 2}: At least one part or series required for ${literatureId}`);
      continue;
    }
    if (partIds.length > MAX_PARTS || seriesNames.length > MAX_SERIES) {
      errors.push(`Row ${i + 2}: Exceeds max parts/series for ${literatureId}`);
      continue;
    }

    const exists = await prisma.literature.findUnique({
      where: { id: literatureId },
      select: { id: true },
    });
    if (!exists) {
      errors.push(`Row ${i + 2}: Literature not found: ${literatureId}`);
      continue;
    }

    try {
      await updateAssociations(literatureId, partIds, seriesNames);
      updated++;
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { updated, errors };
}

import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import Papa from 'papaparse';
import { prisma } from './prisma';
import { getUploadDir } from './uploadPath';
import { uploadToR2, bufferFromR2, deleteFromR2, R2_PUBLIC_BUCKET, getPublicUrl, isR2Key } from './r2';
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
    partNumbers?: string[];   // plain part-number strings, resolved to IDs internally
    seriesNames?: string[];
    keywords?: string[];
    industryTags?: string[];
  },
  userId: string
) {
  const partNumberInputs = (metadata.partNumbers ?? []).filter(Boolean);
  const seriesNames = (metadata.seriesNames ?? []).map((s) => s.trim()).filter(Boolean);
  const keywords = (metadata.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const industryTags = (metadata.industryTags ?? []).map((t) => t.trim()).filter(Boolean);

  // Resolve part numbers → part IDs
  const partIds: string[] = [];
  const unresolvedParts: string[] = [];
  for (const pn of partNumberInputs) {
    const part = await prisma.part.findFirst({
      where: {
        OR: [
          { partNumber: pn.trim() },
          { wagoIdent: pn.trim() },
        ],
      },
      select: { id: true },
    });
    if (part) {
      partIds.push(part.id);
    } else {
      unresolvedParts.push(pn);
    }
  }

  if (partIds.length > MAX_PARTS || seriesNames.length > MAX_SERIES) {
    throw new Error(`Maximum ${MAX_PARTS} parts and ${MAX_SERIES} series per item`);
  }

  // At least one of parts/series/keywords must be provided
  if (partIds.length === 0 && seriesNames.length === 0 && keywords.length === 0) {
    throw new Error('At least one part number, series name, or keyword is required');
  }

  const ext = path.extname(file.originalname) || '.pdf';
  const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `literature/${Date.now()}-${base}${ext}`;
  await uploadToR2(R2_PUBLIC_BUCKET, r2Key, file.buffer, file.mimetype || 'application/pdf');
  const publicUrl = getPublicUrl(r2Key);

  const result = await prisma.$transaction(async (tx) => {
    const lit = await tx.literature.create({
      data: {
        title: metadata.title.trim(),
        description: metadata.description?.trim() || null,
        type: metadata.type as PrismaLiteratureType,
        filePath: publicUrl,
        fileSize: file.size,
        keywords,
        industryTags,
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

  return { literature: result, unresolvedParts };
}

export async function updateLiteratureMetadata(
  id: string,
  fields: {
    title?: string;
    description?: string;
    type?: string;
    keywords?: string[];
    industryTags?: string[];
  }
) {
  const data: Record<string, unknown> = {};
  if (fields.title !== undefined) data.title = fields.title.trim();
  if (fields.description !== undefined) data.description = fields.description?.trim() || null;
  if (fields.type !== undefined) data.type = fields.type as PrismaLiteratureType;
  if (fields.keywords !== undefined) data.keywords = fields.keywords.map((k) => k.trim()).filter(Boolean);
  if (fields.industryTags !== undefined) data.industryTags = fields.industryTags.map((t) => t.trim()).filter(Boolean);

  return prisma.literature.update({
    where: { id },
    data,
    include: literatureInclude,
  });
}

export async function deleteLiterature(id: string) {
  const lit = await prisma.literature.findUnique({ where: { id }, select: { filePath: true } });
  if (!lit) throw new Error('Literature not found');

  // Remove from R2
  try {
    const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    let r2Key: string | null = null;
    if (publicBase && lit.filePath.startsWith(publicBase)) {
      r2Key = lit.filePath.slice(publicBase.length + 1);
    } else if (isR2Key(lit.filePath)) {
      r2Key = lit.filePath;
    }
    if (r2Key) {
      await deleteFromR2(R2_PUBLIC_BUCKET, r2Key);
    }
  } catch (err) {
    console.warn('Could not delete R2 object for literature', id, err);
  }

  await prisma.literature.delete({ where: { id } });
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
    const lit = items[0].literature;
    const buffer = await getLiteratureBuffer(lit.filePath);
    const filename = path.basename(lit.filePath);
    return { buffer, isZipped: false, filename };
  }

  const zipBuffer = await createZipBuffer(
    items.map((i) => ({ id: i.literature.id, title: i.literature.title, filePath: i.literature.filePath }))
  );
  return {
    buffer: zipBuffer,
    isZipped: true,
    filename: `Literature_Pack_${quoteId}.zip`,
  };
}

/** Fetch a literature file buffer from R2 (new CDN URL or key) or local disk (legacy). */
export async function getLiteratureBuffer(filePath: string): Promise<Buffer> {
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (publicBase && filePath.startsWith(publicBase)) {
    const r2Key = filePath.slice(publicBase.length + 1);
    return bufferFromR2(R2_PUBLIC_BUCKET, r2Key);
  }
  if (isR2Key(filePath)) {
    return bufferFromR2(R2_PUBLIC_BUCKET, filePath);
  }
  const resolved = resolveFilePath(filePath);
  return fs.readFile(resolved);
}

export async function createZipBuffer(literature: { id: string; title: string; filePath: string }[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      for (const lit of literature) {
        const ext = path.extname(lit.filePath) || '.pdf';
        const name = `${lit.title.replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`;
        const buffer = await getLiteratureBuffer(lit.filePath);
        archive.append(buffer, { name });
      }
      archive.finalize();
    } catch (err) {
      reject(err);
    }
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
  partNumbers: string[],
  seriesNames: string[]
): Promise<{ literature: any; unresolvedParts: string[] }> {
  // Resolve part numbers → IDs (match either catalog partNumber or wagoIdent/article number)
  const partIds: string[] = [];
  const unresolvedParts: string[] = [];
  for (const pn of partNumbers) {
    const trimmed = pn.trim();
    if (!trimmed) continue;
    const part = await prisma.part.findFirst({
      where: {
        OR: [
          { partNumber: trimmed },
          { wagoIdent: trimmed },
        ],
      },
      select: { id: true },
    });
    if (part) partIds.push(part.id);
    else unresolvedParts.push(trimmed);
  }

  if (partIds.length > MAX_PARTS || seriesNames.length > MAX_SERIES) {
    throw new Error(`Maximum ${MAX_PARTS} parts and ${MAX_SERIES} series per item`);
  }

  const literature = await prisma.$transaction(async (tx) => {
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

  return { literature, unresolvedParts };
}

const literatureInclude = {
  parts: { include: { part: { select: { id: true, partNumber: true, series: true } } } },
  series: true,
  uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
};

export async function listLiterature(options?: {
  type?: PrismaLiteratureType;
  partId?: string;
  partNumber?: string;
  seriesName?: string;
  search?: string;
  keyword?: string;
  industryTag?: string;
  limit?: number;
  offset?: number;
}) {
  // Build where clause
  const andClauses: object[] = [];

  if (options?.type) {
    andClauses.push({ type: options.type });
  }

  if (options?.partId) {
    andClauses.push({ parts: { some: { partId: options.partId } } });
  }

  if (options?.partNumber) {
    const part = await prisma.part.findFirst({
      where: {
        OR: [
          { partNumber: options.partNumber },
          { wagoIdent: options.partNumber },
        ],
      },
      select: { id: true },
    });
    if (part) {
      andClauses.push({ parts: { some: { partId: part.id } } });
    } else {
      // No matching part → return empty
      return { items: [], total: 0 };
    }
  }

  if (options?.seriesName) {
    andClauses.push({ series: { some: { seriesName: { contains: options.seriesName, mode: 'insensitive' } } } });
  }

  if (options?.search) {
    andClauses.push({
      OR: [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { keywords: { has: options.search } },
      ],
    });
  }

  if (options?.keyword) {
    andClauses.push({ keywords: { hasSome: [options.keyword] } });
  }

  if (options?.industryTag) {
    andClauses.push({ industryTags: { hasSome: [options.industryTag] } });
  }

  const where = andClauses.length > 0 ? { AND: andClauses } : undefined;

  const [items, total] = await Promise.all([
    prisma.literature.findMany({
      where,
      include: literatureInclude,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.literature.count({ where }),
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
  const header = 'literature_id,title,type,part_numbers,series_names';
  const example = '00000000-0000-0000-0000-000000000000,Sample Title,FLYER,"221-2301,750-841","221 Series, 750 Series"';
  const note = '# part_numbers and series_names are comma-separated within the cell. Edit and upload via bulk-update-associations.';
  return [header, example, note].join('\n');
}

export function exportLiteratureCsv(literature: Awaited<ReturnType<typeof getAllLiteratureForExport>>): string {
  const rows = literature.map((lit) => {
    const partNums = lit.parts.map((p) => p.part.partNumber ?? p.partId).join('; ');
    const seriesNames = lit.series.map((s) => s.seriesName).join('; ');
    return {
      literature_id: lit.id,
      title: lit.title,
      type: lit.type,
      part_numbers: partNums,
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
  _userId: string
): Promise<{ updated: number; errors: string[] }> {
  const parsed = Papa.parse<{ literature_id: string; part_numbers?: string; series_names?: string }>(csvContent, {
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
    const partNumbersRaw = (row.part_numbers ?? '').toString().split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const seriesNames = (row.series_names ?? '')
      .toString()
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (partNumbersRaw.length === 0 && seriesNames.length === 0) {
      errors.push(`Row ${i + 2}: At least one part number or series required for ${literatureId}`);
      continue;
    }
    if (partNumbersRaw.length > MAX_PARTS || seriesNames.length > MAX_SERIES) {
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
      await updateAssociations(literatureId, partNumbersRaw, seriesNames);
      updated++;
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { updated, errors };
}

import { z } from 'zod';

/** CSV row from BOM upload (all fields optional strings; partNumber required for valid row) */
export const bomCsvRowSchema = z.object({
  manufacturer: z.string().optional(),
  partNumber: z.string().min(1, 'partNumber is required'),
  description: z.string().optional(),
  quantity: z.string().optional(),
  unitPrice: z.string().optional(),
}).strict();

export type BomCsvRow = z.infer<typeof bomCsvRowSchema>;

/** Normalized BOM row after parsing (for DB) */
export const bomRowParsedSchema = z.object({
  partNumber: z.string().min(1).max(200),
  manufacturer: z.string().max(200).nullable(),
  description: z.string().min(1).max(2000),
  quantity: z.number().int().min(1).max(999999),
  unitPrice: z.number().min(0).nullable(),
});

/** Body for POST /projects/:id/items (add item) */
export const addProjectItemSchema = z.object({
  partId: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  partNumber: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  quantity: z.number().int().min(1).max(999999).optional(),
  unitPrice: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).strict();

export type AddProjectItemInput = z.infer<typeof addProjectItemSchema>;

export function parseBomCsvRow(row: Record<string, unknown>): { partNumber: string; manufacturer: string | null; description: string; quantity: number; unitPrice: number | null } | null {
  const parsed = bomCsvRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const { partNumber, manufacturer, description, quantity, unitPrice } = parsed.data;
  const qty = quantity?.trim() ? parseInt(quantity, 10) : 1;
  const numQty = Number.isNaN(qty) || qty < 1 ? 1 : Math.min(qty, 999999);
  const numPrice = unitPrice?.trim() ? parseFloat(unitPrice) : null;
  const finalPrice = numPrice != null && !Number.isNaN(numPrice) && numPrice >= 0 ? numPrice : null;
  return {
    partNumber: partNumber.trim().slice(0, 200),
    manufacturer: manufacturer?.trim()?.slice(0, 200) ?? null,
    description: (description?.trim() || partNumber).slice(0, 2000),
    quantity: numQty,
    unitPrice: finalPrice,
  };
}

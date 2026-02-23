/**
 * Quote number parser for price contracts.
 * Parses a display string (e.g. T26Q5889, T26Q5889-A) into fields for grouping and storage.
 * Format: optional prefix (e.g. T), optional year digits (e.g. 26), core (e.g. Q5889), optional revision (e.g. -A).
 */

export interface QuoteFields {
  quoteCore: string | null;
  quoteYear: string | null;
  quotePrefix: string | null;
  quoteRevision: string | null;
}

/**
 * Parse a quote number string into Prisma-ready fields for PriceContract.
 * Examples:
 *   T26Q5889    -> prefix T, year 26, core Q5889, revision null
 *   T26Q5889-A  -> prefix T, year 26, core Q5889, revision A
 *   Q5889       -> core Q5889, others null
 */
export function quoteFieldsFromNumber(quoteNumber: string | null | undefined): QuoteFields {
  const result: QuoteFields = {
    quoteCore: null,
    quoteYear: null,
    quotePrefix: null,
    quoteRevision: null,
  };
  if (quoteNumber == null || typeof quoteNumber !== 'string') {
    return result;
  }
  const raw = quoteNumber.trim();
  if (!raw) return result;

  // Revision: suffix after last '-' (e.g. -A, -Rev2)
  const dashIdx = raw.lastIndexOf('-');
  let base = raw;
  if (dashIdx > 0) {
    result.quoteRevision = raw.slice(dashIdx + 1).trim() || null;
    base = raw.slice(0, dashIdx).trim();
  }
  if (!base) return result;

  // Optional leading prefix: single letter (e.g. T)
  let rest = base;
  if (/^[A-Za-z](?=[A-Za-z0-9])/.test(base)) {
    result.quotePrefix = base[0];
    rest = base.slice(1);
  }

  // Year: leading 2–4 digits (e.g. 26, 2026)
  const yearMatch = rest.match(/^(\d{2,4})/);
  if (yearMatch) {
    result.quoteYear = yearMatch[1];
    rest = rest.slice(yearMatch[1].length);
  }

  // Core: remainder (e.g. Q5889)
  const core = rest.trim();
  if (core) {
    result.quoteCore = core;
  }

  return result;
}

/**
 * Parse MOQ string to a numeric min quantity (e.g. "1" -> 1, "1-99" -> 1, "10+" -> 10).
 */
export function parseMoqToMinQuantity(moq: string | null | undefined): number {
  if (moq == null || typeof moq !== 'string') return 1;
  const trimmed = moq.trim();
  if (!trimmed) return 1;
  const match = trimmed.match(/\d+/);
  if (match) {
    const n = parseInt(match[0], 10);
    return Number.isNaN(n) || n < 1 ? 1 : Math.min(n, 999999);
  }
  return 1;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * Parse date string from PDF metadata to Date or null.
 * Handles: MM/DD/YYYY, MM-DD-YYYY, "February 23, 2026", "Feb 23, 2026", ISO.
 */
export function parseMetadataDate(value: string | null | undefined): Date | null {
  if (value == null || typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;

  // Text month: "February 23, 2026" or "Feb 23 2026"
  const textMatch = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (textMatch) {
    const monthIdx = MONTH_MAP[textMatch[1].toLowerCase()];
    if (monthIdx !== undefined) {
      const d = parseInt(textMatch[2], 10);
      let y = parseInt(textMatch[3], 10);
      if (y < 100) y += 2000;
      const date = new Date(y, monthIdx, d);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  // US style: MM/DD/YYYY or MM-DD-YYYY
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10) - 1;
    const d = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    if (!Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(y) && m >= 0 && m <= 11) {
      const date = new Date(y, m, d);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  // ISO fallback
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);

  return null;
}

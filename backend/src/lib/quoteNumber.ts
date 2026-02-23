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

/**
 * Parse date string from PDF metadata (e.g. MM/DD/YYYY, MM-DD-YYYY) to Date or null.
 */
export function parseMetadataDate(value: string | null | undefined): Date | null {
  if (value == null || typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  // ISO
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  // US style: MM/DD/YYYY or MM-DD-YYYY
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10) - 1;
    const d = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    if (!Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(y)) {
      const date = new Date(y, m, d);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

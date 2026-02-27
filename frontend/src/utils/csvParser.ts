/**
 * Shared CSV parser for import wizards.
 * Handles BOM, quoted fields, embedded commas and newlines.
 */

export const MAX_IMPORT_ROWS = 25_000;

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
  if (!text.trim()) return { headers: [], rows: [] };
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.replace(/[\r\n]+/g, ' ').trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.replace(/[\r\n]+/g, ' ').trim());
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.replace(/[\r\n]+/g, ' ').trim());
    if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows.slice(0, MAX_IMPORT_ROWS) };
}

/** Build a CSV string from an array of objects (for sending mapped data as file). */
export function buildCSVFromRows(
  rows: Record<string, string | number | boolean | null>[],
  columnOrder: string[]
): string {
  const escape = (v: string | number | boolean | null | undefined): string => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const headerLine = columnOrder.map((c) => escape(c)).join(',');
  const dataLines = rows.map((row) =>
    columnOrder.map((col) => escape(row[col])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

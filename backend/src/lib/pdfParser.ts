import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface ParsedRow {
  partNumber: string;
  series: string;
  description: string;
  price: string;
  discount: string;
}

export interface ParseResult {
  success: boolean;
  rows: ParsedRow[];
  unparsedRows: string[]; // Rows that couldn't be parsed
  errors: string[];
  metadata?: {
    quoteNumber?: string;
    totalRows?: number;
    parsedRows?: number;
  };
}

/**
 * Parse a WAGO quote PDF using the Python parser tool.
 * Returns parsed rows and any unparsed/error rows for user review.
 */
export async function parseWagoPDF(pdfPath: string): Promise<ParseResult> {
  const result: ParseResult = {
    success: false,
    rows: [],
    unparsedRows: [],
    errors: [],
  };

  try {
    // Path to Python parser script
    const scriptPath = path.join(__dirname, '../../../tools/wago-pdf-parser/parse_wago_quote_pdf.py');
    const outputDir = path.dirname(pdfPath);

    // Check if Python and dependencies are available
    try {
      await execAsync('python --version');
    } catch {
      result.errors.push('Python not found. Install Python 3.8+ and dependencies (pip install -r requirements.txt)');
      return result;
    }

    // Run Python parser
    const { stdout, stderr } = await execAsync(
      `python "${scriptPath}" "${pdfPath}" "${outputDir}"`,
      { timeout: 30000 } // 30 second timeout
    );

    if (stderr && !stderr.includes('Rows:')) {
      result.errors.push(`Parser warning: ${stderr}`);
    }

    // Extract quote number and row count from stdout
    const quoteMatch = stdout.match(/Quote Number: (.+)/);
    const rowsMatch = stdout.match(/Rows: (\d+)/);
    const savedMatch = stdout.match(/Saved: (.+)/);

    if (!savedMatch) {
      result.errors.push('Parser did not generate CSV output');
      return result;
    }

    const csvPath = savedMatch[1].trim();

    // Read generated CSV
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      result.errors.push('CSV is empty or has no data rows');
      return result;
    }

    // Parse CSV (skip header)
    const header = lines[0].split(',');
    const rows: ParsedRow[] = [];
    const unparsed: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Simple CSV parse (handles quoted fields)
        const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        const cleaned = cols.map(c => c.replace(/^"|"$/g, '').trim());

        if (cleaned.length < 5) {
          unparsed.push(`Row ${i}: Incomplete data - ${line}`);
          continue;
        }

        const [partNumber, series, description, price, discount] = cleaned;

        // Skip rows with invalid data (e.g. "Failure" in price)
        if (price && (price.toLowerCase().includes('failure') || price.toLowerCase().includes('error'))) {
          unparsed.push(`Row ${i}: Invalid price - ${line}`);
          continue;
        }

        rows.push({
          partNumber: partNumber || '',
          series: series || '',
          description: description || '',
          price: price || '',
          discount: discount || '',
        });
      } catch (err) {
        unparsed.push(`Row ${i}: Parse error - ${line}`);
      }
    }

    // Clean up CSV file
    try {
      await fs.unlink(csvPath);
    } catch {
      // Ignore cleanup errors
    }

    result.success = rows.length > 0;
    result.rows = rows;
    result.unparsedRows = unparsed;
    result.metadata = {
      quoteNumber: quoteMatch ? quoteMatch[1].trim() : undefined,
      totalRows: lines.length - 1,
      parsedRows: rows.length,
    };

    return result;
  } catch (error: any) {
    result.errors.push(error.message || 'Unknown error during PDF parsing');
    return result;
  }
}

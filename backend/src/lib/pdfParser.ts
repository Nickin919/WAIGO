/**
 * WAGO Quote PDF Parser - TypeScript Implementation
 * 
 * Robust PDF parsing for WAGO pricing quote documents.
 * Handles multi-page tables, varying layouts, and edge cases.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';

// ============================================================================
// Types
// ============================================================================

export interface ParsedRow {
  partNumber: string;
  series: string;
  description: string;
  price: string;
  discount: string;
  moq: string;           // Minimum order quantity
  netPrice: string;      // Price after series discount applied
  lineNumber: number;    // Original line for debugging
}

export interface SeriesDiscount {
  series: string;
  discountPercent: number;
  description: string;
}

export interface QuoteMetadata {
  quoteNumber?: string;
  quoteDate?: string;
  expirationDate?: string;
  customerName?: string;
  customerNumber?: string;
}

export interface ValidationWarning {
  type: 'duplicate_part' | 'missing_price' | 'anomalous_price' | 'missing_discount' | 'parse_issue';
  message: string;
  lineNumber?: number;
  partNumber?: string;
}

export interface ParseResult {
  success: boolean;
  rows: ParsedRow[];
  seriesDiscounts: SeriesDiscount[];
  unparsedRows: string[];
  errors: string[];
  warnings: ValidationWarning[];
  metadata: QuoteMetadata;
  stats: {
    totalLinesProcessed: number;
    productRows: number;
    discountRows: number;
    skippedRows: number;
  };
  /** Debug info for live-app troubleshooting (included in upload API response) */
  parseDebug?: {
    rawTextLength: number;
    linesCount: number;
    usedPages: boolean;
    last200Chars: string;
    last3ProductPartNumbers: string[];
  };
}

// ============================================================================
// Constants & Patterns
// ============================================================================

// Series prefix mapping for auto-applying discounts
const SERIES_PREFIXES: Record<string, string[]> = {
  '206': ['206-'],
  '209': ['209-'],
  '210': ['210-'],
  '218': ['218-'],
  '221': ['221-'],
  '222': ['222-'],
  '224': ['224-'],
  '231': ['231-'],
  '232': ['232-'],
  '233': ['233-'],
  '234': ['234-'],
  '235': ['235-'],
  '236': ['236-'],
  '243': ['243-'],
  '249': ['249-'],
  '250': ['250-'],
  '251': ['251-'],
  '252': ['252-'],
  '254': ['254-'],
  '255': ['255-'],
  '256': ['256-'],
  '257': ['257-'],
  '258': ['258-'],
  '260': ['260-'],
  '261': ['261-'],
  '264': ['264-'],
  '268': ['268-'],
  '269': ['269-'],
  '270': ['270-'],
  '272': ['272-'],
  '279': ['279-'],
  '280': ['280-'],
  '281': ['281-'],
  '282': ['282-'],
  '283': ['283-'],
  '284': ['284-'],
  '285': ['285-'],
  '286': ['286-'],
  '289': ['289-'],
  '290': ['290-'],
  '291': ['291-'],
  '292': ['292-'],
  '294': ['294-'],
  '727': ['727-'],
  '733': ['733-', '734-'],
  '734': ['733-', '734-'],
  '750': ['750-'],
  '753': ['753-'],
  '756': ['756-'],
  '757': ['757-'],
  '759': ['759-'],
  '760': ['760-'],
  '761': ['761-'],
  '762': ['762-'],
  '763': ['763-'],
  '767': ['767-'],
  '768': ['768-'],
  '769': ['769-'],
  '770': ['770-'],
  '771': ['771-'],
  '773': ['773-'],
  '777': ['777-'],
  '778': ['778-'],
  '779': ['779-'],
  '787': ['787-'],
  '788': ['788-'],
  '789': ['789-'],
  '793': ['793-'],
  '857': ['857-'],
  '858': ['858-'],
  '859': ['859-'],
  '879': ['879-'],
  '880': ['880-'],
  '881': ['881-'],
  '898': ['898-'],
  '899': ['899-'],
  '2000': ['2000-'],
  '2001': ['2001-'],
  '2002': ['2002-'],
  '2003': ['2003-'],
  '2004': ['2004-'],
  '2005': ['2005-'],
  '2006': ['2006-'],
  '2007': ['2007-'],
  '2009': ['2009-'],
  '2016': ['2016-'],
  '2020': ['2020-'],
  '2022': ['2022-'],
  '2054': ['2054-'],
  '2057': ['2057-'],
  '2059': ['2059-'],
  '2060': ['2060-'],
  '2065': ['2065-'],
  '2070': ['2070-'],
  '2086': ['2086-'],
  '2087': ['2087-'],
  '2091': ['2091-'],
  '2092': ['2092-'],
  '2093': ['2093-'],
  '2094': ['2094-'],
  '2095': ['2095-'],
  '2096': ['2096-'],
  '2097': ['2097-'],
  '2098': ['2098-'],
  '2099': ['2099-'],
  '2100': ['2100-'],
  '2101': ['2101-'],
  '2102': ['2102-'],
  '2103': ['2103-'],
  '2104': ['2104-'],
  '2105': ['2105-'],
  '2106': ['2106-'],
  '2107': ['2107-'],
  '2108': ['2108-'],
  '2109': ['2109-'],
  '2110': ['2110-'],
  '2111': ['2111-'],
  '2112': ['2112-'],
  '2113': ['2113-'],
  '2114': ['2114-'],
  '2115': ['2115-'],
  '2116': ['2116-'],
  '2117': ['2117-'],
  '2118': ['2118-'],
  '2119': ['2119-'],
  '2120': ['2120-'],
  '2121': ['2121-'],
  '2122': ['2122-'],
  '2123': ['2123-'],
  '2124': ['2124-'],
  '2125': ['2125-'],
  '2126': ['2126-'],
  '2127': ['2127-'],
  '2128': ['2128-'],
  '2129': ['2129-'],
  '2130': ['2130-'],
  '2131': ['2131-'],
  '2132': ['2132-'],
  '2133': ['2133-'],
  '2134': ['2134-'],
  '2135': ['2135-'],
  '2136': ['2136-'],
  '2137': ['2137-'],
  '2138': ['2138-'],
  '2139': ['2139-'],
  '2140': ['2140-'],
};

// Regex patterns
const PATTERNS = {
  // Quote metadata — patterns ordered from most specific to least to avoid partial matches
  quoteNumber: /(?:quotation|quote)\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9][-A-Z0-9]*)/i,
  quoteNumberAlt: /(?:quotation|quote)\s*:?\s*([A-Z]\d{1,2}[A-Z]\d{3,}(?:-[A-Z0-9]+)?)/i,
  quoteDate: /(?:quote\s*)?date\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  quoteDateTextMonth: /(?:quote\s*)?date\s*:?\s*((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{2,4})/i,
  expirationDate: /(?:exp(?:ires?|iration)?(?:\s*date)?|valid\s*(?:until|through|thru|to)|good\s*(?:until|through|thru)|price\s*valid(?:ity)?(?:\s*(?:until|through|thru))?)\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  expirationDateTextMonth: /(?:exp(?:ires?|iration)?(?:\s*date)?|valid\s*(?:until|through|thru|to)|good\s*(?:until|through|thru))\s*:?\s*((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{2,4})/i,
  customerName: /(?:customer|company|ship\s*to|sold\s*to)\s*:?\s*([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\n|$)/i,
  customerNumber: /(?:customer\s*(?:#|no|num(?:ber)?)|acct)\s*:?\s*([A-Z0-9\-]+)/i,

  // Part number patterns (WAGO format: 3-4 digits, dash, more digits, optional suffix)
  partNumber: /^(\d{3,4}-\d{1,5}(?:[-\/][A-Z0-9]+)*)$/i,
  partNumberLoose: /(\d{3,4}-\d{1,5}(?:[-\/][A-Z0-9]+)*)/i,

  // Price patterns (strict requires .XX; loose accepts .X or .XX)
  price: /\$?\s*([\d,]+\.?\d*)/,
  priceStrict: /^\$?\s*([\d,]+\.?\d*)$/,
  priceInLine: /\$\s*[\d,]+\.?\d*/,

  // Series discount patterns
  seriesDiscount: /(\d{3,4})\s*Series.*?([\d.]+)\s*%/i,
  seriesDiscountAlt: /Series\s*(\d{3,4}).*?([\d.]+)\s*%/i,
  discountPercent: /([\d.]+)\s*%/,

  // MOQ patterns
  moq: /(?:MOQ|min(?:imum)?\s*(?:order)?\s*(?:qty|quantity)?|order\s*(\d+)[-–](\d+))\s*:?\s*(\d+)/i,
  moqInline: /\((?:Order\s*)?(\d+)[-–](\d+)\)/i,
  moqMinimum: /minimum\s*(?:order\s*)?(?:qty|quantity)?\s*(?:of)?\s*:?\s*(\d+)/i,

  // Header detection (to skip)
  tableHeader: /^(?:wago\s*)?part\s*(?:#|no|num)/i,
  tableHeaderAlt: /^(?:item|description|price|qty)/i,

  // Internal/alternate part numbers (to skip)
  internalPart: /^\d{8,}$/,  // 8+ digit internal codes
  
  // False positives to skip (phone numbers, zip codes in addresses, etc.)
  falsePositive: /\d{3,4}-\d{3,4}-\d{4}|N\d+\s*W\d+|PO Box|Corporation|Telephone|Fax/i,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize text by replacing various line break formats
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n');
}

/**
 * Clean and normalize a cell value
 */
function cleanCell(value: string): string {
  return value
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract price value from string, returns null if invalid
 */
function extractPrice(text: string): number | null {
  const match = text.match(PATTERNS.price);
  if (!match) return null;
  
  const value = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(value) || value <= 0) return null;
  
  return value;
}

/**
 * Format price as string with $ prefix
 */
function formatPrice(value: number | null): string {
  if (value === null) return '';
  return `$${value.toFixed(2)}`;
}

/**
 * Extract MOQ from description text
 */
function extractMOQ(text: string): string {
  // Try inline format: (Order 1-99)
  let match = text.match(PATTERNS.moqInline);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  // Try minimum order format
  match = text.match(PATTERNS.moqMinimum);
  if (match) {
    return match[1];
  }

  // Try general MOQ format
  match = text.match(PATTERNS.moq);
  if (match) {
    return match[3] || match[1] || '';
  }

  return '';
}

/**
 * Determine series from part number
 */
function getSeriesFromPart(partNumber: string): string {
  // Extract the prefix (first 3-4 digits before dash)
  const match = partNumber.match(/^(\d{3,4})-/);
  if (!match) return '';
  
  const prefix = match[1];
  
  // Check if this prefix maps to a known series
  for (const [series, prefixes] of Object.entries(SERIES_PREFIXES)) {
    if (prefixes.some(p => partNumber.startsWith(p))) {
      return series;
    }
  }
  
  return prefix;
}

/**
 * Calculate net price after applying series discount
 */
function calculateNetPrice(
  price: number | null,
  partNumber: string,
  seriesDiscounts: Map<string, number>
): number | null {
  if (price === null) return null;
  
  const series = getSeriesFromPart(partNumber);
  if (!series) return price;
  
  const discountPercent = seriesDiscounts.get(series);
  if (!discountPercent) return price;
  
  return price * (1 - discountPercent / 100);
}

/**
 * Check if a line is a table header (should be skipped)
 */
function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    PATTERNS.tableHeader.test(line) ||
    PATTERNS.tableHeaderAlt.test(line) ||
    lower.includes('wago part') ||
    lower.includes('description') && lower.includes('price') ||
    lower.includes('item') && lower.includes('qty')
  );
}

/**
 * Check if a part number is an internal/alternate code (should be skipped)
 */
function isInternalPartNumber(partNumber: string): boolean {
  return PATTERNS.internalPart.test(partNumber.trim());
}

// ============================================================================
// Metadata Extraction
// ============================================================================

function extractMetadata(text: string): QuoteMetadata {
  const metadata: QuoteMetadata = {};
  
  const headerText = text.substring(0, 4000);
  
  // Quote number (try specific format first, then alternate)
  let match = headerText.match(PATTERNS.quoteNumber);
  if (!match) match = headerText.match(PATTERNS.quoteNumberAlt);
  if (match) {
    metadata.quoteNumber = match[1].trim();
  }
  
  // Quote date (try numeric first, then text month)
  match = headerText.match(PATTERNS.quoteDate);
  if (!match) match = headerText.match(PATTERNS.quoteDateTextMonth);
  if (match) {
    metadata.quoteDate = match[1].trim();
  }
  
  // Expiration date (try numeric first, then text month)
  match = headerText.match(PATTERNS.expirationDate);
  if (!match) match = headerText.match(PATTERNS.expirationDateTextMonth);
  if (match) {
    metadata.expirationDate = match[1].trim();
  }
  
  // Customer name
  match = headerText.match(PATTERNS.customerName);
  if (match) {
    metadata.customerName = match[1].trim();
  }
  
  // Customer number
  match = headerText.match(PATTERNS.customerNumber);
  if (match) {
    metadata.customerNumber = match[1].trim();
  }

  return metadata;
}

// ============================================================================
// Line Parsing
// ============================================================================

interface ParsedLine {
  type: 'product' | 'discount' | 'skip';
  partNumber?: string;
  series?: string;
  description?: string;
  price?: number;
  discountPercent?: number;
  moq?: string;
  reason?: string;
}

/**
 * Parse a single line from the PDF text (single-line mode: part, desc, price on one line)
 */
function parseLine(line: string, lineNumber: number): ParsedLine {
  const trimmed = line.trim();
  
  // Skip empty lines
  if (!trimmed) {
    return { type: 'skip', reason: 'empty' };
  }
  
  // Skip header lines
  if (isHeaderLine(trimmed)) {
    return { type: 'skip', reason: 'header' };
  }
  
  // Check for series discount line
  let discountMatch = trimmed.match(PATTERNS.seriesDiscount) || trimmed.match(PATTERNS.seriesDiscountAlt);
  if (discountMatch || (trimmed.toLowerCase().includes('series') && trimmed.includes('%'))) {
    const seriesMatch = trimmed.match(/(\d{3,4})\s*Series/i) || trimmed.match(/Series\s*(\d{3,4})/i);
    const percentMatch = trimmed.match(PATTERNS.discountPercent);
    
    if (seriesMatch && percentMatch) {
      return {
        type: 'discount',
        series: seriesMatch[1],
        discountPercent: parseFloat(percentMatch[1]),
        description: trimmed.split('Discount')[0].replace(/\d{3,4}\s*Series/i, '').trim(),
      };
    }
  }
  
  // Try single-line: price and part number on same line (WAGO format: "$5.0441	207-1331")
  // Or: part number and price on same line with description between
  const partMatch = trimmed.match(PATTERNS.partNumberLoose);
  const priceMatch = trimmed.match(PATTERNS.price);
  if (partMatch && priceMatch) {
    const partNumber = partMatch[1];
    const priceVal = extractPrice(priceMatch[0]);
    // Skip false positives (phone numbers, addresses, etc.)
    if (PATTERNS.falsePositive.test(trimmed)) {
      return { type: 'skip', reason: 'false_positive' };
    }
    if (!isInternalPartNumber(partNumber) && priceVal !== null && priceVal > 0) {
      let desc = trimmed
        .replace(partMatch[0], '')
        .replace(priceMatch[0], '')
        .replace(/\s+/g, ' ')
        .trim();
      const moq = extractMOQ(desc);
      desc = desc.replace(PATTERNS.moqInline, '').replace(PATTERNS.moqMinimum, '').replace(/\s+/g, ' ').trim();
      return { type: 'product', partNumber, description: desc, price: priceVal, moq };
    }
  }
  
  // Try to parse as product line: split by tabs, 2+ spaces, or |
  const parts = trimmed.split(/\t+|\s{2,}|\|/).map(p => p.trim()).filter(p => p);
  
  if (parts.length < 2) {
    return { type: 'skip', reason: 'insufficient_columns' };
  }
  
  let partNumber = '';
  let description = '';
  let price: number | null = null;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (!partNumber && PATTERNS.partNumber.test(part)) {
      partNumber = part.replace(/\n/g, '/');
      continue;
    }
    
    if (!price && PATTERNS.priceStrict.test(part)) {
      price = extractPrice(part);
      continue;
    }
    
    if (!price && parts.length - i <= 2) {
      const extracted = extractPrice(part);
      if (extracted !== null) {
        price = extracted;
        continue;
      }
    }
    
    if (description) {
      description += '; ' + part;
    } else {
      description = part;
    }
  }
  
  if (!partNumber && description) {
    const partMatchDesc = description.match(PATTERNS.partNumberLoose);
    if (partMatchDesc) {
      partNumber = partMatchDesc[1];
      description = description.replace(partMatchDesc[0], '').trim();
    }
  }
  
  if (!partNumber) {
    return { type: 'skip', reason: 'no_part_number' };
  }
  
  if (isInternalPartNumber(partNumber)) {
    return { type: 'skip', reason: 'internal_part' };
  }
  
  if (price === null) {
    return { type: 'skip', reason: 'no_price' };
  }
  
  const moq = extractMOQ(description);
  let cleanDesc = description
    .replace(PATTERNS.moqInline, '')
    .replace(PATTERNS.moqMinimum, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    type: 'product',
    partNumber,
    description: cleanDesc,
    price,
    moq,
  };
}

/**
 * Fallback: parse WAGO quote format where lines are like:
 *   "$5.0441	207-1331"  (price + part number on same line)
 *   "60493338"            (internal number - skip)
 *   "Gelbox for 221..."   (description on following lines)
 * 
 * Used when single-line parsing finds no product rows.
 */
function parseBlocksFallback(
  lines: string[],
  result: ParseResult,
  seriesDiscountMap: Map<string, number>
): void {
  const seenPartNumbers = new Set<string>();
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    i++;
    
    if (!trimmed) continue;
    if (isHeaderLine(trimmed)) continue;
    if (trimmed.toLowerCase().includes('series') && trimmed.includes('%')) continue;
    
    // Look for WAGO format: "$price  partNumber" or "partNumber  $price" on same line
    const partMatch = trimmed.match(PATTERNS.partNumberLoose);
    const priceMatch = trimmed.match(PATTERNS.price);
    
    if (!partMatch || !priceMatch) continue;
    
    const partNumber = partMatch[1];
    const price = extractPrice(priceMatch[0]);
    
    if (!partNumber || isInternalPartNumber(partNumber)) continue;
    // Skip false positives (phone numbers, addresses with WAGO Corporation, etc.)
    if (PATTERNS.falsePositive.test(trimmed)) continue;
    if (price === null || price <= 0) continue;
    if (seenPartNumbers.has(partNumber)) continue;
    
    // Get description from text after price+part on same line
    let desc = trimmed
      .replace(partMatch[0], '')
      .replace(priceMatch[0], '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Collect additional description lines until we hit another price+part line or header
    while (i < lines.length) {
      const nextLine = lines[i];
      const nextTrimmed = nextLine.trim();
      
      if (!nextTrimmed) {
        i++;
        continue;
      }
      
      // Stop if we see another price+part combo (next product)
      const nextPartMatch = nextTrimmed.match(PATTERNS.partNumberLoose);
      const nextPriceMatch = nextTrimmed.match(PATTERNS.price);
      if (nextPartMatch && nextPriceMatch) break;
      
      // Stop at headers or page markers
      if (isHeaderLine(nextTrimmed)) break;
      if (nextTrimmed.startsWith('--') && nextTrimmed.endsWith('--')) break;
      if (nextTrimmed.includes('WAGO Corporation')) break;
      
      // Skip internal part numbers (8+ digits)
      if (PATTERNS.internalPart.test(nextTrimmed)) {
        i++;
        continue;
      }
      
      // Append to description
      desc = desc ? desc + ' ' + nextTrimmed : nextTrimmed;
      i++;
    }
    
    seenPartNumbers.add(partNumber);
    const moq = extractMOQ(desc);
    let cleanDesc = desc.replace(PATTERNS.moqInline, '').replace(PATTERNS.moqMinimum, '').replace(/\s+/g, ' ').trim();
    const series = getSeriesFromPart(partNumber);
    const netPrice = calculateNetPrice(price, partNumber, seriesDiscountMap);
    
    result.rows.push({
      partNumber,
      series,
      description: cleanDesc,
      price: formatPrice(price),
      discount: series && seriesDiscountMap.has(series) ? `${seriesDiscountMap.get(series)}%` : '',
      moq,
      netPrice: formatPrice(netPrice),
      lineNumber: i,
    });
    result.stats.productRows++;
  }
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a WAGO quote PDF file
 */
export async function parseWagoPDF(pdfPath: string): Promise<ParseResult> {
  const result: ParseResult = {
    success: false,
    rows: [],
    seriesDiscounts: [],
    unparsedRows: [],
    errors: [],
    warnings: [],
    metadata: {},
    stats: {
      totalLinesProcessed: 0,
      productRows: 0,
      discountRows: 0,
      skippedRows: 0,
    },
  };
  
  try {
    // Read PDF file and parse using pdf-parse v2 API
    const dataBuffer = await fs.readFile(pdfPath);
    
    let pdfData: { text: string; pages?: Array<{ text: string }> };
    try {
      const parser = new PDFParse({ data: dataBuffer });
      pdfData = await parser.getText();
    } catch (parseErr: any) {
      result.errors.push(`pdf-parse error: ${parseErr.message}`);
      return result;
    }

    // Prefer per-page text when available to avoid last-page truncation (pdf-parse sometimes omits end of doc from .text)
    let textSource: string;
    if (pdfData.pages && pdfData.pages.length > 0) {
      textSource = pdfData.pages.map(p => (p && p.text) ? p.text : '').join('\n');
    } else {
      textSource = pdfData.text || '';
    }
    if (!textSource.trim()) {
      result.errors.push('PDF contains no extractable text (may be scanned/image-based)');
      return result;
    }

    // Normalize text
    const text = normalizeText(textSource);
    
    // Extract metadata from first pages
    result.metadata = extractMetadata(text);
    
    // Split into lines
    const lines = text.split('\n');
    result.stats.totalLinesProcessed = lines.length;
    
    // First pass: collect series discounts
    const seriesDiscountMap = new Map<string, number>();
    
    for (let i = 0; i < lines.length; i++) {
      const parsed = parseLine(lines[i], i + 1);
      
      if (parsed.type === 'discount' && parsed.series && parsed.discountPercent) {
        seriesDiscountMap.set(parsed.series, parsed.discountPercent);
        
        result.seriesDiscounts.push({
          series: parsed.series,
          discountPercent: parsed.discountPercent,
          description: parsed.description || '',
        });
        
        result.stats.discountRows++;
      }
    }
    
    // Second pass: parse product lines
    const seenPartNumbers = new Set<string>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const parsed = parseLine(line, lineNum);
      // When line has part number but was skipped (no_price or part-only), check next line(s) for description/price (common at end of PDF)
      let effectiveParsed: ParsedLine = parsed;
      const skipReason = (parsed as any).reason;
      if (parsed.type === 'skip' && (skipReason === 'no_price' || skipReason === 'insufficient_columns')) {
        const trimmed = line.trim();
        const partMatch = trimmed.match(PATTERNS.partNumberLoose);
        if (partMatch && !isInternalPartNumber(partMatch[1]) && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const priceOnNext = nextLine ? extractPrice(nextLine) : null;
          const nextIsPriceOnly = priceOnNext !== null && nextLine.length < 30 && /^[\s$,\d.]+$/.test(nextLine.replace(/\s/g, ''));
          let desc = trimmed.replace(partMatch[0], '').replace(/\s+/g, ' ').trim();
          let priceVal = priceOnNext;
          let consumed = 0;
          if (priceOnNext !== null && priceOnNext > 0 && (nextIsPriceOnly || skipReason === 'no_price')) {
            if (skipReason === 'insufficient_columns' && !desc && nextLine && !nextIsPriceOnly) desc = nextLine;
            consumed = 1;
          } else if (skipReason === 'insufficient_columns' && nextLine && !nextIsPriceOnly && i + 2 < lines.length) {
            const lineAfter = lines[i + 2].trim();
            const priceAfter = lineAfter ? extractPrice(lineAfter) : null;
            if (priceAfter !== null && priceAfter > 0) {
              desc = nextLine;
              priceVal = priceAfter;
              consumed = 2;
            }
          }
          if (consumed > 0 && priceVal !== null && priceVal > 0) {
            const moq = extractMOQ(desc);
            desc = desc.replace(PATTERNS.moqInline, '').replace(PATTERNS.moqMinimum, '').replace(/\s+/g, ' ').trim();
            effectiveParsed = { type: 'product', partNumber: partMatch[1], description: desc, price: priceVal, moq };
            i += consumed;
          }
        }
      }
      if (effectiveParsed.type === 'product' && effectiveParsed.partNumber) {
        const parsed = effectiveParsed;
        const partNumber = parsed.partNumber as string;
        // Check for duplicates
        if (seenPartNumbers.has(partNumber)) {
          result.warnings.push({
            type: 'duplicate_part',
            message: `Duplicate part number found`,
            lineNumber: lineNum,
            partNumber,
          });
        }
        seenPartNumbers.add(partNumber);
        
        // Calculate net price
        const netPrice = calculateNetPrice(
          parsed.price ?? null,
          partNumber,
          seriesDiscountMap
        );
        
        // Determine series
        const series = getSeriesFromPart(partNumber);
        
        // Check if discount should apply but doesn't
        if (series && seriesDiscountMap.has(series) && netPrice === parsed.price) {
          result.warnings.push({
            type: 'missing_discount',
            message: `Part has series ${series} but discount not applied`,
            lineNumber: lineNum,
            partNumber,
          });
        }
        
        // Anomalous price check (too low or too high)
        if (parsed.price !== undefined) {
          if (parsed.price < 0.01) {
            result.warnings.push({
              type: 'anomalous_price',
              message: `Price is unusually low: $${parsed.price}`,
              lineNumber: lineNum,
              partNumber,
            });
          } else if (parsed.price > 50000) {
            result.warnings.push({
              type: 'anomalous_price',
              message: `Price is unusually high: $${parsed.price}`,
              lineNumber: lineNum,
              partNumber,
            });
          }
        }
        
        result.rows.push({
          partNumber,
          series,
          description: parsed.description || '',
          price: formatPrice(parsed.price ?? null),
          discount: series && seriesDiscountMap.has(series) 
            ? `${seriesDiscountMap.get(series)}%` 
            : '',
          moq: parsed.moq || '',
          netPrice: formatPrice(netPrice),
          lineNumber: lineNum,
        });
        
        result.stats.productRows++;
      } else if (effectiveParsed.type === 'skip') {
        // Only track significant skips
        if (effectiveParsed.reason !== 'empty' && effectiveParsed.reason !== 'header') {
          const trimmed = line.trim();
          if (trimmed.length > 5 && trimmed.length < 500) {
            result.unparsedRows.push(`Line ${lineNum} (${effectiveParsed.reason}): ${trimmed.substring(0, 100)}${trimmed.length > 100 ? '...' : ''}`);
          }
        }
        result.stats.skippedRows++;
      }
    }
    
    // Fallback: if no product rows from line-by-line parsing, try multi-line blocks (part, then desc lines, then price)
    if (result.stats.productRows === 0 && lines.length > 0) {
      parseBlocksFallback(lines, result, seriesDiscountMap);
    }

    const productRowsOnly = result.rows.filter(r => r.partNumber);

    result.parseDebug = {
      rawTextLength: textSource.length,
      linesCount: lines.length,
      usedPages: !!(pdfData.pages && pdfData.pages.length),
      last200Chars: textSource.slice(-200),
      last3ProductPartNumbers: productRowsOnly.slice(-3).map(r => r.partNumber),
    };

    // Add series discount rows to output
    for (const discount of result.seriesDiscounts) {
      result.rows.push({
        partNumber: '',
        series: discount.series,
        description: discount.description,
        price: '',
        discount: `${discount.discountPercent}%`,
        moq: '',
        netPrice: '',
        lineNumber: 0,
      });
    }
    
    result.success = result.rows.length > 0;
    
    // Final validation
    if (result.rows.length === 0) {
      result.errors.push('No valid product rows found in PDF');
    }
    
    if (result.seriesDiscounts.length === 0) {
      result.warnings.push({
        type: 'parse_issue',
        message: 'No series discounts found - prices may be list prices',
      });
    }
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      result.errors.push(`PDF file not found: ${pdfPath}`);
    } else if (error.message?.includes('Invalid PDF')) {
      result.errors.push('Invalid or corrupted PDF file');
    } else {
      result.errors.push(`Parse error: ${error.message || 'Unknown error'}`);
    }
  }
  
  return result;
}

// ============================================================================
// CSV Export (for testing/debugging)
// ============================================================================

export function toCSV(result: ParseResult): string {
  const headers = ['Part Number', 'Series', 'Description', 'Price', 'Discount', 'MOQ', 'Net Price'];
  const rows = result.rows.map(r => [
    r.partNumber,
    r.series,
    `"${r.description.replace(/"/g, '""')}"`,
    r.price,
    r.discount,
    r.moq,
    r.netPrice,
  ].join(','));
  
  return [headers.join(','), ...rows].join('\n');
}

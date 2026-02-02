/**
 * Test script to see what pdf-parse extracts from the sample PDF
 * Run with: npx tsx test-pdf-parse.ts
 */

import * as path from 'path';
import { parseWagoPDF } from './src/lib/pdfParser';

async function testPdfParse() {
  const pdfPath = path.resolve(__dirname, '../SampleData/INIT Sample PDF Price Contract.pdf');
  
  console.log('Testing parseWagoPDF with:', pdfPath);
  
  try {
    const result = await parseWagoPDF(pdfPath);
    
    console.log('\n=== PARSE RESULT ===');
    console.log('Success:', result.success);
    console.log('Product rows:', result.stats.productRows);
    console.log('Discount rows:', result.stats.discountRows);
    console.log('Skipped rows:', result.stats.skippedRows);
    console.log('Total lines processed:', result.stats.totalLinesProcessed);
    console.log('Errors:', result.errors);
    console.log('Warnings:', result.warnings.length);
    console.log('Unparsed rows:', result.unparsedRows.length);
    
    console.log('\n=== METADATA ===');
    console.log(result.metadata);
    
    console.log('\n=== SERIES DISCOUNTS ===');
    console.log(result.seriesDiscounts);
    
    console.log('\n=== FIRST 10 ROWS ===');
    for (const row of result.rows.slice(0, 10)) {
      console.log(`  ${row.partNumber || 'Series ' + row.series}: ${row.price} ${row.description.substring(0, 50)}...`);
    }
    
    if (result.unparsedRows.length > 0) {
      console.log('\n=== FIRST 10 UNPARSED ===');
      for (const row of result.unparsedRows.slice(0, 10)) {
        console.log(`  ${row}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPdfParse();

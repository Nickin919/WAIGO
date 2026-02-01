/**
 * One-off script to inspect Excel file structure (sheet names, dimensions, first rows).
 * Run: npx tsx scripts/inspect-excel.ts <path-to-xlsx>
 */
import ExcelJS from 'exceljs';
import path from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/inspect-excel.ts <path-to-xlsx>');
  process.exit(1);
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  console.log('File:', path.basename(filePath));
  console.log('Sheets:', workbook.worksheets.map((s) => s.name).join(', '));
  console.log('');

  for (const sheet of workbook.worksheets) {
    console.log('--- Sheet:', sheet.name, '---');
    const rowCount = sheet.rowCount ?? 0;
    const colCount = sheet.columnCount ?? 0;
    console.log('Rows:', rowCount, 'Columns:', colCount);
    // First 12 rows, first 25 columns
    for (let r = 1; r <= Math.min(12, rowCount || 12); r++) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= Math.min(25, colCount || 25); c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        let str: string;
        if (v === null || v === undefined) str = '';
        else if (typeof v === 'object' && 'result' in (v as any)) str = String((v as any).result);
        else str = String(v);
        if (str.length > 15) str = str.slice(0, 12) + '…';
        cells.push(str);
      }
      console.log('R' + r + ':', cells.join(' | '));
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

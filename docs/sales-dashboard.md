# Sales Dashboard

Sales analytics dashboard for RSM and Admin users. Data is imported from Excel (.xlsx) files in two formats: **Direct sales** (12 months per file) and **POS sales** (one month per file; user selects the month).

## Access

- **RSM**: View and upload their own sales data
- **Admin**: View all RSMs' data or select a specific RSM; upload on behalf of an RSM

## Excel formats

### 1. Direct sales (12 months + total)

- **Sheet name**: `ZANALYSIS_PATTERN (8)` or first sheet if not found
- **Data starts at row 7**
- **Columns**:
  - D (4): Sold-to party (customer code)
  - E (5): Customer name
  - F–Q (6–17): Jan–Dec sales amounts
  - R (18): **Ignored** (Total column)
- Empty cells and negative values are treated as 0

### 2. POS sales (one month from distributors)

- **Sheet name**: `ZANALYSIS_PATTERN (7)` or first sheet if not found
- **Data starts at row 6**
- **Columns**:
  - A (1): Sales rep (ignored for import)
  - B (2): **Name CP** (channel partner / distributor) — captured for charts (sales by distributor)
  - C (3): End customer code
  - D (4): End customer (duplicate/code)
  - E (5): **Name End Customer** — required; rows with empty E are distributor totals, not unique sales, and are skipped
  - F (6): Amount ($)
  - G (7): Result / total (ignored)
- **Skipped rows**: Rows where C or E is `"Result"` (subtotals). Rows where E (Name End Customer) is empty (distributor total row).
- **Overall Result**: The last row with "Overall Result" in A–E is not imported; its F value is used to **validate** the upload: the sum of all imported line amounts must equal this total (within a few dollars rounding). If not, the upload is rejected.
- **Month is not in the file** — the user selects the month (and year) when uploading in the dashboard.

## Database

Models: `SalesCustomer`, `MonthlySale` (no schema change for POS; same tables, aggregated by customer per month).

Run migration (if using migrate):
```bash
cd backend && npx prisma migrate dev --name add_sales_dashboard
```

Or apply with:
```bash
cd backend && npx prisma db push
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/sales/upload | RSM, Admin | Upload Excel. Body: `type` = `direct` \| `pos` (default `direct`). For POS: `month` (1–12) and `year` required. Admin: `rsmId` in body. |
| GET | /api/sales/summary | RSM, Admin | Sales summary. Admin can pass `?rsmId=` to filter. |
| GET | /api/sales/rsms | Admin | List RSMs for dropdown. |

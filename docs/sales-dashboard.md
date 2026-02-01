# Sales Dashboard

Sales analytics dashboard for RSM and Admin users. Data is imported from Excel (.xlsx) files.

## Access

- **RSM**: View and upload their own sales data
- **Admin**: View all RSMs' data or select a specific RSM; upload on behalf of an RSM

## Excel Format

- **Sheet name**: `ZANALYSIS_PATTERN (8)` or first sheet if not found
- **Data starts at row 7**
- **Columns**:
  - E (5): Sold-to party (customer code)
  - F (6): Customer name
  - G–R (7–18): Jan–Dec sales amounts (2025)
- Empty cells and negative values are treated as 0

## Database

Models: `SalesCustomer`, `MonthlySale`

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
| POST | /api/sales/upload | RSM, Admin | Upload Excel file. Admin must send `rsmId` in form body. |
| GET | /api/sales/summary | RSM, Admin | Sales summary. Admin can pass `?rsmId=` to filter. |
| GET | /api/sales/rsms | Admin | List RSMs for dropdown. |

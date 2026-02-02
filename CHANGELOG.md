# Changelog

All notable changes to the WAIGO App will be documented in this file.

## [1.2.0] - 2026-02-02

### PDF Pricing Contract Import

#### Features
- **PDF Upload** – Drag-and-drop WAGO pricing quote PDFs directly onto pricing contracts
- **Native TypeScript Parser** – Built-in PDF parsing (no Python dependencies)
- **Multi-page Table Support** – Handles tables spanning multiple pages
- **Series Discount Detection** – Automatically extracts series discounts (e.g., "221 Series 41.5%")
- **Net Price Calculation** – Applies series discounts to matching parts automatically
- **MOQ Extraction** – Captures minimum order quantity information from descriptions
- **Quote Metadata** – Extracts quote number, date, expiration, and customer info
- **Detailed Import Report** – Shows imported items, skipped items (with reasons), series discounts found, validation warnings, and unparsed rows

#### Technical
- `pdf-parse` v2.4.5 library for text extraction
- Robust regex patterns for WAGO part numbers (XXX-XXXX format)
- Fallback parsing strategies for varying PDF layouts
- False-positive filtering (phone numbers, addresses, internal codes)

#### Restore
```bash
git checkout v1.2.0
```

---

## [1.1.0] - 2026-02-01

### Sales Dashboard – Year filtering & trending improvements

#### Changes
- **Default year filter** – Dashboard now defaults to current year instead of "All years (combined)" for clearer single-year view
- **Trending minimum threshold** – Only accounts with ≥$5,000 in one 3-month period appear in trending lists (filters out small accounts)
- **UI clarity** – Year dropdown shows "All years (combined)" label; trending sections note the $5k minimum

#### Restore
```bash
git checkout v1.1.0
```

---

## [1.0.3] - 2026-02-01

### Sales Dashboard – POS improvements

#### Changes
- **Overall Result validation** – POS upload sum of line items must match file "Overall Result" total (within $5); "Overall Result" row is not imported as a customer
- **Name CP (distributor)** – Column B captured and stored; sales by distributor shown in POS pie chart
- **Skip subtotal/total rows** – Rows where C or E is "Result" or Name End Customer is empty are skipped (distributor totals, not unique sales)
- **Negative amounts** – Credits/adjustments (e.g. negative line items) are included so validation sum matches Overall Result
- **Schema** – `MonthlySale.distributorName` added; unique key includes distributor for POS (one row per end customer per distributor per month)
- **Railway** – Start command uses `prisma db push --accept-data-loss` so deploy succeeds with schema changes

#### Restore
```bash
git checkout v1.0.3
```

---

## [1.0.2] - 2026-02-01

### Quotes System

#### Changes
- **Customer model** – Create and select customers with full address/contact details
- **Quote form** – New quote creation and editing with customer selection, product search, bulk import
- **Bulk part lookup** – Add products via paste or CSV (part numbers)
- **Role-based discounts** – Enforced limits: BASIC 10%, TURNKEY 15%, DISTRIBUTOR 20%, RSM 35%, ADMIN 100%
- **Margin pricing** – Cost-plus pricing for distributor+ users (cost × (1 + margin%))
- **Snapshot pricing** – Product data frozen at quote creation for audit trail
- **Hierarchical visibility** – Managers see quotes from subordinates
- **Prisma db push on deploy** – Schema sync runs automatically on Railway startup

#### Restore
```bash
git checkout v1.0.2
```

---

## [1.0.1] - 2026-01-31

### Product Import Improvements

#### Changes
- **Drag-and-drop CSV upload** – Drop zone accepts CSV files via drag-and-drop or click-to-browse
- **Column mapping** – Matching and mapping of CSV columns works reliably
- **Sample file download** – Download sample CSV template for testing imports
- **Catalog selector** – Choose which catalog to import into (fixes "No catalog selected")
- **Custom CSV parser** – Replaced Papa.parse with FileReader + custom parser (handles BOM, quoted fields, large files)

#### Restore
```bash
git checkout v1.0.1
```

---

## [1.0.0] - 2026-01-31

### First Production Release

This is the first successful deployment of the WAIGO App to Railway.

#### Live URLs
- **Frontend**: https://happy-harmony-production.up.railway.app
- **Backend API**: https://waigo-production.up.railway.app

#### Features
- User authentication with role-based access control (Admin, RSM, Distributor, TurnKey, Basic)
- Product catalog management
- Cross-reference lookup for competitor parts
- Project/quote management
- Cost table functionality
- Video content management
- Team collaboration features
- CSV product import

#### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Railway)
- **ORM**: Prisma

#### Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wago.com | admin123 |
| Basic User | user@demo.com | user123 |
| TurnKey | turnkey@demo.com | turnkey123 |
| Distributor | distributor@demo.com | dist123 |
| RSM | rsm@wago.com | rsm123 |

---

## How to Restore This Version

If something breaks in the future, you can restore to this exact version:

```bash
# View all tags
git tag -l

# Checkout this version locally
git checkout v1.0.0

# Or create a new branch from this version
git checkout -b hotfix/from-v1.0.0 v1.0.0

# To deploy this version to Railway:
# 1. Create a branch from the tag
# 2. Push it to GitHub
# 3. Configure Railway to deploy that branch
```

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v1.2.0 | 2026-02-02 | PDF pricing contract import with native TypeScript parser |
| v1.1.0 | 2026-02-01 | Sales dashboard: year filtering, trending threshold |
| v1.0.3 | 2026-02-01 | POS improvements: validation, distributor tracking |
| v1.0.2 | 2026-02-01 | Quotes system: customers, bulk import, role-based discounts, snapshot pricing |
| v1.0.1 | 2026-01-31 | Product import: drag-and-drop, catalog selector, sample download |
| v1.0.0 | 2026-01-31 | First production release on Railway |

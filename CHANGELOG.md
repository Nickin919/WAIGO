# Changelog

All notable changes to the WAIGO App will be documented in this file.

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
| v1.0.1 | 2026-01-31 | Product import: drag-and-drop, catalog selector, sample download |
| v1.0.0 | 2026-01-31 | First production release on Railway |

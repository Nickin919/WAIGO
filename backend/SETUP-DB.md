# Database Setup (Fresh Start)

## Quick reset + seed

From project root:

```bash
npm run db:reset
```

This will:
1. Drop all tables and recreate from schema
2. Run the seed file (demo users, catalog, parts)

## Demo credentials (after seed)

| Role        | Email                  | Password  |
|-------------|------------------------|-----------|
| Admin       | admin@wago.com         | admin123  |
| BASIC User  | user@demo.com          | user123   |
| TurnKey     | turnkey@demo.com       | turnkey123|
| Distributor | distributor@demo.com   | dist123   |
| RSM         | rsm@wago.com           | rsm123    |

## Prerequisites

- PostgreSQL running with `DATABASE_URL` in `backend/.env`
- `JWT_SECRET` set in `backend/.env`

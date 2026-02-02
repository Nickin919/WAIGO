# User Assignment System (B2B Hierarchy)

## Role Model (Canonical)

| Role | Description |
|------|-------------|
| **FREE** | No login – BOM Cross-Reference, Product Finder only (public/guest) |
| **ADMIN** | Full system access (manufacturer internal) |
| **RSM** | Regional Sales Manager – manages Direct accounts and Distributors (manufacturer internal) |
| **DISTRIBUTOR_REP** | Reseller organization – sells to Basic accounts; serviced by RSM |
| **DIRECT_USER** | Customer buying direct from manufacturer; serviced by RSM |
| **BASIC_USER** | Customer buying through a distributor; serviced by assigned distributor |

## Legacy Role Names (Backward Compatible)

The app accepts both legacy and canonical role names until you run the data migration:

- **TURNKEY** → treated as **DIRECT_USER**
- **BASIC** → treated as **BASIC_USER**
- **DISTRIBUTOR** → treated as **DISTRIBUTOR_REP**

## Direct vs Basic

- **Direct**: Customer account with assignment where `manager_account_id` is NULL (RSM-managed).
- **Basic**: Customer account with assignment where `manager_account_id` points to a distributor account.

Determined by `AccountAssignment`; no extra field on User.

## New Schema (Account & AccountAssignment)

- **Account**: Company/organization (type: MANUFACTURER, DISTRIBUTOR, CUSTOMER). Users can have an optional `accountId`.
- **AccountAssignment**: Links customer accounts to RSM and optionally to a distributor (`manager_account_id`). One assignment per managed customer account (`managed_account_id` unique).

Backfilling Accounts and AccountAssignments from existing User hierarchy is optional; the app continues to use `assignedToDistributorId` and `assignedToRsmId` for hierarchy until you migrate.

## Migrating Existing Data to Canonical Roles

After deploying the schema with new enum values, run once:

```bash
cd backend
npx tsx scripts/migrate-roles-to-canonical.ts
```

This updates all users: TURNKEY → DIRECT_USER, BASIC → BASIC_USER, DISTRIBUTOR → DISTRIBUTOR_REP.

## Permission Summary

- **Sales dashboard**: RSM, Admin
- **Pricing contracts / cost tables**: Direct, Distributor rep, RSM, Admin
- **Managed users / Assignments / Activity**: Distributor rep, RSM, Admin
- **Admin panel**: Admin only

All checks use effective role (legacy names are normalized), so existing users keep working until you run the migration script.

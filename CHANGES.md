# WAGO Project Hub - User Hierarchy Update

## Summary

The WAGO Project Hub has been updated to support a sophisticated 6-tier user hierarchy with team functionality, custom cost tables, and hierarchical management. This enables FREE users to access core features without login, while providing enterprise-level capabilities for TurnKey teams, Distributors, and Regional Sales Managers.

---

## What Changed

### 1. User Roles Expanded (6 Types)

**Previous System:**
- USER
- ADMIN
- DISTRIBUTOR

**New System:**
1. **FREE** - No login, temporary sessions
2. **BASIC** - Registered users with saved data
3. **TURNKEY** - Teams with custom pricing
4. **DISTRIBUTOR** - Manages users and catalogs
5. **RSM** - Regional Sales Manager
6. **ADMIN** - Full system access

---

## Major New Features

### A. FREE User Access (Anonymous)
- ✅ No registration required
- ✅ BOM Cross-Reference Tool
- ✅ Product Finder (search)
- ✅ View public catalogs
- ✅ 24-hour temporary sessions
- ❌ No data persistence

### B. TurnKey Teams
- ✅ Multiple users per team
- ✅ Shared projects, BOMs, quotes
- ✅ Custom cost tables (team or individual)
- ✅ Assigned by RSM or ADMIN

### C. Hierarchical Management
```
ADMIN
  └─ RSM (Regional Sales Manager)
      └─ DISTRIBUTOR
          └─ BASIC / TURNKEY Users & Teams
```

### D. Custom Cost Tables
- TurnKey, Distributor, RSM, and Admin users can create custom pricing
- CSV import/export
- Team-shared or individual tables
- Per-part custom costs with notes

### E. Public Endpoints (No Auth Required)
- `POST /api/public/cross-reference` - Single part lookup
- `POST /api/public/cross-reference/bulk` - Bulk BOM processing
- `GET /api/public/parts/search` - Product search
- `GET /api/public/catalogs` - Public catalog browsing
- `POST /api/public/session/create` - Create anonymous session

---

## Database Schema Changes

### New Models

#### 1. TurnkeyTeam
```prisma
model TurnkeyTeam {
  id          String
  name        String
  description String?
  members     User[]      // Multiple TURNKEY users
  costTables  CostTable[] // Shared pricing
}
```

#### 2. CostTable & CostTableItem
```prisma
model CostTable {
  id              String
  name            String
  userId          String?       // Individual owner
  turnkeyTeamId   String?       // Or team owner
  items           CostTableItem[]
}

model CostTableItem {
  id          String
  costTableId String
  partNumber  String
  customCost  Float
  notes       String?
}
```

#### 3. CatalogAssignment
```prisma
model CatalogAssignment {
  catalogId    String
  userId       String
  assignedById String  // Who assigned it
  assignedAt   DateTime
}
```

### Modified Models

#### User Model Updates
```typescript
// NEW FIELDS:
role: FREE | BASIC | TURNKEY | DISTRIBUTOR | RSM | ADMIN
email?: nullable (for FREE users)
passwordHash?: nullable (for FREE users)
companyName?: string

// HIERARCHICAL RELATIONSHIPS:
assignedToDistributorId?: string  // BASIC/TURNKEY assigned to DISTRIBUTOR
assignedToRsmId?: string          // DISTRIBUTOR assigned to RSM
turnkeyTeamId?: string            // TURNKEY user's team

// SESSION TRACKING:
sessionId?: string                // For FREE users
lastActiveAt?: DateTime           // Activity tracking

// NEW RELATIONS:
managedUsers: User[]              // Users this person manages
turnkeyTeam: TurnkeyTeam         // Team membership
costTables: CostTable[]           // Custom pricing tables
```

#### Catalog Model Updates
```typescript
// NEW FIELDS:
isPublic: boolean       // Public catalogs for FREE users
createdById?: string    // Who created the catalog

// NEW RELATIONS:
createdBy: User
assignments: CatalogAssignment[]
```

---

## API Endpoints

### New Routes

#### Public (No Auth)
```
POST   /api/public/cross-reference
POST   /api/public/cross-reference/bulk
GET    /api/public/parts/search
GET    /api/public/catalogs
POST   /api/public/session/create
```

#### User Management
```
GET    /api/user-management
GET    /api/user-management/hierarchy/:userId
GET    /api/user-management/activity
POST   /api/user-management/assign-to-distributor
POST   /api/user-management/assign-distributor-to-rsm
PATCH  /api/user-management/:userId/role
```

#### Teams (TurnKey)
```
GET    /api/teams
GET    /api/teams/:id
POST   /api/teams
PATCH  /api/teams/:id
DELETE /api/teams/:id
POST   /api/teams/members
DELETE /api/teams/:teamId/members/:userId
```

#### Cost Tables
```
GET    /api/cost-tables
GET    /api/cost-tables/:id
POST   /api/cost-tables
POST   /api/cost-tables/upload
GET    /api/cost-tables/:id/download
PATCH  /api/cost-tables/:id
DELETE /api/cost-tables/:id
GET    /api/cost-tables/custom-cost/:partNumber
```

---

## Permission Matrix

| Feature | FREE | BASIC | TURNKEY | DIST | RSM | ADMIN |
|---------|------|-------|---------|------|-----|-------|
| BOM Cross-Reference | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product Search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save Projects | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save Quotes | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Catalogs | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Cost Tables | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Team Features | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Assign Catalogs | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | Own | Region | All |
| View Others' Data | ❌ | ❌ | Team | Assigned | Assigned | All |

---

## Data Visibility Rules

### FREE Users
- See: Public catalogs only
- Save: Nothing (temp session)
- Access: Product finder, BOM cross-ref

### BASIC Users
- See: Own data only
- Save: Projects, quotes, catalogs
- Can be: Assigned to Distributor

### TURNKEY Users
- See: Own + Team data
- Save: Personal or team-shared
- Features: Custom cost tables
- Can be: Part of a team, assigned to Distributor

### DISTRIBUTOR Users
- See: All assigned users' data
- Manage: Catalogs for users
- Create: Catalogs, assign to users
- Can be: Assigned to RSM

### RSM Users
- See: All Distributors + their users (in region)
- Manage: Assign users to Distributors
- Assign: Distributors to themselves
- Access: Regional dashboard

### ADMIN Users
- See: Everything
- Manage: All users, all assignments
- Create: Any user type
- Access: Full system configuration

---

## Assignment Workflows

### Creating a TurnKey Team
```
1. RSM or ADMIN creates team
2. Create TURNKEY users (or upgrade existing)
3. Add users to team (updates turnkeyTeamId)
4. Team can now share:
   - Cost tables
   - Projects
   - Quotes
```

### Assigning Users to Distributor
```
1. ADMIN creates Distributor user
2. RSM assigns Distributor to themselves
3. RSM creates BASIC/TURNKEY users
4. RSM assigns users to Distributor
5. Distributor can now:
   - View user activity
   - Create catalogs for them
   - See their projects/quotes
```

### Complete Hierarchy Example
```
ADMIN creates:
  └─ RSM (Chicago Region)
      └─ Assigns Distributor (ABC Electric Supply)
          └─ Assigns BASIC User (John - Mechanic at Factory A)
          └─ Assigns TURNKEY Team (XYZ Construction)
              └─ Team Members:
                  - Sarah (Project Manager)
                  - Mike (Electrician)
                  - Lisa (Procurement)
```

---

## Migration Guide

### For Existing Deployments

1. **Run Database Migration**
```bash
cd backend
npx prisma migrate dev --name add-user-hierarchy
```

2. **Update Existing Users**
```sql
-- Map old roles to new roles
UPDATE users SET role = 'BASIC' WHERE role = 'USER';
UPDATE users SET role = 'DISTRIBUTOR' WHERE role = 'DISTRIBUTOR';
UPDATE users SET role = 'ADMIN' WHERE role = 'ADMIN';

-- Set email as required for non-FREE users
UPDATE users SET email = COALESCE(email, id || '@placeholder.com') WHERE email IS NULL;
```

3. **Create Public Catalog**
```sql
-- Make existing catalogs public for FREE user access
UPDATE catalogs SET is_public = true WHERE name LIKE '%Demo%';
```

4. **Add Cleanup Job**
```javascript
// Add to cron or scheduled task
// Clean up inactive FREE user sessions daily
await prisma.user.deleteMany({
  where: {
    role: 'FREE',
    lastActiveAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }
});
```

---

## Security Considerations

### 1. FREE User Sessions
- Temporary only (24-hour expiry)
- No sensitive data storage
- Cookie-based session tracking
- Automatic cleanup of expired sessions

### 2. Data Isolation
- Enforced at API layer based on user role
- Prisma queries filtered by hierarchy
- No direct database access from frontend

### 3. Assignment Validation
- RSM can only assign within their region
- Distributors can only manage assigned users
- All assignments auditable

### 4. Cost Table Access
- Team members share tables
- Individuals can create private tables
- Distributors see assigned users' tables

---

## Testing Checklist

### FREE User Features
- [ ] Can access /api/public/cross-reference
- [ ] Can search products
- [ ] Session created automatically
- [ ] Session expires after 24 hours
- [ ] Cannot save projects/quotes
- [ ] Cannot access auth-required endpoints

### BASIC User Features
- [ ] Can register and login
- [ ] Can save projects
- [ ] Can create quotes
- [ ] Can create catalogs
- [ ] Cannot access team features
- [ ] Can be assigned to Distributor

### TURNKEY User Features
- [ ] Can join a team
- [ ] Can create cost tables
- [ ] Can see team data
- [ ] Team members share resources
- [ ] Can be assigned to Distributor

### DISTRIBUTOR Features
- [ ] Can see assigned users
- [ ] Can create catalogs
- [ ] Can assign catalogs to users
- [ ] Can view user activity
- [ ] Cannot see other Distributors' data

### RSM Features
- [ ] Can create teams
- [ ] Can assign users to Distributors
- [ ] Can see regional data
- [ ] Cannot see other RSMs' regions

### ADMIN Features
- [ ] Can create any user type
- [ ] Can assign users anywhere
- [ ] Can see all data
- [ ] Can manage system settings

---

## Frontend Updates Needed

### Navigation
- Show/hide features based on user role
- FREE users: Show cross-ref and search only
- BASIC: Show projects, quotes, catalogs
- TURNKEY: Add "My Team" section
- DISTRIBUTOR: Add "Managed Users" dashboard
- RSM: Add "Regional Management" dashboard

### Components to Update
1. Header - role-based menu
2. Dashboard - role-specific widgets
3. Sidebar/BottomNav - conditional links
4. Settings - team management for TURNKEY
5. Admin Panel - user assignment UI

---

## Configuration

### Environment Variables
```env
# Session management for FREE users
FREE_USER_SESSION_DURATION=86400000  # 24 hours in ms
FREE_USER_CLEANUP_CRON=0 2 * * *     # Daily at 2 AM

# Feature flags
ENABLE_FREE_USER_ACCESS=true
ENABLE_TEAM_FEATURES=true
ENABLE_COST_TABLES=true
```

---

## Documentation

New documentation files created:
- `/docs/user-hierarchy.md` - Complete user system guide
- `/CHANGES.md` - This file

Updated files:
- `/prisma/schema.prisma` - New models and relationships
- `/backend/src/server.ts` - New routes
- All affected controllers and routes

---

## Next Steps

1. ✅ Database schema updated
2. ✅ Backend API implemented
3. ✅ Public endpoints created
4. ✅ Team management added
5. ✅ Cost tables implemented
6. ⏳ Frontend UI updates (in progress)
7. ⏳ Testing suite
8. ⏳ Documentation completion

---

## Support

For questions or issues:
1. Check `/docs/user-hierarchy.md` for detailed specifications
2. Review API endpoints in route files
3. Test using the updated Postman/Thunder Client collection
4. Contact development team for clarification

---

**Version**: 2.0.0  
**Date**: {{ current_date }}  
**Status**: ✅ Backend Complete, Frontend In Progress

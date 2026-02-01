# WAGO Project Hub - Quick Reference Guide

## 🎯 6 User Types at a Glance

### 1️⃣ FREE (No Login)
- **Access**: BOM Cross-Ref, Product Search
- **Save**: Nothing (24hr session)
- **Endpoint**: `/api/public/*`

### 2️⃣ BASIC (Registered)
- **Access**: Everything FREE + Save Projects/Quotes
- **Can be**: Assigned to Distributor
- **Features**: Personal catalogs

### 3️⃣ TURNKEY (Team Member)
- **Access**: Everything BASIC + Teams
- **Features**: Custom cost tables, shared data
- **Teams**: Multiple users share resources

### 4️⃣ DISTRIBUTOR
- **Manages**: BASIC and TURNKEY users
- **Access**: View all assigned users' data
- **Can**: Build/assign catalogs

### 5️⃣ RSM (Regional Sales Manager)
- **Manages**: Distributors + their users
- **Assigns**: Users to Distributors
- **Access**: Regional dashboard

### 6️⃣ ADMIN
- **Access**: Everything
- **Manages**: All users, all assignments
- **Full**: System configuration

---

## 📊 Hierarchy Chart

```
FREE (anonymous)
    ↓ (registers)
BASIC User
    ↓ (upgraded by RSM/Admin)
TURNKEY User → joins Team
    ↓ (assigned by RSM)
managed by → DISTRIBUTOR
    ↓ (assigned by Admin)
managed by → RSM
    ↓
overseen by → ADMIN
```

---

## 🔑 Key API Endpoints

### Public (FREE Users - No Auth)
```bash
# Product Search
GET /api/public/parts/search?q=terminal

# Single Cross-Reference
POST /api/public/cross-reference
{ "manufacturer": "Phoenix", "partNumber": "UK-2.5" }

# Bulk BOM Cross-Reference
POST /api/public/cross-reference/bulk
{ "items": [
    { "manufacturer": "Phoenix", "partNumber": "UK-2.5" },
    { "manufacturer": "Allen-Bradley", "partNumber": "1492-J4" }
  ]
}

# Create Session
POST /api/public/session/create
```

### User Management
```bash
# Get users (filtered by role)
GET /api/user-management

# Assign user to distributor (RSM/Admin)
POST /api/user-management/assign-to-distributor
{ "userId": "...", "distributorId": "..." }

# Get hierarchy
GET /api/user-management/hierarchy/:userId

# Update role (Admin only)
PATCH /api/user-management/:userId/role
{ "role": "TURNKEY" }
```

### Teams
```bash
# Create team (RSM/Admin)
POST /api/teams
{ "name": "Construction Team Alpha" }

# Add member
POST /api/teams/members
{ "teamId": "...", "userId": "..." }

# Get team data
GET /api/teams/:teamId
```

### Cost Tables
```bash
# Create cost table
POST /api/cost-tables
{ "name": "Q1 2024 Pricing", "isTeamTable": true }

# Upload CSV
POST /api/cost-tables/upload
FormData: { csv: file, costTableId: "..." }

# Get custom cost
GET /api/cost-tables/custom-cost/:partNumber
```

---

## 💾 Database Models (New)

### TurnkeyTeam
```typescript
{
  id: uuid
  name: string
  description?: string
  members: User[]
  costTables: CostTable[]
}
```

### CostTable
```typescript
{
  id: uuid
  name: string
  userId?: uuid           // Individual owner
  turnkeyTeamId?: uuid    // OR team owner
  items: CostTableItem[]
}
```

### CostTableItem
```typescript
{
  id: uuid
  costTableId: uuid
  partNumber: string
  customCost: number
  description?: string
  notes?: string
}
```

### User (Updated Fields)
```typescript
{
  // NEW:
  role: 'FREE' | 'BASIC' | 'TURNKEY' | 'DISTRIBUTOR' | 'RSM' | 'ADMIN'
  companyName?: string
  sessionId?: string                    // For FREE users
  lastActiveAt?: DateTime
  assignedToDistributorId?: uuid        // Hierarchy
  assignedToRsmId?: uuid                // Hierarchy
  turnkeyTeamId?: uuid                  // Team membership
  
  // RELATIONS:
  managedUsers: User[]                  // Who they manage
  turnkeyTeam: TurnkeyTeam
  costTables: CostTable[]
}
```

---

## 🔒 Permission Quick Check

| Can they... | FREE | BASIC | TURNKEY | DIST | RSM | ADMIN |
|-------------|------|-------|---------|------|-----|-------|
| Search products? | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cross-ref BOM? | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save projects? | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Join team? | ❌ | ❌ | ✅ | N/A | N/A | N/A |
| Custom pricing? | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage users? | ❌ | ❌ | ❌ | ✅* | ✅** | ✅ |
| Assign to Dist? | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

*Distributors manage assigned users only  
**RSMs manage regional users only

---

## 🚀 Common Workflows

### FREE User → BASIC User
```javascript
1. User visits site (no login)
2. Uses BOM cross-ref tool
3. Decides to save work
4. Clicks "Sign Up"
5. Now has BASIC account
```

### Create TurnKey Team
```javascript
1. RSM creates team:
   POST /api/teams
   { "name": "ABC Construction Team" }

2. Create/upgrade users to TURNKEY:
   PATCH /api/user-management/:userId/role
   { "role": "TURNKEY" }

3. Add users to team:
   POST /api/teams/members
   { "teamId": "...", "userId": "..." }

4. Team creates shared cost table:
   POST /api/cost-tables
   { "name": "Team Pricing", "isTeamTable": true }
```

### Distributor Setup
```javascript
1. ADMIN creates Distributor:
   POST /api/auth/register
   { "email": "dist@company.com", "role": "DISTRIBUTOR" }

2. RSM assigns to themselves:
   POST /api/user-management/assign-distributor-to-rsm
   { "distributorId": "...", "rsmId": "..." }

3. RSM assigns users to Distributor:
   POST /api/user-management/assign-to-distributor
   { "userId": "...", "distributorId": "..." }

4. Distributor sees assigned users:
   GET /api/user-management/activity
```

---

## 📝 Prisma Migration

```bash
# Generate migration
cd backend
npx prisma migrate dev --name add-user-hierarchy

# Update existing data
npx prisma studio
# Or use SQL:
UPDATE users SET role = 'BASIC' WHERE role = 'USER';

# Seed demo data
npx prisma db seed
```

---

## 🧪 Testing Scenarios

### Test FREE User
```bash
# No token needed
curl http://localhost:3001/api/public/parts/search?q=terminal

curl -X POST http://localhost:3001/api/public/cross-reference \
  -H "Content-Type: application/json" \
  -d '{"manufacturer":"Phoenix","partNumber":"UK-2.5"}'
```

### Test TURNKEY User with Team
```bash
# Login as TURNKEY user
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"turnkey@test.com","password":"test"}' \
  | jq -r '.token')

# Get team
curl http://localhost:3001/api/teams/:teamId \
  -H "Authorization: Bearer $TOKEN"

# Create cost table
curl -X POST http://localhost:3001/api/cost-tables \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Pricing","isTeamTable":true}'
```

### Test Distributor Viewing Users
```bash
# Login as Distributor
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dist@test.com","password":"test"}' \
  | jq -r '.token')

# View managed users
curl http://localhost:3001/api/user-management \
  -H "Authorization: Bearer $TOKEN"

# View activity
curl http://localhost:3001/api/user-management/activity \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 Documentation Files

- `SETUP.md` - Initial setup guide
- `CHANGES.md` - Detailed change log
- `docs/user-hierarchy.md` - Complete user system reference
- `docs/getting-started.md` - Development guide
- `docs/railway-deployment.md` - Deployment instructions
- `QUICK-REFERENCE.md` - This file

---

## 🐛 Troubleshooting

### "User not found" after migration
```bash
# Reset role enum
npx prisma migrate reset
npx prisma db seed
```

### FREE user session not working
```javascript
// Check cookie is set
res.cookie('wago_session', sessionId, {
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000
});

// Check cleanup job is running
// Clean sessions older than 24 hours
```

### Team data not sharing
```sql
-- Verify team membership
SELECT id, email, role, turnkey_team_id FROM users WHERE role = 'TURNKEY';

-- Check cost table ownership
SELECT * FROM cost_tables WHERE turnkey_team_id = 'team-id';
```

---

## ✅ Implementation Checklist

**Backend:**
- [x] Updated Prisma schema
- [x] Created Team models
- [x] Created CostTable models
- [x] Added public endpoints
- [x] Created user management controllers
- [x] Added team management
- [x] Implemented cost tables
- [x] Updated server routes

**Frontend (TODO):**
- [ ] Add role-based navigation
- [ ] Create FREE user landing page
- [ ] Add team management UI
- [ ] Create cost table interface
- [ ] Add distributor dashboard
- [ ] Add RSM management panel
- [ ] Update admin panel

**Deployment:**
- [ ] Run database migration
- [ ] Update environment variables
- [ ] Add cleanup cron job
- [ ] Test all user workflows
- [ ] Update documentation

---

**Need Help?** Check the full documentation in `docs/user-hierarchy.md`

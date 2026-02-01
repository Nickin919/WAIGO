# WAGO Project Hub - User Hierarchy & Permissions

## User Types Overview

The WAGO Project Hub supports 6 distinct user types with hierarchical relationships and specific feature access.

---

## 1. FREE User (Anonymous)

**Authentication**: No login required
**Session**: Temporary session ID for temporary data storage

### Features
- ✅ BOM Cross-Reference Tool
- ✅ Product Finder
- ✅ View public catalogs
- ❌ No saved data (temporary session only)
- ❌ No projects, quotes, or custom catalogs

### Use Cases
- Quick product lookups
- One-time BOM cross-referencing
- Exploring WAGO products without commitment

### Technical Implementation
- Session-based tracking using cookies
- Temporary data stored with `sessionId`
- Data purged after inactivity (e.g., 24 hours)

---

## 2. BASIC User (Registered)

**Authentication**: Email + Password (required)
**Parent**: None
**Children**: None

### Features
- ✅ All FREE user features
- ✅ Upload and save BOMs to projects
- ✅ Create and save quotes
- ✅ Create and save custom catalogs
- ✅ Persistent data storage
- ❌ No team functionality
- ❌ No custom cost tables

### Use Cases
- Individual mechanics
- Small businesses
- Personal project management

### Database Fields
```typescript
{
  role: 'BASIC',
  email: required,
  passwordHash: required,
  catalogId: optional,
  assignedToDistributorId: optional // Can be assigned to a Distributor
}
```

---

## 3. TURNKEY Registered User

**Authentication**: Email + Password (required)
**Parent**: Can be assigned to Distributor
**Children**: Team members share data

### Features
- ✅ All BASIC user features
- ✅ Create custom cost tables
- ✅ Team functionality (multiple logins in TurnKey Team)
- ✅ Share data within team
- ✅ Team-specific pricing

### Team Functionality
- Multiple users can be part of a TurnKey Team
- All team members see shared:
  - Projects
  - BOMs
  - Quotes
  - Cost tables
- Teams are assigned by RSM or ADMIN

### Custom Cost Tables
```sql
CostTable:
  - name: "Q1 2024 Pricing"
  - userId OR turnkeyTeamId
  - items: [
      { partNumber, customCost, notes }
    ]
```

### Use Cases
- Larger contractors with multiple team members
- Engineering firms
- Project-based teams needing shared pricing

### Database Fields
```typescript
{
  role: 'TURNKEY',
  turnkeyTeamId: optional, // Links to team
  assignedToDistributorId: optional,
  costTables: [] // Custom pricing
}
```

---

## 4. DISTRIBUTOR User

**Authentication**: Email + Password (required)
**Parent**: Can be assigned to RSM
**Children**: Manages BASIC and TURNKEY users/teams

### Features
- ✅ All features available
- ✅ Build catalogs and assign to managed users
- ✅ See all projects, BOMs, quotes of assigned users
- ✅ Multiple users can be part of Distributor account
- ✅ View all data for managed users
- ✅ Custom margin settings

### Assignment Capabilities
- Assign catalogs to users
- View all activity of assigned users
- Create custom catalogs for specific customers
- Set distributor margins

### Visibility
- Can see ALL data from:
  - BASIC users assigned to them
  - TURNKEY users/teams assigned to them
- Cannot see data from other Distributors

### Use Cases
- Electrical distributors
- Industrial suppliers
- Regional distribution centers

### Database Fields
```typescript
{
  role: 'DISTRIBUTOR',
  distributorMarginPercent: number,
  assignedToRsmId: optional,
  managedUsers: [] // BASIC and TURNKEY users
}
```

---

## 5. RSM User (Regional Sales Manager)

**Authentication**: Email + Password (required)
**Parent**: ADMIN
**Children**: Manages Distributors and their users

### Features
- ✅ All features available
- ✅ Assign catalogs, quotes, BOMs to any assigned user
- ✅ Assign BASIC/TURNKEY users to Distributors
- ✅ Assign Distributors to themselves
- ✅ View all activity in their region

### Assignment Flow
```
RSM assigns:
  → Distributors to themselves
  → BASIC users to Distributors
  → TURNKEY teams to Distributors
  → Catalogs to any user in their hierarchy
```

### Visibility
- Can see ALL data from:
  - All Distributors assigned to them
  - All users assigned to those Distributors
- Cannot see data from other RSMs' regions

### Use Cases
- Regional WAGO sales managers
- Territory managers
- Sales team leaders

### Database Fields
```typescript
{
  role: 'RSM',
  managedByRsm: [] // Distributors assigned to this RSM
}
```

---

## 6. ADMIN User

**Authentication**: Email + Password (required)
**Parent**: None (top level)
**Children**: Can manage ALL users

### Features
- ✅ ALL features available
- ✅ Manage all user types
- ✅ Assign users to any Distributor or RSM
- ✅ Create and manage all catalogs
- ✅ Video approval workflow
- ✅ System configuration
- ✅ Bulk operations

### Administrative Tasks
- User management (create, edit, delete, activate/deactivate)
- Assign users to Distributors
- Assign Distributors to RSMs
- Manage all catalogs (public and private)
- Approve videos
- Import cross-reference data
- System settings

### Visibility
- Can see EVERYTHING
- Full access to all data across all users

### Use Cases
- WAGO system administrators
- IT support
- Platform managers

---

## Hierarchical Structure

```
┌─────────────────────────────────────────────┐
│              ADMIN (Top Level)              │
│  • Manages everything                       │
│  • Assigns RSMs                             │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌───────▼────────┐
│  RSM (Region1) │  │  RSM (Region2) │
│  • Assigns     │  │  • Assigns     │
│    Distributors│  │    Distributors│
└───────┬────────┘  └───────┬────────┘
        │                   │
   ┌────┴─────┐        ┌────┴─────┐
   │          │        │          │
┌──▼────┐ ┌──▼────┐ ┌──▼────┐ ┌──▼────┐
│Dist A │ │Dist B │ │Dist C │ │Dist D │
│• Mgmt │ │• Mgmt │ │• Mgmt │ │• Mgmt │
└──┬────┘ └──┬────┘ └──┬────┘ └──┬────┘
   │         │         │         │
┌──▼──────┬──▼──────┬──▼──────┬──▼──────┐
│ BASIC   │ BASIC   │TURNKEY  │TURNKEY  │
│ Users   │ Users   │ Teams   │ Teams   │
└─────────┴─────────┴─────────┴─────────┘

Note: FREE users (no login) exist outside this hierarchy
```

---

## Data Visibility Rules

### FREE Users
- See: Public catalogs only
- Save: Nothing (temporary session)

### BASIC Users
- See: Own data only
- Save: Own projects, quotes, catalogs

### TURNKEY Users
- See: Own data + Team shared data
- Save: Can save to personal or team

### DISTRIBUTOR Users
- See: All assigned BASIC and TURNKEY users' data
- Manage: Catalogs for assigned users

### RSM Users
- See: All Distributors assigned to them + their users
- Manage: Assignments within their region

### ADMIN Users
- See: Everything
- Manage: Everything

---

## Assignment Workflow

### 1. Creating a New BASIC User
```
ADMIN creates user → 
  Optional: Assign to Distributor → 
    User can now access Distributor's catalogs
```

### 2. Creating a TurnKey Team
```
RSM or ADMIN creates team →
  Add multiple TURNKEY users to team →
  Assign team to Distributor →
  Team members share cost tables and projects
```

### 3. Distributor Onboarding
```
ADMIN creates Distributor →
  RSM assigns Distributor to themselves →
  Distributor creates catalogs →
  RSM assigns BASIC/TURNKEY users to Distributor
```

---

## Permission Matrix

| Feature | FREE | BASIC | TURNKEY | DIST | RSM | ADMIN |
|---------|------|-------|---------|------|-----|-------|
| BOM Cross-Reference | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product Finder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save Projects | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save Quotes | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Catalogs | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom Cost Tables | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Team Features | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Assign Catalogs | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ✅* | ✅** | ✅ |
| View Other Users' Data | ❌ | ❌ | Team | Assigned | Assigned | All |
| Video Approval | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| System Config | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*Distributors can only manage assigned users
**RSMs can only manage users in their region

---

## API Endpoints Structure

### Public (FREE user access)
```
GET  /api/public/parts/search
GET  /api/public/cross-reference
GET  /api/public/catalogs (public only)
```

### Authenticated
```
POST /api/auth/register (BASIC signup)
POST /api/auth/login
GET  /api/auth/me

# User-specific
GET  /api/projects (filtered by user role)
GET  /api/quotes (filtered by user role)
GET  /api/catalogs (filtered by user role)
```

### TurnKey-specific
```
GET  /api/teams/:teamId
GET  /api/cost-tables
POST /api/cost-tables
```

### Distributor-specific
```
GET  /api/distributor/users (assigned users)
POST /api/distributor/catalogs/assign
GET  /api/distributor/activity (all assigned users' activity)
```

### RSM-specific
```
GET  /api/rsm/distributors
POST /api/rsm/assign-user
POST /api/rsm/assign-distributor
```

### Admin-only
```
GET  /api/admin/users (all)
POST /api/admin/users/assign
POST /api/admin/videos/approve
```

---

## Implementation Notes

### Session Management for FREE Users
```typescript
// Create temporary session for FREE user
const sessionId = generateUUID();
res.cookie('wago_session', sessionId, { 
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});

// Store temporary data with sessionId
await prisma.user.create({
  data: {
    role: 'FREE',
    sessionId,
    lastActiveAt: new Date()
  }
});
```

### Cleanup Job
Run daily to remove inactive FREE user sessions:
```sql
DELETE FROM users 
WHERE role = 'FREE' 
  AND last_active_at < NOW() - INTERVAL '24 hours';
```

---

## Security Considerations

1. **FREE Users**: No sensitive data storage, session-only
2. **Password Security**: Bcrypt with salt rounds = 10
3. **JWT Tokens**: Include user role for authorization
4. **Data Isolation**: Enforce in API layer based on user hierarchy
5. **Audit Logging**: Track all assignments and data access

---

## Migration Path

### Existing Users
Current users will be mapped as follows:
- `USER` → `BASIC`
- `DISTRIBUTOR` → `DISTRIBUTOR`
- `ADMIN` → `ADMIN`

New roles (`FREE`, `TURNKEY`, `RSM`) must be explicitly assigned.

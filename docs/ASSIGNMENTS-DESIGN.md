# User Role Assignments, Catalog Assignments & Price Contracts – Design

This document maps the CPQ spec to the WAIGO app, aligns naming and behavior, and calls out deviations and decisions.

---

## 1. Alignment with Current WAIGO Design

| Spec concept | WAIGO today | Action |
|--------------|-------------|--------|
| Roles ADMIN → RSM → DISTRIBUTOR → TURNKEY → BASIC → FREE | Same enum + hierarchy | No change |
| assignedToRsmId, assignedToDistributorId, turnkeyTeamId | Present on User | No change |
| Catalog assignments (many-to-many, primary + secondary) | CatalogAssignment exists; User.catalogId = primary | Add `isPrimary` to CatalogAssignment; keep User.catalogId in sync with primary |
| Master catalog vs curated subsets | Each catalog has its own Parts (Part.catalogId) | **Deviate** – see §2 |
| Price contracts (special pricing overlays) | Not present | **Add** – PriceContract, PriceContractItem, UserPriceContractAssignment |
| Assignments management page (tree + table + bulk assign) | Not present | **Add** – AssignmentsPage |
| My Price Contracts (assignees edit suggestedSellPrice) | Not present | **Add** – My Price Contracts page |
| Proposal/Quote wizard: catalog + contract selection | Quote form has catalog only | **Extend** – add price contract step and pricing logic |
| React + MUI/Ant Design | React + TypeScript + Tailwind, custom components | **Keep** – Tailwind + existing patterns (no MUI/Ant) |
| React Query + Zod | Not used consistently | Use existing api + toasts; add Zod where we add new APIs |

---

## 2. Deviations & Decisions

### 2.1 Master catalog vs curated catalogs (needs your decision)

- **Spec:** One “master” catalog (single source of truth); “curated” catalogs are subsets (e.g. via CatalogItems referencing master products).
- **Current WAIGO:** Each catalog has its own products (Part.catalogId). Product import is per-catalog. No shared master.
- **Options:**
  - **A) Keep current model (recommended for now)**  
    - No data migration.  
    - Add `isMaster` (Boolean) on Catalog for labeling only (e.g. “Main WAGO catalog”).  
    - “Curated” = any non-master catalog; still full copy of products per catalog.  
    - Later, if needed, we can add true master + subset (separate migration).
  - **B) Full master/subset model**  
    - One catalog holds all parts; others only reference parts via CatalogItem (curated subsets).  
    - Requires migration: decide one catalog as master, move/link parts, change product import to “master + assign to curated”.

**Recommendation:** Implement **A** (isMaster flag, current part-per-catalog model). If you want true master/subset, we treat that as a Phase 2 and I’ll outline the migration.

### 2.2 Primary catalog

- **Spec:** User has one primary + multiple secondary catalogs.
- **Current:** User.catalogId (single) + CatalogAssignment (many-to-many).
- **Plan:** Add `isPrimary` to CatalogAssignment. One assignment per user must have `isPrimary == true`. On assign/set-primary, update User.catalogId to match. Existing User.catalogId can be backfilled into CatalogAssignment with isPrimary true.

### 2.3 Price contracts – assignments to teams

- **Spec:** Assignments to “users/teams”.
- **Plan:** Implement **user-level** assignments first (UserPriceContractAssignment). Team-level (e.g. “all TURNKEY in this team get this contract”) can be Phase 2: add TurnkeyTeamPriceContractAssignment or a rule “user gets contract if assigned OR if their turnkeyTeamId is assigned”.

### 2.4 Phasing

- **Phase 1 (this implementation):**
  - Schema: Catalog.isMaster, CatalogAssignment.isPrimary, PriceContract, PriceContractItem, UserPriceContractAssignment.
  - Backend: assignment tree/users APIs, catalog assign (with primary), price contract CRUD + CSV, assign contracts to users, GET my assignments, PATCH my contract items (suggestedSellPrice only).
  - Frontend: Assignments page (hierarchy + table + bulk assign catalogs/contracts), My Price Contracts page, assignment modals.
- **Phase 2 (later):**
  - Quote wizard: catalog + price contract dropdowns and pricing logic.
  - Optional: master/subset catalog model + migration.
  - Optional: team-level price contract assignment.

---

## 3. Prisma Schema Additions/Changes

- **Catalog:** `isMaster Boolean @default(false)`
- **CatalogAssignment:** `isPrimary Boolean @default(false)` (application ensures exactly one primary per user).
- **PriceContract:** id, name, description?, validFrom?, validTo?, createdById (ADMIN/RSM).
- **PriceContractItem:** contractId, partId? (nullable), seriesOrGroup? (nullable), costPrice, suggestedSellPrice?, discountPercent?, minQuantity (default 1). One of partId or seriesOrGroup set.
- **UserPriceContractAssignment:** userId, contractId (unique per user+contract).

Relations: User ↔ CatalogAssignment ↔ Catalog; User ↔ UserPriceContractAssignment ↔ PriceContract; PriceContract ↔ PriceContractItem; Part optional on PriceContractItem.

---

## 4. Backend (High Level)

- Reuse existing `getSubordinateUserIds(userId, role)` for scoping.
- **Assignments:**  
  - GET /api/assignments/tree – hierarchical tree of visible users (RSM → Distributors → Users/Teams).  
  - GET /api/assignments/users – flat, filterable, paginated list for table.  
  - POST/PATCH /api/assignments/catalogs – assign catalogs (bulk/single), set primary (one per user).  
  - POST/PATCH /api/assignments/contracts – assign price contracts (bulk/single).
- **Catalogs:** Existing CRUD; creation/update scoped by role (ADMIN all, RSM/DISTRIBUTOR subordinates’ catalogs or created by self).
- **Price contracts:** CRUD (ADMIN/RSM only); CSV upload parser (columns: productSku or series/group, costPrice, suggestedSellPrice, discountPercent, minQuantity).
- **My contracts:**  
  - GET /api/users/me/assignments – current user’s catalogs (with primary) and price contracts.  
  - PATCH /api/my/contracts/:contractId/items – assignee updates only suggestedSellPrice on items.
- All mutation endpoints: role checks and subordinate checks; return 403 when outside scope.

---

## 5. Frontend (High Level)

- **AssignmentsPage** (ADMIN/RSM/DISTRIBUTOR):  
  - Left: HierarchySidebar (expandable tree: RSMs → Distributors → Teams → Users).  
  - Main: Data table (Name, Role, Team, Primary Catalog, Assigned Catalogs chips, Assigned Contracts chips, Actions).  
  - Toolbar: bulk select + “Assign Catalogs”, “Assign Price Contracts”.  
  - Modals: AssignmentModal for catalogs (searchable multi-select, set primary), same for contracts (searchable multi-select).
- **My Price Contracts page** (TURNKEY/BASIC/DISTRIBUTOR as assignees):  
  - List assigned contracts; expand contract → table of items with editable suggestedSellPrice; other fields read-only/grayed.
- **Quote/Proposal (Phase 2):** Step 1 – catalog (dropdown from assigned, primary pre-selected). Step 2 – price contract (dropdown from assigned + “Standard pricing”). Then load products from catalog and apply contract pricing when contract selected.

---

## 6. What I’ll Implement Now (Phase 1)

1. **Schema** – isMaster, isPrimary, PriceContract, PriceContractItem, UserPriceContractAssignment.
2. **Backend** – Assignments tree/users, catalog and contract assignment endpoints, price contract CRUD + CSV upload, my-assignments and my-contract-items (PATCH suggestedSellPrice).
3. **Frontend** – AssignmentsPage (sidebar + table + bulk assign + modals), My Price Contracts page (list + editable suggestedSellPrice). Styling: Tailwind, existing buttons/inputs/cards.

---

## 7. Questions for You

1. **Master catalog:** Confirm **Option A** (isMaster flag, keep current “each catalog has its own products”) for Phase 1, or do you want to plan **Option B** (true master + curated subsets) and I’ll outline the migration?
2. **Team-level price contracts:** Phase 1 user-only assignments only, or should we add “assign contract to TurnKey team” in this pass?
3. **Quote wizard:** Include catalog + price contract dropdowns and pricing in this implementation, or defer to Phase 2 after assignments + My Price Contracts are in place?

Once you confirm these, I’ll treat the design as locked for Phase 1 and implement schema, backend, and frontend accordingly.

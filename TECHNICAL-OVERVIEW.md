# WAIGO / WAGO Project Hub – Technical Overview

**For experienced software developers.** Quick reference to understand the deployed web application’s architecture and structure.

---

## 1. Application Type

**B2B Industrial CPQ (Configure-Price-Proposal) Web Application** – Product catalog, quotes, projects, video academy, and hierarchical user management for WAGO industrial products.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI** | Tailwind CSS, Lucide React (icons), Framer Motion |
| **Routing** | React Router v6 |
| **State** | Zustand (persisted auth) |
| **HTTP** | Axios (JWT Bearer) |
| **Backend** | Node.js, Express, TypeScript |
| **ORM** | Prisma |
| **Database** | PostgreSQL |
| **Auth** | JWT (jsonwebtoken), bcrypt |
| **File Upload** | Multer |
| **CSV** | PapaParse |
| **PDF** | jsPDF |
| **Deploy** | Railway (frontend + backend as separate services) |

---

## 3. Monorepo Structure

```
WAIGO App/
├── frontend/          # React SPA
├── backend/           # Express API server
├── prisma/            # Schema (backend/prisma is canonical)
└── package.json       # Root workspace (concurrently runs both)
```

**Scripts (root):**
- `npm run dev` – Runs frontend (Vite) + backend (tsx watch)
- `npm run build` – Builds both
- `npm run db:migrate` – Prisma migrate
- `npm run db:seed` – Seed database
- `npm run db:studio` – Prisma Studio

---

## 4. Frontend Architecture

### Entry
- `frontend/src/main.tsx` – `ReactDOM.createRoot`, `BrowserRouter`, `Toaster`
- `frontend/index.html` – Single HTML shell

### App Structure
- `App.tsx` – Route definitions, `ProtectedRoute`, `AdminRoute`, `GuestRouteGuard`
- Layouts: `MainLayout` (Header, Sidebar, BottomNav), `AuthLayout` (login/register)

### Key Concepts
- **Guest mode**: `loginAsGuest()` → `role: FREE`, no JWT; limited routes
- **Protected routes**: Require `isAuthenticated`
- **Admin routes**: Require `role === 'ADMIN'`
- **Guest allowed**: `/catalog`, `/product-finder`, `/bom-cross-reference` (and nested)

### State
- `stores/authStore.ts` – Zustand + persist; `user`, `token`, `isAuthenticated`, `isGuest`

### API Client
- `lib/api.ts` – Axios instance, base URL `VITE_API_URL/api`
- Request interceptor: adds `Authorization: Bearer <token>`
- Response interceptor: 401 → logout, redirect to `/login`

### Pages
| Path | Purpose |
|------|---------|
| `/login`, `/register` | Auth |
| `/dashboard` | Main dashboard |
| `/catalog`, `/catalog/category/:id`, `/catalog/part/:id` | Product catalog browse |
| `/catalog-list`, `/catalog-creator/*` | My catalogs |
| `/quotes`, `/quotes/new`, `/quotes/:id` | Quotes |
| `/projects`, `/projects/:id` | BOM/projects |
| `/videos`, `/video/:id` | Video academy |
| `/product-finder` | Product search (guest) |
| `/bom-cross-reference` | Cross-reference (guest) |
| `/managed-users`, `/assignments`, `/activity` | Management |
| `/pricing-contracts` | Pricing contracts (formerly cost tables) |
| `/my-price-contracts` | Assigned price contracts |
| `/team` | TurnKey team |
| `/admin`, `/admin/import-products` | Admin |

---

## 5. Backend Architecture

### Entry
- `backend/src/server.ts` – Express app, middleware, route mounting

### Middleware
- `helmet`, `cors`, `morgan`, `express.json`
- `auth.ts`: `authenticate` (JWT), `authorize(roles)`
- `upload.ts`: Multer for CSV, video, etc.
- `errorHandler`, `notFound`

### Route Structure
| Prefix | Purpose |
|--------|---------|
| `/api/public` | No auth – product search, BOM cross-ref, public catalogs |
| `/api/auth` | Login, register, me, change-password |
| `/api/catalogs` | Catalog CRUD |
| `/api/categories` | Category tree |
| `/api/parts` | Parts by catalog/category, bulk lookup |
| `/api/quotes` | Quote CRUD, PDF, CSV |
| `/api/projects` | Project/BOM CRUD |
| `/api/videos` | Video feed, view tracking |
| `/api/comments` | Video comments |
| `/api/customers` | Customer CRUD |
| `/api/cost-tables` | Pricing contracts (DB: cost_tables) |
| `/api/price-contracts` | Price contracts (ADMIN/RSM) |
| `/api/assignments` | Catalog/contract assignments |
| `/api/user-management` | Hierarchy, activity |
| `/api/teams` | TurnKey teams |
| `/api/admin` | Admin dashboard, users |

### Auth Flow
- Login: `POST /api/auth/login` → `{ user, token }`
- Protected routes: `Authorization: Bearer <token>`
- JWT payload includes `userId`, `role`

### Role Hierarchy
`ADMIN` > `RSM` > `DISTRIBUTOR` > `TURNKEY` > `BASIC` > `FREE`

---

## 6. Database (Prisma)

**Provider:** PostgreSQL  
**Schema:** `backend/prisma/schema.prisma`

### Main Models
- **User** – Roles, hierarchy (`assignedToDistributorId`, `assignedToRsmId`), `turnkeyTeamId`
- **Catalog**, **Category**, **Part** – Product catalog
- **Project**, **ProjectItem**, **ProjectRevision** – BOM/projects
- **Quote**, **QuoteItem**, **QuoteDiscount** – Quotes
- **Customer** – Customers for quotes
- **CostTable**, **CostTableItem** – Custom pricing (UI: “Pricing Contracts”)
- **PriceContract**, **PriceContractItem**, **UserPriceContractAssignment** – Assigned pricing
- **CatalogAssignment** – Catalogs assigned to users
- **Video**, **UserVideoView**, **Comment** – Video academy
- **TurnkeyTeam** – Teams
- **CrossReference** – BOM cross-reference
- **PriceHistory**, **Notification**, etc.

---

## 7. Deployment (Railway)

- **Frontend**: Static build (Vite) → served (e.g. static hosting or Node)
- **Backend**: `npm run build` → `node dist/server.js`
- **Env vars (backend)**: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `PORT`, etc.
- **Env vars (frontend)**: `VITE_API_URL` (backend URL)

---

## 8. Environment Variables

### Backend (`.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
PORT=3001
CORS_ORIGINS=https://your-frontend.railway.app
```

### Frontend (`.env`)
```
VITE_API_URL=https://your-backend.railway.app
```

---

## 9. Important Conventions

- **Pricing Contracts** (UI) = **Cost Tables** (DB: `cost_tables`)
- **Price Contracts** = Separate concept for ADMIN/RSM-assigned pricing overlays
- Guest users: no JWT; synthetic `user: { id: 'guest', role: 'FREE' }`; public API only
- Public catalogs: `Catalog.isPublic === true` for guest access
- Quote discount limits: removed; no role-based max discount is enforced

---

## 10. Quick Start (Local)

```bash
# Clone, install
npm install

# DB (PostgreSQL running)
cp backend/.env.example backend/.env   # Set DATABASE_URL, JWT_SECRET
npm run db:migrate
npm run db:seed

# Run
npm run dev   # Frontend: localhost:5173, Backend: localhost:3001
```

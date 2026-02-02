# Project / BOM – Revised Plan (Diagram + Recommendation)

This document compares the original flow plan with the new recommendation, then gives a single **revised phased implementation plan** that merges both.

---

## 1. Comparison: Original Plan vs Recommendation

| Area | Original plan | Recommendation | Decision (revised plan) |
|------|----------------|----------------|--------------------------|
| **Routes** | Projects list + modal create; Project Detail at `/projects/:id` | `/dashboard`, `/projects`, `/projects/new`, `/projects/:id`; ProtectedRoute | Use `/projects`, `/projects/new` (name upfront page or modal→redirect), `/projects/:id` (editor). Keep existing ProtectedRoute. |
| **New project flow** | Create modal on list → then open detail | Modal: name → POST create → Zustand set current project + **navigate to** `/projects/:newId`. Auto-save starts immediately. | **Name upfront**: modal or `/projects/new` page → POST → redirect to `/projects/:id`. Auto-save starts on editor load. |
| **State** | Not specified | `useProjectStore` (current project, BOM items, status), `useProjectsListStore` (list), `useAuthStore` (existing) | **Add** useProjectStore + useProjectsListStore. Keep useAuthStore. |
| **API – list** | GET `/projects` (existing) | GET `/` – list with summary: id, name, updatedAt, itemCount, **status** | Keep GET `/projects`; extend response to include **status** and itemCount (already have _count). |
| **API – create** | POST `/projects` (existing) | POST `/` – create with name → returns draft | Same; ensure we set **status: 'draft'** on create. |
| **API – detail** | GET `/projects/:id` (existing) | GET `/:id` – full project + BOM items array | Same; we already return items. Expose as “BOM items array” in API (from ProjectItem table). |
| **API – update** | PATCH project (name/desc); add/update/delete item endpoints | PATCH `/:id` – partial (e.g. add/remove items, qty, classification) | **Keep** separate item endpoints (POST/PATCH/DELETE items) for clarity; add PATCH `/:id` for name/description and **optional** bulk PATCH. Use POST `/:id/upload` for CSV. |
| **API – upload** | POST `/:id/upload-bom` (multer, 501) | POST `/:id/upload` – BOM CSV (replace or append) | **Rename/align** to POST `/:id/upload` (or keep upload-bom). Implement replace vs append via query/body. |
| **API – submit** | Not specified as single endpoint | POST `/:id/submit` – trigger review/cross-reference (async job) | **Add** POST `/:id/submit` → set status to processing, run auto-classify + cross-reference (sync for now; async job later). |
| **API – report** | Generate on finalize / on demand | GET `/:id/report` – latest report (or generate on-demand) | **Add** GET `/:id/report` – return report JSON or generate on-demand; use for View/Download/Email. |
| **BOM storage** | ProjectItem table (existing) | “bomItems JSON array” on Project | **Keep** ProjectItem table (better for querying, indexing, large BOMs). API exposes items as array; no schema change to JSON. |
| **Project status** | Optional DRAFT/SUBMITTED/FINALIZED | draft / reviewed / completed (or processing) | **Add** `status` to Project: `DRAFT` \| `SUBMITTED` \| `PROCESSING` \| `COMPLETED`. |
| **Editor UI** | Project Detail: list of lines + Upload / Sample / Product Finder | Single “Project Editor” page: **Tabs** (Upload, Product Finder, Manual Edit Table); **editable table** (Tanstack Table) with columns Part#, Description, Qty, Manufacturer, Classification, Actions | **Adopt** single editor page with Tabs + **Tanstack Table** for BOM (sortable, filterable, editable cells). Classification column (Panel/Accessory, WAGO/Non-WAGO/Unknown). |
| **Auto-save** | “Normal save on add/remove/update; optional Save draft” | **Debounce** (2–5s) on any change → PATCH; “Saving…” → “Saved” toast; optimistic updates | **Add** debounced auto-save (PATCH or item-level APIs); “Saving…” / “Saved” toast; optimistic updates where simple. |
| **Submit UX** | “Submit for Review” button | “Generate Report” button (disabled until valid) → POST /submit → **progress modal or polling** | **Add** “Submit for Review” → POST `/:id/submit` → show **progress** (polling or later WebSocket). Status: processing → completed. |
| **Validation** | Not specified | **Zod** (client) + express-validator (server); shared schemas if shared package | **Add** Zod for frontend forms/uploads; keep express-validator on backend; optional shared Zod schemas later. |
| **Performance** | Not specified | **Virtualized** table (react-window or Tanstack Virtual) for 1000+ items; paginate project list | **Plan** virtualization for BOM table in Phase 1 if >500 rows; paginate project list (optional Phase 1). |
| **Upgrades (later)** | Not specified | Tanstack Table, React Query, BullMQ+Redis, Socket.io, separate BomItem table (we have it!), shared Zod, feature flags | **Adopt** Tanstack Table in Phase 1; list React Query, BullMQ, Socket.io, shared Zod as **recommended upgrades** in later phase. |

---

## 2. Overall Architecture (Revised)

### Frontend – Routing & layout
- **React Router 6** (already in use).
- **Protected routes**: existing `<ProtectedRoute>`; redirect to login if not authenticated.
- **Routes**:
  - `/dashboard` – Main layout with sidebar (existing).
  - `/projects` – Projects list (table with optional mini sparklines, “New Project”).
  - `/projects/new` – New project: name (and optional description) upfront → POST create → redirect to `/projects/:id`.
  - `/projects/:id` – **Project editor** (single page: BOM build/edit, tabs: Upload | Product Finder | Table).

### Frontend – State (Zustand)
- **useAuthStore** – existing (token, user).
- **useProjectStore** – current project for editor: `{ project, items, status }`; set on load of `/projects/:id`; updated by auto-save and mutations.
- **useProjectsListStore** – list of projects (id, name, updatedAt, itemCount, status); fetched on Projects list mount; invalidate after create/update/delete.

### Backend – API structure
- **Base**: `/api/projects` (existing).
- **GET /** – List user’s projects; include `status`, `itemCount` (or _count.items).
- **POST /** – Create project (name, description?) → `status: DRAFT`.
- **GET /:id** – Full project + BOM items (from ProjectItem table); auth check `project.userId === req.user.id`.
- **PATCH /:id** – Partial update (name, description); optionally support bulk item updates if needed.
- **POST /:id/upload** – BOM CSV upload (replace or append); multer + PapaParse; validate columns; create/update ProjectItems.
- **POST /:id/submit** – Submit for review: set status to PROCESSING; run auto-classify + cross-reference; set COMPLETED and store report data (or trigger async job later).
- **GET /:id/report** – Return latest report (JSON); generate on-demand if missing for completed project.
- **Items**: keep existing **POST /:id/items**, **PATCH /:id/items/:itemId**, **DELETE /:id/items/:itemId** for add/edit/remove.
- **Suggest/apply**: keep **GET /:id/suggest-upgrades**, **POST /:id/apply-upgrade** (implement in Phase 2).

### Backend – Security & validation
- All project routes **authenticated**; **authorize** by `project.userId === req.user.id`.
- **Rate-limit** upload and submit (already have express-rate-limit; add stricter limits for these if needed).
- **Validate** CSV (columns, required fields); **sanitize** input (no formula injection for future Excel export).
- **Zod** or express-validator for request bodies.

### Schema (additions)
- **Project**: add `status` enum – `DRAFT` | `SUBMITTED` | `PROCESSING` | `COMPLETED` (default `DRAFT`).
- **ProjectItem**: already has partId, manufacturer, partNumber, description, quantity, isWagoPart, hasWagoEquivalent; add **classification** (e.g. Panel/Accessory) and **suggestedPartId** if useful for report.
- **Report**: store summary (e.g. JSON or new table) on project when status becomes COMPLETED; GET `/report` reads or regenerates.

---

## 3. Revised Phased Implementation Plan

### Phase 1 – Foundation: routing, state, editor, BOM build, auto-save

**Goal:** User can create a project (name upfront), open the editor, build BOM via upload + Product Finder + table edit, with auto-save and draft status.

**1.1 Routing & layout**
- Ensure `/projects` (list), `/projects/new` (name upfront), `/projects/:id` (editor) exist; ProtectedRoute wraps as now.
- **New project flow**: “New Project” from list → go to `/projects/new` (or modal); form: name (+ optional description) → POST `/api/projects` → redirect to `/projects/:newId`.

**1.2 Schema**
- Add `status` to Project: `DRAFT` | `SUBMITTED` | `PROCESSING` | `COMPLETED`; default `DRAFT`. Migration.

**1.3 Backend API**
- **GET /projects**: include `status` in response (and itemCount if not already).
- **POST /projects**: set `status: 'DRAFT'`.
- **POST /projects/:id/upload** (or keep `upload-bom`): implement BOM CSV parse (PapaParse); columns e.g. Manufacturer, PartNumber, Description, Quantity; **replace** or **append** (query/body); create/update ProjectItems; match catalog by part number where possible → set partId, isWagoPart.
- **GET /projects/:id/sample-bom** (or static file): return sample CSV (Manufacturer, PartNumber, Description, Quantity).
- **Security**: ensure every project endpoint checks `project.userId === req.user.id`.

**1.4 Frontend – state**
- **useProjectStore**: current project + items + status; load when entering `/projects/:id`; actions: setProject, setItems, updateItem, addItem, removeItem, setStatus.
- **useProjectsListStore**: list of projects; fetch on `/projects` mount; invalidate after create/update/delete.

**1.5 Frontend – Projects list**
- Table (simple or **Tanstack Table**): columns Name, Updated, Item count, Status, Actions (Open).
- “New Project” → navigate to `/projects/new`.
- Optional: Recharts mini-sparklines for item count trend; pagination if list is large.

**1.6 Frontend – New project page (`/projects/new`)**
- Form: project name (required), description (optional).
- Submit → POST create → redirect to `/projects/:id` (editor).

**1.7 Frontend – Project editor (`/projects/:id`)**
- **Single page** with **tabs**: “Upload” | “Product Finder” | “BOM Table”.
- **Upload tab**: dropzone (e.g. react-dropzone); “Replace” vs “Append”; parse CSV client-side for instant feedback (PapaParse); send file to POST `/:id/upload`; link to “Download sample CSV”.
- **Product Finder tab**: reuse existing Product Finder / cross-reference UI; “Add to BOM” → call POST `/:id/items` with selected part(s); refresh BOM in store.
- **BOM Table tab**: **Tanstack Table** (headless); columns: Part#, Manufacturer, Description, Qty, Classification (dropdown: WAGO/Non-WAGO/Unknown, Panel/Accessory if in schema), Actions (Remove). Editable cells (qty, classification); **debounced auto-save** (2–5s) via PATCH item or bulk PATCH; “Saving…” / “Saved” toast; optimistic updates.
- Optional: virtualize table (e.g. Tanstack Virtual) if BOM can be 1000+ rows.

**1.8 Auto-save**
- On any change in editor (add/remove/edit item): debounce 2–5s → PATCH item(s) or PATCH project; update useProjectStore; show “Saving…” then “Saved” (or error toast).

**Deliverables (Phase 1):** Routes and status; useProjectStore + useProjectsListStore; Projects list table; New project page; Project editor with Upload / Product Finder / BOM Table tabs; BOM CSV upload (replace/append) + sample download; Product Finder → add to BOM; editable BOM table with auto-save; security and validation on API.

---

### Phase 2 – Submit, classification, cross-reference, finalize

**Goal:** User can submit BOM for review, see classification (WAGO/Non-WAGO, Panel/Accessory, Identified/Unknown), resolve unknowns, see and apply WAGO suggestions, then accept & finalize.

**2.1 Backend**
- **POST /projects/:id/submit**: set status to PROCESSING; run **auto-classify** (match items to catalog → set partId, isWagoPart, classification); run **cross-reference** for non-WAGO/unknown → store suggestions; set status to COMPLETED (or SUBMITTED then COMPLETED after “finalize”). For now run **synchronously**; later replace with queue (BullMQ).
- **GET /projects/:id/suggest-upgrades**: implement: for each item (non-WAGO or unknown), lookup CrossReference + catalog → return list of { itemId, suggestedWagoPartId, partNumber, description, cost/tech note }.
- **POST /projects/:id/apply-upgrade**: implement: replace item’s partId, partNumber, description with chosen WAGO part; set isWagoPart, hasWagoEquivalent.
- **Classification**: persist Panel/Accessory and Identified/Unknown on ProjectItem (or derive from part); expose in GET `/:id`.

**2.2 Frontend – editor**
- “Submit for Review” button (disabled if no items or invalid). On submit → POST `/:id/submit` → show **progress** (polling GET `/:id` until status !== PROCESSING) or simple “Processing…” modal.
- After submit: show **Classification** view (same table with columns WAGO/Non-WAGO, Panel/Accessory, Identified/Unknown); filter/toggle. “Resolve unknown” → open catalog search → pick part → PATCH item (partId, isWagoPart).
- **Suggestions**: per row, show “WAGO equivalent: …” and “Apply”; call apply-upgrade; refresh items.
- “Accept & Finalize” → confirm → POST submit again or dedicated “finalize” endpoint that sets COMPLETED and generates report payload; then navigate to report view or “View Report” link.

**Deliverables (Phase 2):** POST submit with auto-classify + cross-reference; progress UX; classification view and resolve unknown; suggest/apply WAGO upgrades; Accept & Finalize; status lifecycle DRAFT → PROCESSING → COMPLETED.

---

### Phase 3 – Report: view, download, email

**Goal:** For completed projects, user can view report, download (PDF/Excel), and email.

**3.1 Backend**
- **GET /projects/:id/report**: if status COMPLETED, return report JSON (summary, before/after items, cost comparison, technical advantages); generate on-demand if not stored.
- **Report generation**: on finalize (or first GET report), compute and store (or always compute): original vs WAGO-substituted BOM, cost delta, list of advantages.
- **Download**: endpoint or same GET with `?format=pdf` or `?format=xlsx` → generate PDF/Excel and return file.
- **Email**: POST `/projects/:id/report/email` with `{ email }` → generate report (e.g. PDF), send via nodemailer.

**3.2 Frontend**
- **View Report**: page or section at `/projects/:id/report` (or tab): render summary, table, cost comparison, advantages.
- **Download or Email**: buttons “Download PDF”, “Download Excel”, “Email report” (with email input); call download/email endpoints; “Neither” → link “Back to Projects”.

**Deliverables (Phase 3):** GET report (JSON + optional format); report generation logic; View Report UI; Download PDF/Excel; Email report; back to Projects list.

---

### Phase 4 (optional) – Guest flow

**Goal:** “Continue as Guest” → limited project experience (temporary session, no persistence or temp project).

- Guest landing → “Project Page (Limited)”: same three entry points (Upload BOM, Product Finder, Download Sample); optional in-memory or session BOM; show classification/suggestions; CTA “Sign up to save”.
- Implement only if needed; can defer.

---

### Phase 5 (optional) – Scalability & DX upgrades

**Goal:** Better performance, DX, and scalability without changing the flow.

| Upgrade | Why | When |
|--------|-----|------|
| **Tanstack Query** | Caching, background refetch, invalidation on save | After Phase 1 or 2; replace raw Axios for projects/list/detail. |
| **BullMQ + Redis** | Async submit/report generation; retries; email when ready | When submit or report generation becomes slow; add POST submit → enqueue job → poll or WebSocket. |
| **WebSockets (e.g. Socket.io)** | Real-time “Classifying 45%…” and live project list | When you want progress without polling. |
| **Virtualized BOM table** | Smooth table for 1000+ rows | Phase 1 if large BOMs expected; else Phase 2. |
| **Shared Zod schemas** | One schema for BOM row, CSV, validation client + server | When adding validation; optional shared package. |
| **Feature flags** | Roll out editor/submit to beta users | Low effort; add when you have multiple audiences. |

---

## 4. Summary – Phased order

1. **Phase 1** – Routing (`/projects`, `/projects/new`, `/projects/:id`); Project status; useProjectStore + useProjectsListStore; Projects list; New project page; Project editor (tabs: Upload, Product Finder, BOM Table); BOM CSV upload + sample; Product Finder → add to BOM; Tanstack Table + debounced auto-save; API upload + security.
2. **Phase 2** – POST submit (auto-classify + cross-reference); progress UX; Classification view + resolve unknown; suggest/apply WAGO upgrades; Accept & Finalize; status lifecycle.
3. **Phase 3** – GET report; report generation; View Report UI; Download PDF/Excel; Email report.
4. **Phase 4** – Guest flow (optional).
5. **Phase 5** – Tanstack Query, BullMQ, WebSockets, virtualization, shared Zod, feature flags (optional).

---

## 5. Technical notes (unchanged)

- **BOM CSV**: columns e.g. Manufacturer, PartNumber, Description, Quantity; document in sample and validate on upload.
- **Catalog match**: Part number (and optionally manufacturer) → partId, isWagoPart on ProjectItem.
- **Cross-reference**: Reuse CrossReference table and bulk lookup for suggestions.
- **Panel vs Accessory**: Add to Part/catalog or ProjectItem if needed; otherwise derive in report only.

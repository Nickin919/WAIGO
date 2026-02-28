# Master Catalog vs Project Books – Canonical Rule

## Rule

- **There is only ONE Catalog: the MASTER Catalog.** It is the single source of truth for product data (parts, categories). It is identified by `isMaster: true` in the database; there must be exactly one such row.
- **All other entities in the same table are Project Books.** They are derived from or assigned for use in quotes, Quick Grid, and projects. Users get "assigned" project books (and optionally the Master is used as default). Project books can be created by:
  - **Catalog Creator** (user builds a custom set from Master),
  - **Convert to Project Book** (ADMIN/RSM converts a project BOM into a project book),
  - Or assigned by admin/RSM/distributor from existing project books.

So: **1 Catalog = MASTER. Everything else = Project Book.**

---

## Current State in the Codebase (after rewrites)

The app has had rewrites where "catalogs" were removed in favor of "project books," but the code still uses **"catalog"** in many places to mean either the Master or any project book. That can cause confusion.

### What is already aligned

| Layer | Current state |
|-------|----------------|
| **Database** | Table name is `project_books` (`@@map("project_books")`). Foreign keys use `project_book_id` in column names (e.g. `User.catalogId` → `project_book_id`, `CatalogAssignment.catalogId` → `project_book_id`). |
| **Single Master** | `isMaster: true` marks the one Master Catalog. Seed and server logic ensure only one Master exists. |
| **Some UI** | "My Project Books," "Project Book" dropdown on New Project, "Build project book," "Convert to Project Book" use the correct term. |

### Where "catalog" is still used (and can be misleading)

| Location | How it appears | Note |
|----------|----------------|--------|
| **Prisma model** | `model Catalog` | Model is still named `Catalog`; the table is `project_books`. So in code we "have many Catalogs" but semantically we have 1 Catalog (Master) + many Project Books. |
| **API routes** | `/catalogs`, `/assignments/me` returns `catalogs` | Response is really "Master (if applicable) + assigned project books." Callers may treat all as "catalogs." |
| **API / frontend variables** | `catalogId`, `catalogs`, `catalogApi`, `getCatalogs` | Used for both Master and project books. |
| **Quote form** | "Select a catalog" / dropdown of `catalogs` | Options are Master + assigned project books; label says "catalog." |
| **Assignments** | `CatalogAssignment`, "catalog assignments" | These are project book assignments (and Master can be in the list). |
| **Comments / docs** | "catalog" for any of them | Should reserve "catalog" for Master and use "project book" elsewhere. |

So: **database and some UI already say "project book"; backend and API still speak "catalog" for both Master and project books.** That can look like "multiple catalogs" instead of "one Catalog (Master) + many Project Books."

---

## Recommended Conventions (no breaking change required)

1. **Documentation and comments**  
   - Use **"Catalog"** or **"Master Catalog"** only for the single row with `isMaster: true`.  
   - Use **"Project Book"** for every other row in `project_books` and for user-facing concepts (assignments, quote source, Quick Grid source).

2. **UI labels**  
   - Where we list sources (e.g. quote form, New Project):  
     - Label the option with `isMaster: true` as **"Master Catalog"** (or "Catalog").  
     - Label all others as **"Project book"** (e.g. "Project book: …").  
   - Avoid saying "catalogs" when the list is Master + project books; prefer "Master Catalog / Project books" or "Product source."

3. **API**  
   - Keeping `catalogs` in responses is fine for compatibility.  
   - When adding new endpoints or payloads, prefer `projectBooks` (and optionally a separate `masterCatalog`) so the semantics match the rule.

4. **Schema**  
   - In Prisma, the `Catalog` model and `project_books` table can stay as-is.  
   - Add a short comment on the model: exactly one row is the Catalog (Master); all others are Project Books. See `backend/prisma/schema.prisma`.

---

## Possible Programming Issues

- **Enforcing exactly one Master**  
  The app assumes there is only one row with `isMaster: true`. Seed and server startup logic set/ensure this. There is no unique constraint on `is_master`; if multiple rows were ever set `isMaster: true`, code that does `findFirst({ where: { isMaster: true } })` would be non-deterministic. Consider adding a partial unique index so at most one row has `is_master = true` (optional, requires migration).

- **Assignments including Master**  
  When a user has no project book assignments, `getMyAssignments` returns the Master as the only option (so they can still quote and use Quick Grid). So "assignments" semantically include "can use Master" when no project books are assigned. That’s correct; just keep labeling so it’s clear that’s the Master Catalog, not "a catalog" among many.

- **Naming in code**  
  A full rename of `Catalog` → `ProjectBook` in Prisma and all references would be a large change. Not required to enforce the rule; the rule is semantic (1 Catalog = Master, rest = Project Books). Prefer clarifying docs and UI first, then consider a gradual rename in a later phase if desired.

---

## Summary

- **Canonical rule:** 1 Catalog = MASTER only. All other records in the same table = Project Books.  
- **Code today:** DB and some UI already use "project books"; model name and most API/frontend names still use "catalog" for both.  
- **Next steps:** Use this doc as the single source of truth; add schema comment; tighten UI labels to "Master Catalog" vs "Project book" where options are listed; optionally add a DB constraint so only one row can be Master.

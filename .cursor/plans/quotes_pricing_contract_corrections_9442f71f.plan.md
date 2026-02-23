---
name: Quotes pricing contract corrections
overview: Correct quote line-item pricing so list price and min qty always come from the MASTER catalog; when an RSM or Distributor uses a price contract, show contract cost and lock the discount %, pull margin from contract (editable), default qty to master min qty, and ensure backend snapshots and cost use master + contract rules.
todos: []
isProject: false
---

# Quotes: List Price from MASTER, Contract Cost/Discount/Margin, and Qty Default

## Current (incorrect) behavior

- In [QuoteForm.tsx](frontend/src/pages/quotes/QuoteForm.tsx), when a price contract is selected and a product is added, **list price** is set to the contract’s **cost** (`contractItem.costPrice` at line 299). That makes the “List Price” column show contract cost instead of catalog list price.
- **Min Qty** and default quantity use the part from the **selected catalog** (`part.minQty`), not necessarily the MASTER catalog.
- **Discount %** is editable for all users; it should be **locked** when the line is driven by a price contract (RSM/Distributor).
- **Margin %** should be populated from the contract’s suggested sell when available and remain **editable**.
- Backend [quote.controller.ts](backend/src/controllers/quote.controller.ts) uses `part.basePrice` and `part.minQty` from the part linked by `item.partId` (the catalog the user chose), and always computes `costPrice = listPrice * (1 - discountPct/100)`. It does not resolve the MASTER catalog part or use contract cost when a price contract is present.

## Target behavior


| Field                                        | Source                                                                                  | Editable                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| **List price**                               | MASTER catalog part `basePrice`                                                         | No (display only)                |
| **Min Qty**                                  | MASTER catalog part `minQty`                                                            | No (display only)                |
| **Cost** (for RSM/Distributor with contract) | Price contract item `costPrice`                                                         | No (implicit from contract)      |
| **Disc %**                                   | Price contract item `discountPercent` when contract applies                             | **Locked** when contract applies |
| **Margin %**                                 | From contract’s suggested sell when present                                             | **Yes** (unlocked, can modify)   |
| **Sell price**                               | `cost * (1 + margin%/100)`                                                              | Derived                          |
| **Qty**                                      | Default = MASTER part `minQty`; later BOM will supply when “Project BOM → Quote” exists | **Yes**                          |


## Implementation plan

### 1. Backend: Resolve MASTER catalog and contract cost in quote create/update

**File:** [backend/src/controllers/quote.controller.ts](backend/src/controllers/quote.controller.ts)

- **Resolve MASTER part per line item**
  - After loading `part` by `item.partId`, resolve the MASTER catalog (e.g. `prisma.catalog.findFirst({ where: { isMaster: true } })`), then find the part in that catalog by `part.partNumber` (same part number as `part`).
  - If a MASTER part is found, use `masterPart.basePrice` and `masterPart.minQty` for list price and min qty; otherwise fall back to the current `part.basePrice` / `part.minQty`.
- **Use contract cost when a price contract is present**
  - When `priceContractId` is set, load contract items for that contract (e.g. by `contractId`, and match by `partId` or by `seriesOrGroup` / part number as in the frontend’s `findContractItem`).
  - For each quote line, if a matching contract item exists, set `costPrice = contractItem.costPrice` instead of `listPrice * (1 - discountPct/100)`.
- **Snapshot and totals**
  - Set `snapshotPrice` and `snapshotMinQty` from the MASTER-derived list price and min qty.
  - Compute `sellPrice = costPrice * (1 + marginPct/100)` and `lineTotal = quantity * sellPrice`; recalc `total` from line totals.

Apply the same MASTER resolution and contract-cost logic in **updateQuote** when rebuilding items (same loop that creates `itemsToCreate`).

### 2. Backend: Expose MASTER catalog in assignments (optional but useful)

**File:** [backend/src/controllers/assignments.controller.ts](backend/src/controllers/assignments.controller.ts)

- In `getMyAssignments`, when building `catalogsPayload`, include `isMaster: true/false` from the catalog (add to the catalog `select` in the include so the frontend can identify the MASTER catalog and call part APIs against it).

### 3. Frontend: List price and min qty always from MASTER

**File:** [frontend/src/pages/quotes/QuoteForm.tsx](frontend/src/pages/quotes/QuoteForm.tsx)

- **Master catalog id**
  - From assignments (or catalog list), set `masterCatalogId` to the catalog where `isMaster === true`. If assignments don’t currently return `isMaster`, rely on the backend change in step 2 or on existing `catalogApi.getAll()` fallback that already filters by `isMaster` in error path; ensure at least one code path provides a way to know the master catalog (e.g. include `isMaster` in assignment catalogs).
- **When adding a product (addProduct, bulk import, CSV)**
  - **List price:** Always use MASTER catalog’s list price:
    - If `catalogId === masterCatalogId`, use `part.basePrice` and `part.minQty` (current part is already from MASTER).
    - If not, call `partApi.getByNumber(part.partNumber, masterCatalogId)`; if a part is returned, use its `basePrice` and `minQty` for list price and min qty; otherwise fall back to current `part.basePrice` and `part.minQty`.
  - **Min Qty (display):** Use the same MASTER part’s `minQty` as above.
  - **Default quantity:** Set default qty to MASTER part’s `minQty` (or part’s min qty when MASTER part is not found). Do not use contract `minQuantity` for the default qty.
- **When a price contract applies (RSM/Distributor, contract selected, matching contract item)**
  - **Cost:** Use `contractItem.costPrice` as the user’s cost (do not treat it as list price).
  - **List price:** As above, always from MASTER (and show in “List Price” column).
  - **Discount %:** Set from `contractItem.discountPercent` (or derive from list vs cost: `(1 - cost/listPrice)*100` if contract stores only cost). **Lock** the Discount % input when this line is contract-driven (e.g. `discountLocked` or `isContractPricing` flag on the line).
  - **Margin %:** Compute from contract’s suggested sell when present: `marginPct = (suggestedSellPrice / cost - 1) * 100`. Leave the Margin % input **editable** (no lock).
- **Bulk add and CSV:** Use the same rules: resolve MASTER part by part number for list price and min qty; when contract applies, use contract cost, set and lock discount %, set margin from suggested sell; default qty = MASTER min qty.

### 4. Frontend: Lock Discount % when contract applies

**File:** [frontend/src/pages/quotes/QuoteForm.tsx](frontend/src/pages/quotes/QuoteForm.tsx)

- Add a per-line flag (e.g. `discountLocked` or derive from “has contract + RSM/Distributor”) so that when the line is priced by a price contract, the Discount % cell is read-only and the bulk “Apply %” for discount does not change contract-driven lines (or only non-locked lines).
- In the table, render the Discount % as a disabled input or plain text when locked; keep Margin % and Qty editable.

### 5. LineItem shape and edit load

- **LineItem:** Add fields as needed, e.g. `discountLocked?: boolean` and ensure `productPrice` (list price) and `minQty` are always set from MASTER in add/bulk/CSV.
- **Edit quote load:** When loading an existing quote, list price and min qty come from snapshot (`snapshotPrice`, `snapshotMinQty`). After the backend stores MASTER list/min qty in snapshots, the existing mapping in QuoteForm (e.g. `productPrice: i.snapshotPrice ?? ...`, `minQty: i.snapshotMinQty ?? ...`) will show the correct values. Optionally set `discountLocked` for items that were created with a price contract (e.g. from `priceContractId` and possibly a stored or derived flag); if the backend doesn’t persist “locked”, derive it on load when `quote.priceContractId` is set and the line has contract-driven pricing.

### 6. Future: Project BOM → Quote (out of scope for this change)

- You noted that in the future a Project BOM may be turned into a quote and then quantity will come from that BOM. No implementation in this plan; only ensure the current default qty is MASTER `minQty` so that when BOM-to-quote is added, it can override quantity per line from the BOM.

---

## Summary of files to change


| Area     | File                        | Changes                                                                                                                                                                                                                                    |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend  | `quote.controller.ts`       | Resolve MASTER part per item; use contract item cost when `priceContractId` set; snapshot MASTER list + min qty; same in create and update.                                                                                                |
| Backend  | `assignments.controller.ts` | Include `isMaster` in catalog payload for `getMyAssignments` so frontend can identify master catalog.                                                                                                                                      |
| Frontend | `QuoteForm.tsx`             | Use MASTER catalog part for list price and min qty (and default qty); when contract applies use contract cost, set and lock discount %, set margin from contract; lock Discount % UI when contract-driven; keep Margin % and Qty editable. |


## Data flow (high level)

```mermaid
sequenceDiagram
  participant User
  participant QuoteForm
  participant API
  participant Backend

  User->>QuoteForm: Add product with price contract
  QuoteForm->>API: getByNumber(partNumber, masterCatalogId)
  API->>Backend: Part from MASTER
  Backend-->>QuoteForm: basePrice, minQty
  QuoteForm->>QuoteForm: listPrice = master.basePrice, minQty = master.minQty, qty default = master.minQty
  QuoteForm->>QuoteForm: cost = contractItem.costPrice, discountPct = contract (locked), margin from suggested sell (editable)
  User->>QuoteForm: Save quote
  QuoteForm->>Backend: createQuote(items)
  Backend->>Backend: Resolve MASTER part, contract item; costPrice from contract or list*(1-disc%); snapshot MASTER list/minQty
  Backend-->>QuoteForm: Quote created
```



No schema changes are required; existing `QuoteItem` and `PriceContractItem` fields are sufficient. The only optional backend addition is returning `isMaster` on assignment catalogs so the frontend can reliably resolve the MASTER catalog for part lookups.
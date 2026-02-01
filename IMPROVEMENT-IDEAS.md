# WAIGO App – Improvement Ideas

Ideas to make the application more intuitive, feature-rich, and enjoyable to use.

---

## 1. **Bulk Actions & Smart Filters on Catalog/Product Views**

**What:** Add checkboxes to product lists with bulk actions (e.g., "Add to Catalog", "Export selected", "Apply discount"). Add filters for category, price range, series, and search.

**Why:** Users often work with many products at once. Bulk actions and filters reduce repetitive clicks and make it easier to manage large catalogs.

**Impact:** High – saves time for distributors and admins.

---

## 2. **Saved Import Mappings & Import History**

**What:** Let users save column mappings by name (e.g., "WAGO Standard Template") and reuse them on future imports. Show an import history table with date, user, row count, and errors.

**Why:** Re-imports use the same CSV structure. Saving mappings avoids re-mapping every time. History helps with troubleshooting and auditing.

**Impact:** Medium–High – big win for repeat importers.

---

## 3. **Onboarding Wizard for New Users**

**What:** A short first-time wizard: choose role, set catalog, maybe add first product or import. Simple steps with progress indicator.

**Why:** New users often don’t know where to start. A guided flow improves activation and reduces support questions.

**Impact:** High – better first impression and adoption.

---

## 4. **Dark Mode & Accessibility**

**What:** Add a dark theme toggle. Ensure good contrast, keyboard navigation, and screen-reader support (ARIA labels, focus states).

**Why:** Many users prefer dark mode and work in low light. Strong accessibility broadens your audience and can help with compliance.

**Impact:** Medium – differentiator for usability and inclusiveness.

---

## 5. **Quick-Add Product from Catalog View**

**What:** “Quick add” button on product cards that adds the product to the current project/quote without leaving the catalog. Optional small modal for quantity.

**Why:** Switching between catalog and project/quote is slow. Quick-add keeps users in context and speeds up BOM building.

**Impact:** High – smoother workflow for power users.

---

## Bonus: Real-Time Collaboration on Quotes

**What:** Allow multiple users to view or edit a quote in real time (e.g., via WebSockets), with presence indicators.

**Why:** Distributors and customers often work together on quotes. Real-time collaboration reduces version confusion and speeds up approval.

**Impact:** High value, but higher implementation effort.

---

*Pick 1–2 ideas to start with; implement in small iterations.*

# Pricing Proposal PDF – Design Guide & Best Practices

This guide aligns the WAGO pricing proposal PDF with **quoting best practices** for 5–30 line items, with a **consistent multipage look** and a **clean, easy-to-scan** body.

---

## Goals

- **Identity on every page:** Proposal number, date, and page X of Y so the reader always knows which document they’re viewing.
- **Scannable line items:** Clear column headers, right-aligned numbers, enough row height (no cramming). For 5–30 parts, the table is the main focus.
- **Consistent multipage:** Same header and footer on every page; table header repeated when the table continues; optional “Bill To” or “PP#” in header on continuation pages.
- **Clear totals:** Subtotal and total stand out (bold, size, or a distinct block).
- **Minimal clutter:** Legend (* / †) and terms/notes are present but don’t compete with the line items.

---

## Best Practices Applied

| Practice | Application |
|----------|-------------|
| **Visual hierarchy** | Document title > section labels (Bill To, line items, totals) > body text. Use size and weight, not only color. |
| **Table readability** | 10–11pt body; 20–24pt effective row height; right-align Qty, Price, Total; left-align Part # and Description. Optional zebra striping for long tables. |
| **Whitespace** | Consistent padding (e.g. 16–24px); space between sections; avoid walls of text. |
| **Contrast** | Dark text (#111827 / #1f2937) on light background; gray only for labels and secondary text (#6b7280). |
| **Multipage consistency** | Same header bar and footer on every page; table header row repeated on continuation pages; footer: disclaimer + “Page X of Y”. |
| **Totals prominence** | Totals section with border or background; TOTAL in larger, bold type. |

---

## Style Variants

Three example styles are provided. All use the same content and structure; only the **table and section styling** differ.

### Style A – Clean minimal

- **Table:** Light gray header row; thin row dividers; no zebra. Plenty of white space.
- **Best for:** Short quotes (5–15 lines), customers who prefer a simple, uncluttered look.
- **Files:** `docs/quote-pdf-sample-style-a.html`, `docs/sample-pricing-proposal-style-a.pdf`

### Style B – Professional zebra (recommended)

- **Table:** Gray header; alternating light gray/white row backgrounds; subtle row borders. Easier to follow across many lines.
- **Best for:** 15–30 line items; multipage quotes where the table spans pages.
- **Multipage footer (best practice):**
  - **Last page only:** Terms, Contact block, and the full footer message (“This is a pricing proposal, not an official quote. Thank you for your business.”). This keeps the closing content and disclaimer in one place.
  - **Continuation pages:** A light footer with a thin border and the message “Continued on the next page” plus “Page X of Y.” No terms or contact on these pages.
- **Header logos (Style B):** Two logo areas in the header:
  - **RSM logo (left, primary):** Recommended **180×60 px** (or proportional). Used for: the quote owner’s RSM (if the owner is a Basic/Direct user assigned to an RSM), or the quote owner’s own logo if they are an RSM.
  - **Distributor logo (right, smaller):** Recommended **120×40 px**. Used for: the quote owner’s assigned distributor (if Basic/Direct), or the quote owner’s own logo if they are a Distributor.
- **Where logos are stored:** Each user has an optional **Company logo** (`User.logoUrl`) editable in Profile (RSM and Distributor roles). When generating the PDF, resolve the quote owner’s RSM and Distributor (from `userId` → `assignedToRsmId` / `assignedToDistributorId`), then use each entity’s `logoUrl` for the corresponding header slot.
- **Files:** `docs/quote-pdf-sample-style-b.html`, `docs/sample-pricing-proposal-style-b.pdf`

### Style C – Classic bordered

- **Table:** Full grid (vertical and horizontal lines); no row fill. Formal, “invoice-like” look.
- **Best for:** Customers or regions that expect a more traditional quote layout.
- **Files:** `docs/quote-pdf-sample-style-c.html`, `docs/sample-pricing-proposal-style-c.pdf`

---

## Structure (All Styles)

1. **Header (every page)**  
   **Style B:** RSM logo (left, 180×60 px) · “PRICING PROPOSAL” + Distributor logo (right, 120×40 px) · Proposal # · Date · Page X of Y.  
   Other styles: Logo/brand left · “PRICING PROPOSAL” right · Proposal # · Date · Page X of Y

2. **Meta (page 1 only)**  
   Proposal #, Date, Price contract (if any) in one compact bar.

3. **Bill To (page 1 only)**  
   Customer name, address, email.

4. **Line items table**  
   Part Number | Description | Qty | Price | Total  
   - Header row repeated on each page when table continues.  
   - * and † with legend below table (or in footer if space is tight).

5. **Totals**  
   Subtotal; TOTAL (emphasized).

6. **Terms & notes**  
   Short blocks; not dominant.

7. **Contact**  
   WAGO contact + Distributor (photo placeholder, name, email, phone). **Style B:** Only on the last page (with Terms and full footer).

8. **Footer**  
   - **Style B (multipage):** On continuation pages, a light footer with border + “Continued on the next page” + Page X of Y. On the **last page only**, the full footer: “This is a pricing proposal, not an official quote. Thank you for your business.” + page number.  
   - **Styles A & C:** Same full footer on every page.

---

## Generating Sample PDFs

From the backend folder:

```bash
npx tsx scripts/generate-sample-pricing-proposal-pdf.ts     # all three styles
npx tsx scripts/generate-sample-pricing-proposal-pdf.ts a  # Style A only
npx tsx scripts/generate-sample-pricing-proposal-pdf.ts b  # Style B only
npx tsx scripts/generate-sample-pricing-proposal-pdf.ts c  # Style C only
```

This produces 2–3 page sample PDFs (18 line items so the table spans 2 pages). Outputs:

- `docs/sample-pricing-proposal-style-a.pdf`
- `docs/sample-pricing-proposal-style-b.pdf`
- `docs/sample-pricing-proposal-style-c.pdf`

Use these to compare readability and multipage consistency before locking in one style for `GET /quotes/:id/pdf`.

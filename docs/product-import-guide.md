# Product Import Tool - Complete Guide

## Overview

The Product Import Tool allows ADMIN users to import large product catalogs from CSV files with intelligent column mapping, preview capabilities, and price change tracking.

---

## Features

### ✅ Intelligent Column Mapping
- Auto-detects column mappings from headers
- Manual override for any column
- Validates required fields
- Prevents duplicate mappings

### ✅ Flexible Import Modes
- **Upsert Mode** (default) - Creates new products, updates existing
- **Update-Only Mode** - Only updates existing, reports not-found items

### ✅ Price Change Tracking
- Automatically logs all price changes
- Groups changes by import batch
- Historical price tracking per product

### ✅ Preview Before Import
- Shows first 10 rows of transformed data
- Displays import mode and column count
- Summary statistics

### ✅ Comprehensive Results
- Created count
- Updated count
- Price changes logged
- Errors with row numbers
- Not-found items (update-only mode)

---

## User Flow

### Step 1: Upload CSV
1. Click "Import Products" from Admin Dashboard
2. Browse and select CSV file
3. File is parsed automatically

### Step 2: Map Columns
1. Review auto-detected column mappings
2. Adjust mappings as needed using dropdowns
3. Toggle "Update-Only Mode" if desired
4. Validation errors shown in real-time
5. Click "Continue to Preview"

### Step 3: Preview Data
1. Review first 10 rows of transformed data
2. See summary: total rows, mapped columns, mode
3. Click "Import X Products" to proceed

### Step 4: Import
1. Progress indicator while importing
2. Results summary displayed
3. Options to view products or import another file

---

## CSV Format

### Required Columns (Normal Mode)
- **Part Number** - Unique identifier (upsert key)
- **Category** - Product category (creates if doesn't exist)
- **Price** - List price per unit

### Required Columns (Update-Only Mode)
- **Part Number** - Only field required

### Optional Columns
- Series
- Description
- English Description
- List Price Per 100
- WAGO Ident #
- Distributor Discount (%)
- Min Qty

### Example CSV

```csv
Part Number,Series,Description,Category,Price Each,List Price Per 100,WAGO Ident,Discount %,Min Qty
2002-1201,2002,Push-in CAGE CLAMP Terminal Block,Terminal Blocks,0.85,75.00,210-101,15,1
2002-1401,2002,4-pole Terminal Block,Terminal Blocks,1.45,130.00,210-141,15,1
221-412,221,LEVER-NUTS 2-Conductor,Splicing Connectors,0.35,28.00,221-412,10,5
```

---

## Column Mapping Intelligence

### Auto-Detection Rules

The system uses fuzzy matching to detect columns:

| CSV Header Examples | Detected As |
|---------------------|-------------|
| "Part Number", "Part No", "SKU", "Part" | Part Number |
| "WAGO Ident", "Internal Ident", "Ident" | WAGO Ident |
| "Series", "Product Series", "Category" | Category/Series |
| "List Price Per 100", "Price/100" | List Price Per 100 |
| "Price Each", "List Price Each", "Price EA" | Price |
| "English Desc", "Eng Desc" | English Description |
| "Description", "Desc" | Description |
| "Discount", "ACP %" | Distributor Discount |
| "Multiples", "Min Qty", "Box Qty", "Package Qty" | Min Qty |

### Manual Override

Any auto-detected mapping can be manually changed via dropdown selectors.

---

## Import Logic

### Upsert Process (Normal Mode)

For each row:

1. **Check if Part Number exists** in catalog
2. **If EXISTS**:
   - Update all provided fields
   - Track price change if price differs
   - Leave unchanged fields as-is
3. **If NOT EXISTS**:
   - Validate required fields (Part Number, Category, Price)
   - Create new product
   - Auto-create category if doesn't exist

### Update-Only Mode

For each row:

1. **Check if Part Number exists** in catalog
2. **If EXISTS**:
   - Update provided fields
   - Track price changes
3. **If NOT EXISTS**:
   - Add to "not found" list
   - Do NOT create new product
   - Report at end of import

---

## Price Change Tracking

### Automatic Logging

When a price changes during import:

```typescript
{
  partNumber: "2002-1201",
  oldPrice: 0.85,
  newPrice: 0.92,
  changedBy: "admin-user-id",
  changedAt: "2024-01-15T10:30:00Z",
  importBatch: "import_1705318200000"
}
```

### Batch Grouping

All price changes from a single import are grouped by `importBatch` ID for auditing.

### Query Price History

```
GET /api/admin/products/:partNumber/price-history?catalogId=xxx
```

---

## API Endpoints

### 1. Bulk Import
```
POST /api/admin/products/import
Authorization: Bearer {admin-token}

Body:
{
  "products": [
    {
      "partNumber": "2002-1201",
      "series": "2002",
      "category": "Terminal Blocks",
      "price": 0.85,
      "description": "Push-in Terminal Block",
      ...
    }
  ],
  "updateOnly": false,
  "catalogId": "catalog-uuid"
}

Response:
{
  "created": 150,
  "updated": 45,
  "priceChanges": 12,
  "notFound": [],
  "errors": ["Row 23: Missing Category"],
  "importBatch": "import_1705318200000"
}
```

### 2. Get Price History
```
GET /api/admin/products/:partNumber/price-history?catalogId=xxx

Response:
{
  "partNumber": "2002-1201",
  "currentPrice": 0.92,
  "history": [
    {
      "oldPrice": 0.85,
      "newPrice": 0.92,
      "changedBy": { "email": "admin@wago.com", "firstName": "Admin" },
      "changedAt": "2024-01-15T10:30:00Z",
      "importBatch": "import_1705318200000"
    }
  ]
}
```

### 3. Get Import Batch Summary
```
GET /api/admin/products/import-batch/:batchId

Response:
{
  "batchId": "import_1705318200000",
  "totalChanges": 12,
  "changes": [...]
}
```

### 4. Get Import Statistics
```
GET /api/admin/products/import-stats?catalogId=xxx

Response:
{
  "totalParts": 248,
  "activeParts": 245,
  "inactiveParts": 3,
  "totalPriceChanges": 156,
  "recentImports": [...]
}
```

---

## Database Schema

### Part Model (Updated)
```prisma
model Part {
  id                  String   @id @default(uuid())
  catalogId           String
  categoryId          String
  partNumber          String   @unique // Upsert key
  series              String?  // NEW
  description         String
  englishDescription  String?  // NEW
  basePrice           Float?   // Renamed from price
  listPricePer100     Float?   // NEW
  wagoIdent           String?  // NEW
  distributorDiscount Float    @default(0) // NEW
  minQty              Int      @default(1)
  active              Boolean  @default(true) // NEW
  
  priceHistory        PriceHistory[]
}
```

### PriceHistory Model (NEW)
```prisma
model PriceHistory {
  id          String   @id @default(uuid())
  partId      String
  partNumber  String
  oldPrice    Float
  newPrice    Float
  changedById String
  changedAt   DateTime @default(now())
  importBatch String?  // Groups changes from same import
  
  part        Part     @relation(...)
  changedBy   User     @relation(...)
}
```

---

## Validation Rules

### Normal Mode (Upsert)
- ✅ Part Number (always required)
- ✅ Category (required for NEW products only)
- ✅ Price (required for NEW products only)
- ⚠️ Existing products can be updated with partial data

### Update-Only Mode
- ✅ Part Number (only required field)
- ⚠️ Products not found are reported, not created
- ⚠️ No validation on category/price since not creating new

### Field Validation
- Part Number: Must not be empty
- Price: Must be positive number
- Min Qty: Must be positive integer
- Discount: Must be between 0-100
- All text fields: Trimmed, null if empty

---

## Error Handling

### Import Errors
Errors are collected with row numbers:

```
Row 23: Missing Category (required for new products)
Row 45: Missing Price (required for new products)
Row 67 (ABC-123): Foreign key constraint failed
```

### Validation Errors (Before Import)
- "Required field 'Part Number' is not mapped"
- "Required field 'Category' is not mapped"
- "Each field can only be mapped once"

### File Errors
- "Please upload a CSV file"
- "CSV file is empty"
- "Maximum 25,000 products per import"

---

## Performance

### Limits
- **Max rows per import:** 25,000
- **Preview rows:** 10
- **Price history per part:** 50 records
- **Recent imports shown:** 10 batches

### Processing Speed
- Small files (<1K rows): ~2-5 seconds
- Medium files (1K-5K rows): ~10-20 seconds
- Large files (5K-25K rows): ~1-3 minutes

---

## Best Practices

### 1. Use Update-Only for Price Updates
If you're only updating prices on existing products:
- Enable "Update-Only Mode"
- Only include Part Number and Price columns
- Much faster, no risk of creating duplicates

### 2. Test with Small Sample First
- Import first 100 rows
- Verify mappings and results
- Then import full file

### 3. Backup Before Major Imports
```sql
-- Export current products
SELECT * FROM parts WHERE catalog_id = 'xxx';
```

### 4. Review Price History
After import, check price history for unexpected changes:
```
GET /api/admin/products/import-batch/{batchId}
```

### 5. Category Organization
- Use consistent category names
- Categories auto-create if missing
- Consider pre-creating categories for better organization

---

## CSV Preparation Tips

### Clean Your Data
- Remove empty rows
- Trim whitespace
- Ensure consistent formatting

### Handle Special Characters
- Quotes in descriptions: Use "" (double quotes)
- Commas in text: Wrap in quotes
- Line breaks: Avoid or use \n

### Price Formatting
- Use decimal notation: `0.85` not `$0.85`
- No currency symbols
- No thousands separators

### Example Cleanup
```csv
Before:
Part Number,Description,Price
2002-1201,"Terminal Block, 2-pole",$0.85

After:
Part Number,Description,Price
2002-1201,"Terminal Block 2-pole",0.85
```

---

## Troubleshooting

### "Required field not mapped"
- Check that Part Number, Category, and Price are mapped
- In update-only mode, only Part Number is required

### "Each field can only be mapped once"
- Review dropdowns - same field selected twice
- Change one to "Skip this column"

### "Missing Category (required for new products)"
- Product doesn't exist and no category provided
- Either: provide category, or enable update-only mode

### "Maximum 25,000 products per import"
- Split your CSV into multiple files
- Import in batches

### Import seems slow
- Expected for large files
- Don't close browser during import
- Check network tab for progress

---

## UI Test IDs (For Automation)

```typescript
// Upload step
'input-file-upload' - Hidden file input
'button-browse-file' - Browse button trigger

// Mapping step
'select-mapping-0' - First column dropdown
'select-mapping-1' - Second column dropdown
'switch-update-only' - Update-only mode toggle
'button-continue-to-preview' - Proceed button

// Preview step
'button-import' - Final import button

// Complete step
'button-view-products' - Navigate to products
```

---

## Example Workflow

### Scenario: Monthly Price Update

1. **Export current catalog** (for backup)
2. **Receive price update CSV** from supplier
3. **Open Import Tool** in Admin Dashboard
4. **Upload CSV**
5. **Enable "Update-Only Mode"**
6. **Map columns**:
   - Part Number → Part Number
   - New Price → List Price (Each)
   - Skip other columns
7. **Preview** - Verify correct products
8. **Import** - Execute update
9. **Review results**:
   - 245 products updated
   - 3 not found (discontinued items)
   - 189 price changes logged
10. **Check price history** for specific parts if needed

### Scenario: New Catalog Import

1. **Prepare CSV** with all product data
2. **Upload CSV**
3. **Keep "Upsert Mode"** (default)
4. **Map all columns**:
   - Map all available fields
   - Skip unused columns
5. **Preview** - Check data transformation
6. **Import** - Create new products
7. **Review results**:
   - 1,248 products created
   - 0 updated
   - 0 errors

---

## Security & Permissions

### Access Control
- **Admin-only** feature
- Requires ADMIN role in JWT token
- All endpoints protected with `authorize('ADMIN')`

### Audit Trail
- All imports logged with user ID
- Price changes tracked with who/when
- Import batches for grouping

---

## Future Enhancements

### Potential Features
- [ ] Schedule recurring imports
- [ ] Email notifications on completion
- [ ] Compare CSV before importing
- [ ] Rollback import batch
- [ ] Export validation report
- [ ] Import history dashboard
- [ ] Duplicate detection warnings
- [ ] Bulk update by filter

---

## Technical Implementation

### Frontend Stack
- React 18 + TypeScript
- PapaParse for CSV parsing
- React Hot Toast for notifications
- Tailwind CSS for styling

### Backend Stack
- Express.js + TypeScript
- Prisma ORM
- PostgreSQL database
- Admin authentication required

### CSV Parsing
```typescript
Papa.parse(file, {
  complete: (results) => {
    const headers = results.data[0];
    const dataRows = results.data.slice(1);
    // Auto-detect mappings
  }
});
```

### Upsert Logic
```typescript
// Check existing by catalogId + partNumber
const existing = await prisma.part.findUnique({
  where: {
    catalogId_partNumber: { catalogId, partNumber }
  }
});

if (existing) {
  // Update with price tracking
  await prisma.part.update({...});
  if (priceChanged) {
    await prisma.priceHistory.create({...});
  }
} else {
  // Create new
  await prisma.part.create({...});
}
```

---

## Monitoring & Analytics

### Import Statistics
```
GET /api/admin/products/import-stats?catalogId=xxx
```

Shows:
- Total parts in catalog
- Active vs inactive
- Total price changes ever
- Recent import batches

### Price History by Part
```
GET /api/admin/products/:partNumber/price-history
```

Shows last 50 price changes for a specific part.

### Import Batch Details
```
GET /api/admin/products/import-batch/:batchId
```

Shows all price changes from a specific import.

---

## Complete Feature Checklist

### ✅ Implemented
- [x] CSV file upload
- [x] Intelligent column mapping
- [x] Auto-detection algorithm
- [x] Manual mapping override
- [x] Update-only mode toggle
- [x] Required field validation
- [x] Duplicate mapping detection
- [x] Data preview (first 10 rows)
- [x] Upsert logic (create or update)
- [x] Price change tracking
- [x] Import batch grouping
- [x] Error collection with row numbers
- [x] Not-found reporting (update-only)
- [x] Results summary UI
- [x] Admin-only access control
- [x] Category auto-creation
- [x] Multi-step wizard UI
- [x] Progress indicators
- [x] Test IDs for automation

### 📋 Database Migrations Needed

```bash
cd backend
npx prisma migrate dev --name add-product-import-fields
npx prisma generate
```

This adds:
- New fields to Part model (series, englishDescription, wagoIdent, etc.)
- PriceHistory table
- Relations and indexes

---

## Support

### Common Questions

**Q: Can I update just prices without other fields?**
A: Yes! Enable "Update-Only Mode" and only map Part Number and Price columns.

**Q: What happens if Part Number doesn't exist?**
A: In normal mode, it creates a new product. In update-only mode, it reports it as "not found".

**Q: How do I undo an import?**
A: Currently manual. Future: rollback feature using importBatch ID.

**Q: Can I import into multiple catalogs?**
A: Each import targets one catalog. Run separate imports for multiple catalogs.

**Q: What's the maximum file size?**
A: 25,000 rows per file. Split larger files into batches.

---

**Ready to import?** Head to Admin Dashboard → Import Products!

# Catalog Creator Feature - Complete Guide

## Overview

The Catalog Creator allows users to build custom product catalogs by selecting items from a tree-based browser or bulk importing part numbers. Features hierarchical visibility so users can see catalogs from their subordinates.

---

## Key Features

### ✅ Tree-Based Product Browser
- Products organized by category
- Collapsible/expandable tree nodes
- Visual hierarchy with folder icons
- Category-level "select all" checkbox with indeterminate state
- Individual product selection

### ✅ Bulk Part Number Import
- Paste part numbers (one per line)
- Automatic lookup and matching
- Shows found vs not-found results
- Adds to existing selection (no duplicates)

### ✅ Search & Filter
- Real-time search across:
  - Part numbers
  - Product names
  - Descriptions
  - Categories
- Filters tree while maintaining structure

### ✅ Selected Products Panel
- Visual display of all selected products
- Quick remove individual products
- Clear all selection
- Shows count

### ✅ Full CRUD Operations
- Create new catalogs
- Edit existing catalogs
- Delete catalogs
- Update product selections

### ✅ Hierarchical Visibility
- Users see their own catalogs
- **TurnKey**: See team members' catalogs
- **Distributor**: See assigned users' catalogs
- **RSM**: See regional catalogs
- **Admin**: See all catalogs

---

## User Flow

### Creating a New Catalog

1. **Navigate** to "My Catalogs" in sidebar
2. **Click** "New Catalog" button
3. **Enter** catalog name and description
4. **Select products** using one of three methods:
   - **Tree Browser**: Check individual products or entire categories
   - **Bulk Import**: Paste part numbers (one per line)
   - **Search**: Filter and select specific products
5. **Review** selected products in bottom panel
6. **Click** "Save Catalog"

### Bulk Import Method

1. Click **"Bulk Import"** card
2. **Paste** part numbers in textarea:
```
2002-1201
221-412
750-504
787-1668
```
3. **Click** "Import Part Numbers"
4. **Review** results:
   - ✅ Added 3 products
   - ❌ 1 not found: ABC-999
5. **Continue** selecting more products if needed
6. **Save** catalog

### Editing Existing Catalog

1. Navigate to **"My Catalogs"**
2. **Click** "Edit" on any catalog card
3. **Modify** name, description, or product selection
4. **Save** changes

---

## UI Components

### 1. Catalog List Page

```
┌──────────────────────────────────────────────────┐
│  My Catalogs                   [+ New Catalog]   │
├──────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ 📁 Catalog │ │ 📁 Catalog │ │ 📁 Catalog │  │
│  │ Name       │ │ Name       │ │ Name       │  │
│  │ 42 products│ │ 128 products│ │ 65 products│  │
│  │ by Admin   │ │ by John    │ │ by Sarah   │  │
│  │ [Edit] [×] │ │ [Edit] [×] │ │ [Edit] [×] │  │
│  └────────────┘ └────────────┘ └────────────┘  │
└──────────────────────────────────────────────────┘
```

### 2. Catalog Creator (2-Column Layout)

```
┌──────────────────────────────────────────────────────────┐
│  ← Create Catalog                    [Save Catalog]      │
├─────────────────┬────────────────────────────────────────┤
│ Catalog Details │  Product Tree                          │
│ ┌─────────────┐ │  [Search products...]                  │
│ │ Name *      │ │  [Expand All] [Collapse All]          │
│ │ Description │ │  ┌────────────────────────────────────┐│
│ └─────────────┘ │  │ ☑ Terminal Blocks (3/10)          ││
│                 │  │   ☑ 2002-1201                     ││
│ Bulk Import     │  │   ☐ 2002-1401                     ││
│ ┌─────────────┐ │  │   ☑ 2002-1301                     ││
│ │ Paste part  │ │  │ ☐ Electronics (0/15)              ││
│ │ numbers:    │ │  │ ☑ Automation (5/8)                ││
│ │ 2002-1201   │ │  └────────────────────────────────────┘│
│ │ 221-412     │ │                                        │
│ │             │ │                                        │
│ │[Import]     │ │                                        │
│ └─────────────┘ │                                        │
├─────────────────┴────────────────────────────────────────┤
│ Selected Products (42)             [Clear All]           │
│ [2002-1201 ×] [221-412 ×] [750-504 ×] [2002-1301 ×] ... │
└──────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Get Visible Catalogs
```
GET /api/catalog-creator/my-catalogs
Authorization: Bearer {token}

Response:
[
  {
    "id": "cat-123",
    "name": "Industrial Controls",
    "description": "Custom catalog for...",
    "creatorName": "John Doe",
    "itemCount": 42,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-20T15:30:00Z"
  }
]
```

### 2. Get Catalog Detail
```
GET /api/catalog-creator/detail/:id
Authorization: Bearer {token}

Response:
{
  "catalog": {
    "id": "cat-123",
    "name": "Industrial Controls",
    "description": "...",
    "creatorName": "John Doe"
  },
  "items": {
    "products": [...], // Full product objects
    "categoryIds": [] // Selected category IDs
  }
}
```

### 3. Create Catalog
```
POST /api/catalog-creator/create
Authorization: Bearer {token}

Body:
{
  "name": "My Custom Catalog",
  "description": "Optional description",
  "productIds": ["prod-1", "prod-2", ...],
  "categoryIds": ["cat-1"] // Optional: entire categories
}

Response:
{
  "id": "cat-456",
  "name": "My Custom Catalog",
  ...
}
```

### 4. Update Catalog
```
PATCH /api/catalog-creator/update/:id
Authorization: Bearer {token}

Body:
{
  "name": "Updated Name",
  "description": "Updated description",
  "productIds": ["prod-1", "prod-3", ...] // Replaces all items
}
```

### 5. Delete Catalog
```
DELETE /api/catalog-creator/delete/:id
Authorization: Bearer {token}

Response: 204 No Content
```

### 6. Bulk Lookup Part Numbers
```
POST /api/catalog-creator/lookup-parts
Authorization: Bearer {token}

Body:
{
  "partNumbers": ["2002-1201", "221-412", "ABC-999"]
}

Response:
{
  "products": [
    { "id": "prod-1", "partNumber": "2002-1201", ... },
    { "id": "prod-2", "partNumber": "221-412", ... }
  ],
  "notFound": ["ABC-999"]
}
```

### 7. Get Products for Catalog
```
GET /api/catalog-creator/products-for-catalog?catalogId=xxx
Authorization: Bearer {token}

Response:
{
  "products": [...]  // Up to 10,000 active products
}
```

---

## Database Schema

### Catalog Model (Existing, Enhanced)
```prisma
model Catalog {
  id          String
  name        String
  description String?
  isPublic    Boolean  @default(false)
  createdById String
  createdAt   DateTime
  updatedAt   DateTime
  
  catalogItems CatalogItem[] // Junction to products
}
```

### CatalogItem Model (Junction Table)
```prisma
model CatalogItem {
  id         String
  catalogId  String
  productId  String?   // Individual product
  categoryId String?   // Or entire category
  addedAt    DateTime
  
  catalog    Catalog
  product    Part?
  category   Category?
}
```

This allows:
- Selecting individual products
- Selecting entire categories
- Flexible organization

---

## Frontend Component Structure

### CatalogList.tsx
- Lists all visible catalogs
- Shows creator name, item count
- Edit and delete actions
- Grid layout with cards

### CatalogCreator.tsx
- Multi-step form
- Tree-based product browser
- Bulk import textarea
- Selected products panel
- Save/update logic

### Key Features

#### Tree Component
```typescript
<TreeNodeComponent 
  node={node}
  depth={0}
/>
```

Renders:
- Category nodes with folder icons
- Product nodes with package icons
- Checkboxes with indeterminate state
- Selection count badges
- Expand/collapse buttons

#### Bulk Import
```typescript
<textarea
  value={bulkImportText}
  onChange={(e) => setBulkImportText(e.target.value)}
  placeholder="2002-1201
221-412
750-504"
  data-testid="textarea-bulk-import"
/>
<button onClick={handleBulkImport}>
  Import Part Numbers
</button>
```

#### Selected Products Display
```typescript
{selectedProducts.map(product => (
  <div className="badge">
    {product.series || product.partNumber}
    <button onClick={() => removeProduct(product.id)}>
      <X />
    </button>
  </div>
))}
```

---

## Hierarchical Visibility

### Who Sees What

**FREE Users:**
- Cannot create catalogs

**BASIC Users:**
- See only their own catalogs

**TURNKEY Users:**
- See own catalogs
- See team members' catalogs

**DISTRIBUTOR Users:**
- See own catalogs
- See catalogs from assigned users

**RSM Users:**
- See own catalogs
- See catalogs from assigned distributors
- See catalogs from users under those distributors

**ADMIN Users:**
- See ALL catalogs from all users

### Access Control

Backend enforces visibility:
```typescript
async function getSubordinateUserIds(userId: string, role: string) {
  switch (role) {
    case 'ADMIN': return allUserIds;
    case 'RSM': return [self, distributors, theirUsers];
    case 'DISTRIBUTOR': return [self, assignedUsers];
    case 'TURNKEY': return [teamMembers];
    default: return [self];
  }
}
```

---

## Use Cases

### 1. Distributor Creates Customer Catalog

**Scenario:** ABC Electric creates catalog for ACME Corp customer

1. Distributor logs in
2. Creates new catalog: "ACME Corp - Control Panel Parts"
3. Searches for relevant products
4. Selects "Terminal Blocks" category (all products)
5. Bulk imports specific part numbers customer requested
6. Reviews 45 selected products
7. Saves catalog
8. Can assign to BASIC user at ACME Corp

### 2. TurnKey Team Shares Catalog

**Scenario:** Construction team creates shared parts catalog

1. TurnKey user (Sarah) creates catalog
2. Selects frequently-used products
3. Team members (Mike, Lisa) can see and edit it
4. Shared across team for projects

### 3. User Creates Personal Catalog

**Scenario:** Mechanic creates favorites list

1. BASIC user logs in
2. Creates "My Favorites" catalog
3. Selects commonly-used parts
4. Uses bulk import for known part numbers
5. Quick access for future projects

---

## Frontend State Management

### State Variables
```typescript
// Form data
const [name, setName] = useState('');
const [description, setDescription] = useState('');
const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

// UI state
const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
const [search, setSearch] = useState('');

// Bulk import
const [bulkImportText, setBulkImportText] = useState('');
const [bulkImportResult, setBulkImportResult] = useState(null);

// Loading states
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [bulkImporting, setBulkImporting] = useState(false);
```

### Tree Data Structure
```typescript
interface TreeNode {
  id: string;
  name: string;
  type: 'category' | 'product';
  children?: TreeNode[];
  product?: Product;
}
```

Built from flat product array grouped by category.

---

## Interaction Patterns

### Multi-Select Behavior

**Category Checkbox:**
- Unchecked (none selected) → Click → Select all products in category
- All checked → Click → Deselect all
- Indeterminate (some selected) → Click → Select all

**Product Checkbox:**
- Toggle individual product selection
- Updates parent category's indeterminate state

### Tree Navigation

**Expand/Collapse:**
- Click chevron icon to toggle node
- "Expand All" button opens all categories
- "Collapse All" button closes all categories

**Search:**
- Type in search box
- Filters products in real-time
- Maintains tree structure
- Shows parent categories if children match

---

## Validation Rules

### Create/Edit Form
- ✅ Name required (non-empty)
- ✅ At least 1 product selected
- ⚠️ Description optional

### Bulk Import
- ✅ At least 1 part number entered
- ⚠️ Empty lines ignored
- ⚠️ Whitespace trimmed
- ⚠️ Not-found items reported but don't block

---

## Test IDs for Automation

```typescript
// Navigation
'button-back' - Back button

// Form inputs
'input-catalog-name' - Name field
'input-catalog-description' - Description field

// Bulk import
'textarea-bulk-import' - Bulk import textarea
'button-bulk-import' - Import button

// Tree controls
'input-search-products' - Search input
'button-expand-all' - Expand all button
'button-collapse-all' - Collapse all button

// Tree items
'checkbox-category-{id}' - Category checkbox
'checkbox-product-{id}' - Product checkbox
'tree-product-{id}' - Product node

// Selected products
'selected-product-{id}' - Selected product badge
'remove-product-{id}' - Remove product button
'button-clear-selection' - Clear all button

// Actions
'button-save-catalog' - Save catalog button
```

---

## Error Handling

### User Errors
- "Please enter a catalog name" - Name field empty
- "Please select at least one product" - No products selected
- "Please enter at least one part number" - Bulk import with empty textarea

### API Errors
- "Failed to load products" - Can't fetch product list
- "Failed to save catalog" - Server error on create/update
- "Access denied" - User doesn't have permission
- "Catalog not found" - Invalid catalog ID

### Bulk Import Errors
- Shows list of not-found part numbers
- Doesn't block successful matches
- User can continue selecting more products

---

## Performance Optimization

### Data Loading
- Loads up to 10,000 products (reasonable limit)
- Single API call on page load
- Products cached in component state

### Tree Rendering
- Only renders visible nodes (React optimization)
- Collapsed categories don't render children
- Search filters before rendering

### Selection State
- Uses Set for O(1) lookup
- No array iteration for selection checks
- Efficient add/remove operations

---

## Responsive Design

### Desktop (≥1024px)
- 2-column layout: Details/Bulk (40%) | Tree (60%)
- Selected products panel full width below
- Sidebar navigation visible

### Tablet (768px - 1023px)
- Stacked layout
- Details on top, tree below
- Selected products at bottom

### Mobile (<768px)
- Single column
- Optimized touch targets
- Scrollable tree area
- Bottom navigation

---

## Advanced Features

### Indeterminate Checkbox State

Category shows 3 states:
- ☐ Unchecked - No products selected
- ☑ Checked - All products selected
- ⊟ Indeterminate - Some products selected

Implementation:
```typescript
const allSelected = childProducts.every(id => selected.has(id));
const someSelected = childProducts.some(id => selected.has(id));

<input
  type="checkbox"
  checked={allSelected}
  ref={el => {
    if (el) el.indeterminate = someSelected && !allSelected;
  }}
/>
```

### Smart Search

Filters at multiple levels:
- Category name matching
- Product name matching
- Part number matching
- Description matching

Shows category if:
- Category name matches, OR
- Any child product matches

---

## Integration Points

### With Product Import Tool
1. Admin imports master products via CSV
2. Users create catalogs from imported products
3. Select relevant products for their needs

### With Projects
1. User creates catalog
2. Uses catalog to populate BOM
3. Generate quotes from catalog items

### With Quotes
1. User creates catalog for customer
2. Generate quote using catalog products
3. Send to customer

---

## Future Enhancements

### Potential Features
- [ ] Catalog templates
- [ ] Clone existing catalog
- [ ] Share catalog with other users
- [ ] Export catalog as CSV
- [ ] Catalog categories (organize catalogs)
- [ ] Catalog versioning
- [ ] Bulk operations (add/remove products)
- [ ] Drag-and-drop product ordering
- [ ] Product images in tree
- [ ] Recently selected products
- [ ] Favorite products quick-add

---

## Troubleshooting

### "Products not loading"
- Check authentication token
- Verify API endpoint accessible
- Check browser console for errors

### "Can't see team member's catalog"
- Verify you're in same TurnKey team
- Check turnkeyTeamId in database

### "Bulk import finds nothing"
- Check part numbers match exactly
- Verify products exist in database
- Check case sensitivity

### "Can't save catalog"
- Ensure name is filled
- Ensure at least 1 product selected
- Check for network errors

---

## Example Usage

### Creating Catalog with Bulk Import

```typescript
// User pastes in textarea:
2002-1201
2002-1401
221-412
750-504

// System looks up:
POST /api/catalog-creator/lookup-parts
{ partNumbers: ["2002-1201", "2002-1401", "221-412", "750-504"] }

// Response:
{
  products: [/* 4 products found */],
  notFound: []
}

// Adds to selection
selectedProductIds.add(prod-1, prod-2, prod-3, prod-4)

// User can continue:
// - Select more from tree
// - Bulk import more part numbers
// - Remove unwanted products
// - Save catalog
```

---

## Complete Workflow Example

**Goal:** Create catalog of frequently-ordered terminal blocks

1. **Navigate** to My Catalogs
2. **Click** "+ New Catalog"
3. **Enter** name: "Frequent Terminal Blocks"
4. **Enter** description: "Most commonly ordered items"
5. **Option A - Tree Selection:**
   - Expand "Terminal Blocks" category
   - Check "Push-in Terminal Blocks" (selects all 10)
   - Uncheck 3 items not needed
   - Final: 7 products selected
6. **Option B - Bulk Import:**
   - Paste part numbers from email/spreadsheet
   - Click "Import Part Numbers"
   - See: "Added 5 products. 1 not found: OLD-PART"
7. **Review** selected products panel (12 total)
8. **Click** "Save Catalog"
9. ✅ Success! Redirects to catalog list

---

## Summary

The Catalog Creator provides:
- ✅ Intuitive tree-based selection
- ✅ Fast bulk import by part numbers
- ✅ Search and filter capabilities
- ✅ Visual selection feedback
- ✅ Hierarchical visibility
- ✅ Full CRUD operations
- ✅ Mobile-friendly responsive design

Perfect for users who need to organize products into custom collections for customers, projects, or personal use!

---

**Ready to use!** Navigate to "My Catalogs" in the sidebar to get started.

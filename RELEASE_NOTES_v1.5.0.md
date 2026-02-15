# WAIGO App - Release v1.5.0

**Release Date:** February 15, 2026  
**Git Tag:** v1.5.0  
**Commit:** de4214f

---

## 🎯 Overview

This release focuses on security improvements, enhanced cross-reference data management, and UI/UX cleanup. Major highlights include critical security patches, a new flexible column-mapping import wizard, and streamlined data management interface.

---

## ✨ New Features

### Cross-Reference Import Wizard
- **Flexible Column Mapping**: Upload CSV files with any column headers and map them to required fields
- **Interactive Wizard**: 4-step process (Upload → Map → Preview → Import)
- **Replace or Merge Mode**: Choose to replace all data or add/merge with existing records
- **Duplicate Handling**: Smart upsert logic based on manufacturer + part number + WAGO part
- **Multiple WAGO Equivalents**: Support for mapping multiple WAGO parts per competitor part
- **Sample Template**: Download sample CSV with proper format from the wizard
- **Route**: `/admin/import-cross-references`

### Required Fields
- At least one of: Part Number A OR Part Number B
- Manufacture Name
- At least one of: WAGO Cross A OR WAGO Cross B

### Optional Fields
- Active Item, Estimated Price, Notes A/B, Author, Last Date Modified

---

## 🔒 Security Fixes

### Critical & High Severity
1. **Multer Upgrade** (1.4.5-lts.2 → 2.0.2)
   - Fixed CVE-2025-47935: Memory leak DoS from improper stream handling
   - Fixed CVE-2025-47944: Unhandled exceptions from malformed multipart requests
   - Fixed CVE-2025-7338: Additional DoS vulnerability

2. **React Email Upgrade** (0.0.x → 5.2.8)
   - Updated @react-email/components: 0.0.15 → 1.0.7
   - Updated @react-email/render: 0.0.11 → 2.0.4
   - Replaced deprecated `renderAsync` with `render` API

3. **React Upgrade** (18.2.0 → 19.2.4)
   - Required for react-email compatibility
   - Latest stable version with security patches

4. **Next.js Security** (Transitive Dependency)
   - Resolved multiple critical/high CVEs through react-email upgrade
   - Fixed authorization bypass, DoS, and SSRF vulnerabilities

5. **Express Rate Limit Configuration**
   - Added `app.set('trust proxy', 1)` for Railway reverse proxy
   - Eliminates ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warnings
   - Ensures accurate IP-based rate limiting

---

## 🐛 Bug Fixes

### TypeScript Errors
1. **CrossReferenceImport.tsx**
   - Fixed type mismatch in validation function
   - Removed redundant filter causing compilation error

2. **userManagement.controller.ts**
   - Fixed UserRole type assignment
   - Properly imported and typed Prisma enum

### Build Errors
- All TypeScript compilation errors resolved
- Frontend and backend build successfully on Railway
- No blocking warnings in production builds

---

## 🎨 UI/UX Improvements

### Reference Data Management Page
- **Renamed**: "BOM Data Management" → "Reference Data Management"
- **Simplified**: Removed confusing dual import options
- **Cleaned Up**: Removed legacy fixed-column cross-reference import
- **Streamlined**: Single clear path to new import wizard
- **Button Text**: "MASTER Cross Reference Import (with column mapping)" → "Cross Reference Import"

### Admin Dashboard
- Updated quick action button: "BOM Data" → "Reference Data"

### Page Structure
```
Reference Data Management
├── Cross-References
│   └── Cross Reference Import (link to wizard)
└── Non-WAGO Products
    ├── Download Sample CSV
    ├── Upload CSV
    └── Import Button
```

---

## 🗑️ Removed

- Legacy fixed-column cross-reference import (replaced by new wizard)
- Old cross-reference sample CSV download (moved to wizard)
- Unused state variables and functions (68 lines of code removed)

---

## 📦 Dependencies Updated

### Backend
```json
{
  "multer": "^1.4.5-lts.2" → "^2.0.2",
  "@react-email/components": "^0.0.15" → "^1.0.7",
  "@react-email/render": "^0.0.11" → "^2.0.4",
  "react-email": "^2.1.6" → "^5.2.8",
  "react": "^18.2.0" → "^19.2.4",
  "@types/react": "^18.2.0" → "^19.2.14"
}
```

---

## 🚀 Deployment

### Railway Services
- **Backend (WAIGO)**: ✅ Deployed successfully
- **Frontend (happy-harmony)**: ✅ Deployed successfully

### Verification
- No trust proxy warnings in logs
- All builds complete without errors
- Cross-reference import wizard accessible and functional
- Security vulnerabilities resolved (verified via npm audit)

---

## 📝 Migration Notes

### For Administrators
1. **New Import Process**: Use the new "Cross Reference Import" button on the Reference Data Management page
2. **Column Mapping**: Your CSV files can now have any column headers - just map them in the wizard
3. **No Breaking Changes**: Existing cross-reference data remains intact
4. **Old Import Removed**: The fixed-column import on the data management page has been removed

### For Developers
1. **API Changes**: New endpoint `/api/admin/cross-references/import-master` for column-mapped imports
2. **React Email**: Update any email templates to use `render` instead of `renderAsync`
3. **Trust Proxy**: Express app now trusts Railway's reverse proxy headers

---

## 🔗 Related Commits

- `de4214f` - refactor: clean up Reference Data Management page
- `068a3e7` - fix: resolve TypeScript error in userManagement role update
- `a6144a8` - fix: resolve TypeScript error in CrossReferenceImport validation
- `8180967` - fix: resolve security vulnerabilities and express-rate-limit warning
- `72a7c94` - feat: enhance cross-reference import functionality with improved column mapping options
- `d4464f8` - feat: MASTER Cross Reference Import with column mapping and replace/add-merge

---

## 📊 Testing

### Verified
- ✅ Frontend builds without errors
- ✅ Backend builds without errors
- ✅ Cross-reference import wizard functional
- ✅ Column mapping works correctly
- ✅ Replace and add/merge modes working
- ✅ No trust proxy warnings in production
- ✅ Email service working with new react-email API
- ✅ File uploads working with multer 2.0.2

---

## 🙏 Acknowledgments

This release addresses critical security vulnerabilities and significantly improves the cross-reference data management workflow based on user feedback.

---

**For questions or issues, please contact the development team.**

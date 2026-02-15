# MASTER Cross Reference Import

## Overview

Admins can import cross-reference data from CSV using a **column-mapping wizard** (similar to Product Import). You can either **replace** the entire cross-reference table (e.g. first MASTER load) or **add/merge** with existing data so that additional uploads do not erase previous imports.

## Features

- **Column mapping**: Upload any CSV and map columns to Part Number A/B, Manufacture Name, WAGO Cross A/B, Notes, Author, etc.
- **Replace or Add/merge**: Choose "Replace entire table" for initial load, or leave unchecked to upsert by (Manufacture + Part Number + WAGO part). Duplicates are merged; new rows (e.g. same part, different WAGO equivalent) create a second entry so BOM checks can return multiple matches.
- **Preview**: See first rows and mode before importing.
- **Results**: Created count, updated count, and any row-level errors.

## How to access

- **Admin Dashboard** → **Cross Reference Import**
- **Admin** → **BOM Data** → **MASTER Cross Reference Import (with column mapping)**

## User flow

1. **Upload**: Select a CSV file (or drag-and-drop). File is parsed; max 25,000 rows.
2. **Map columns**: Map each CSV column to a field (Part Number A, Part Number B, Manufacture Name, WAGO Cross A, WAGO Cross B, etc.). Optionally check **Replace entire table** for first load.
3. **Preview**: Review transformed rows and choose **Replace all & import** or **Add/merge**.
4. **Import**: Results show created/updated counts and errors.

## Required mappings

- At least one of **Part Number A** or **Part Number B**
- **Manufacture Name**
- At least one of **WAGO Cross A** or **WAGO Cross B** (must match an existing WAGO part in the catalog)

## Replace vs Add/merge

- **Replace entire table** (checkbox): Deletes all existing cross-references, then inserts only the rows from this file. Use for the first MASTER load (e.g. 1000 items).
- **Add/merge** (default): Does not delete. For each row, the system looks up by (Manufacture Name, Part Number A or B, WAGO part). If a row exists, it is **merged** (updated). If not (new part or same part with a different WAGO equivalent), a **new row** is created. So one competitor part can have multiple cross-reference rows and BOM check returns multiple matches.

## Sample CSV

Download the template from the wizard (Step 1). Columns include: Part Number A, Part Number B, Manufacture Name, Active Item, Estimated Price, WAGO Cross A, WAGO Cross B, Notes A, Notes B, Author, Last Date Modified.

## API

- **POST** `/api/admin/cross-references/import-master`  
  - Body: `{ rows: Array<MappedRow>, replace?: boolean }`  
  - `replace` default `false`. When `true`, all cross-references are deleted before inserting. When `false`, rows are upserted by (originalManufacturer, originalPartNumber, wagoPartId).  
  - Returns: `{ created, updated, totalRows, errors?, importBatchId }`

## BOM Data Management page

The **BOM Data** page still offers the **fixed-column** CSV upload (originalManufacturer, originalPartNumber, wagoPartNumber, …) for quick add/replace without mapping. For flexible column mapping and the MASTER workflow, use **MASTER Cross Reference Import** instead.

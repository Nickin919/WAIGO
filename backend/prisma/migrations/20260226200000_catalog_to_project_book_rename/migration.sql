-- Phase 4: Catalog → ProjectBook terminology (table/column renames)
-- Pre-migration: take a full database backup before running.

BEGIN;

  -- 1. Drop foreign keys referencing catalogs
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_catalog_id_fkey;
  ALTER TABLE catalog_assignments DROP CONSTRAINT IF EXISTS catalog_assignments_catalog_id_fkey;
  ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_catalog_id_fkey;
  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_catalog_id_fkey;
  ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_catalog_id_fkey;
  ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_catalog_id_fkey;
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_catalog_id_fkey;
  ALTER TABLE catalogs DROP CONSTRAINT IF EXISTS catalogs_source_catalog_id_fkey;

  -- 2. Rename main table
  ALTER TABLE catalogs RENAME TO project_books;

  -- 3. Rename self-referencing column in project_books
  ALTER TABLE project_books RENAME COLUMN source_catalog_id TO source_project_book_id;

  -- 4. Rename columns in dependent tables
  ALTER TABLE users RENAME COLUMN catalog_id TO project_book_id;
  ALTER TABLE catalog_assignments RENAME COLUMN catalog_id TO project_book_id;
  ALTER TABLE catalog_items RENAME COLUMN catalog_id TO project_book_id;
  ALTER TABLE categories RENAME COLUMN catalog_id TO project_book_id;
  ALTER TABLE parts RENAME COLUMN catalog_id TO project_book_id;
  ALTER TABLE quotes RENAME COLUMN catalog_id TO project_book_id;
  ALTER TABLE projects RENAME COLUMN catalog_id TO project_book_id;

  -- 5. Rename junction tables
  ALTER TABLE catalog_assignments RENAME TO project_book_assignments;
  ALTER TABLE catalog_items RENAME TO project_book_items;

  -- 6. Recreate foreign keys
  ALTER TABLE users ADD CONSTRAINT users_project_book_id_fkey
    FOREIGN KEY (project_book_id) REFERENCES project_books(id);
  ALTER TABLE project_book_assignments ADD CONSTRAINT project_book_assignments_project_book_id_fkey
    FOREIGN KEY (project_book_id) REFERENCES project_books(id);
  ALTER TABLE project_book_items ADD CONSTRAINT project_book_items_project_book_id_fkey
    FOREIGN KEY (project_book_id) REFERENCES project_books(id);
  ALTER TABLE categories ADD CONSTRAINT categories_project_book_id_fkey
    FOREIGN KEY (project_book_id) REFERENCES project_books(id);
  ALTER TABLE parts ADD CONSTRAINT parts_project_book_id_fkey
    FOREIGN KEY (project_book_id) REFERENCES project_books(id);
  ALTER TABLE quotes ADD CONSTRAINT quotes_project_book_id_fkey
    FOREIGN KEY (project_book_id) REFERENCES project_books(id);
  ALTER TABLE projects ADD CONSTRAINT projects_project_book_id_fkey
    FOREIGN KEY (project_book_id) REFERENCES project_books(id);
  ALTER TABLE project_books ADD CONSTRAINT project_books_source_project_book_id_fkey
    FOREIGN KEY (source_project_book_id) REFERENCES project_books(id);

COMMIT;

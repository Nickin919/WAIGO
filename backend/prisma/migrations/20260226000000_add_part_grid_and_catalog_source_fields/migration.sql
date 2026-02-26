-- CreateEnum
CREATE TYPE "CatalogSourceType" AS ENUM ('MANUAL', 'CONVERTED_FROM_BOM');

-- AlterTable (Part: grid + priceDate)
ALTER TABLE "parts" ADD COLUMN "grid_level_number" INTEGER;
ALTER TABLE "parts" ADD COLUMN "grid_level_name" TEXT;
ALTER TABLE "parts" ADD COLUMN "grid_sublevel_number" INTEGER;
ALTER TABLE "parts" ADD COLUMN "grid_sublevel_name" TEXT;
ALTER TABLE "parts" ADD COLUMN "price_date" DATE;

-- CreateIndex (Part: composite for grid browse/sort)
CREATE INDEX "parts_catalog_id_grid_level_number_grid_sublevel_number_part__idx" ON "parts"("catalog_id", "grid_level_number", "grid_sublevel_number", "part_number");

-- AlterTable (Catalog: source type and conversion traceability)
ALTER TABLE "catalogs" ADD COLUMN "source_type" "CatalogSourceType" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "catalogs" ADD COLUMN "source_project_id" TEXT;
ALTER TABLE "catalogs" ADD COLUMN "source_revision" VARCHAR(100);

-- AddForeignKey
ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_source_project_id_fkey" FOREIGN KEY ("source_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (optional, for lookups by source project)
CREATE INDEX "catalogs_source_project_id_idx" ON "catalogs"("source_project_id");

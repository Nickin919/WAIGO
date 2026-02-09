-- AlterTable
ALTER TABLE "projects" ADD COLUMN "catalog_id" TEXT;

-- CreateIndex
CREATE INDEX "projects_catalog_id_idx" ON "projects"("catalog_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

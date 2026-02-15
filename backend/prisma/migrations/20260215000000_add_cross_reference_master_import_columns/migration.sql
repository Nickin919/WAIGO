-- AlterTable (MASTER Cross Reference Import columns)
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "part_number_a" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "part_number_b" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "manufacture_name" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "active_item" BOOLEAN;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "estimated_price" DECIMAL(12,4);
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "wago_cross_a" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "wago_cross_b" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "notes_a" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "notes_b" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "author" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "last_date_modified" TIMESTAMP(3);
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "import_batch_id" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;
ALTER TABLE "cross_references" ADD COLUMN IF NOT EXISTS "source_filename" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cross_references_import_batch_id_idx" ON "cross_references"("import_batch_id");

-- AddForeignKey
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

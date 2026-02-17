-- AlterTable
ALTER TABLE "price_contract_items" ADD COLUMN "category_id" TEXT;

-- CreateIndex
CREATE INDEX "price_contract_items_category_id_idx" ON "price_contract_items"("category_id");

-- AddForeignKey
ALTER TABLE "price_contract_items" ADD CONSTRAINT "price_contract_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

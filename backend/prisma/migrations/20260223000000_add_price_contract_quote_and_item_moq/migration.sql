-- AlterTable
ALTER TABLE "price_contract_items" ADD COLUMN IF NOT EXISTS "moq" TEXT;

-- AlterTable
ALTER TABLE "price_contracts" ADD COLUMN IF NOT EXISTS "quote_number" TEXT,
ADD COLUMN IF NOT EXISTS "quote_core" TEXT,
ADD COLUMN IF NOT EXISTS "quote_year" TEXT,
ADD COLUMN IF NOT EXISTS "quote_prefix" TEXT,
ADD COLUMN IF NOT EXISTS "quote_revision" TEXT;

-- CreateIndex (only if not exists - PostgreSQL 9.5+ doesn't have IF NOT EXISTS for CREATE INDEX, so we use a simple CREATE INDEX; migration may fail if index exists, then we can fix)
CREATE INDEX IF NOT EXISTS "price_contracts_quote_core_quote_year_idx" ON "price_contracts"("quote_core", "quote_year");

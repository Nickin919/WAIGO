-- CreateEnum
CREATE TYPE "FailureReportSource" AS ENUM ('BOM_UPLOAD', 'PROJECT_BOOK_CONVERSION', 'CROSS_REF_IMPORT');

-- CreateTable
CREATE TABLE "failure_reports" (
    "id" TEXT NOT NULL,
    "source" "FailureReportSource" NOT NULL,
    "failure_type" TEXT NOT NULL,
    "import_batch_id" TEXT,
    "context" JSONB,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolution_note" TEXT,

    CONSTRAINT "failure_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failure_reports_source_idx" ON "failure_reports"("source");
CREATE INDEX "failure_reports_import_batch_id_idx" ON "failure_reports"("import_batch_id");
CREATE INDEX "failure_reports_created_at_idx" ON "failure_reports"("created_at");
CREATE INDEX "failure_reports_resolved_at_idx" ON "failure_reports"("resolved_at");

-- AddForeignKey
ALTER TABLE "failure_reports" ADD CONSTRAINT "failure_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "failure_reports" ADD CONSTRAINT "failure_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

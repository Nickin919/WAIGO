-- CreateEnum
CREATE TYPE "UnmatchedEventType" AS ENUM ('PART_NOT_FOUND', 'SERIES_NOT_FOUND', 'CROSS_REF_NOT_FOUND', 'INVALID_SUBMISSION');

-- CreateEnum
CREATE TYPE "UnmatchedSubmissionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "unmatched_submission_events" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" "UnmatchedEventType" NOT NULL,
    "source" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "submitted_value" TEXT NOT NULL,
    "submitted_field" TEXT NOT NULL,
    "submitted_manufacturer" TEXT,
    "matched_against" TEXT,
    "user_id" TEXT,
    "import_batch_id" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB,
    "status" "UnmatchedSubmissionStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_id" TEXT,

    CONSTRAINT "unmatched_submission_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unmatched_submission_events_created_at_idx" ON "unmatched_submission_events"("created_at");
CREATE INDEX "unmatched_submission_events_source_idx" ON "unmatched_submission_events"("source");
CREATE INDEX "unmatched_submission_events_event_type_idx" ON "unmatched_submission_events"("event_type");
CREATE INDEX "unmatched_submission_events_user_id_idx" ON "unmatched_submission_events"("user_id");
CREATE INDEX "unmatched_submission_events_status_idx" ON "unmatched_submission_events"("status");
CREATE INDEX "unmatched_submission_events_source_created_at_idx" ON "unmatched_submission_events"("source", "created_at");

-- AddForeignKey
ALTER TABLE "unmatched_submission_events" ADD CONSTRAINT "unmatched_submission_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "unmatched_submission_events" ADD CONSTRAINT "unmatched_submission_events_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

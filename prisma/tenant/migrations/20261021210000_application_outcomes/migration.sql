ALTER TABLE "job_applications"
  ADD COLUMN "joined_at" TIMESTAMP(3),
  ADD COLUMN "outcome_recorded_at" TIMESTAMP(3),
  ADD COLUMN "outcome_recorded_by_subject" VARCHAR(255),
  ADD COLUMN "outcome_reason" VARCHAR(1000);

ALTER TABLE "job_applications"
  ADD CONSTRAINT "job_applications_outcome_evidence_check" CHECK (
    (
      "status" IN ('JOINED', 'NOT_JOINED')
      AND "outcome_recorded_at" IS NOT NULL
      AND "outcome_recorded_by_subject" IS NOT NULL
      AND "outcome_reason" IS NOT NULL
      AND (("status" = 'JOINED' AND "joined_at" IS NOT NULL) OR ("status" = 'NOT_JOINED' AND "joined_at" IS NULL))
    )
    OR
    (
      "status" NOT IN ('JOINED', 'NOT_JOINED')
      AND "joined_at" IS NULL
      AND "outcome_recorded_at" IS NULL
      AND "outcome_recorded_by_subject" IS NULL
      AND "outcome_reason" IS NULL
    )
  );

CREATE INDEX "job_applications_status_outcome_recorded_at_idx"
  ON "job_applications"("status", "outcome_recorded_at");

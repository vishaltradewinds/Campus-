CREATE TABLE "application_interviews" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "request_id" VARCHAR(128) NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "duration_minutes" INTEGER NOT NULL DEFAULT 30,
  "mode" VARCHAR(24) NOT NULL,
  "location_or_join_url" VARCHAR(2000),
  "instructions" VARCHAR(2000),
  "status" VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED',
  "created_by_subject" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_interviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_interviews_duration_check" CHECK ("duration_minutes" BETWEEN 15 AND 240),
  CONSTRAINT "application_interviews_mode_check" CHECK ("mode" IN ('ONLINE', 'IN_PERSON', 'PHONE')),
  CONSTRAINT "application_interviews_status_check" CHECK ("status" IN ('SCHEDULED', 'CANCELLED', 'COMPLETED'))
);
CREATE UNIQUE INDEX "application_interviews_request_id_key" ON "application_interviews"("request_id");
CREATE INDEX "application_interviews_application_id_scheduled_at_idx"
  ON "application_interviews"("application_id", "scheduled_at");
CREATE INDEX "application_interviews_status_scheduled_at_idx"
  ON "application_interviews"("status", "scheduled_at");
ALTER TABLE "application_interviews"
  ADD CONSTRAINT "application_interviews_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "job_applications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "application_interview_audit_events" (
  "id" TEXT NOT NULL,
  "interview_id" TEXT NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "application_interview_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "application_interview_audit_events_interview_id_occurred_at_idx"
  ON "application_interview_audit_events"("interview_id", "occurred_at");
CREATE INDEX "application_interview_audit_events_actor_subject_occurred_at_idx"
  ON "application_interview_audit_events"("actor_subject", "occurred_at");
ALTER TABLE "application_interview_audit_events"
  ADD CONSTRAINT "application_interview_audit_events_interview_id_fkey"
  FOREIGN KEY ("interview_id") REFERENCES "application_interviews"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_application_interview_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'application_interview_audit_events is append-only';
END;
$$;
CREATE TRIGGER application_interview_audit_events_no_update
BEFORE UPDATE OR DELETE ON "application_interview_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_application_interview_audit_mutation();

CREATE FUNCTION prevent_application_interview_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'application_interviews cannot be deleted; cancel or complete the interview instead';
END;
$$;
CREATE TRIGGER application_interviews_no_delete
BEFORE DELETE ON "application_interviews"
FOR EACH ROW EXECUTE FUNCTION prevent_application_interview_delete();

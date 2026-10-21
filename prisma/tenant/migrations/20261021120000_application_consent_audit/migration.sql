-- Add versioned application consent policies and append-only application audit events.
CREATE TABLE "application_consent_policies" (
  "id" TEXT NOT NULL,
  "purpose" VARCHAR(64) NOT NULL,
  "version" VARCHAR(64) NOT NULL,
  "content" TEXT NOT NULL,
  "content_hash" VARCHAR(128) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  "effective_at" TIMESTAMP(3) NOT NULL,
  "retired_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_consent_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_consent_policies_purpose_version_key"
  ON "application_consent_policies"("purpose", "version");
CREATE INDEX "application_consent_policies_purpose_status_effective_at_retired_at_idx"
  ON "application_consent_policies"("purpose", "status", "effective_at", "retired_at");

CREATE TABLE "job_application_audit_events" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consent_version" VARCHAR(64),
  "consent_hash" VARCHAR(128),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "job_application_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_application_audit_events_application_id_occurred_at_idx"
  ON "job_application_audit_events"("application_id", "occurred_at");
CREATE INDEX "job_application_audit_events_actor_subject_occurred_at_idx"
  ON "job_application_audit_events"("actor_subject", "occurred_at");
ALTER TABLE "job_application_audit_events"
  ADD CONSTRAINT "job_application_audit_events_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "job_applications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce append-only semantics at the database layer, not only in application code.
CREATE FUNCTION prevent_job_application_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'job_application_audit_events is append-only';
END;
$$;

CREATE TRIGGER job_application_audit_events_no_update
BEFORE UPDATE OR DELETE ON "job_application_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_job_application_audit_event_mutation();

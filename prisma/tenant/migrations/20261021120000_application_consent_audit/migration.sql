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
  "created_by_subject" VARCHAR(255) NOT NULL,
  "published_by_subject" VARCHAR(255),
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

-- Record every consent policy lifecycle action with database-enforced append-only behavior.
CREATE TABLE "consent_policy_audit_events" (
  "id" TEXT NOT NULL,
  "policy_id" TEXT NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "content_hash" VARCHAR(128),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "consent_policy_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consent_policy_audit_events_policy_id_occurred_at_idx"
  ON "consent_policy_audit_events"("policy_id", "occurred_at");
CREATE INDEX "consent_policy_audit_events_actor_subject_occurred_at_idx"
  ON "consent_policy_audit_events"("actor_subject", "occurred_at");
ALTER TABLE "consent_policy_audit_events"
  ADD CONSTRAINT "consent_policy_audit_events_policy_id_fkey"
  FOREIGN KEY ("policy_id") REFERENCES "application_consent_policies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_consent_policy_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'consent_policy_audit_events is append-only';
END;
$$;
CREATE TRIGGER consent_policy_audit_events_no_update
BEFORE UPDATE OR DELETE ON "consent_policy_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_consent_policy_audit_event_mutation();

-- Consent content and identity are immutable after insertion; only lifecycle fields may change.
CREATE FUNCTION prevent_application_consent_policy_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."purpose" IS DISTINCT FROM OLD."purpose"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."content" IS DISTINCT FROM OLD."content"
    OR NEW."content_hash" IS DISTINCT FROM OLD."content_hash"
    OR NEW."effective_at" IS DISTINCT FROM OLD."effective_at"
    OR NEW."created_by_subject" IS DISTINCT FROM OLD."created_by_subject"
  THEN
    RAISE EXCEPTION 'application consent policy content and identity are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER application_consent_policies_content_immutable
BEFORE UPDATE ON "application_consent_policies"
FOR EACH ROW EXECUTE FUNCTION prevent_application_consent_policy_content_mutation();

CREATE FUNCTION prevent_application_consent_policy_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'application consent policies cannot be deleted';
END;
$$;
CREATE TRIGGER application_consent_policies_no_delete
BEFORE DELETE ON "application_consent_policies"
FOR EACH ROW EXECUTE FUNCTION prevent_application_consent_policy_delete();

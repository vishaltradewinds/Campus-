-- Employer onboarding and verification audit events.
CREATE TABLE "employer_audit_events" (
  "id" TEXT NOT NULL,
  "employer_id" TEXT NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "employer_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employer_audit_events_employer_id_occurred_at_idx"
  ON "employer_audit_events"("employer_id", "occurred_at");
CREATE INDEX "employer_audit_events_actor_subject_occurred_at_idx"
  ON "employer_audit_events"("actor_subject", "occurred_at");
ALTER TABLE "employer_audit_events"
  ADD CONSTRAINT "employer_audit_events_employer_id_fkey"
  FOREIGN KEY ("employer_id") REFERENCES "employers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_employer_audit_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'employer_audit_events is append-only';
END;
$$;
CREATE TRIGGER employer_audit_events_no_update
BEFORE UPDATE OR DELETE ON "employer_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_employer_audit_event_mutation();

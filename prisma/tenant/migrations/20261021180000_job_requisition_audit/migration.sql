CREATE TABLE "job_requisition_audit_events" (
  "id" TEXT NOT NULL,
  "requisition_id" TEXT NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "job_requisition_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_requisition_audit_events_requisition_id_occurred_at_idx"
  ON "job_requisition_audit_events"("requisition_id", "occurred_at");
CREATE INDEX "job_requisition_audit_events_actor_subject_occurred_at_idx"
  ON "job_requisition_audit_events"("actor_subject", "occurred_at");
ALTER TABLE "job_requisition_audit_events"
  ADD CONSTRAINT "job_requisition_audit_events_requisition_id_fkey"
  FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_job_requisition_audit_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'job_requisition_audit_events is append-only';
END;
$$;
CREATE TRIGGER job_requisition_audit_events_no_update
BEFORE UPDATE OR DELETE ON "job_requisition_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_job_requisition_audit_event_mutation();

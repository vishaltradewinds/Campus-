CREATE TABLE "application_offers" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "request_id" VARCHAR(128) NOT NULL,
  "offer_reference" VARCHAR(200) NOT NULL,
  "document_reference" VARCHAR(2000) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ISSUED',
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "responded_at" TIMESTAMP(3),
  "response_note" VARCHAR(500),
  "created_by_subject" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_offers_status_check" CHECK ("status" IN ('ISSUED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED')),
  CONSTRAINT "application_offers_expiry_check" CHECK ("expires_at" > "issued_at"),
  CONSTRAINT "application_offers_response_timestamp_check" CHECK (
    ("status" IN ('ACCEPTED', 'DECLINED') AND "responded_at" IS NOT NULL)
    OR ("status" NOT IN ('ACCEPTED', 'DECLINED') AND "responded_at" IS NULL)
  )
);
CREATE UNIQUE INDEX "application_offers_request_id_key" ON "application_offers"("request_id");
CREATE INDEX "application_offers_application_id_status_idx" ON "application_offers"("application_id", "status");
CREATE INDEX "application_offers_status_expires_at_idx" ON "application_offers"("status", "expires_at");
ALTER TABLE "application_offers"
  ADD CONSTRAINT "application_offers_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "job_applications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "application_offer_audit_events" (
  "id" TEXT NOT NULL,
  "offer_id" TEXT NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "application_offer_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "application_offer_audit_events_offer_id_occurred_at_idx"
  ON "application_offer_audit_events"("offer_id", "occurred_at");
CREATE INDEX "application_offer_audit_events_actor_subject_occurred_at_idx"
  ON "application_offer_audit_events"("actor_subject", "occurred_at");
ALTER TABLE "application_offer_audit_events"
  ADD CONSTRAINT "application_offer_audit_events_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "application_offers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_application_offer_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'application_offer_audit_events is append-only';
END;
$$;
CREATE TRIGGER application_offer_audit_events_no_update
BEFORE UPDATE OR DELETE ON "application_offer_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_application_offer_audit_mutation();

CREATE FUNCTION prevent_application_offer_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'application_offers cannot be deleted; record a controlled offer state change instead';
END;
$$;
CREATE TRIGGER application_offers_no_delete
BEFORE DELETE ON "application_offers"
FOR EACH ROW EXECUTE FUNCTION prevent_application_offer_delete();

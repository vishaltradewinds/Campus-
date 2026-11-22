-- NexusTalent PostgreSQL foundation. No source data and no activation.
-- Run once in an empty dedicated NexusTalent database as its migration owner.
CREATE SCHEMA nexustalent;
REVOKE ALL ON SCHEMA nexustalent FROM PUBLIC;
CREATE ROLE nexustalent_api NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_api TO CURRENT_USER;
CREATE TABLE nexustalent.records (
  document_path text PRIMARY KEY,
  collection text GENERATED ALWAYS AS (split_part(document_path,'/',1)) STORED,
  payload jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT valid_path CHECK (length(document_path) <= 6144 AND document_path ~ '^[^/]+/[^/]+(/[^/]+/[^/]+)*$' AND document_path !~ '(^|/)[.][.]?(/|$)'),
  CONSTRAINT known_collection CHECK (collection IN ('users','employers','institutions','students','academicCorrections','careerEvidence','assessmentSubmissions','offers','candidateProfiles','auditEvents','requirements','campaigns','calls','opportunities','commercialAccounts','subscriptions','campaignCharges','successFees','invoices','billingEvents','system')),
  CONSTRAINT object_payload CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT principal_identity CHECK (
    collection <> 'users' OR document_path LIKE '%/%/%' OR
    ((payload->>'uid') IS NOT DISTINCT FROM split_part(document_path,'/',2) AND
    COALESCE(payload->>'role','') IN ('student','institution','employer','super_admin','simulation'))
  ),
  CONSTRAINT stakeholder_identity CHECK (
    collection NOT IN ('employers','institutions','students') OR document_path LIKE '%/%/%' OR
    (payload->>'id') IS NOT DISTINCT FROM split_part(document_path,'/',2)
  )
);
CREATE INDEX records_collection_path ON nexustalent.records(collection,document_path);
CREATE INDEX records_employer ON nexustalent.records(collection,(payload->>'employerId'));
CREATE INDEX records_institution ON nexustalent.records(collection,(payload->>'institutionId'));
CREATE INDEX records_student ON nexustalent.records(collection,(payload->>'studentId'));
CREATE INDEX records_campaign ON nexustalent.records(collection,(payload->>'campaignId'));
CREATE FUNCTION nexustalent.guard_record_change() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF OLD.collection = 'auditEvents' THEN
    RAISE EXCEPTION 'Audit records are append-only' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.document_path IS DISTINCT FROM OLD.document_path THEN
    RAISE EXCEPTION 'Document identity is immutable' USING ERRCODE='23514';
  END IF;
  NEW.revision := OLD.revision + 1;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;
CREATE TRIGGER record_change BEFORE UPDATE OR DELETE ON nexustalent.records
FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_record_change();
ALTER TABLE nexustalent.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexustalent.records FORCE ROW LEVEL SECURITY;
REVOKE ALL ON nexustalent.records FROM PUBLIC;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_api;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_api;
-- Intentionally no RLS policies: all runtime access is denied until reviewed.
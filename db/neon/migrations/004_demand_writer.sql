-- Review candidate. Dedicated scope for employer demand initiation only.
CREATE ROLE nexustalent_demand_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_demand_writer;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_demand_writer;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role() TO nexustalent_demand_writer;
CREATE POLICY demand_read ON nexustalent.records FOR SELECT TO nexustalent_demand_writer
 USING (
  NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL
  AND current_setting('nexustalent.demand_action',true) IN ('CREATE_REQUIREMENT_CAMPAIGN','SEND_CALLS')
  AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
  AND document_path NOT LIKE '%/%/%'
  AND (
   (collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true))
   OR ((SELECT nexustalent.actor_role())='employer' AND (
    (collection='employers' AND document_path='employers/'||current_setting('nexustalent.actor_uid',true))
    OR (collection IN ('requirements','campaigns','calls') AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true))
    OR (collection='institutions' AND current_setting('nexustalent.demand_action',true)='SEND_CALLS' AND payload->>'empanelmentStatus'='empanelled')
    OR (collection='auditEvents' AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true)
       AND payload->>'action'=current_setting('nexustalent.demand_action',true)
       AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.demand_action',true),'UTF8')),'hex'))
   ))
  )
 );
CREATE POLICY demand_insert ON nexustalent.records FOR INSERT TO nexustalent_demand_writer
 WITH CHECK (
  (SELECT nexustalent.actor_role())='employer'
  AND document_path NOT LIKE '%/%/%'
  AND current_setting('nexustalent.demand_action',true) IN ('CREATE_REQUIREMENT_CAMPAIGN','SEND_CALLS')
  AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
  AND (
   (current_setting('nexustalent.demand_action',true)='CREATE_REQUIREMENT_CAMPAIGN'
     AND collection IN ('requirements','campaigns') AND payload->>'id'=split_part(document_path,'/',2)
     AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true) AND payload->>'status'='active'
     AND (collection='requirements' OR (payload->'targetedInstitutionIds'='[]'::jsonb AND payload->'callsSent'='[]'::jsonb AND payload->'candidateOpportunities'='[]'::jsonb)))
   OR (current_setting('nexustalent.demand_action',true)='SEND_CALLS' AND collection='calls'
       AND payload->>'id'=split_part(document_path,'/',2) AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true)
       AND payload->>'status'='pending' AND payload->'activatedStudentsCount'='0'::jsonb)
   OR (collection='auditEvents'
       AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.demand_action',true),'UTF8')),'hex')
       AND payload->>'eventId'=split_part(document_path,'/',2) AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true)
       AND payload->>'actorRole'='employer' AND payload->>'requestId'=current_setting('nexustalent.request_id',true)
       AND payload->>'action'=current_setting('nexustalent.demand_action',true) AND payload->'immutable'='true'::jsonb)
  )
 );
CREATE POLICY demand_campaign_update ON nexustalent.records FOR UPDATE TO nexustalent_demand_writer
 USING (
  (SELECT nexustalent.actor_role())='employer' AND current_setting('nexustalent.demand_action',true)='SEND_CALLS'
  AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
  AND collection='campaigns' AND document_path NOT LIKE '%/%/%' AND payload->>'id'=split_part(document_path,'/',2)
  AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true) AND payload->>'status'='active'
 )
 WITH CHECK (
  (SELECT nexustalent.actor_role())='employer' AND current_setting('nexustalent.demand_action',true)='SEND_CALLS'
  AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
  AND collection='campaigns' AND document_path NOT LIKE '%/%/%' AND payload->>'id'=split_part(document_path,'/',2)
  AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true) AND payload->>'status'='active'
 );
CREATE FUNCTION nexustalent.guard_demand_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF pg_has_role(current_user,'nexustalent_demand_writer','MEMBER') AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN
  IF split_part(OLD.document_path,'/',1)<>'campaigns'
    OR (NEW.payload - ARRAY['targetedInstitutionIds','callsSent','candidateOpportunities','funnel']) IS DISTINCT FROM (OLD.payload - ARRAY['targetedInstitutionIds','callsSent','candidateOpportunities','funnel'])
    OR ((NEW.payload->'funnel') - 'institutionsInvited') IS DISTINCT FROM ((OLD.payload->'funnel') - 'institutionsInvited')
    OR NEW.payload->'candidateOpportunities' IS DISTINCT FROM '[]'::jsonb
    OR jsonb_typeof(NEW.payload->'targetedInstitutionIds') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.payload->'callsSent') IS DISTINCT FROM 'array'
    OR ((NEW.payload->'targetedInstitutionIds') @> (OLD.payload->'targetedInstitutionIds')) IS DISTINCT FROM true
    OR ((NEW.payload->'callsSent') @> (OLD.payload->'callsSent')) IS DISTINCT FROM true
    OR NEW.payload->'funnel'->'institutionsInvited' IS DISTINCT FROM to_jsonb(jsonb_array_length(NEW.payload->'targetedInstitutionIds'))
  THEN RAISE EXCEPTION 'Demand writer cannot modify unrelated campaign fields' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER demand_update_guard BEFORE UPDATE ON nexustalent.records FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_demand_update();
REVOKE ALL ON FUNCTION nexustalent.guard_demand_update() FROM PUBLIC;
-- No DELETE, profile, student evidence or billing permissions. Business validation remains server-owned.
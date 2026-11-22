-- Review candidate; trusted API only, never expose this login to a browser.
CREATE ROLE nexustalent_consent_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_consent_writer;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_consent_writer;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role() TO nexustalent_consent_writer;
CREATE POLICY resolve_consent_student ON nexustalent.records FOR SELECT TO nexustalent_scope_resolver
 USING (collection='students' AND document_path='students/'||NULLIF(current_setting('nexustalent.actor_uid',true),'') AND payload->>'id'=current_setting('nexustalent.actor_uid',true));
CREATE POLICY resolve_consent_opportunity ON nexustalent.records FOR SELECT TO nexustalent_scope_resolver
 USING (collection='opportunities' AND document_path='opportunities/'||NULLIF(current_setting('nexustalent.opportunity_id',true),'') AND payload->>'studentId'=NULLIF(current_setting('nexustalent.actor_uid',true),''));
CREATE FUNCTION nexustalent.consent_student() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT payload FROM nexustalent.records WHERE document_path='students/'||NULLIF(current_setting('nexustalent.actor_uid',true),'') AND payload->>'id'=current_setting('nexustalent.actor_uid',true)
$$;
CREATE FUNCTION nexustalent.consent_opportunity() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT payload FROM nexustalent.records WHERE document_path='opportunities/'||NULLIF(current_setting('nexustalent.opportunity_id',true),'') AND payload->>'studentId'=NULLIF(current_setting('nexustalent.actor_uid',true),'') AND payload->>'id'=current_setting('nexustalent.opportunity_id',true)
$$;
REVOKE ALL ON FUNCTION nexustalent.consent_student(), nexustalent.consent_opportunity() FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_scope_resolver;
ALTER FUNCTION nexustalent.consent_student() OWNER TO nexustalent_scope_resolver;
ALTER FUNCTION nexustalent.consent_opportunity() OWNER TO nexustalent_scope_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_scope_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.consent_student(), nexustalent.consent_opportunity() TO nexustalent_consent_writer;
CREATE POLICY consent_read ON nexustalent.records FOR SELECT TO nexustalent_consent_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL
 AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
 AND current_setting('nexustalent.consent_action',true) IN ('GLOBAL_CONSENT','UPDATE_CONSENT_SCOPE','SUBMIT_CONSENT')
 AND document_path NOT LIKE '%/%/%'
 AND ((collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true))
 OR ((SELECT nexustalent.actor_role())='student' AND (
  (collection='students' AND document_path='students/'||current_setting('nexustalent.actor_uid',true))
  OR (collection='opportunities' AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true)
    AND (current_setting('nexustalent.consent_action',true)='GLOBAL_CONSENT' OR (current_setting('nexustalent.consent_action',true)='SUBMIT_CONSENT' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true))))
  OR (collection='campaigns' AND (
    (current_setting('nexustalent.consent_action',true)='GLOBAL_CONSENT' AND jsonb_typeof(payload->'targetedInstitutionIds')='array'
      AND (payload->'targetedInstitutionIds') ? ((SELECT nexustalent.consent_student())->>'institutionId'))
    OR (current_setting('nexustalent.consent_action',true)='SUBMIT_CONSENT' AND document_path='campaigns/'||((SELECT nexustalent.consent_opportunity())->>'campaignId')
       AND payload->>'employerId'=((SELECT nexustalent.consent_opportunity())->>'employerId'))))
  OR (collection='auditEvents' AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true)
    AND payload->>'action'=current_setting('nexustalent.consent_action',true)
    AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.consent_action',true),'UTF8')),'hex'))
 ))));
CREATE POLICY consent_audit_insert ON nexustalent.records FOR INSERT TO nexustalent_consent_writer WITH CHECK (
 (SELECT nexustalent.actor_role())='student' AND collection='auditEvents'
 AND current_setting('nexustalent.consent_action',true) IN ('GLOBAL_CONSENT','UPDATE_CONSENT_SCOPE','SUBMIT_CONSENT')
 AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
 AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.consent_action',true),'UTF8')),'hex')
 AND payload->>'eventId'=split_part(document_path,'/',2) AND payload->>'actorRole'='student'
 AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'requestId'=current_setting('nexustalent.request_id',true)
 AND payload->>'action'=current_setting('nexustalent.consent_action',true) AND payload->'immutable'='true'::jsonb);
CREATE POLICY consent_update ON nexustalent.records FOR UPDATE TO nexustalent_consent_writer USING (
 (SELECT nexustalent.actor_role())='student' AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
 AND document_path NOT LIKE '%/%/%' AND payload->>'id'=split_part(document_path,'/',2)
 AND ((collection='students' AND current_setting('nexustalent.consent_action',true) IN ('GLOBAL_CONSENT','UPDATE_CONSENT_SCOPE')
 AND document_path='students/'||current_setting('nexustalent.actor_uid',true))
 OR (current_setting('nexustalent.consent_action',true)='SUBMIT_CONSENT' AND (
 (collection='opportunities' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true))
 OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.consent_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.consent_opportunity())->>'employerId'))))));
CREATE FUNCTION nexustalent.guard_consent_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE action text := current_setting('nexustalent.consent_action',true);
 cid text; previous jsonb; next_grant jsonb; old_grants jsonb; new_grants jsonb; grant_record jsonb; changed integer:=0;
BEGIN
 IF NOT pg_has_role(current_user,'nexustalent_consent_writer','MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
 IF OLD.collection='students' AND action IN ('GLOBAL_CONSENT','UPDATE_CONSENT_SCOPE') THEN
  IF (NEW.payload - 'campaignConsents') IS DISTINCT FROM (OLD.payload - 'campaignConsents') OR jsonb_typeof(NEW.payload->'campaignConsents') IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Unrelated student update' USING ERRCODE='23514'; END IF;
  old_grants:=COALESCE(OLD.payload->'campaignConsents','{}'::jsonb); new_grants:=NEW.payload->'campaignConsents';
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(old_grants) k WHERE NOT new_grants ? k) THEN RAISE EXCEPTION 'Consent history deletion' USING ERRCODE='23514'; END IF;
  FOR cid,next_grant IN SELECT key,value FROM jsonb_each(new_grants) LOOP
   previous:=old_grants->cid;
   IF next_grant IS NOT DISTINCT FROM previous THEN CONTINUE; END IF;
   changed:=changed+1;
   IF jsonb_typeof(next_grant) IS DISTINCT FROM 'object' OR COALESCE(next_grant->>'updatedAt','')='' THEN RAISE EXCEPTION 'Malformed consent' USING ERRCODE='23514'; END IF;
   IF action='UPDATE_CONSENT_SCOPE' THEN
    IF previous->>'status' IS DISTINCT FROM 'approved' OR (next_grant-ARRAY['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared','updatedAt']) IS DISTINCT FROM (previous-ARRAY['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared','updatedAt']) OR
      ((next_grant->'academicDataShared' IS DISTINCT FROM previous->'academicDataShared')::int+(next_grant->'skillBenchmarksShared' IS DISTINCT FROM previous->'skillBenchmarksShared')::int+(next_grant->'projectReposShared' IS DISTINCT FROM previous->'projectReposShared')::int+(next_grant->'contactInfoShared' IS DISTINCT FROM previous->'contactInfoShared')::int)>1
      OR EXISTS(SELECT 1 FROM unnest(ARRAY['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared']) k WHERE jsonb_typeof(next_grant->k) IS DISTINCT FROM 'boolean')
      THEN RAISE EXCEPTION 'Invalid consent scope change' USING ERRCODE='23514'; END IF;
   ELSE
    IF COALESCE(next_grant->>'status','') NOT IN ('approved','denied') OR EXISTS(SELECT 1 FROM unnest(ARRAY['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared']) k WHERE next_grant->k IS DISTINCT FROM 'false'::jsonb) THEN
     RAISE EXCEPTION 'Global consent cannot grant additional scope' USING ERRCODE='23514'; END IF;
    IF next_grant->>'status'='approved' AND NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='opportunities/'||(next_grant->>'opportunityId') AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true) AND payload->>'campaignId'=cid AND payload->>'employerId'=next_grant->>'employerId') THEN
     RAISE EXCEPTION 'Consent requires own invitation' USING ERRCODE='23514'; END IF;
   END IF;
  END LOOP;
  IF (action='UPDATE_CONSENT_SCOPE' AND changed>1) OR changed>200 THEN RAISE EXCEPTION 'Too many consent changes' USING ERRCODE='23514'; END IF;
 ELSIF OLD.collection='opportunities' AND action='SUBMIT_CONSENT' THEN
  IF COALESCE(OLD.payload->>'stage','') NOT IN ('invited','declined','assessment_pending') OR COALESCE(NEW.payload->>'stage','') NOT IN ('assessment_pending','declined') OR
  (NEW.payload-ARRAY['stage','consentedAt','stageUpdatedAt']) IS DISTINCT FROM (OLD.payload-ARRAY['stage','consentedAt','stageUpdatedAt']) THEN RAISE EXCEPTION 'Invalid application transition' USING ERRCODE='23514'; END IF;
  IF NEW.payload->>'stage'='assessment_pending' THEN
   grant_record:=(SELECT nexustalent.consent_student())->'campaignConsents'->(OLD.payload->>'campaignId');
   IF grant_record->>'status' IS DISTINCT FROM 'approved' OR grant_record->>'employerId' IS DISTINCT FROM OLD.payload->>'employerId' THEN RAISE EXCEPTION 'Current consent required' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF OLD.collection='campaigns' AND action='SUBMIT_CONSENT' THEN
  IF (NEW.payload-'funnel') IS DISTINCT FROM (OLD.payload-'funnel') OR ((NEW.payload->'funnel')-'applicationsConsented') IS DISTINCT FROM ((OLD.payload->'funnel')-'applicationsConsented')
  OR (NEW.payload->'funnel'->'applicationsConsented' IS DISTINCT FROM OLD.payload->'funnel'->'applicationsConsented' AND
   (jsonb_typeof(NEW.payload->'funnel'->'applicationsConsented') IS DISTINCT FROM 'number' OR (NEW.payload->'funnel'->>'applicationsConsented')::numeric<0 OR abs((NEW.payload->'funnel'->>'applicationsConsented')::numeric-COALESCE((OLD.payload->'funnel'->>'applicationsConsented')::numeric,0))>1)) THEN
   RAISE EXCEPTION 'Invalid consent funnel change' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Unrelated consent mutation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER consent_update_guard BEFORE UPDATE ON nexustalent.records FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_consent_update();
REVOKE ALL ON FUNCTION nexustalent.guard_consent_update() FROM PUBLIC;

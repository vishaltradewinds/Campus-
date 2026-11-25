-- Candidate: institutional response and activation only.
CREATE ROLE nexustalent_institution_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_institution_writer;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_institution_writer;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role() TO nexustalent_institution_writer;
CREATE POLICY resolve_institution_call ON nexustalent.records FOR SELECT TO nexustalent_scope_resolver
 USING (collection='calls' AND document_path='calls/'||NULLIF(current_setting('nexustalent.call_id',true),'')
 AND payload->>'id'=current_setting('nexustalent.call_id',true) AND payload->>'institutionId'=NULLIF(current_setting('nexustalent.actor_uid',true),''));
CREATE FUNCTION nexustalent.bound_institution_call() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT payload FROM nexustalent.records WHERE document_path='calls/'||NULLIF(current_setting('nexustalent.call_id',true),'')
 AND payload->>'id'=current_setting('nexustalent.call_id',true) AND payload->>'institutionId'=NULLIF(current_setting('nexustalent.actor_uid',true),'')
$$;
REVOKE ALL ON FUNCTION nexustalent.bound_institution_call() FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_scope_resolver;
ALTER FUNCTION nexustalent.bound_institution_call() OWNER TO nexustalent_scope_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_scope_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.bound_institution_call() TO nexustalent_institution_writer;
CREATE POLICY institution_mutation_read ON nexustalent.records FOR SELECT TO nexustalent_institution_writer
 USING (
  NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL
  AND current_setting('nexustalent.institution_action',true) IN ('RESPOND_CALL','ACTIVATE_STUDENTS')
  AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
  AND NULLIF(current_setting('nexustalent.call_id',true),'') IS NOT NULL
  AND document_path NOT LIKE '%/%/%'
  AND (
   (collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true))
   OR ((SELECT nexustalent.actor_role())='institution' AND (
    (collection='institutions' AND document_path='institutions/'||current_setting('nexustalent.actor_uid',true))
    OR (collection='calls' AND document_path='calls/'||current_setting('nexustalent.call_id',true) AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true))
    OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.bound_institution_call())->>'campaignId')
        AND payload->>'employerId'=((SELECT nexustalent.bound_institution_call())->>'employerId'))
    OR (current_setting('nexustalent.institution_action',true)='ACTIVATE_STUDENTS' AND (SELECT nexustalent.bound_institution_call()) IS NOT NULL AND (
      (collection='students' AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true))
      OR (collection='opportunities' AND payload->>'callId'=current_setting('nexustalent.call_id',true) AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true))))
    OR (collection='auditEvents' AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true)
      AND payload->>'action'=current_setting('nexustalent.institution_action',true)
      AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.institution_action',true),'UTF8')),'hex'))
   ))
  )
 );
CREATE POLICY resolve_own_verified_students ON nexustalent.records FOR SELECT TO nexustalent_scope_resolver
 USING (collection='students' AND document_path NOT LIKE '%/%/%'
 AND payload->>'institutionId'=NULLIF(current_setting('nexustalent.actor_uid',true),'')
 AND payload->>'institutionVerificationStatus'='verified');
CREATE FUNCTION nexustalent.bound_verified_student(sid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='students/'||sid
 AND payload->>'id'=sid AND payload->>'institutionId'=NULLIF(current_setting('nexustalent.actor_uid',true),'')
 AND payload->>'institutionVerificationStatus'='verified')
$$;
REVOKE ALL ON FUNCTION nexustalent.bound_verified_student(text) FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_scope_resolver;
ALTER FUNCTION nexustalent.bound_verified_student(text) OWNER TO nexustalent_scope_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_scope_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.bound_verified_student(text) TO nexustalent_institution_writer;
CREATE POLICY institution_mutation_insert ON nexustalent.records FOR INSERT TO nexustalent_institution_writer
 WITH CHECK (
  (SELECT nexustalent.actor_role())='institution'
  AND current_setting('nexustalent.institution_action',true) IN ('RESPOND_CALL','ACTIVATE_STUDENTS')
  AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
  AND (SELECT nexustalent.bound_institution_call()) IS NOT NULL
  AND document_path NOT LIKE '%/%/%'
  AND (
   (collection='opportunities' AND current_setting('nexustalent.institution_action',true)='ACTIVATE_STUDENTS'
    AND ((SELECT nexustalent.bound_institution_call())->>'status') IN ('accepted','partial')
    AND payload->>'id'=split_part(document_path,'/',2)
    AND document_path='opportunities/'||encode(sha256(convert_to(current_setting('nexustalent.call_id',true)||':'||(payload->>'studentId'),'UTF8')),'hex')
    AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true)
    AND payload->>'callId'=current_setting('nexustalent.call_id',true)
    AND payload->>'campaignId'=((SELECT nexustalent.bound_institution_call())->>'campaignId')
    AND payload->>'employerId'=((SELECT nexustalent.bound_institution_call())->>'employerId')
    AND payload->>'stage'='invited' AND payload->>'studentName'='Candidate'
    AND nexustalent.bound_verified_student(payload->>'studentId'))
   OR (collection='auditEvents'
     AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.institution_action',true),'UTF8')),'hex')
     AND payload->>'eventId'=split_part(document_path,'/',2) AND payload->>'actorRole'='institution'
     AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'requestId'=current_setting('nexustalent.request_id',true)
     AND payload->>'action'=current_setting('nexustalent.institution_action',true) AND payload->'immutable'='true'::jsonb)
  )
 );
CREATE POLICY institution_mutation_update ON nexustalent.records FOR UPDATE TO nexustalent_institution_writer
 USING ((SELECT nexustalent.actor_role())='institution'
 AND current_setting('nexustalent.institution_action',true) IN ('RESPOND_CALL','ACTIVATE_STUDENTS')
 AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL
 AND (SELECT nexustalent.bound_institution_call()) IS NOT NULL
 AND document_path NOT LIKE '%/%/%'
 AND payload->>'id'=split_part(document_path,'/',2)
 AND ((collection='calls' AND document_path='calls/'||current_setting('nexustalent.call_id',true) AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true))
 OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.bound_institution_call())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.bound_institution_call())->>'employerId'))));
-- WITH CHECK inherits USING. Trigger protects old/New identity and non-action fields.
CREATE FUNCTION nexustalent.guard_institution_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE action text := current_setting('nexustalent.institution_action',true);
BEGIN
 IF NOT pg_has_role(current_user,'nexustalent_institution_writer','MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
 IF split_part(OLD.document_path,'/',1)='calls' AND action='RESPOND_CALL' THEN
  IF OLD.payload->>'status' IS DISTINCT FROM 'pending'
   OR COALESCE(NEW.payload->>'status','') NOT IN ('accepted','partial','counter','declined')
   OR (NEW.payload - ARRAY['status','responseNotes','offeredCandidatesCount','counterDaysExtension','respondedAt']) IS DISTINCT FROM (OLD.payload - ARRAY['status','responseNotes','offeredCandidatesCount','counterDaysExtension','respondedAt'])
   OR jsonb_typeof(NEW.payload->'offeredCandidatesCount') IS DISTINCT FROM 'number'
   OR (NEW.payload->>'offeredCandidatesCount')::numeric NOT BETWEEN 0 AND 100000
   OR trunc((NEW.payload->>'offeredCandidatesCount')::numeric) <> (NEW.payload->>'offeredCandidatesCount')::numeric
   OR ((NEW.payload->>'status'='declined') IS DISTINCT FROM ((NEW.payload->>'offeredCandidatesCount')::numeric=0))
  THEN RAISE EXCEPTION 'Invalid institutional response' USING ERRCODE='23514'; END IF;
 ELSIF split_part(OLD.document_path,'/',1)='calls' AND action='ACTIVATE_STUDENTS' THEN
  IF COALESCE(OLD.payload->>'status','') NOT IN ('accepted','partial')
   OR (NEW.payload - 'activatedStudentsCount') IS DISTINCT FROM (OLD.payload - 'activatedStudentsCount')
   OR jsonb_typeof(NEW.payload->'activatedStudentsCount') IS DISTINCT FROM 'number'
   OR jsonb_typeof(OLD.payload->'activatedStudentsCount') IS DISTINCT FROM 'number'
   OR jsonb_typeof(OLD.payload->'offeredCandidatesCount') IS DISTINCT FROM 'number'
   OR trunc((NEW.payload->>'activatedStudentsCount')::numeric) <> (NEW.payload->>'activatedStudentsCount')::numeric
   OR (NEW.payload->>'activatedStudentsCount')::numeric <= (OLD.payload->>'activatedStudentsCount')::numeric
   OR (NEW.payload->>'activatedStudentsCount')::numeric > (OLD.payload->>'offeredCandidatesCount')::numeric
   OR (NEW.payload->>'activatedStudentsCount')::numeric - (OLD.payload->>'activatedStudentsCount')::numeric > 100
  THEN RAISE EXCEPTION 'Invalid activation ledger' USING ERRCODE='23514'; END IF;
 ELSIF split_part(OLD.document_path,'/',1)='campaigns' AND action='RESPOND_CALL' THEN
  IF (NEW.payload - 'funnel') IS DISTINCT FROM (OLD.payload - 'funnel')
   OR ((NEW.payload->'funnel') - 'institutionsAccepted') IS DISTINCT FROM ((OLD.payload->'funnel') - 'institutionsAccepted')
   OR jsonb_typeof(NEW.payload->'funnel'->'institutionsAccepted') IS DISTINCT FROM 'number'
   OR (NEW.payload->'funnel'->>'institutionsAccepted')::numeric - COALESCE((OLD.payload->'funnel'->>'institutionsAccepted')::numeric,0) NOT IN (0,1)
  THEN RAISE EXCEPTION 'Invalid response funnel' USING ERRCODE='23514'; END IF;
 ELSIF split_part(OLD.document_path,'/',1)='campaigns' AND action='ACTIVATE_STUDENTS' THEN
  IF (NEW.payload - ARRAY['funnel','candidateOpportunities']) IS DISTINCT FROM (OLD.payload - ARRAY['funnel','candidateOpportunities'])
   OR NEW.payload->'candidateOpportunities' IS DISTINCT FROM '[]'::jsonb
   OR ((NEW.payload->'funnel') - 'studentsInvited') IS DISTINCT FROM ((OLD.payload->'funnel') - 'studentsInvited')
   OR jsonb_typeof(NEW.payload->'funnel'->'studentsInvited') IS DISTINCT FROM 'number'
   OR (NEW.payload->'funnel'->>'studentsInvited')::numeric - COALESCE((OLD.payload->'funnel'->>'studentsInvited')::numeric,0) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'Invalid activation funnel' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Unrelated institutional update' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER institution_update_guard BEFORE UPDATE ON nexustalent.records FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_institution_update();
REVOKE ALL ON FUNCTION nexustalent.guard_institution_update() FROM PUBLIC;
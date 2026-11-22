-- Scoped employer progression and student offer acceptance. No joining or billing access.
CREATE ROLE nexustalent_offer_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_offer_writer;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_offer_writer;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role() TO nexustalent_offer_writer;
CREATE POLICY resolve_offer_opportunity ON nexustalent.records FOR SELECT TO nexustalent_scope_resolver USING (
 collection='opportunities' AND document_path='opportunities/'||NULLIF(current_setting('nexustalent.opportunity_id',true),'')
 AND (payload->>'employerId'=NULLIF(current_setting('nexustalent.actor_uid',true),'') OR payload->>'studentId'=NULLIF(current_setting('nexustalent.actor_uid',true),'')));
CREATE FUNCTION nexustalent.bound_offer_opportunity() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT payload FROM nexustalent.records WHERE document_path='opportunities/'||NULLIF(current_setting('nexustalent.opportunity_id',true),'')
 AND payload->>'id'=current_setting('nexustalent.opportunity_id',true) AND (((SELECT nexustalent.actor_role())='employer' AND current_setting('nexustalent.offer_stage',true) IN ('shortlisted','interviewing','offered')) OR ((SELECT nexustalent.actor_role())='student' AND current_setting('nexustalent.offer_stage',true)='accepted')) AND (((SELECT nexustalent.actor_role())='employer' AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.actor_role())='student' AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true)))
$$;
REVOKE ALL ON FUNCTION nexustalent.bound_offer_opportunity() FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_scope_resolver;
ALTER FUNCTION nexustalent.bound_offer_opportunity() OWNER TO nexustalent_scope_resolver;
CREATE FUNCTION nexustalent.bound_offer_consent() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE o jsonb;
BEGIN
 o:=nexustalent.bound_offer_opportunity();
 IF o IS NULL OR nexustalent.actor_role() IS DISTINCT FROM 'employer' THEN RETURN NULL; END IF;
 RETURN (SELECT payload->'campaignConsents'->(o->>'campaignId') FROM nexustalent.records WHERE document_path='students/'||(o->>'studentId') AND payload->>'id'=o->>'studentId');
END
$$;
REVOKE ALL ON FUNCTION nexustalent.bound_offer_consent() FROM PUBLIC;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_scope_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.bound_offer_opportunity(),nexustalent.bound_offer_consent() TO nexustalent_offer_writer;
CREATE POLICY offer_read ON nexustalent.records FOR SELECT TO nexustalent_offer_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.offer_stage',true) IN ('shortlisted','interviewing','offered','accepted') AND document_path NOT LIKE '%/%/%' AND ((collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true)) OR ((((SELECT nexustalent.actor_role())='employer' AND current_setting('nexustalent.offer_stage',true) IN ('shortlisted','interviewing','offered')) OR ((SELECT nexustalent.actor_role())='student' AND current_setting('nexustalent.offer_stage',true)='accepted')) AND (SELECT nexustalent.bound_offer_opportunity()) IS NOT NULL AND (
 (collection='opportunities' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true) AND (((SELECT nexustalent.actor_role())='employer' AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.actor_role())='student' AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true)))) OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.bound_offer_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.bound_offer_opportunity())->>'employerId')) OR (collection='offers' AND document_path='offers/'||((SELECT nexustalent.bound_offer_opportunity())->>'offerRecordId') AND payload->>'id'=((SELECT nexustalent.bound_offer_opportunity())->>'offerRecordId') AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=((SELECT nexustalent.bound_offer_opportunity())->>'studentId') AND payload->>'employerId'=((SELECT nexustalent.bound_offer_opportunity())->>'employerId') AND payload->>'campaignId'=((SELECT nexustalent.bound_offer_opportunity())->>'campaignId') AND payload->>'institutionId'=((SELECT nexustalent.bound_offer_opportunity())->>'institutionId')) OR
 ((SELECT nexustalent.actor_role())='employer' AND collection='students' AND document_path='students/'||((SELECT nexustalent.bound_offer_opportunity())->>'studentId'))
 OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':ADVANCE_CANDIDATE_STAGE','UTF8')),'hex') AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'action'='ADVANCE_CANDIDATE_STAGE')))));
CREATE POLICY offer_insert ON nexustalent.records FOR INSERT TO nexustalent_offer_writer WITH CHECK (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.offer_stage',true) IN ('shortlisted','interviewing','offered','accepted') AND document_path NOT LIKE '%/%/%' AND (((SELECT nexustalent.actor_role())='employer' AND current_setting('nexustalent.offer_stage',true) IN ('shortlisted','interviewing','offered')) OR ((SELECT nexustalent.actor_role())='student' AND current_setting('nexustalent.offer_stage',true)='accepted')) AND (SELECT nexustalent.bound_offer_opportunity()) IS NOT NULL AND (
 (collection='offers' AND current_setting('nexustalent.offer_stage',true)='offered' AND (SELECT nexustalent.actor_role())='employer'
 AND document_path='offers/'||encode(sha256(convert_to('offer:'||current_setting('nexustalent.opportunity_id',true)||':'||current_setting('nexustalent.request_id',true),'UTF8')),'hex') AND payload->>'id'=encode(sha256(convert_to('offer:'||current_setting('nexustalent.opportunity_id',true)||':'||current_setting('nexustalent.request_id',true),'UTF8')),'hex')
 AND ((SELECT nexustalent.bound_offer_opportunity())->>'stage')='offered' AND ((SELECT nexustalent.bound_offer_opportunity())->>'offerRecordId')=payload->>'id'
 AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=((SELECT nexustalent.bound_offer_opportunity())->>'studentId')
 AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true) AND payload->>'campaignId'=((SELECT nexustalent.bound_offer_opportunity())->>'campaignId')
 AND payload->>'institutionId'=((SELECT nexustalent.bound_offer_opportunity())->>'institutionId')
 AND payload->>'status'='issued' AND payload->>'issuedBy'=current_setting('nexustalent.actor_uid',true) AND payload->>'currency'='INR'
 AND jsonb_typeof(payload->'salaryLPA')='number' AND (payload->>'salaryLPA')::numeric BETWEEN 0 AND 900719925.4740991
 AND payload-ARRAY['id','opportunityId','campaignId','employerId','studentId','institutionId','role','salaryLPA','currency','joiningWindow','terms','offerLetterUrl','status','issuedAt','issuedBy']='{}'::jsonb)
 OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':ADVANCE_CANDIDATE_STAGE','UTF8')),'hex') AND payload->>'eventId'=split_part(document_path,'/',2)
 AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'actorRole'=(SELECT nexustalent.actor_role()) AND payload->>'action'='ADVANCE_CANDIDATE_STAGE' AND payload->>'requestId'=current_setting('nexustalent.request_id',true) AND payload->'immutable'='true'::jsonb)));
CREATE POLICY offer_update ON nexustalent.records FOR UPDATE TO nexustalent_offer_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.offer_stage',true) IN ('shortlisted','interviewing','offered','accepted') AND document_path NOT LIKE '%/%/%' AND (((SELECT nexustalent.actor_role())='employer' AND current_setting('nexustalent.offer_stage',true) IN ('shortlisted','interviewing','offered')) OR ((SELECT nexustalent.actor_role())='student' AND current_setting('nexustalent.offer_stage',true)='accepted')) AND (SELECT nexustalent.bound_offer_opportunity()) IS NOT NULL AND payload->>'id'=split_part(document_path,'/',2) AND ((collection='opportunities' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true) AND (((SELECT nexustalent.actor_role())='employer' AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.actor_role())='student' AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true)))) OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.bound_offer_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.bound_offer_opportunity())->>'employerId')) OR (current_setting('nexustalent.offer_stage',true)='accepted' AND (collection='offers' AND document_path='offers/'||((SELECT nexustalent.bound_offer_opportunity())->>'offerRecordId') AND payload->>'id'=((SELECT nexustalent.bound_offer_opportunity())->>'offerRecordId') AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=((SELECT nexustalent.bound_offer_opportunity())->>'studentId') AND payload->>'employerId'=((SELECT nexustalent.bound_offer_opportunity())->>'employerId') AND payload->>'campaignId'=((SELECT nexustalent.bound_offer_opportunity())->>'campaignId') AND payload->>'institutionId'=((SELECT nexustalent.bound_offer_opportunity())->>'institutionId')))));
CREATE FUNCTION nexustalent.guard_offer_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE next_stage text:=current_setting('nexustalent.offer_stage',true); old_stage text:=OLD.payload->>'stage'; field text; allowed text[];
BEGIN
 IF NOT pg_has_role(current_user,'nexustalent_offer_writer','MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
 IF OLD.collection='opportunities' THEN
  allowed:=ARRAY['stage','stageUpdatedAt','funnelCountedStages'];
  IF next_stage IN ('shortlisted','interviewing','offered') THEN
    allowed:=allowed||ARRAY['interviewFeedback'];
    IF NOT COALESCE(((SELECT nexustalent.bound_offer_consent())->>'status'='approved' AND (SELECT nexustalent.bound_offer_consent())->>'employerId'=current_setting('nexustalent.actor_uid',true) AND COALESCE((SELECT nexustalent.bound_offer_consent())->>'updatedAt','')<>''),false) THEN RAISE EXCEPTION 'Current employer consent required' USING ERRCODE='23514'; END IF;
  END IF;
  IF next_stage='offered' THEN allowed:=allowed||ARRAY['offerRecordId','offerLetterUrl']; END IF;
  IF NEW.payload->>'stage' IS DISTINCT FROM next_stage OR NOT COALESCE((old_stage,next_stage) IN (('assessment_completed','shortlisted'),('shortlisted','interviewing'),('interviewing','offered'),('offered','accepted')),false)
   OR (NEW.payload-allowed) IS DISTINCT FROM (OLD.payload-allowed)
   OR ((NEW.payload->'funnelCountedStages')-next_stage) IS DISTINCT FROM (COALESCE(OLD.payload->'funnelCountedStages','{}'::jsonb)-next_stage)
   OR NEW.payload->'funnelCountedStages'->next_stage IS DISTINCT FROM 'true'::jsonb
   OR (next_stage='offered' AND NEW.payload->>'offerRecordId' IS DISTINCT FROM encode(sha256(convert_to('offer:'||current_setting('nexustalent.opportunity_id',true)||':'||current_setting('nexustalent.request_id',true),'UTF8')),'hex'))
   OR (next_stage='accepted' AND NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='offers/'||(OLD.payload->>'offerRecordId') AND payload->>'status'='issued' AND payload->>'currency'='INR'))
  THEN RAISE EXCEPTION 'Invalid offer-stage transition' USING ERRCODE='23514'; END IF;
 ELSIF OLD.collection='campaigns' THEN
  field:=CASE next_stage WHEN 'shortlisted' THEN 'shortlisted' WHEN 'interviewing' THEN 'interviewed' WHEN 'offered' THEN 'offersMade' WHEN 'accepted' THEN 'offersAccepted' END;
  IF field IS NULL OR (NEW.payload-'funnel') IS DISTINCT FROM (OLD.payload-'funnel') OR ((NEW.payload->'funnel')-field) IS DISTINCT FROM ((OLD.payload->'funnel')-field)
   OR ((NEW.payload->'funnel'->field) IS DISTINCT FROM (OLD.payload->'funnel'->field) AND (jsonb_typeof(NEW.payload->'funnel'->field) IS DISTINCT FROM 'number' OR (NEW.payload->'funnel'->>field)::numeric-COALESCE((OLD.payload->'funnel'->>field)::numeric,0)<>1))
  THEN RAISE EXCEPTION 'Invalid offer funnel change' USING ERRCODE='23514'; END IF;
 ELSIF OLD.collection='offers' AND next_stage='accepted' THEN
  IF OLD.payload->>'status' IS DISTINCT FROM 'issued' OR NEW.payload->>'status' IS DISTINCT FROM 'accepted' OR NEW.payload->>'acceptedBy' IS DISTINCT FROM current_setting('nexustalent.actor_uid',true)
  OR (NEW.payload-ARRAY['status','acceptedAt','acceptedBy']) IS DISTINCT FROM (OLD.payload-ARRAY['status','acceptedAt','acceptedBy'])
  OR ((SELECT nexustalent.bound_offer_opportunity())->>'stage') IS DISTINCT FROM 'accepted'
  THEN RAISE EXCEPTION 'Invalid offer acceptance' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Unrelated offer mutation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER offer_update_guard BEFORE UPDATE ON nexustalent.records FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_offer_update();
REVOKE ALL ON FUNCTION nexustalent.guard_offer_update() FROM PUBLIC;

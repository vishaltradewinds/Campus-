-- Review candidate: student assessment submission only.
CREATE ROLE nexustalent_assessment_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_assessment_writer;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_assessment_writer;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role(), nexustalent.consent_opportunity() TO nexustalent_assessment_writer;
CREATE POLICY assessment_read ON nexustalent.records FOR SELECT TO nexustalent_assessment_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.assessment_action',true)='ADVANCE_CANDIDATE_STAGE' AND document_path NOT LIKE '%/%/%' AND ((collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true))
 OR ((SELECT nexustalent.actor_role())='student' AND (SELECT nexustalent.consent_opportunity()) IS NOT NULL AND ((collection='opportunities' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true)) OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.consent_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.consent_opportunity())->>'employerId'))
 OR (collection='assessmentSubmissions' AND document_path='assessmentSubmissions/'||encode(sha256(convert_to('assessment:'||current_setting('nexustalent.opportunity_id',true),'UTF8')),'hex') AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true))
 OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':ADVANCE_CANDIDATE_STAGE','UTF8')),'hex') AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'action'='ADVANCE_CANDIDATE_STAGE')))));
CREATE POLICY assessment_insert ON nexustalent.records FOR INSERT TO nexustalent_assessment_writer WITH CHECK (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.assessment_action',true)='ADVANCE_CANDIDATE_STAGE' AND document_path NOT LIKE '%/%/%' AND (SELECT nexustalent.actor_role())='student' AND (SELECT nexustalent.consent_opportunity()) IS NOT NULL AND (
 (collection='assessmentSubmissions' AND document_path='assessmentSubmissions/'||encode(sha256(convert_to('assessment:'||current_setting('nexustalent.opportunity_id',true),'UTF8')),'hex')
 AND payload->>'id'=split_part(document_path,'/',2) AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true) AND payload->>'submittedBy'=current_setting('nexustalent.actor_uid',true)
 AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'campaignId'=((SELECT nexustalent.consent_opportunity())->>'campaignId')
 AND payload->>'employerId'=((SELECT nexustalent.consent_opportunity())->>'employerId') AND ((SELECT nexustalent.consent_opportunity())->>'stage')='assessment_completed'
 AND ((SELECT nexustalent.consent_opportunity())->>'assessmentSubmissionId')=payload->>'id' AND ((SELECT nexustalent.consent_opportunity())->>'assessmentEvidenceHash')=payload->>'evidenceHash'
 AND ((SELECT nexustalent.consent_opportunity())->>'assessmentTemplateId')=payload->>'templateId' AND payload->>'status'='pending_review'
 AND jsonb_typeof(payload->'response')='string' AND length(payload->>'response') BETWEEN 1 AND 12000
 AND (payload->>'templateId') ~ '^[A-Za-z0-9._:-]{1,128}$' AND jsonb_typeof(payload->'shareWithEmployer')='boolean'
 AND payload->>'evidenceHash'=encode(sha256(convert_to(payload->>'response','UTF8')),'hex')
 AND payload-ARRAY['id','opportunityId','campaignId','employerId','studentId','templateId','response','shareWithEmployer','evidenceHash','status','submittedAt','submittedBy']='{}'::jsonb)
 OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':ADVANCE_CANDIDATE_STAGE','UTF8')),'hex') AND payload->>'eventId'=split_part(document_path,'/',2)
 AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'actorRole'='student' AND payload->>'action'='ADVANCE_CANDIDATE_STAGE'
 AND payload->>'requestId'=current_setting('nexustalent.request_id',true) AND payload->'immutable'='true'::jsonb)));
CREATE POLICY assessment_update ON nexustalent.records FOR UPDATE TO nexustalent_assessment_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.assessment_action',true)='ADVANCE_CANDIDATE_STAGE' AND document_path NOT LIKE '%/%/%' AND (SELECT nexustalent.actor_role())='student' AND (SELECT nexustalent.consent_opportunity()) IS NOT NULL AND payload->>'id'=split_part(document_path,'/',2) AND ((collection='opportunities' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true)) OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.consent_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.consent_opportunity())->>'employerId'))));
CREATE FUNCTION nexustalent.guard_assessment_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NOT pg_has_role(current_user,'nexustalent_assessment_writer','MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
 IF OLD.collection='opportunities' THEN
 IF OLD.payload->>'stage' IS DISTINCT FROM 'assessment_pending' OR NEW.payload->>'stage' IS DISTINCT FROM 'assessment_completed'
 OR (NEW.payload-ARRAY['stage','assessmentScore','assessmentEvidenceHash','assessmentTemplateId','assessmentSubmissionId','assessmentReviewStatus','stageUpdatedAt','funnelCountedStages']) IS DISTINCT FROM (OLD.payload-ARRAY['stage','assessmentScore','assessmentEvidenceHash','assessmentTemplateId','assessmentSubmissionId','assessmentReviewStatus','stageUpdatedAt','funnelCountedStages'])
 OR NEW.payload->'assessmentScore' IS DISTINCT FROM 'null'::jsonb OR NEW.payload->>'assessmentReviewStatus' IS DISTINCT FROM 'pending_review'
 OR NEW.payload->>'assessmentSubmissionId' IS DISTINCT FROM encode(sha256(convert_to('assessment:'||current_setting('nexustalent.opportunity_id',true),'UTF8')),'hex')
 OR COALESCE(NEW.payload->>'assessmentEvidenceHash','') !~ '^[a-f0-9]{64}$'
 OR ((NEW.payload->'funnelCountedStages')-'assessment_completed') IS DISTINCT FROM (COALESCE(OLD.payload->'funnelCountedStages','{}'::jsonb)-'assessment_completed')
 OR NEW.payload->'funnelCountedStages'->'assessment_completed' IS DISTINCT FROM 'true'::jsonb
 THEN RAISE EXCEPTION 'Invalid assessment opportunity update' USING ERRCODE='23514'; END IF;
 ELSIF OLD.collection='campaigns' THEN
 IF (NEW.payload-'funnel') IS DISTINCT FROM (OLD.payload-'funnel') OR ((NEW.payload->'funnel')-'assessmentsCompleted') IS DISTINCT FROM ((OLD.payload->'funnel')-'assessmentsCompleted')
 OR (NEW.payload->'funnel'->'assessmentsCompleted' IS DISTINCT FROM OLD.payload->'funnel'->'assessmentsCompleted' AND
 (jsonb_typeof(NEW.payload->'funnel'->'assessmentsCompleted') IS DISTINCT FROM 'number'
 OR (NEW.payload->'funnel'->>'assessmentsCompleted')::numeric-COALESCE((OLD.payload->'funnel'->>'assessmentsCompleted')::numeric,0)<>1))
 THEN RAISE EXCEPTION 'Invalid assessment funnel update' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Unrelated assessment update' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER assessment_update_guard BEFORE UPDATE ON nexustalent.records FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_assessment_update();
REVOKE ALL ON FUNCTION nexustalent.guard_assessment_update() FROM PUBLIC;

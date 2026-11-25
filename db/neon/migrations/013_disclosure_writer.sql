-- Disclosure authorization is derived from current consent and exact invitation.
CREATE ROLE nexustalent_disclosure_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE nexustalent_disclosure_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_disclosure_resolver TO CURRENT_USER;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_disclosure_writer,nexustalent_disclosure_resolver;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_disclosure_writer;
GRANT SELECT ON nexustalent.records TO nexustalent_disclosure_resolver;
-- Resolver has no login; only its fixed function can traverse exact linked identities.
CREATE POLICY disclosure_resolver_read ON nexustalent.records FOR SELECT TO nexustalent_disclosure_resolver USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.disclosure_action',true) IN ('PROVISION_PROJECTION','READ_ASSESSMENT') AND document_path NOT LIKE '%/%/%' AND collection IN ('users','students','campaigns','opportunities','assessmentSubmissions'));
CREATE FUNCTION nexustalent.disclosure_context() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a jsonb; c jsonb; s jsonb; o jsonb; submission jsonb; grant_data jsonb; r text; campaign_id text; student_id text; submission_id text; opportunity_id text; sharing jsonb;
BEGIN
 IF NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NULL OR NULLIF(current_setting('nexustalent.request_id',true),'') IS NULL THEN RETURN NULL; END IF;
 SELECT payload INTO a FROM nexustalent.records WHERE document_path='users/'||current_setting('nexustalent.actor_uid',true) AND payload->>'uid'=current_setting('nexustalent.actor_uid',true);
 r:=a->>'role';
 IF current_setting('nexustalent.disclosure_action',true)='READ_ASSESSMENT' THEN
  IF r IS DISTINCT FROM 'employer' THEN RETURN NULL; END IF;
  submission_id:=current_setting('nexustalent.disclosure_submission',true);
  SELECT payload INTO submission FROM nexustalent.records WHERE document_path='assessmentSubmissions/'||submission_id AND payload->>'id'=submission_id AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true);
  IF submission IS NULL OR submission->'shareWithEmployer' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(submission->'response') IS DISTINCT FROM 'string' OR length(submission->>'response') NOT BETWEEN 1 AND 12000 OR submission->>'evidenceHash' IS DISTINCT FROM encode(sha256(convert_to(submission->>'response','UTF8')),'hex') THEN RETURN NULL; END IF;
  campaign_id:=submission->>'campaignId'; student_id:=submission->>'studentId';
 ELSIF current_setting('nexustalent.disclosure_action',true)='PROVISION_PROJECTION' THEN
  IF COALESCE(r,'') NOT IN ('employer','institution') THEN RETURN NULL; END IF;
  campaign_id:=current_setting('nexustalent.disclosure_campaign',true); student_id:=current_setting('nexustalent.disclosure_student',true);
 ELSE RETURN NULL; END IF;
 SELECT payload INTO c FROM nexustalent.records WHERE document_path='campaigns/'||campaign_id AND payload->>'id'=campaign_id;
 SELECT payload INTO s FROM nexustalent.records WHERE document_path='students/'||student_id AND payload->>'id'=student_id;
 IF c IS NULL OR s IS NULL OR NULLIF(c->>'employerId','') IS NULL THEN RETURN NULL; END IF;
 IF r='employer' AND c->>'employerId' IS DISTINCT FROM current_setting('nexustalent.actor_uid',true) THEN RETURN NULL; END IF;
 IF r='institution' AND (s->>'institutionId' IS DISTINCT FROM current_setting('nexustalent.actor_uid',true) OR NOT COALESCE((c->'targetedInstitutionIds') ? current_setting('nexustalent.actor_uid',true),false)) THEN RETURN NULL; END IF;
 grant_data:=s->'campaignConsents'->campaign_id;
 IF grant_data->>'status' IS DISTINCT FROM 'approved' OR grant_data->>'employerId' IS DISTINCT FROM c->>'employerId' OR COALESCE(grant_data->>'updatedAt','')='' THEN RETURN NULL; END IF;
 opportunity_id:=grant_data->>'opportunityId';
 SELECT payload INTO o FROM nexustalent.records WHERE document_path='opportunities/'||opportunity_id AND payload->>'id'=opportunity_id AND payload->>'studentId'=student_id AND payload->>'campaignId'=campaign_id AND payload->>'employerId'=c->>'employerId';
 IF o IS NULL THEN RETURN NULL; END IF;
 IF current_setting('nexustalent.disclosure_action',true)='READ_ASSESSMENT' THEN
  IF grant_data->'skillBenchmarksShared' IS DISTINCT FROM 'true'::jsonb OR submission->>'opportunityId' IS DISTINCT FROM opportunity_id OR o->>'assessmentSubmissionId' IS DISTINCT FROM submission_id OR o->>'assessmentEvidenceHash' IS DISTINCT FROM submission->>'evidenceHash' THEN RETURN NULL; END IF;
 ELSE
  IF o->>'institutionId' IS DISTINCT FROM s->>'institutionId' OR opportunity_id IS DISTINCT FROM encode(sha256(convert_to((o->>'callId')||':'||student_id,'UTF8')),'hex')
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c->'callsSent')='array' THEN c->'callsSent' ELSE '[]'::jsonb END) x WHERE x->>'id'=o->>'callId' AND x->>'institutionId'=s->>'institutionId') THEN RETURN NULL; END IF;
 END IF;
 sharing:=jsonb_build_object('academicDataShared',COALESCE(grant_data->'academicDataShared'='true'::jsonb,false),'skillBenchmarksShared',COALESCE(grant_data->'skillBenchmarksShared'='true'::jsonb,false),'projectReposShared',COALESCE(grant_data->'projectReposShared'='true'::jsonb,false),'contactInfoShared',COALESCE(grant_data->'contactInfoShared'='true'::jsonb,false));
 RETURN jsonb_build_object('role',r,'studentId',student_id,'campaignId',campaign_id,'employerId',c->>'employerId','opportunityId',opportunity_id,'submissionId',submission_id,'consentScope',sharing,'consentUpdatedAt',grant_data->>'updatedAt','academicCurrent',COALESCE(s->>'academicCorrectedAt','')='' OR s->>'institutionVerificationStatus'='verified' OR s->>'platformVerificationStatus'='verified','projectionId',encode(sha256(convert_to((c->>'employerId')||':'||campaign_id||':'||student_id,'UTF8')),'hex'));
END
$$;
REVOKE ALL ON FUNCTION nexustalent.disclosure_context() FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_disclosure_resolver;
ALTER FUNCTION nexustalent.disclosure_context() OWNER TO nexustalent_disclosure_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_disclosure_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.disclosure_context() TO nexustalent_disclosure_writer;
CREATE POLICY disclosure_read ON nexustalent.records FOR SELECT TO nexustalent_disclosure_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.disclosure_action',true) IN ('PROVISION_PROJECTION','READ_ASSESSMENT') AND document_path NOT LIKE '%/%/%' AND ((collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true) AND payload->>'uid'=current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.disclosure_context()) IS NOT NULL AND (
 (collection='students' AND document_path='students/'||((SELECT nexustalent.disclosure_context())->>'studentId')) OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.disclosure_context())->>'campaignId'))
 OR (collection='opportunities' AND document_path='opportunities/'||((SELECT nexustalent.disclosure_context())->>'opportunityId'))
 OR (current_setting('nexustalent.disclosure_action',true)='READ_ASSESSMENT' AND collection='assessmentSubmissions' AND document_path='assessmentSubmissions/'||((SELECT nexustalent.disclosure_context())->>'submissionId'))
 OR (current_setting('nexustalent.disclosure_action',true)='PROVISION_PROJECTION' AND (SELECT nexustalent.disclosure_context()) IS NOT NULL AND ((collection='candidateProfiles' AND document_path='candidateProfiles/'||((SELECT nexustalent.disclosure_context())->>'projectionId')) OR (collection='careerEvidence' AND payload->>'studentId'=((SELECT nexustalent.disclosure_context())->>'studentId') AND payload->>'status'='verified' AND COALESCE(payload->>'disputeStatus','')<>'open' AND ((payload->>'claimType'='skill' AND (SELECT nexustalent.disclosure_context())->'consentScope'->'skillBenchmarksShared'='true'::jsonb) OR (payload->>'claimType'='education' AND (SELECT nexustalent.disclosure_context())->'consentScope'->'academicDataShared'='true'::jsonb) OR (payload->>'claimType'='project' AND (SELECT nexustalent.disclosure_context())->'consentScope'->'projectReposShared'='true'::jsonb))) OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.disclosure_campaign',true)||':'||current_setting('nexustalent.disclosure_student',true),'UTF8')),'hex') AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'action'='CANDIDATE_PROJECTION_PROVISIONED')))
 ))));
CREATE POLICY disclosure_insert ON nexustalent.records FOR INSERT TO nexustalent_disclosure_writer WITH CHECK (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.disclosure_action',true) IN ('PROVISION_PROJECTION','READ_ASSESSMENT') AND document_path NOT LIKE '%/%/%' AND current_setting('nexustalent.disclosure_action',true)='PROVISION_PROJECTION' AND (SELECT nexustalent.disclosure_context()) IS NOT NULL AND (((collection='candidateProfiles' AND document_path='candidateProfiles/'||((SELECT nexustalent.disclosure_context())->>'projectionId')) AND payload->>'studentId'=((SELECT nexustalent.disclosure_context())->>'studentId') AND payload->>'employerId'=((SELECT nexustalent.disclosure_context())->>'employerId') AND payload->>'campaignId'=((SELECT nexustalent.disclosure_context())->>'campaignId') AND payload->>'opportunityId'=((SELECT nexustalent.disclosure_context())->>'opportunityId') AND payload->>'consentStatus'='approved' AND payload->>'consentUpdatedAt'=((SELECT nexustalent.disclosure_context())->>'consentUpdatedAt') AND payload->'consentScope'=((SELECT nexustalent.disclosure_context())->'consentScope') AND payload->'projectionVersion'='3'::jsonb)
 OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':'||current_setting('nexustalent.disclosure_campaign',true)||':'||current_setting('nexustalent.disclosure_student',true),'UTF8')),'hex') AND payload->>'eventId'=split_part(document_path,'/',2) AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'actorRole'=((SELECT nexustalent.disclosure_context())->>'role') AND payload->>'requestId'=current_setting('nexustalent.request_id',true) AND payload->>'action'='CANDIDATE_PROJECTION_PROVISIONED' AND payload->>'subjectStudentId'=current_setting('nexustalent.disclosure_student',true) AND payload->>'employerId'=((SELECT nexustalent.disclosure_context())->>'employerId') AND payload->>'campaignId'=current_setting('nexustalent.disclosure_campaign',true) AND payload->>'projectionId'=((SELECT nexustalent.disclosure_context())->>'projectionId') AND payload->'consentScope'=((SELECT nexustalent.disclosure_context())->'consentScope') AND payload->'immutable'='true'::jsonb)));
CREATE POLICY disclosure_replace ON nexustalent.records FOR UPDATE TO nexustalent_disclosure_writer USING (NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.disclosure_action',true) IN ('PROVISION_PROJECTION','READ_ASSESSMENT') AND document_path NOT LIKE '%/%/%' AND current_setting('nexustalent.disclosure_action',true)='PROVISION_PROJECTION' AND (SELECT nexustalent.disclosure_context()) IS NOT NULL AND collection='candidateProfiles' AND document_path='candidateProfiles/'||((SELECT nexustalent.disclosure_context())->>'projectionId')) WITH CHECK (NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.disclosure_action',true) IN ('PROVISION_PROJECTION','READ_ASSESSMENT') AND document_path NOT LIKE '%/%/%' AND current_setting('nexustalent.disclosure_action',true)='PROVISION_PROJECTION' AND (SELECT nexustalent.disclosure_context()) IS NOT NULL AND collection='candidateProfiles' AND document_path='candidateProfiles/'||((SELECT nexustalent.disclosure_context())->>'projectionId') AND payload->>'studentId'=((SELECT nexustalent.disclosure_context())->>'studentId') AND payload->>'employerId'=((SELECT nexustalent.disclosure_context())->>'employerId') AND payload->>'campaignId'=((SELECT nexustalent.disclosure_context())->>'campaignId') AND payload->>'opportunityId'=((SELECT nexustalent.disclosure_context())->>'opportunityId') AND payload->>'consentStatus'='approved' AND payload->>'consentUpdatedAt'=((SELECT nexustalent.disclosure_context())->>'consentUpdatedAt') AND payload->'consentScope'=((SELECT nexustalent.disclosure_context())->'consentScope') AND payload->'projectionVersion'='3'::jsonb);
CREATE FUNCTION nexustalent.guard_disclosure_write() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE c jsonb; s jsonb; item jsonb;
BEGIN
 IF NOT pg_has_role(current_user,'nexustalent_disclosure_writer','MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) OR split_part(NEW.document_path,'/',1)<>'candidateProfiles' THEN RETURN NEW; END IF;
 c:=nexustalent.disclosure_context(); s:=c->'consentScope';
 IF c IS NULL OR current_setting('nexustalent.disclosure_action',true)<>'PROVISION_PROJECTION' OR NEW.payload-ARRAY['studentId','employerId','campaignId','role','name','institutionId','institutionName','candidateType','consentStatus','consentUpdatedAt','consentScope','projectionVersion','opportunityId','academicCorrectedAt','updatedAt','program','branch','graduationYear','cgpa','verifiedSkills','verifiedEvidence','projects','email']<>'{}'::jsonb
 OR ((s->'academicDataShared' IS DISTINCT FROM 'true'::jsonb OR c->'academicCurrent' IS DISTINCT FROM 'true'::jsonb) AND NEW.payload ?| ARRAY['program','branch','graduationYear','cgpa'])
 OR (s->'contactInfoShared' IS DISTINCT FROM 'true'::jsonb AND NEW.payload ? 'email')
 OR (s->'skillBenchmarksShared' IS DISTINCT FROM 'true'::jsonb AND NEW.payload ? 'verifiedSkills')
 OR (NEW.payload ? 'projects' AND (s->'projectReposShared' IS DISTINCT FROM 'true'::jsonb OR NEW.payload->'projects' IS DISTINCT FROM '[]'::jsonb))
 OR jsonb_typeof(NEW.payload->'verifiedEvidence') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Projection violates current consent scope' USING ERRCODE='23514'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.payload->'verifiedEvidence') LOOP
  IF NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='careerEvidence/'||(item->>'id') AND payload->>'claimType'=item->>'claimType' AND payload->>'claimKey'=item->>'claimKey' AND payload->>'claimValue'=item->>'claimValue' AND payload->>'sourceType'=item->>'sourceType' AND COALESCE(NULLIF(payload->>'expiresAt','')::timestamptz>clock_timestamp(),true))
  OR item-ARRAY['id','claimType','claimKey','claimValue','sourceType','reviewedAt','expiresAt']<>'{}'::jsonb OR (item->>'claimType'='education' AND c->'academicCurrent' IS DISTINCT FROM 'true'::jsonb)
  THEN RAISE EXCEPTION 'Unscoped projection evidence' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END
$$;
CREATE TRIGGER disclosure_write_guard BEFORE INSERT OR UPDATE ON nexustalent.records FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_disclosure_write();
REVOKE ALL ON FUNCTION nexustalent.guard_disclosure_write() FROM PUBLIC;

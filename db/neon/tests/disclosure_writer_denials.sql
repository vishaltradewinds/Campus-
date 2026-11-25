BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/disc-emp','{"uid":"disc-emp","role":"employer"}'),('users/disc-foreign','{"uid":"disc-foreign","role":"employer"}'),
 ('campaigns/disc-camp','{"id":"disc-camp","employerId":"disc-emp","callsSent":[{"id":"disc-call","institutionId":"disc-inst"}]}');
WITH o AS (SELECT encode(sha256(convert_to('disc-call:disc-stu','UTF8')),'hex') id)
INSERT INTO nexustalent.records(document_path,payload)
SELECT 'opportunities/'||id,jsonb_build_object('id',id,'studentId','disc-stu','employerId','disc-emp','campaignId','disc-camp','institutionId','disc-inst','callId','disc-call','assessmentSubmissionId','disc-sub','assessmentEvidenceHash',encode(sha256(convert_to('Synthetic','UTF8')),'hex')) FROM o;
WITH o AS (SELECT encode(sha256(convert_to('disc-call:disc-stu','UTF8')),'hex') id)
INSERT INTO nexustalent.records(document_path,payload)
SELECT 'students/disc-stu',jsonb_build_object('id','disc-stu','institutionId','disc-inst','email','private@example.invalid','campaignConsents',jsonb_build_object('disc-camp',jsonb_build_object('status','approved','employerId','disc-emp','opportunityId',id,'updatedAt','test','skillBenchmarksShared',true))) FROM o;
WITH o AS (SELECT encode(sha256(convert_to('disc-call:disc-stu','UTF8')),'hex') id)
INSERT INTO nexustalent.records(document_path,payload)
SELECT 'assessmentSubmissions/disc-sub',jsonb_build_object('id','disc-sub','studentId','disc-stu','employerId','disc-emp','campaignId','disc-camp','opportunityId',id,'response','Synthetic','shareWithEmployer',true,'evidenceHash',encode(sha256(convert_to('Synthetic','UTF8')),'hex')) FROM o;
SET LOCAL ROLE nexustalent_disclosure_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound disclosure leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','disc-foreign',true),set_config('nexustalent.disclosure_action','PROVISION_PROJECTION',true),set_config('nexustalent.request_id','disc-req-001',true),set_config('nexustalent.disclosure_campaign','disc-camp',true),set_config('nexustalent.disclosure_student','disc-stu',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection IN ('students','campaigns','opportunities')) THEN RAISE EXCEPTION 'Foreign disclosure'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','disc-emp',true);
DO $$ DECLARE c jsonb:=nexustalent.disclosure_context(); p jsonb; BEGIN
 IF c IS NULL THEN RAISE EXCEPTION 'Authorized disclosure not resolved'; END IF;
 p:=jsonb_build_object('studentId','disc-stu','employerId','disc-emp','campaignId','disc-camp','opportunityId',c->>'opportunityId','consentStatus','approved','consentUpdatedAt','test','consentScope',c->'consentScope','projectionVersion',3,'verifiedEvidence','[]'::jsonb);
 BEGIN INSERT INTO nexustalent.records(document_path,payload) VALUES ('candidateProfiles/'||(c->>'projectionId'),p||'{"email":"private@example.invalid"}'); RAISE EXCEPTION 'Unconsented email disclosed'; EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO nexustalent.records(document_path,payload) VALUES ('candidateProfiles/'||(c->>'projectionId'),p);
END $$;
SELECT set_config('nexustalent.disclosure_action','READ_ASSESSMENT',true),set_config('nexustalent.disclosure_submission','disc-sub',true);
DO $$ BEGIN
 IF (SELECT payload->>'response' FROM nexustalent.records WHERE document_path='assessmentSubmissions/disc-sub') IS DISTINCT FROM 'Synthetic' THEN RAISE EXCEPTION 'Authorized assessment missing'; END IF;
 UPDATE nexustalent.records SET payload=payload||'{"name":"forged"}' WHERE collection='candidateProfiles';
 IF FOUND THEN RAISE EXCEPTION 'Assessment mode wrote projection'; END IF;
END $$;
SELECT set_config('nexustalent.actor_uid','disc-foreign',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='assessmentSubmissions') THEN RAISE EXCEPTION 'Foreign assessment leaked'; END IF; END $$;
RESET ROLE;
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{campaignConsents,disc-camp,status}','"denied"') WHERE document_path='students/disc-stu';
SET LOCAL ROLE nexustalent_disclosure_ci;
SELECT set_config('nexustalent.actor_uid','disc-emp',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection='assessmentSubmissions') THEN RAISE EXCEPTION 'Revoked assessment leaked'; END IF; END $$;
ROLLBACK;

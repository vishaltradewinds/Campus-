BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/rls-assess-stu','{"uid":"rls-assess-stu","role":"student"}'),
 ('campaigns/rls-assess-camp','{"id":"rls-assess-camp","employerId":"emp","funnel":{"assessmentsCompleted":0,"joined":0}}'),
 ('opportunities/rls-assess-opp','{"id":"rls-assess-opp","studentId":"rls-assess-stu","campaignId":"rls-assess-camp","employerId":"emp","stage":"assessment_pending"}'),
 ('opportunities/rls-assess-other','{"id":"rls-assess-other","studentId":"other","campaignId":"rls-assess-camp","employerId":"emp","stage":"assessment_pending"}');
SET LOCAL ROLE nexustalent_assessment_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound assessment leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','rls-assess-stu',true),set_config('nexustalent.assessment_action','ADVANCE_CANDIDATE_STAGE',true),set_config('nexustalent.request_id','assessment-001',true),set_config('nexustalent.opportunity_id','rls-assess-opp',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='opportunities/rls-assess-other') THEN RAISE EXCEPTION 'Foreign opportunity read'; END IF;
 BEGIN UPDATE nexustalent.records SET payload=jsonb_set(payload,'{stage}','"offered"') WHERE document_path='opportunities/rls-assess-opp'; RAISE EXCEPTION 'Offer escalation'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,joined}','10') WHERE document_path='campaigns/rls-assess-camp'; RAISE EXCEPTION 'Unrelated funnel mutation'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO nexustalent.records(document_path,payload) VALUES ('offers/forged','{"id":"forged"}'); RAISE EXCEPTION 'Offer write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
WITH e AS (SELECT encode(sha256(convert_to('assessment:rls-assess-opp','UTF8')),'hex') id,encode(sha256(convert_to('Synthetic','UTF8')),'hex') h)
UPDATE nexustalent.records SET payload=payload||jsonb_build_object('stage','assessment_completed','assessmentScore',NULL,'assessmentSubmissionId',e.id,'assessmentEvidenceHash',e.h,'assessmentTemplateId','template','assessmentReviewStatus','pending_review','funnelCountedStages',jsonb_build_object('assessment_completed',true)) FROM e WHERE document_path='opportunities/rls-assess-opp';
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,assessmentsCompleted}','1') WHERE document_path='campaigns/rls-assess-camp';
DO $$ DECLARE aid text:=encode(sha256(convert_to('assessment:rls-assess-opp','UTF8')),'hex'); BEGIN
 BEGIN INSERT INTO nexustalent.records(document_path,payload) VALUES ('assessmentSubmissions/'||aid,jsonb_build_object('id',aid,'studentId','rls-assess-stu','submittedBy','rls-assess-stu','opportunityId','rls-assess-opp','campaignId','rls-assess-camp','employerId','emp','status','pending_review','response','Tampered','evidenceHash','wrong','templateId','template','shareWithEmployer',false)); RAISE EXCEPTION 'Tampered evidence accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
WITH e AS (SELECT encode(sha256(convert_to('assessment:rls-assess-opp','UTF8')),'hex') id,encode(sha256(convert_to('Synthetic','UTF8')),'hex') h)
INSERT INTO nexustalent.records(document_path,payload) SELECT 'assessmentSubmissions/'||id,jsonb_build_object('id',id,'studentId','rls-assess-stu','submittedBy','rls-assess-stu','opportunityId','rls-assess-opp','campaignId','rls-assess-camp','employerId','emp','status','pending_review','response','Synthetic','evidenceHash',h,'templateId','template','shareWithEmployer',false) FROM e;
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records WHERE collection='assessmentSubmissions')<>1 THEN RAISE EXCEPTION 'Valid assessment missing'; END IF;
 UPDATE nexustalent.records SET payload=payload||'{"response":"tampered"}' WHERE collection='assessmentSubmissions';
 IF FOUND THEN RAISE EXCEPTION 'Assessment overwrite allowed'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_assessment_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Assessment context persisted'; END IF; END $$;
ROLLBACK;

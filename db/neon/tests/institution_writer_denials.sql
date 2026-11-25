BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/rls-inst','{"uid":"rls-inst","role":"institution"}'),
 ('institutions/rls-inst','{"id":"rls-inst","empanelmentStatus":"empanelled"}'),
 ('students/rls-stu','{"id":"rls-stu","institutionId":"rls-inst","institutionVerificationStatus":"verified"}'),
 ('students/rls-other','{"id":"rls-other","institutionId":"other","institutionVerificationStatus":"verified"}'),
 ('students/rls-pending','{"id":"rls-pending","institutionId":"rls-inst","institutionVerificationStatus":"pending"}'),
 ('campaigns/rls-camp','{"id":"rls-camp","employerId":"emp","candidateOpportunities":[],"funnel":{"institutionsAccepted":0,"studentsInvited":0,"joined":0}}'),
 ('calls/rls-call','{"id":"rls-call","campaignId":"rls-camp","employerId":"emp","institutionId":"rls-inst","status":"pending","activatedStudentsCount":0}'),
 ('campaigns/rls-foreign','{"id":"rls-foreign","employerId":"emp"}'),
 ('calls/rls-foreign','{"id":"rls-foreign","campaignId":"rls-foreign","employerId":"emp","institutionId":"other","status":"pending"}');
SET LOCAL ROLE nexustalent_institution_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound institution leaked records'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','rls-inst',true),set_config('nexustalent.institution_action','RESPOND_CALL',true),set_config('nexustalent.request_id','rls-respond-1',true),set_config('nexustalent.call_id','rls-call',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records)<>4 THEN RAISE EXCEPTION 'Response scope mismatch'; END IF;
 UPDATE nexustalent.records SET payload=payload||'{"status":"accepted"}' WHERE document_path='calls/rls-foreign';
 IF FOUND THEN RAISE EXCEPTION 'Foreign call update allowed'; END IF;
 BEGIN
 UPDATE nexustalent.records SET payload=payload||'{"status":"accepted","offeredCandidatesCount":1,"employerId":"forged"}' WHERE document_path='calls/rls-call';
 RAISE EXCEPTION 'Call ownership mutation allowed';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
 INSERT INTO nexustalent.records(document_path,payload) VALUES ('opportunities/forged','{"id":"forged","institutionId":"rls-inst","callId":"rls-call"}');
 RAISE EXCEPTION 'Response inserted opportunity';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||'{"status":"accepted","offeredCandidatesCount":1}' WHERE document_path='calls/rls-call';
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,institutionsAccepted}','1') WHERE document_path='campaigns/rls-camp';
SELECT set_config('nexustalent.institution_action','ACTIVATE_STUDENTS',true),set_config('nexustalent.request_id','rls-activate-1',true);
DO $$
DECLARE sid text; oid text;
BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='students/rls-other') THEN RAISE EXCEPTION 'Foreign student read'; END IF;
 FOREACH sid IN ARRAY ARRAY['rls-other','rls-pending'] LOOP
  oid:=encode(sha256(convert_to('rls-call:'||sid,'UTF8')),'hex');
  BEGIN
   INSERT INTO nexustalent.records(document_path,payload) VALUES ('opportunities/'||oid,jsonb_build_object('id',oid,'studentId',sid,'studentName','Candidate','callId','rls-call','institutionId','rls-inst','employerId','emp','campaignId','rls-camp','stage','invited'));
   RAISE EXCEPTION 'Unverified or foreign candidate activated';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 BEGIN
 UPDATE nexustalent.records SET payload=jsonb_set(payload,'{activatedStudentsCount}','2') WHERE document_path='calls/rls-call';
 RAISE EXCEPTION 'Activation capacity exceeded';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
 UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,joined}','100') WHERE document_path='campaigns/rls-camp';
 RAISE EXCEPTION 'Unrelated funnel change allowed';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
 INSERT INTO nexustalent.records(document_path,payload) VALUES ('auditEvents/forged','{"id":"forged"}');
 RAISE EXCEPTION 'Forged audit allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
WITH x AS (SELECT encode(sha256(convert_to('rls-call:rls-stu','UTF8')),'hex') AS id)
INSERT INTO nexustalent.records(document_path,payload) SELECT 'opportunities/'||id,jsonb_build_object('id',id,'studentId','rls-stu','studentName','Candidate','callId','rls-call','institutionId','rls-inst','employerId','emp','campaignId','rls-camp','stage','invited') FROM x;
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{activatedStudentsCount}','1') WHERE document_path='calls/rls-call';
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,studentsInvited}','1') WHERE document_path='campaigns/rls-camp';
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records WHERE collection='opportunities')<>1 THEN RAISE EXCEPTION 'Valid activation missing'; END IF;
 IF (SELECT payload->>'activatedStudentsCount' FROM nexustalent.records WHERE document_path='calls/rls-call') IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Activation count missing'; END IF;
END $$;
SELECT set_config('nexustalent.call_id','rls-foreign',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection IN ('campaigns','calls','students','opportunities')) THEN RAISE EXCEPTION 'Foreign call context leaked linked data'; END IF; END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_institution_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Context persisted'; END IF; END $$;
ROLLBACK;
BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('campaigns/rls-foreign','{"id":"rls-foreign","employerId":"other","status":"active"}'),
 ('institutions/rls-target','{"id":"rls-target","empanelmentStatus":"empanelled"}'),
 ('institutions/rls-pending','{"id":"rls-pending","empanelmentStatus":"pending_empanelment"}');
SET LOCAL ROLE nexustalent_demand_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound demand writer leaked records'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','ci-employer',true),set_config('nexustalent.demand_action','CREATE_REQUIREMENT_CAMPAIGN',true),set_config('nexustalent.request_id','rls-create-0001',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path IN ('campaigns/rls-foreign','students/ci-student','institutions/rls-target')) THEN RAISE EXCEPTION 'Cross-scope read'; END IF;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('requirements/rls-foreign','{"id":"rls-foreign","employerId":"other","status":"active"}');
  RAISE EXCEPTION 'Foreign insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('successFees/rls-forged','{"id":"rls-forged","employerId":"ci-employer"}');
  RAISE EXCEPTION 'Billing insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('auditEvents/forged','{"eventId":"forged","actorRole":"employer","actorUid":"ci-employer","action":"CREATE_REQUIREMENT_CAMPAIGN","requestId":"rls-create-0001","immutable":true}');
  RAISE EXCEPTION 'Forged audit allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('requirements/rls-req','{"id":"rls-req","employerId":"ci-employer","status":"active"}'),
 ('campaigns/rls-own','{"id":"rls-own","employerId":"ci-employer","status":"active","targetedInstitutionIds":[],"callsSent":[],"candidateOpportunities":[],"funnel":{"institutionsInvited":0,"joined":0}}');
DO $$ BEGIN
 UPDATE nexustalent.records SET payload=payload||'{"title":"forged"}' WHERE document_path='campaigns/rls-own';
 IF FOUND THEN RAISE EXCEPTION 'Create scope allowed update'; END IF;
END $$;
SELECT set_config('nexustalent.demand_action','SEND_CALLS',true),set_config('nexustalent.request_id','rls-send-0001',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='institutions/rls-target') OR EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='institutions/rls-pending') THEN RAISE EXCEPTION 'Institution scope mismatch'; END IF;
 UPDATE nexustalent.records SET payload=payload||'{"title":"forged"}' WHERE document_path='campaigns/rls-foreign';
 IF FOUND THEN RAISE EXCEPTION 'Foreign update allowed'; END IF;
 BEGIN
  UPDATE nexustalent.records SET payload=payload||'{"title":"forged"}' WHERE document_path='campaigns/rls-own';
  RAISE EXCEPTION 'Unrelated campaign field mutation allowed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,joined}','100') WHERE document_path='campaigns/rls-own';
  RAISE EXCEPTION 'Funnel manipulation allowed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('campaigns/rls-new','{"id":"rls-new","employerId":"ci-employer","status":"active"}');
  RAISE EXCEPTION 'Send scope allowed campaign creation';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES ('calls/rls-call','{"id":"rls-call","campaignId":"rls-own","employerId":"ci-employer","institutionId":"rls-target","status":"pending","activatedStudentsCount":0}');
UPDATE nexustalent.records SET payload=payload||'{"targetedInstitutionIds":["rls-target"],"callsSent":[{"id":"rls-call"}],"funnel":{"institutionsInvited":1,"joined":0}}' WHERE document_path='campaigns/rls-own';
DO $$ BEGIN
 IF (SELECT payload->'funnel'->>'institutionsInvited' FROM nexustalent.records WHERE document_path='campaigns/rls-own') IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Valid demand update failed'; END IF;
 BEGIN
  DELETE FROM nexustalent.records WHERE document_path='calls/rls-call';
  RAISE EXCEPTION 'Delete allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SELECT set_config('nexustalent.actor_uid','ci-student',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE collection<>'users') THEN RAISE EXCEPTION 'Non-employer scope leaked rows'; END IF;
 BEGIN
  INSERT INTO nexustalent.records(document_path,payload) VALUES ('calls/rls-student','{"id":"rls-student","employerId":"ci-student","status":"pending","activatedStudentsCount":0}');
  RAISE EXCEPTION 'Student demand write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_demand_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Demand context persisted'; END IF; END $$;
ROLLBACK;
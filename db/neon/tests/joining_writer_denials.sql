BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/rls-join-inst','{"uid":"rls-join-inst","role":"institution"}'),
 ('students/rls-join-stu','{"id":"rls-join-stu","institutionId":"rls-join-inst","placementStatus":"in_process"}'),
 ('campaigns/rls-join-camp','{"id":"rls-join-camp","employerId":"emp","funnel":{"joined":0}}'),
 ('opportunities/rls-join-opp','{"id":"rls-join-opp","studentId":"rls-join-stu","campaignId":"rls-join-camp","employerId":"emp","employerName":"Synthetic","institutionId":"rls-join-inst","stage":"accepted","offerRecordId":"rls-join-offer"}'),
 ('offers/rls-join-offer','{"id":"rls-join-offer","studentId":"rls-join-stu","campaignId":"rls-join-camp","employerId":"emp","institutionId":"rls-join-inst","opportunityId":"rls-join-opp","status":"accepted","currency":"INR","salaryLPA":8}'),
 ('opportunities/rls-join-foreign','{"id":"rls-join-foreign","studentId":"other","employerId":"other","institutionId":"other","stage":"accepted"}');
SET LOCAL ROLE nexustalent_joining_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound joining leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','rls-join-inst',true),set_config('nexustalent.joining_action','joined',true),set_config('nexustalent.request_id','rls-joining-001',true),set_config('nexustalent.opportunity_id','rls-join-opp',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='opportunities/rls-join-foreign') THEN RAISE EXCEPTION 'Foreign opportunity visible'; END IF;
 BEGIN UPDATE nexustalent.records SET payload=payload||'{"stage":"joined","joinedSalaryLPA":99,"funnelCountedStages":{"joined":true}}' WHERE document_path='opportunities/rls-join-opp'; RAISE EXCEPTION 'Forged salary allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO nexustalent.records(document_path,payload) VALUES ('invoices/forged','{"id":"forged"}'); RAISE EXCEPTION 'Invoice creation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||'{"stage":"joined","joinedSalaryLPA":8,"funnelCountedStages":{"joined":true}}' WHERE document_path='opportunities/rls-join-opp';
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,joined}','1') WHERE document_path='campaigns/rls-join-camp';
UPDATE nexustalent.records SET payload=payload||'{"status":"joined","joinedBy":"rls-join-inst"}' WHERE document_path='offers/rls-join-offer';
UPDATE nexustalent.records SET payload=payload||'{"placementStatus":"placed","placedCompany":"Synthetic","placedSalaryLPA":8,"availability":"not_currently_available"}' WHERE document_path='students/rls-join-stu';
DO $$ DECLARE fid text:=encode(sha256(convert_to('success-fee:rls-join-opp','UTF8')),'hex'); BEGIN
 BEGIN INSERT INTO nexustalent.records(document_path,payload) VALUES ('successFees/'||fid,jsonb_build_object('id',fid,'opportunityId','rls-join-opp','campaignId','rls-join-camp','employerId','emp','studentId','rls-join-stu','status','earned','currency','INR','feeRateBps',500,'compensationMinor',80000000,'feeAmountMinor',999)); RAISE EXCEPTION 'Incorrect fee allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
WITH e AS (SELECT encode(sha256(convert_to('success-fee:rls-join-opp','UTF8')),'hex') id)
INSERT INTO nexustalent.records(document_path,payload) SELECT 'successFees/'||id,jsonb_build_object('id',id,'opportunityId','rls-join-opp','campaignId','rls-join-camp','employerId','emp','studentId','rls-join-stu','status','earned','currency','INR','feeRateBps',500,'compensationMinor',80000000,'feeAmountMinor',4000000) FROM e;
DO $$ BEGIN
 IF (SELECT count(*) FROM nexustalent.records WHERE collection='successFees')<>1 THEN RAISE EXCEPTION 'Earned fee missing'; END IF;
 UPDATE nexustalent.records SET payload=payload||'{"status":"paid"}' WHERE collection='successFees';
 IF FOUND THEN RAISE EXCEPTION 'Payment status mutation allowed'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_joining_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Joining context persisted'; END IF; END $$;
ROLLBACK;

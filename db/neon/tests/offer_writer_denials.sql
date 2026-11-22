BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/rls-offer-emp','{"uid":"rls-offer-emp","role":"employer"}'),
 ('users/rls-offer-stu','{"uid":"rls-offer-stu","role":"student"}'),
 ('students/rls-offer-stu','{"id":"rls-offer-stu","campaignConsents":{"rls-offer-camp":{"status":"approved","employerId":"rls-offer-emp","updatedAt":"test"}}}'),
 ('campaigns/rls-offer-camp','{"id":"rls-offer-camp","employerId":"rls-offer-emp","funnel":{"offersMade":0,"joined":0}}'),
 ('opportunities/rls-offer-opp','{"id":"rls-offer-opp","studentId":"rls-offer-stu","campaignId":"rls-offer-camp","employerId":"rls-offer-emp","institutionId":"inst","stage":"interviewing"}'),
 ('opportunities/rls-offer-foreign','{"id":"rls-offer-foreign","studentId":"other","campaignId":"rls-offer-camp","employerId":"other","institutionId":"inst","stage":"interviewing"}');
SET LOCAL ROLE nexustalent_offer_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound offer writer leaked rows'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','rls-offer-emp',true),set_config('nexustalent.offer_stage','offered',true),set_config('nexustalent.request_id','rls-offer-001',true),set_config('nexustalent.opportunity_id','rls-offer-opp',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='opportunities/rls-offer-foreign') THEN RAISE EXCEPTION 'Foreign opportunity visible'; END IF;
 BEGIN UPDATE nexustalent.records SET payload=jsonb_set(payload,'{stage}','"joined"') WHERE document_path='opportunities/rls-offer-opp'; RAISE EXCEPTION 'Joining escalated'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO nexustalent.records(document_path,payload) VALUES ('successFees/forged','{"id":"forged"}'); RAISE EXCEPTION 'Billing mutation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
WITH e AS (SELECT encode(sha256(convert_to('offer:rls-offer-opp:rls-offer-001','UTF8')),'hex') id)
UPDATE nexustalent.records SET payload=payload||jsonb_build_object('stage','offered','offerRecordId',e.id,'funnelCountedStages',jsonb_build_object('offered',true)) FROM e WHERE document_path='opportunities/rls-offer-opp';
WITH e AS (SELECT encode(sha256(convert_to('offer:rls-offer-opp:rls-offer-001','UTF8')),'hex') id)
INSERT INTO nexustalent.records(document_path,payload) SELECT 'offers/'||id,jsonb_build_object('id',id,'studentId','rls-offer-stu','opportunityId','rls-offer-opp','campaignId','rls-offer-camp','employerId','rls-offer-emp','institutionId','inst','status','issued','issuedBy','rls-offer-emp','salaryLPA',8,'currency','INR') FROM e;
SELECT set_config('nexustalent.actor_uid','rls-offer-stu',true),set_config('nexustalent.offer_stage','accepted',true);
UPDATE nexustalent.records SET payload=payload||jsonb_build_object('stage','accepted','funnelCountedStages',jsonb_build_object('offered',true,'accepted',true)) WHERE document_path='opportunities/rls-offer-opp';
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=payload||'{"status":"accepted","acceptedBy":"rls-offer-stu","salaryLPA":99}' WHERE collection='offers'; RAISE EXCEPTION 'Student changed compensation'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||'{"status":"accepted","acceptedBy":"rls-offer-stu"}' WHERE collection='offers';
DO $$ BEGIN IF (SELECT payload->>'status' FROM nexustalent.records WHERE collection='offers') IS DISTINCT FROM 'accepted' THEN RAISE EXCEPTION 'Valid offer acceptance missing'; END IF; END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_offer_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Offer context persisted'; END IF; END $$;
ROLLBACK;

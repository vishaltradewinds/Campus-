BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('students/rls-consent-stu','{"id":"rls-consent-stu","institutionId":"camp","campaignConsents":{}}'),
 ('users/rls-consent-stu','{"uid":"rls-consent-stu","role":"student"}'),
 ('campaigns/rls-consent-camp','{"id":"rls-consent-camp","employerId":"emp","targetedInstitutionIds":["camp"],"funnel":{"applicationsConsented":0,"joined":0}}'),
 ('opportunities/rls-consent-opp','{"id":"rls-consent-opp","studentId":"rls-consent-stu","campaignId":"rls-consent-camp","employerId":"emp","stage":"invited"}'),
 ('opportunities/rls-consent-other','{"id":"rls-consent-other","studentId":"other","campaignId":"rls-consent-camp","employerId":"emp","stage":"invited"}');
SET LOCAL ROLE nexustalent_consent_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound consent context leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','rls-consent-stu',true),set_config('nexustalent.consent_action','GLOBAL_CONSENT',true),set_config('nexustalent.request_id','rls-consent-001',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent.records WHERE document_path='opportunities/rls-consent-other') THEN RAISE EXCEPTION 'Foreign opportunity visible'; END IF;
 BEGIN UPDATE nexustalent.records SET payload=payload||'{"institutionId":"other"}' WHERE document_path='students/rls-consent-stu'; RAISE EXCEPTION 'Unrelated profile update'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE nexustalent.records SET payload=jsonb_set(payload,'{campaignConsents}', '{"rls-consent-camp":{"status":"approved","employerId":"emp","opportunityId":"rls-consent-other","updatedAt":"test","academicDataShared":false,"skillBenchmarksShared":false,"projectReposShared":false,"contactInfoShared":false}}') WHERE document_path='students/rls-consent-stu'; RAISE EXCEPTION 'Foreign approval'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO nexustalent.records(document_path,payload) VALUES ('auditEvents/forged','{"id":"forged"}'); RAISE EXCEPTION 'Forged audit'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{campaignConsents}', '{"rls-consent-camp":{"status":"approved","employerId":"emp","opportunityId":"rls-consent-opp","updatedAt":"test","academicDataShared":false,"skillBenchmarksShared":false,"projectReposShared":false,"contactInfoShared":false}}') WHERE document_path='students/rls-consent-stu';
SELECT set_config('nexustalent.consent_action','UPDATE_CONSENT_SCOPE',true);
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{campaignConsents,rls-consent-camp,academicDataShared}','true') WHERE document_path='students/rls-consent-stu';
SELECT set_config('nexustalent.consent_action','SUBMIT_CONSENT',true),set_config('nexustalent.opportunity_id','rls-consent-opp',true);
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=jsonb_set(payload,'{stage}','joined') WHERE document_path='opportunities/rls-consent-opp'; RAISE EXCEPTION 'Invalid stage'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,joined}','10') WHERE document_path='campaigns/rls-consent-camp'; RAISE EXCEPTION 'Unrelated funnel mutation'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{stage}','"assessment_pending"') WHERE document_path='opportunities/rls-consent-opp';
UPDATE nexustalent.records SET payload=jsonb_set(payload,'{funnel,applicationsConsented}','1') WHERE document_path='campaigns/rls-consent-camp';
DO $$ BEGIN IF (SELECT payload->>'stage' FROM nexustalent.records WHERE document_path='opportunities/rls-consent-opp') IS DISTINCT FROM 'assessment_pending' THEN RAISE EXCEPTION 'Valid application missing'; END IF; END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE nexustalent_consent_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Consent context persisted'; END IF; END $$;
ROLLBACK;

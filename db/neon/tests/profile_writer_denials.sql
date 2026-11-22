BEGIN;
INSERT INTO nexustalent.records(document_path,payload) VALUES
 ('users/profile-stu','{"uid":"profile-stu","role":"student"}'),('users/profile-admin','{"uid":"profile-admin","role":"super_admin"}'),('users/profile-other','{"uid":"profile-other","role":"simulation"}'),('students/profile-stu','{"id":"profile-stu","availability":"actively_seeking"}');
SET LOCAL ROLE nexustalent_profile_ci;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent.records) THEN RAISE EXCEPTION 'Unbound profile leaked'; END IF; END $$;
SELECT set_config('nexustalent.actor_uid','profile-stu',true),set_config('nexustalent.target_id','profile-stu',true),set_config('nexustalent.profile_action','UPDATE_STUDENT_AVAILABILITY',true),set_config('nexustalent.request_id','profile-001',true);
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=payload||'{"availability":"open_to_offers","platformVerificationStatus":"verified"}' WHERE collection='students'; RAISE EXCEPTION 'Verification escalation'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||'{"availability":"open_to_offers"}' WHERE collection='students';
SELECT set_config('nexustalent.actor_uid','profile-admin',true),set_config('nexustalent.target_id','profile-other',true),set_config('nexustalent.profile_action','PROVISION_USER_ROLE',true),set_config('nexustalent.admin_claim','false',true);
DO $$ BEGIN UPDATE nexustalent.records SET payload=payload||'{"role":"student"}' WHERE document_path='users/profile-other'; IF FOUND THEN RAISE EXCEPTION 'Unclaimed role provisioning'; END IF; END $$;
SELECT set_config('nexustalent.admin_claim','true',true);
DO $$ BEGIN
 BEGIN UPDATE nexustalent.records SET payload=payload||'{"role":"super_admin"}' WHERE document_path='users/profile-other'; RAISE EXCEPTION 'Privileged escalation'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE nexustalent.records SET payload=payload||'{"role":"student"}' WHERE document_path='users/profile-other';
DO $$ BEGIN IF (SELECT payload->>'role' FROM nexustalent.records WHERE document_path='users/profile-other') IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Ordinary role missing'; END IF; END $$;
ROLLBACK;

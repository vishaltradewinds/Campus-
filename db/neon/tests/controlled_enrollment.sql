BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' OR current_user<>'postgres' THEN RAISE EXCEPTION 'CI only'; END IF; END $$;
INSERT INTO nexustalent_identity.enrollment_grants(token_hash,uid,email,expires_at) VALUES
(repeat('a',64),'enroll-ci','enroll@example.invalid',now()+interval '1 hour'),
(repeat('b',64),'expired-ci','expired@example.invalid',now()-interval '1 hour');
SET LOCAL ROLE nexustalent_enrollment_api;
DO $$ DECLARE h text:='scrypt-v1:'||repeat('a',32)||':'||repeat('b',128); BEGIN
 IF nexustalent_identity.consume_enrollment(repeat('b',64),h) THEN RAISE EXCEPTION 'expired grant accepted'; END IF;
 IF NOT nexustalent_identity.consume_enrollment(repeat('a',64),h) THEN RAISE EXCEPTION 'enrollment failed'; END IF;
 IF nexustalent_identity.consume_enrollment(repeat('a',64),h) THEN RAISE EXCEPTION 'grant replay'; END IF;
 BEGIN PERFORM 1 FROM nexustalent_identity.enrollment_grants; RAISE EXCEPTION 'raw grant access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE nexustalent_identity.principals SET admin_authorized=true; RAISE EXCEPTION 'admin escalation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nexustalent_identity.principals WHERE uid='enroll-ci' AND NOT admin_authorized) THEN RAISE EXCEPTION 'ordinary principal missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM nexustalent_identity.credentials WHERE uid='enroll-ci') THEN RAISE EXCEPTION 'credential missing'; END IF;
END $$;
ROLLBACK;

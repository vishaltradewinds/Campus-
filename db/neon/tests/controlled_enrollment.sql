BEGIN;
DO $$ BEGIN IF current_database()<>'nexustalent_ci' OR current_user<>'postgres' THEN RAISE EXCEPTION 'CI only'; END IF; END $$;
INSERT INTO nexustalent_identity.enrollment_grants(token_hash,uid,email,expires_at) VALUES
(repeat('a',64),'enroll-ci','enroll@example.invalid',now()+interval '1 hour'),
(repeat('b',64),'expired-ci','expired@example.invalid',now()-interval '1 hour');
DO $ BEGIN
 IF nexustalent_identity.issue_enrollment(repeat('c',64),'new-ci','new@example.invalid',clock_timestamp()+interval '25 hours') THEN RAISE EXCEPTION 'excessive validity'; END IF;
 IF NOT nexustalent_identity.issue_enrollment(repeat('c',64),'new-ci','new@example.invalid',clock_timestamp()+interval '1 hour') THEN RAISE EXCEPTION 'issuance failed'; END IF;
 IF nexustalent_identity.issue_enrollment(repeat('d',64),'new-ci','other@example.invalid',clock_timestamp()+interval '1 hour') THEN RAISE EXCEPTION 'duplicate pending UID'; END IF;
 IF nexustalent_identity.issue_enrollment(repeat('d',64),'other-ci','new@example.invalid',clock_timestamp()+interval '1 hour') THEN RAISE EXCEPTION 'duplicate pending email'; END IF;
 IF NOT nexustalent_identity.cancel_enrollment(repeat('c',64)) THEN RAISE EXCEPTION 'cancel failed'; END IF;
 IF nexustalent_identity.cancel_enrollment(repeat('c',64)) THEN RAISE EXCEPTION 'repeat cancel'; END IF;
 IF NOT nexustalent_identity.issue_enrollment(repeat('d',64),'new-ci','new@example.invalid',clock_timestamp()+interval '1 hour') THEN RAISE EXCEPTION 'replacement failed'; END IF;
END $;
SET LOCAL ROLE nexustalent_enrollment_api;
DO $$ DECLARE h text:='scrypt-v1:'||repeat('a',32)||':'||repeat('b',128); BEGIN
 BEGIN PERFORM nexustalent_identity.issue_enrollment(repeat('e',64),'forged-ci','forged@example.invalid',clock_timestamp()+interval '1 hour'); RAISE EXCEPTION 'runtime issuance allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM nexustalent_identity.cancel_enrollment(repeat('d',64)); RAISE EXCEPTION 'runtime cancel allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF nexustalent_identity.consume_enrollment(repeat('c',64),h) THEN RAISE EXCEPTION 'cancelled grant accepted'; END IF;
 IF NOT nexustalent_identity.consume_enrollment(repeat('d',64),h) THEN RAISE EXCEPTION 'replacement redemption failed'; END IF;
 IF nexustalent_identity.consume_enrollment(repeat('b',64),h) THEN RAISE EXCEPTION 'expired grant accepted'; END IF;
 IF NOT nexustalent_identity.consume_enrollment(repeat('a',64),h) THEN RAISE EXCEPTION 'enrollment failed'; END IF;
 IF nexustalent_identity.consume_enrollment(repeat('a',64),h) THEN RAISE EXCEPTION 'grant replay'; END IF;
 BEGIN PERFORM 1 FROM nexustalent_identity.enrollment_grants; RAISE EXCEPTION 'raw grant access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE nexustalent_identity.principals SET admin_authorized=true; RAISE EXCEPTION 'admin escalation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $ BEGIN
 IF nexustalent_identity.cancel_enrollment(repeat('d',64)) THEN RAISE EXCEPTION 'consumed grant cancelled'; END IF;
 IF nexustalent_identity.issue_enrollment(repeat('e',64),'new-ci','new@example.invalid',clock_timestamp()+interval '1 hour') THEN RAISE EXCEPTION 'existing account reinvited'; END IF;
 IF (SELECT count(*) FROM nexustalent_identity.enrollment_grants WHERE uid='new-ci')<>2 THEN RAISE EXCEPTION 'invitation history lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM nexustalent_identity.principals WHERE uid='enroll-ci' AND NOT admin_authorized) THEN RAISE EXCEPTION 'ordinary principal missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM nexustalent_identity.credentials WHERE uid='enroll-ci') THEN RAISE EXCEPTION 'credential missing'; END IF;
END $$;
ROLLBACK;

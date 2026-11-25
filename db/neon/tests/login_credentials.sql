BEGIN;
INSERT INTO nexustalent_identity.principals(uid,email,admin_authorized) VALUES ('login-fixture','login@example.invalid',false),('admin-fixture','admin@example.invalid',true);
INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES ('login-fixture','login@example.invalid','scrypt-v1:'||repeat('a',32)||':'||repeat('b',128)),('admin-fixture','admin@example.invalid','scrypt-v1:'||repeat('a',32)||':'||repeat('b',128));
SET LOCAL ROLE nexustalent_login_api;
DO $$ DECLARE h text:='scrypt-v1:'||repeat('a',32)||':'||repeat('b',128); BEGIN
 IF NOT EXISTS(SELECT 1 FROM nexustalent_identity.login_credential('login@example.invalid')) THEN RAISE EXCEPTION 'credential unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent_identity.login_credential('admin@example.invalid')) THEN RAISE EXCEPTION 'admin login unexpectedly enabled'; END IF;
 IF nexustalent_identity.issue_session('login-fixture','wrong',repeat('a',64)) THEN RAISE EXCEPTION 'changed credential accepted'; END IF;
 IF NOT nexustalent_identity.issue_session('login-fixture',h,repeat('a',64)) THEN RAISE EXCEPTION 'issuance failed'; END IF;
 IF NOT nexustalent_identity.revoke_session(repeat('a',64)) THEN RAISE EXCEPTION 'revocation failed'; END IF;
 BEGIN PERFORM 1 FROM nexustalent_identity.credentials; RAISE EXCEPTION 'raw credential access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE nexustalent_session_reader;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM nexustalent_identity.resolve_session(repeat('a',64))) THEN RAISE EXCEPTION 'revoked token accepted'; END IF; END $$;
ROLLBACK;

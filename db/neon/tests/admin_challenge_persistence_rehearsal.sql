-- DISPOSABLE POSTGRESQL 16 rehearsal only. This file is NOT a migration.
-- No app role or production credential is provisioned. Roll back all objects.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'nexustalent_ci' OR current_user<>'postgres'
 OR inet_server_addr() IS NULL OR NOT (
  inet_server_addr() << inet '127.0.0.0/8' OR inet_server_addr() << inet '172.16.0.0/12' OR inet_server_addr()=inet '::1'
 ) THEN RAISE EXCEPTION 'Disposable local CI database required'; END IF;
END $$;
CREATE SCHEMA nexustalent_admin_rehearsal;
REVOKE ALL ON SCHEMA nexustalent_admin_rehearsal FROM PUBLIC;
CREATE TABLE nexustalent_admin_rehearsal.credentials (
 credential_id text PRIMARY KEY CHECK(length(credential_id) BETWEEN 1 AND 1366),
 uid text NOT NULL REFERENCES nexustalent_identity.principals(uid),
 public_key_pem text NOT NULL CHECK(length(public_key_pem) BETWEEN 1 AND 4096),
 revoked_at timestamptz
);
CREATE TABLE nexustalent_admin_rehearsal.challenges (
 challenge_digest text PRIMARY KEY CHECK(challenge_digest ~ '^[0-9a-f]{64}$'),
 credential_id text NOT NULL REFERENCES nexustalent_admin_rehearsal.credentials(credential_id),
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '2 minutes')
);
CREATE UNIQUE INDEX one_pending_challenge_per_credential ON nexustalent_admin_rehearsal.challenges(credential_id) WHERE consumed_at IS NULL;
REVOKE ALL ON ALL TABLES IN SCHEMA nexustalent_admin_rehearsal FROM PUBLIC;
-- Database-level single-use claim. Lock the credential first so revocation
-- and challenge consumption serialize. Return only a currently authorized
-- administrator's registered public key; this does not verify a signature.
CREATE FUNCTION nexustalent_admin_rehearsal.consume(p_digest text,p_credential text)
RETURNS TABLE(uid text,public_key_pem text,issued_at timestamptz,expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c_uid text; c_key text;
BEGIN
 IF p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 SELECT c.uid,c.public_key_pem INTO c_uid,c_key
 FROM nexustalent_admin_rehearsal.credentials c JOIN nexustalent_identity.principals p ON p.uid=c.uid
 WHERE c.credential_id=p_credential AND c.revoked_at IS NULL AND p.admin_authorized AND NOT p.disabled
 FOR UPDATE OF c,p;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY
 UPDATE nexustalent_admin_rehearsal.challenges ch SET consumed_at=clock_timestamp()
 WHERE ch.challenge_digest=p_digest AND ch.credential_id=p_credential
 AND ch.consumed_at IS NULL AND ch.issued_at<=clock_timestamp() AND ch.expires_at>clock_timestamp()
 RETURNING c_uid,c_key,ch.issued_at,ch.expires_at;
END $$;
REVOKE ALL ON FUNCTION nexustalent_admin_rehearsal.consume(text,text) FROM PUBLIC;
INSERT INTO nexustalent_identity.principals(uid,email,admin_authorized) VALUES
 ('admin-rehearsal-ci','admin-rehearsal@example.invalid',true),
 ('ordinary-rehearsal-ci','ordinary-rehearsal@example.invalid',false);
INSERT INTO nexustalent_admin_rehearsal.credentials VALUES
 ('credential-a','admin-rehearsal-ci','synthetic public key fixture',NULL),
 ('credential-b','ordinary-rehearsal-ci','synthetic public key fixture',NULL);
INSERT INTO nexustalent_admin_rehearsal.challenges(challenge_digest,credential_id,expires_at)
 VALUES(repeat('a',64),'credential-a',clock_timestamp()+interval '1 minute'),
 (repeat('b',64),'credential-b',clock_timestamp()+interval '1 minute');
SET LOCAL ROLE nexustalent_session_reader;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM nexustalent_admin_rehearsal.credentials;
 RAISE EXCEPTION 'Ordinary session identity can read admin credentials'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM nexustalent_admin_rehearsal.consume(repeat('a',64),'credential-a');
 RAISE EXCEPTION 'Ordinary identity can consume admin challenge'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent_admin_rehearsal.consume(repeat('a',64),'credential-b')) THEN RAISE EXCEPTION 'Wrong credential accepted'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent_admin_rehearsal.consume(repeat('b',64),'credential-b')) THEN RAISE EXCEPTION 'Ordinary principal accepted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM nexustalent_admin_rehearsal.consume(repeat('a',64),'credential-a') WHERE uid='admin-rehearsal-ci') THEN RAISE EXCEPTION 'Valid challenge denied'; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent_admin_rehearsal.consume(repeat('a',64),'credential-a')) THEN RAISE EXCEPTION 'Replay accepted'; END IF;
END $$;
INSERT INTO nexustalent_admin_rehearsal.challenges(challenge_digest,credential_id,issued_at,expires_at)
 VALUES(repeat('c',64),'credential-a',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent_admin_rehearsal.consume(repeat('c',64),'credential-a')) THEN RAISE EXCEPTION 'Expired challenge accepted'; END IF;
END $$;
UPDATE nexustalent_admin_rehearsal.challenges SET consumed_at=clock_timestamp() WHERE challenge_digest=repeat('c',64);
INSERT INTO nexustalent_admin_rehearsal.challenges(challenge_digest,credential_id,expires_at)
 VALUES(repeat('d',64),'credential-a',clock_timestamp()+interval '1 minute');
UPDATE nexustalent_admin_rehearsal.credentials SET revoked_at=clock_timestamp() WHERE credential_id='credential-a';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM nexustalent_admin_rehearsal.consume(repeat('d',64),'credential-a')) THEN RAISE EXCEPTION 'Revoked credential accepted'; END IF;
END $$;
ROLLBACK;

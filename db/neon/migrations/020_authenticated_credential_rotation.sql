-- Test-only candidate 020. No live schema change or recovery activation.
-- Authenticated ordinary-account password change; never a forgotten-password
-- recovery mechanism, administrator login, or password reset by email.
GRANT UPDATE(password_hash) ON nexustalent_identity.credentials TO nexustalent_login_resolver;

-- Session issuance must serialize on the same credential row as password
-- rotation. A stale password checked before a concurrent change must not
-- create a new session after that change revoked the previous sessions.
CREATE OR REPLACE FUNCTION nexustalent_identity.issue_session(p_uid text,p_expected text,p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE active_uid text;
BEGIN
 SELECT c.uid INTO active_uid
 FROM nexustalent_identity.credentials c
 JOIN nexustalent_identity.principals p ON p.uid=c.uid
 WHERE c.uid=p_uid AND c.password_hash=p_expected AND NOT p.disabled AND NOT p.admin_authorized
 FOR UPDATE OF c;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO nexustalent_identity.sessions(token_hash,uid,expires_at)
 SELECT p_hash,p.uid,clock_timestamp()+interval '8 hours'
 FROM nexustalent_identity.principals p
 WHERE p.uid=active_uid AND NOT p.disabled AND NOT p.admin_authorized;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION nexustalent_identity.issue_session(text,text,text) FROM PUBLIC;


CREATE FUNCTION nexustalent_identity.credential_for_session(p_digest text)
RETURNS TABLE(uid text,password_hash text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.uid,c.password_hash
 FROM nexustalent_identity.sessions s
 JOIN nexustalent_identity.principals p ON p.uid=s.uid
 JOIN nexustalent_identity.credentials c ON c.uid=p.uid
 WHERE p_digest ~ '^[0-9a-f]{64}$' AND s.token_hash=p_digest
   AND s.revoked_at IS NULL AND s.expires_at>statement_timestamp()
   AND s.created_at<=statement_timestamp() AND NOT p.disabled
   AND NOT p.admin_authorized
$$;

CREATE FUNCTION nexustalent_identity.change_credential(
 p_digest text,p_expected_hash text,p_new_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  active_uid text;
BEGIN
 IF p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$'
    OR p_expected_hash IS NULL OR p_expected_hash !~ '^scrypt-v1:[0-9a-f]{32}:[0-9a-f]{128}$'
    OR p_new_hash IS NULL OR p_new_hash !~ '^scrypt-v1:[0-9a-f]{32}:[0-9a-f]{128}$'
    OR p_expected_hash=p_new_hash THEN
   RETURN false;
 END IF;
 -- All competing password changes acquire the SAME credential row first.
 -- Locking individual sessions before the shared credential would deadlock
 -- when two active sessions changed the password at the same time.
 SELECT c.uid INTO active_uid
 FROM nexustalent_identity.credentials c
 JOIN nexustalent_identity.principals p ON p.uid=c.uid
 WHERE c.uid=(SELECT s.uid FROM nexustalent_identity.sessions s WHERE s.token_hash=p_digest)
   AND c.password_hash=p_expected_hash AND NOT p.disabled AND NOT p.admin_authorized
 FOR UPDATE OF c;
 IF NOT FOUND THEN RETURN false; END IF;
 -- Recheck the token only after the shared credential lock: prior concurrent
 -- password rotation or logout may have revoked it while we waited.
 PERFORM 1 FROM nexustalent_identity.sessions s
 WHERE s.token_hash=p_digest AND s.uid=active_uid AND s.revoked_at IS NULL
   AND s.expires_at>clock_timestamp() AND s.created_at<=clock_timestamp()
 FOR UPDATE OF s;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE nexustalent_identity.credentials
 SET password_hash=p_new_hash
 WHERE uid=active_uid AND password_hash=p_expected_hash;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE nexustalent_identity.sessions
 SET revoked_at=clock_timestamp()
 WHERE uid=active_uid AND revoked_at IS NULL;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION nexustalent_identity.credential_for_session(text),
  nexustalent_identity.change_credential(text,text,text) FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent_identity TO nexustalent_login_resolver;
ALTER FUNCTION nexustalent_identity.credential_for_session(text) OWNER TO nexustalent_login_resolver;
ALTER FUNCTION nexustalent_identity.change_credential(text,text,text) OWNER TO nexustalent_login_resolver;
REVOKE CREATE ON SCHEMA nexustalent_identity FROM nexustalent_login_resolver;
GRANT EXECUTE ON FUNCTION nexustalent_identity.credential_for_session(text),
  nexustalent_identity.change_credential(text,text,text) TO nexustalent_login_api;

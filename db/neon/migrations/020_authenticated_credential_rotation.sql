-- Test-only candidate 020. No live schema change or recovery activation.
-- Authenticated ordinary-account password change; never a forgotten-password
-- recovery mechanism, administrator login, or password reset by email.
GRANT UPDATE(password_hash) ON nexustalent_identity.credentials TO nexustalent_login_resolver;

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
 -- Hold both session and credential locks until all sessions are revoked.
 -- The active session and stored expected hash are independently checked.
 SELECT c.uid INTO active_uid
 FROM nexustalent_identity.sessions s
 JOIN nexustalent_identity.principals p ON p.uid=s.uid
 JOIN nexustalent_identity.credentials c ON c.uid=p.uid
 WHERE s.token_hash=p_digest AND s.revoked_at IS NULL
   AND s.expires_at>clock_timestamp() AND s.created_at<=clock_timestamp()
   AND c.password_hash=p_expected_hash AND NOT p.disabled
   AND NOT p.admin_authorized
 FOR UPDATE OF s,c;
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

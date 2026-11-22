-- CI-only credential lifecycle candidate. No public registration or live activation.
CREATE ROLE nexustalent_login_api NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE nexustalent_login_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_login_resolver TO CURRENT_USER;
CREATE TABLE nexustalent_identity.credentials (
 uid text PRIMARY KEY REFERENCES nexustalent_identity.principals(uid) ON DELETE CASCADE,
 login_name text NOT NULL UNIQUE CHECK (length(login_name) BETWEEN 3 AND 320 AND login_name=lower(login_name)),
 password_hash text NOT NULL CHECK (password_hash ~ '^scrypt-v1:[0-9a-f]{32}:[0-9a-f]{128}$')
);
REVOKE ALL ON nexustalent_identity.credentials FROM PUBLIC;
GRANT USAGE ON SCHEMA nexustalent_identity TO nexustalent_login_api,nexustalent_login_resolver;
GRANT SELECT ON nexustalent_identity.credentials,nexustalent_identity.principals TO nexustalent_login_resolver;
GRANT SELECT,INSERT ON nexustalent_identity.sessions TO nexustalent_login_resolver;
GRANT UPDATE(revoked_at) ON nexustalent_identity.sessions TO nexustalent_login_resolver;
CREATE FUNCTION nexustalent_identity.login_credential(p_login text)
RETURNS TABLE(uid text,password_hash text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.uid,c.password_hash FROM nexustalent_identity.credentials c
 JOIN nexustalent_identity.principals p ON p.uid=c.uid
 WHERE c.login_name=p_login AND NOT p.disabled AND NOT p.admin_authorized
$$;
CREATE FUNCTION nexustalent_identity.issue_session(p_uid text,p_expected text,p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO nexustalent_identity.sessions(token_hash,uid,expires_at)
 SELECT p_hash,c.uid,clock_timestamp()+interval '8 hours'
 FROM nexustalent_identity.credentials c JOIN nexustalent_identity.principals p ON p.uid=c.uid
 WHERE c.uid=p_uid AND c.password_hash=p_expected AND NOT p.disabled AND NOT p.admin_authorized;
 RETURN FOUND;
END $$;
CREATE FUNCTION nexustalent_identity.revoke_session(p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE nexustalent_identity.sessions SET revoked_at=clock_timestamp() WHERE token_hash=p_hash AND revoked_at IS NULL;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION nexustalent_identity.login_credential(text),nexustalent_identity.issue_session(text,text,text),nexustalent_identity.revoke_session(text) FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent_identity TO nexustalent_login_resolver;
ALTER FUNCTION nexustalent_identity.login_credential(text) OWNER TO nexustalent_login_resolver;
ALTER FUNCTION nexustalent_identity.issue_session(text,text,text) OWNER TO nexustalent_login_resolver;
ALTER FUNCTION nexustalent_identity.revoke_session(text) OWNER TO nexustalent_login_resolver;
REVOKE CREATE ON SCHEMA nexustalent_identity FROM nexustalent_login_resolver;
GRANT EXECUTE ON FUNCTION nexustalent_identity.login_credential(text),nexustalent_identity.issue_session(text,text,text),nexustalent_identity.revoke_session(text) TO nexustalent_login_api;

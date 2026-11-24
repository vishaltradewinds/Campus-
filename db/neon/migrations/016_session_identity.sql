-- CI candidate only. No live account provisioning or credential migration.
CREATE ROLE nexustalent_session_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE nexustalent_session_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_session_resolver TO CURRENT_USER;
CREATE SCHEMA nexustalent_identity;
REVOKE ALL ON SCHEMA nexustalent_identity FROM PUBLIC;
CREATE TABLE nexustalent_identity.principals (
 uid text PRIMARY KEY CHECK (length(uid) BETWEEN 1 AND 200 AND uid NOT LIKE '%/%'),
 email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
 disabled boolean NOT NULL DEFAULT false,
 admin_authorized boolean NOT NULL DEFAULT false
);
CREATE TABLE nexustalent_identity.sessions (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 uid text NOT NULL REFERENCES nexustalent_identity.principals(uid) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at > created_at AND expires_at <= created_at + interval '24 hours')
);
CREATE INDEX sessions_uid ON nexustalent_identity.sessions(uid);
REVOKE ALL ON ALL TABLES IN SCHEMA nexustalent_identity FROM PUBLIC;
GRANT USAGE ON SCHEMA nexustalent_identity TO nexustalent_session_reader,nexustalent_session_resolver;
GRANT SELECT ON nexustalent_identity.principals,nexustalent_identity.sessions TO nexustalent_session_resolver;
CREATE FUNCTION nexustalent_identity.resolve_session(p_hash text)
RETURNS TABLE(uid text,email text,admin_claim boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.uid,p.email,false
 FROM nexustalent_identity.sessions s JOIN nexustalent_identity.principals p ON p.uid=s.uid
 WHERE p_hash ~ '^[0-9a-f]{64}$' AND s.token_hash=p_hash AND s.revoked_at IS NULL
 AND s.expires_at>statement_timestamp() AND s.created_at<=statement_timestamp() AND NOT p.disabled AND NOT p.admin_authorized
$$;
REVOKE ALL ON FUNCTION nexustalent_identity.resolve_session(text) FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent_identity TO nexustalent_session_resolver;
ALTER FUNCTION nexustalent_identity.resolve_session(text) OWNER TO nexustalent_session_resolver;
REVOKE CREATE ON SCHEMA nexustalent_identity FROM nexustalent_session_resolver;
GRANT EXECUTE ON FUNCTION nexustalent_identity.resolve_session(text) TO nexustalent_session_reader;


-- Ordinary sessions must never inherit a subsequently changed admin claim.
-- Privileged principal changes invalidate prior sessions; reenabling or
-- demoting an account cannot revive a previously issued bearer token.
CREATE FUNCTION nexustalent_identity.invalidate_sessions_on_principal_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE nexustalent_identity.sessions SET revoked_at=clock_timestamp()
 WHERE uid=NEW.uid AND revoked_at IS NULL;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION nexustalent_identity.invalidate_sessions_on_principal_change() FROM PUBLIC;
CREATE TRIGGER invalidate_sessions_on_principal_change
 AFTER UPDATE OF disabled,admin_authorized ON nexustalent_identity.principals
 FOR EACH ROW WHEN (OLD.disabled IS DISTINCT FROM NEW.disabled OR OLD.admin_authorized IS DISTINCT FROM NEW.admin_authorized)
 EXECUTE FUNCTION nexustalent_identity.invalidate_sessions_on_principal_change();

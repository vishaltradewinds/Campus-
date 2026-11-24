-- Controlled enrollment; no public registration and no administrator creation.
CREATE ROLE nexustalent_enrollment_api NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE nexustalent_enrollment_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_enrollment_resolver TO CURRENT_USER;
CREATE TABLE nexustalent_identity.enrollment_grants (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 uid text NOT NULL CHECK(length(uid) BETWEEN 1 AND 200 AND uid NOT LIKE '%/%'),
 email text NOT NULL CHECK(length(email) BETWEEN 3 AND 320 AND email=lower(email)),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,
 CHECK(consumed_at IS NULL OR revoked_at IS NULL)
);
-- At most one unresolved invitation per UID or email. Expired invitations
-- must be explicitly cancelled before replacement; historical digests remain.
CREATE UNIQUE INDEX enrollment_pending_uid ON nexustalent_identity.enrollment_grants(uid) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX enrollment_pending_email ON nexustalent_identity.enrollment_grants(email) WHERE consumed_at IS NULL AND revoked_at IS NULL;
REVOKE ALL ON nexustalent_identity.enrollment_grants FROM PUBLIC;
GRANT USAGE ON SCHEMA nexustalent_identity TO nexustalent_enrollment_api,nexustalent_enrollment_resolver;
GRANT SELECT,UPDATE(consumed_at) ON nexustalent_identity.enrollment_grants TO nexustalent_enrollment_resolver;
GRANT INSERT,SELECT ON nexustalent_identity.principals,nexustalent_identity.credentials TO nexustalent_enrollment_resolver;
CREATE FUNCTION nexustalent_identity.consume_enrollment(p_token text,p_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE g nexustalent_identity.enrollment_grants%ROWTYPE;
BEGIN
 IF p_password IS NULL OR p_password !~ '^scrypt-v1:[0-9a-f]{32}:[0-9a-f]{128}$' THEN RETURN false; END IF;
 SELECT * INTO g FROM nexustalent_identity.enrollment_grants WHERE token_hash=p_token AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO nexustalent_identity.principals(uid,email,admin_authorized) VALUES(g.uid,g.email,false);
 INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES(g.uid,g.email,p_password);
 UPDATE nexustalent_identity.enrollment_grants SET consumed_at=clock_timestamp() WHERE token_hash=p_token;
 RETURN true;
EXCEPTION WHEN unique_violation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION nexustalent_identity.consume_enrollment(text,text) FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent_identity TO nexustalent_enrollment_resolver;
ALTER FUNCTION nexustalent_identity.consume_enrollment(text,text) OWNER TO nexustalent_enrollment_resolver;
REVOKE CREATE ON SCHEMA nexustalent_identity FROM nexustalent_enrollment_resolver;
GRANT EXECUTE ON FUNCTION nexustalent_identity.consume_enrollment(text,text) TO nexustalent_enrollment_api;

-- Owner-operated offline invitation lifecycle. SECURITY INVOKER, no runtime
-- grants, no HTTP endpoint, no administrator provisioning. Token generation
-- and private delivery must occur outside PostgreSQL; only a digest is stored.
CREATE FUNCTION nexustalent_identity.issue_enrollment(p_digest text,p_uid text,p_email text,p_expires timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$'
    OR p_uid IS NULL OR length(p_uid) NOT BETWEEN 1 AND 200 OR p_uid<>btrim(p_uid) OR p_uid LIKE '%/%'
    OR p_email IS NULL OR length(p_email) NOT BETWEEN 3 AND 320 OR p_email<>lower(btrim(p_email))
    OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
    OR p_expires IS NULL OR p_expires<=clock_timestamp() OR p_expires>clock_timestamp()+interval '24 hours'
 THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM nexustalent_identity.principals WHERE uid=p_uid OR lower(email)=p_email)
    OR EXISTS(SELECT 1 FROM nexustalent_identity.credentials WHERE uid=p_uid OR login_name=p_email)
 THEN RETURN false; END IF;
 INSERT INTO nexustalent_identity.enrollment_grants(token_hash,uid,email,expires_at)
 VALUES(p_digest,p_uid,p_email,p_expires) ON CONFLICT DO NOTHING;
 RETURN FOUND;
END $$;
CREATE FUNCTION nexustalent_identity.cancel_enrollment(p_digest text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE nexustalent_identity.enrollment_grants SET revoked_at=clock_timestamp()
 WHERE token_hash=p_digest AND consumed_at IS NULL AND revoked_at IS NULL;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION nexustalent_identity.issue_enrollment(text,text,text,timestamptz),
 nexustalent_identity.cancel_enrollment(text) FROM PUBLIC;

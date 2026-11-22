-- Review candidate only. Run with migration owner, never the application role.
-- Separate reader from mutation role; no write privilege or bypass.
CREATE ROLE nexustalent_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE nexustalent_scope_resolver NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT nexustalent_scope_resolver TO CURRENT_USER;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_reader, nexustalent_scope_resolver;
GRANT SELECT ON nexustalent.records TO nexustalent_reader, nexustalent_scope_resolver;
-- The resolver can see exactly one principal record, with no recursive policy.
CREATE POLICY resolve_own_account ON nexustalent.records FOR SELECT TO nexustalent_scope_resolver
 USING (collection='users' AND document_path='users/'||NULLIF(current_setting('nexustalent.actor_uid',true),'') AND payload->>'uid'=NULLIF(current_setting('nexustalent.actor_uid',true),''));
CREATE FUNCTION nexustalent.actor_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT payload->>'role' FROM nexustalent.records
 WHERE document_path='users/'||NULLIF(current_setting('nexustalent.actor_uid',true),'')
   AND payload->>'uid'=NULLIF(current_setting('nexustalent.actor_uid',true),'')
$$;
REVOKE ALL ON FUNCTION nexustalent.actor_role() FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_scope_resolver;
ALTER FUNCTION nexustalent.actor_role() OWNER TO nexustalent_scope_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_scope_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role() TO nexustalent_reader;
-- Actor UID and verified admin claim are supplied by the trusted API only.
-- The login is server-only; arbitrary SQL access to this login is NOT safe.
CREATE POLICY workspace_scoped_read ON nexustalent.records FOR SELECT TO nexustalent_reader
 USING (
  document_path NOT LIKE '%/%/%'
  AND NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL
  AND (
   (collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true))
   OR ((SELECT nexustalent.actor_role())='super_admin' AND current_setting('nexustalent.admin_claim',true)='true'
     AND (collection IN ('users','employers','institutions','requirements','campaigns','calls','opportunities')
       OR (collection='careerEvidence' AND payload->>'status' IN ('submitted','under_review'))))
   OR ((SELECT nexustalent.actor_role()) IN ('employer','institution')
     AND ((collection='employers' AND payload->>'verificationStatus'='verified')
       OR (collection='institutions' AND payload->>'empanelmentStatus'='empanelled')))
   OR ((SELECT nexustalent.actor_role())='employer'
     AND ((collection='employers' AND document_path='employers/'||current_setting('nexustalent.actor_uid',true))
       OR (collection IN ('requirements','campaigns','calls','opportunities') AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true))))
   OR ((SELECT nexustalent.actor_role())='institution'
     AND ((collection='institutions' AND document_path='institutions/'||current_setting('nexustalent.actor_uid',true))
       OR (collection IN ('students','calls','opportunities') AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true))
       OR (collection='campaigns' AND jsonb_typeof(payload->'targetedInstitutionIds')='array' AND (payload->'targetedInstitutionIds') ? current_setting('nexustalent.actor_uid',true))))
   OR ((SELECT nexustalent.actor_role())='student'
     AND ((collection='students' AND document_path='students/'||current_setting('nexustalent.actor_uid',true))
       OR (collection IN ('opportunities','careerEvidence') AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true))))
  )
 );
-- No writer policy or production login; existing mutation role stays unchanged.
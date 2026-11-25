-- Candidate only: no cloud activation or login provisioning.
CREATE ROLE nexustalent_registrar NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_registrar;
GRANT SELECT, INSERT ON nexustalent.records TO nexustalent_registrar;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role() TO nexustalent_registrar;
CREATE POLICY registration_read ON nexustalent.records FOR SELECT TO nexustalent_registrar
 USING (
  NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL
  AND document_path NOT LIKE '%/%/%'
  AND (
   (collection IN ('users','students','employers','institutions') AND split_part(document_path,'/',2)=current_setting('nexustalent.actor_uid',true))
   OR (collection='institutions' AND payload->>'empanelmentStatus'='empanelled')
   OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to('REGISTER_STAKEHOLDER:'||current_setting('nexustalent.actor_uid',true),'UTF8')),'hex')
       AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'action'='REGISTER_STAKEHOLDER')
  )
 );
CREATE POLICY registration_insert ON nexustalent.records FOR INSERT TO nexustalent_registrar
 WITH CHECK (
  NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL
  AND current_setting('nexustalent.registration_role',true) IN ('student','institution','employer')
  AND NULLIF(current_setting('nexustalent.registration_email',true),'') IS NOT NULL
  AND document_path NOT LIKE '%/%/%'
  AND (
   (collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true)
    AND payload->>'uid'=current_setting('nexustalent.actor_uid',true)
    AND payload->>'role'=current_setting('nexustalent.registration_role',true)
    AND payload->>'email'=current_setting('nexustalent.registration_email',true)
    AND payload - ARRAY['uid','role','email','name','createdAt','updatedAt'] = '{}'::jsonb)
   OR (
    (SELECT nexustalent.actor_role())=current_setting('nexustalent.registration_role',true)
    AND split_part(document_path,'/',2)=current_setting('nexustalent.actor_uid',true)
    AND payload->>'id'=current_setting('nexustalent.actor_uid',true)
    AND (
      (collection='employers' AND current_setting('nexustalent.registration_role',true)='employer'
       AND payload->>'verificationStatus'='pending' AND payload->'verified'='false'::jsonb
       AND payload->>'contactEmail'=current_setting('nexustalent.registration_email',true))
      OR (collection='institutions' AND current_setting('nexustalent.registration_role',true)='institution'
       AND payload->>'empanelmentStatus'='pending_empanelment'
       AND payload->>'placementOfficerEmail'=current_setting('nexustalent.registration_email',true))
      OR (collection='students' AND current_setting('nexustalent.registration_role',true)='student'
       AND payload->>'platformVerificationStatus'='pending'
       AND payload->>'institutionVerificationStatus' IN ('pending','not_applicable')
       AND payload->>'email'=current_setting('nexustalent.registration_email',true)
       AND NOT (payload ? 'campaignConsents' OR payload ? 'evidenceIds'))
    )
   )
   OR (collection='auditEvents'
       AND (SELECT nexustalent.actor_role())=current_setting('nexustalent.registration_role',true)
       AND document_path='auditEvents/'||encode(sha256(convert_to('REGISTER_STAKEHOLDER:'||current_setting('nexustalent.actor_uid',true),'UTF8')),'hex')
       AND payload->>'eventId'=split_part(document_path,'/',2)
       AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true)
       AND payload->>'actorRole'=current_setting('nexustalent.registration_role',true)
       AND payload->>'action'='REGISTER_STAKEHOLDER' AND payload->'immutable'='true'::jsonb
       AND payload->'ids'=jsonb_build_array(current_setting('nexustalent.actor_uid',true)))
  )
 );
-- No update/delete policy or grant. This role cannot write recruitment or billing data.
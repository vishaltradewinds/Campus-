-- SECURITY: DISPOSABLE POSTGRESQL 16 CI FIXTURE ONLY.
-- Test-only production-shaped roles. No passwords, no Neon operations.
-- Refuse all other databases, accounts and network addresses BEFORE DDL.
DO $$
DECLARE
  pair text[];
  mappings text[][] := ARRAY[
  ARRAY['nexustalent_app_reader','nexustalent_reader'],
  ARRAY['nexustalent_app_registrar','nexustalent_registrar'],
  ARRAY['nexustalent_app_demand','nexustalent_demand_writer'],
  ARRAY['nexustalent_app_institution','nexustalent_institution_writer'],
  ARRAY['nexustalent_app_consent','nexustalent_consent_writer'],
  ARRAY['nexustalent_app_assessment','nexustalent_assessment_writer'],
  ARRAY['nexustalent_app_offer','nexustalent_offer_writer'],
  ARRAY['nexustalent_app_joining','nexustalent_joining_writer'],
  ARRAY['nexustalent_app_verification','nexustalent_verification_writer'],
  ARRAY['nexustalent_app_academic','nexustalent_academic_writer'],
  ARRAY['nexustalent_app_evidence','nexustalent_evidence_writer'],
  ARRAY['nexustalent_app_disclosure','nexustalent_disclosure_writer'],
  ARRAY['nexustalent_app_profile','nexustalent_profile_writer'],
  ARRAY['nexustalent_app_directory','nexustalent_directory_reader'],
  ARRAY['nexustalent_app_login','nexustalent_login_api'],
  ARRAY['nexustalent_app_session','nexustalent_session_reader'],
  ARRAY['nexustalent_app_enrollment','nexustalent_enrollment_api']
  ];
BEGIN
  IF current_database() <> 'nexustalent_ci'
     OR current_user <> 'postgres'
     OR inet_server_addr() IS NULL
     OR NOT (
       inet_server_addr() << inet '127.0.0.0/8'
       OR inet_server_addr() << inet '172.16.0.0/12'
       OR inet_server_addr() = inet '::1'
     ) THEN
    RAISE EXCEPTION 'Disposable local/Docker CI database required';
  END IF;
  FOREACH pair SLICE 1 IN ARRAY mappings LOOP
    EXECUTE format(
      'CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD NULL',
      pair[1]
    );
    EXECUTE format('GRANT %I TO %I WITH INHERIT TRUE',pair[2],pair[1]);
  END LOOP;
END;
$$;

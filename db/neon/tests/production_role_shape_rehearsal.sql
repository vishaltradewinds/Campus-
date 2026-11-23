-- DISPOSABLE PostgreSQL16 ROLE REHEARSAL ONLY; never apply to Neon.
-- Refuses any database/user other than the isolated CI fixture.
-- NO PASSWORDS ARE SET. These SQL roles cannot be used for remote login.
DO $$
DECLARE mapping text[][] := ARRAY[
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
]; entry text[];
BEGIN
 IF current_database()<>'nexustalent_ci' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'Disposable PostgreSQL fixture only';
 END IF;
 FOREACH entry SLICE 1 IN ARRAY mapping LOOP
  EXECUTE format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION',entry[1]);
  EXECUTE format('GRANT %I TO %I WITH INHERIT TRUE',entry[2],entry[1]);
 END LOOP;
END
$$;

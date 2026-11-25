-- Joining-only role. A success fee is an internal earned record, never a payment.
CREATE ROLE nexustalent_joining_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA nexustalent TO nexustalent_joining_writer;
GRANT SELECT, INSERT, UPDATE ON nexustalent.records TO nexustalent_joining_writer;
GRANT EXECUTE ON FUNCTION nexustalent.actor_role() TO nexustalent_joining_writer;
CREATE POLICY resolve_joining_opportunity ON nexustalent.records FOR SELECT TO nexustalent_scope_resolver USING (
 collection='opportunities' AND document_path='opportunities/'||NULLIF(current_setting('nexustalent.opportunity_id',true),'') AND
 (payload->>'employerId'=NULLIF(current_setting('nexustalent.actor_uid',true),'') OR payload->>'institutionId'=NULLIF(current_setting('nexustalent.actor_uid',true),'')));
CREATE FUNCTION nexustalent.bound_joining_opportunity() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT payload FROM nexustalent.records WHERE document_path='opportunities/'||NULLIF(current_setting('nexustalent.opportunity_id',true),'') AND payload->>'id'=current_setting('nexustalent.opportunity_id',true)
 AND current_setting('nexustalent.joining_action',true)='joined' AND (((SELECT nexustalent.actor_role())='employer' AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.actor_role())='institution' AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true)))
$$;
REVOKE ALL ON FUNCTION nexustalent.bound_joining_opportunity() FROM PUBLIC;
GRANT CREATE ON SCHEMA nexustalent TO nexustalent_scope_resolver;
ALTER FUNCTION nexustalent.bound_joining_opportunity() OWNER TO nexustalent_scope_resolver;
REVOKE CREATE ON SCHEMA nexustalent FROM nexustalent_scope_resolver;
GRANT EXECUTE ON FUNCTION nexustalent.bound_joining_opportunity() TO nexustalent_joining_writer;
CREATE POLICY joining_read ON nexustalent.records FOR SELECT TO nexustalent_joining_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.joining_action',true)='joined' AND document_path NOT LIKE '%/%/%' AND ((collection='users' AND document_path='users/'||current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.actor_role()) IN ('employer','institution') AND (SELECT nexustalent.bound_joining_opportunity()) IS NOT NULL AND (
 (collection='opportunities' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true) AND (((SELECT nexustalent.actor_role())='employer' AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.actor_role())='institution' AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true)))) OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.bound_joining_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.bound_joining_opportunity())->>'employerId')) OR (collection='offers' AND document_path='offers/'||((SELECT nexustalent.bound_joining_opportunity())->>'offerRecordId') AND payload->>'id'=((SELECT nexustalent.bound_joining_opportunity())->>'offerRecordId') AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=((SELECT nexustalent.bound_joining_opportunity())->>'studentId') AND payload->>'employerId'=((SELECT nexustalent.bound_joining_opportunity())->>'employerId') AND payload->>'campaignId'=((SELECT nexustalent.bound_joining_opportunity())->>'campaignId') AND payload->>'institutionId'=((SELECT nexustalent.bound_joining_opportunity())->>'institutionId')) OR (collection='students' AND document_path='students/'||((SELECT nexustalent.bound_joining_opportunity())->>'studentId') AND payload->>'id'=((SELECT nexustalent.bound_joining_opportunity())->>'studentId')) OR
 (collection='successFees' AND document_path='successFees/'||encode(sha256(convert_to('success-fee:'||current_setting('nexustalent.opportunity_id',true),'UTF8')),'hex') AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'employerId'=((SELECT nexustalent.bound_joining_opportunity())->>'employerId'))
 OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':ADVANCE_CANDIDATE_STAGE','UTF8')),'hex') AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'action'='ADVANCE_CANDIDATE_STAGE')))));
-- Invoker function cannot widen SELECT; policy above does not call it.
CREATE FUNCTION nexustalent.bound_joining_offer() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE o jsonb;
BEGIN
 o:=nexustalent.bound_joining_opportunity();
 IF o IS NULL THEN RETURN NULL; END IF;
 RETURN (SELECT payload FROM nexustalent.records WHERE document_path='offers/'||(o->>'offerRecordId') AND payload->>'id'=o->>'offerRecordId' AND payload->>'opportunityId'=o->>'id');
END
$$;
REVOKE ALL ON FUNCTION nexustalent.bound_joining_offer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nexustalent.bound_joining_offer() TO nexustalent_joining_writer;
CREATE POLICY joining_update ON nexustalent.records FOR UPDATE TO nexustalent_joining_writer USING (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.joining_action',true)='joined' AND document_path NOT LIKE '%/%/%' AND (SELECT nexustalent.actor_role()) IN ('employer','institution') AND (SELECT nexustalent.bound_joining_opportunity()) IS NOT NULL AND payload->>'id'=split_part(document_path,'/',2) AND ((collection='opportunities' AND document_path='opportunities/'||current_setting('nexustalent.opportunity_id',true) AND (((SELECT nexustalent.actor_role())='employer' AND payload->>'employerId'=current_setting('nexustalent.actor_uid',true)) OR ((SELECT nexustalent.actor_role())='institution' AND payload->>'institutionId'=current_setting('nexustalent.actor_uid',true)))) OR (collection='campaigns' AND document_path='campaigns/'||((SELECT nexustalent.bound_joining_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.bound_joining_opportunity())->>'employerId')) OR (collection='offers' AND document_path='offers/'||((SELECT nexustalent.bound_joining_opportunity())->>'offerRecordId') AND payload->>'id'=((SELECT nexustalent.bound_joining_opportunity())->>'offerRecordId') AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'studentId'=((SELECT nexustalent.bound_joining_opportunity())->>'studentId') AND payload->>'employerId'=((SELECT nexustalent.bound_joining_opportunity())->>'employerId') AND payload->>'campaignId'=((SELECT nexustalent.bound_joining_opportunity())->>'campaignId') AND payload->>'institutionId'=((SELECT nexustalent.bound_joining_opportunity())->>'institutionId')) OR (collection='students' AND document_path='students/'||((SELECT nexustalent.bound_joining_opportunity())->>'studentId') AND payload->>'id'=((SELECT nexustalent.bound_joining_opportunity())->>'studentId'))));
CREATE POLICY joining_insert ON nexustalent.records FOR INSERT TO nexustalent_joining_writer WITH CHECK (
 NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.opportunity_id',true),'') IS NOT NULL AND NULLIF(current_setting('nexustalent.request_id',true),'') IS NOT NULL AND current_setting('nexustalent.joining_action',true)='joined' AND document_path NOT LIKE '%/%/%' AND (SELECT nexustalent.actor_role()) IN ('employer','institution') AND (SELECT nexustalent.bound_joining_opportunity()) IS NOT NULL AND (
 (collection='successFees' AND document_path='successFees/'||encode(sha256(convert_to('success-fee:'||current_setting('nexustalent.opportunity_id',true),'UTF8')),'hex') AND payload->>'id'=encode(sha256(convert_to('success-fee:'||current_setting('nexustalent.opportunity_id',true),'UTF8')),'hex')
 AND payload->>'opportunityId'=current_setting('nexustalent.opportunity_id',true) AND payload->>'campaignId'=((SELECT nexustalent.bound_joining_opportunity())->>'campaignId') AND payload->>'employerId'=((SELECT nexustalent.bound_joining_opportunity())->>'employerId') AND payload->>'studentId'=((SELECT nexustalent.bound_joining_opportunity())->>'studentId')
 AND ((SELECT nexustalent.bound_joining_opportunity())->>'stage')='joined' AND (nexustalent.bound_joining_offer()->>'status')='joined' AND (nexustalent.bound_joining_offer()->>'currency')='INR'
 AND payload->>'currency'='INR' AND payload->>'status'='earned' AND payload->'feeRateBps'='500'::jsonb
 AND jsonb_typeof(payload->'compensationMinor')='number' AND jsonb_typeof(payload->'feeAmountMinor')='number'
 AND (payload->>'compensationMinor')::numeric=round((nexustalent.bound_joining_offer()->>'salaryLPA')::numeric*10000000)
 AND (payload->>'compensationMinor')::numeric BETWEEN 0 AND 9007199254740991
 AND (payload->>'feeAmountMinor')::numeric=trunc((payload->>'compensationMinor')::numeric*500/10000)
 AND payload-ARRAY['id','opportunityId','campaignId','employerId','studentId','compensationMinor','feeRateBps','feeAmountMinor','currency','status','earnedAt']='{}'::jsonb)
 OR (collection='auditEvents' AND document_path='auditEvents/'||encode(sha256(convert_to(current_setting('nexustalent.request_id',true)||':'||current_setting('nexustalent.actor_uid',true)||':ADVANCE_CANDIDATE_STAGE','UTF8')),'hex') AND payload->>'eventId'=split_part(document_path,'/',2)
 AND payload->>'actorUid'=current_setting('nexustalent.actor_uid',true) AND payload->>'actorRole'=(SELECT nexustalent.actor_role()) AND payload->>'action'='ADVANCE_CANDIDATE_STAGE'
 AND payload->>'requestId'=current_setting('nexustalent.request_id',true) AND payload->'immutable'='true'::jsonb)));
CREATE FUNCTION nexustalent.guard_joining_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE o jsonb; accepted jsonb;
BEGIN
 IF NOT pg_has_role(current_user,'nexustalent_joining_writer','MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
 o:=nexustalent.bound_joining_opportunity(); accepted:=nexustalent.bound_joining_offer();
 IF o IS NULL OR accepted IS NULL OR accepted->>'currency' IS DISTINCT FROM 'INR' OR jsonb_typeof(accepted->'salaryLPA') IS DISTINCT FROM 'number'
 OR (accepted->>'salaryLPA')::numeric<0 OR round((accepted->>'salaryLPA')::numeric*10000000)>9007199254740991 THEN
 RAISE EXCEPTION 'Authoritative offer required' USING ERRCODE='23514'; END IF;
 IF OLD.collection='opportunities' THEN
  IF OLD.payload->>'stage' IS DISTINCT FROM 'accepted' OR NEW.payload->>'stage' IS DISTINCT FROM 'joined' OR accepted->>'status' IS DISTINCT FROM 'accepted'
  OR (NEW.payload-ARRAY['stage','stageUpdatedAt','joinedAt','joinedSalaryLPA','funnelCountedStages']) IS DISTINCT FROM (OLD.payload-ARRAY['stage','stageUpdatedAt','joinedAt','joinedSalaryLPA','funnelCountedStages'])
  OR NEW.payload->'joinedSalaryLPA' IS DISTINCT FROM accepted->'salaryLPA'
  OR ((NEW.payload->'funnelCountedStages')-'joined') IS DISTINCT FROM (COALESCE(OLD.payload->'funnelCountedStages','{}'::jsonb)-'joined')
  OR NEW.payload->'funnelCountedStages'->'joined' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Invalid joining transition' USING ERRCODE='23514'; END IF;
 ELSIF OLD.collection='campaigns' THEN
  IF o->>'stage' IS DISTINCT FROM 'joined' OR (NEW.payload-'funnel') IS DISTINCT FROM (OLD.payload-'funnel')
  OR ((NEW.payload->'funnel')-'joined') IS DISTINCT FROM ((OLD.payload->'funnel')-'joined')
  OR (NEW.payload->'funnel'->'joined' IS DISTINCT FROM OLD.payload->'funnel'->'joined' AND
  (jsonb_typeof(NEW.payload->'funnel'->'joined') IS DISTINCT FROM 'number' OR (NEW.payload->'funnel'->>'joined')::numeric-COALESCE((OLD.payload->'funnel'->>'joined')::numeric,0)<>1))
  THEN RAISE EXCEPTION 'Invalid joining funnel' USING ERRCODE='23514'; END IF;
 ELSIF OLD.collection='offers' THEN
  IF o->>'stage' IS DISTINCT FROM 'joined' OR OLD.payload->>'status' IS DISTINCT FROM 'accepted' OR NEW.payload->>'status' IS DISTINCT FROM 'joined' OR NEW.payload->>'joinedBy' IS DISTINCT FROM current_setting('nexustalent.actor_uid',true)
  OR (NEW.payload-ARRAY['status','joinedAt','joinedBy']) IS DISTINCT FROM (OLD.payload-ARRAY['status','joinedAt','joinedBy'])
  THEN RAISE EXCEPTION 'Invalid offer joining status' USING ERRCODE='23514'; END IF;
 ELSIF OLD.collection='students' THEN
  IF o->>'stage' IS DISTINCT FROM 'joined' OR accepted->>'status' IS DISTINCT FROM 'joined'
  OR (NEW.payload-ARRAY['placementStatus','placedCompany','placedSalaryLPA','availability']) IS DISTINCT FROM (OLD.payload-ARRAY['placementStatus','placedCompany','placedSalaryLPA','availability'])
  OR NEW.payload->>'placementStatus' IS DISTINCT FROM 'placed' OR NEW.payload->>'availability' IS DISTINCT FROM 'not_currently_available'
  OR NEW.payload->'placedSalaryLPA' IS DISTINCT FROM accepted->'salaryLPA' OR NEW.payload->>'placedCompany' IS DISTINCT FROM o->>'employerName'
  THEN RAISE EXCEPTION 'Invalid placement update' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Unrelated joining mutation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$$;
CREATE TRIGGER joining_update_guard BEFORE UPDATE ON nexustalent.records FOR EACH ROW EXECUTE FUNCTION nexustalent.guard_joining_update();
REVOKE ALL ON FUNCTION nexustalent.guard_joining_update() FROM PUBLIC;

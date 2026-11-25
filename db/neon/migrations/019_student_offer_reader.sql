-- Student-owned offers only; no mutation privileges.
CREATE POLICY student_own_offer_read ON nexustalent.records FOR SELECT TO nexustalent_reader
 USING (collection='offers' AND document_path='offers/'||(payload->>'id')
 AND NULLIF(current_setting('nexustalent.actor_uid',true),'') IS NOT NULL
 AND (SELECT nexustalent.actor_role())='student'
 AND payload->>'studentId'=current_setting('nexustalent.actor_uid',true)
 AND payload->>'status' IN ('issued','accepted','joined'));

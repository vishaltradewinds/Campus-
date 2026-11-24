import {runtimeGrantRoles,runtimeLogins} from './check-live-neon-roles.mjs';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
const runtimeScopes=Object.keys(runtimeGrantRoles);

// This query inspects only PostgreSQL catalogs. It is never executed by this
// module; an independently authorized reviewer must run it with read-only
// privileges after actual schema and login role provisioning.
export function productionRolePrivilegeAuditSql(){
 const expected=runtimeScopes.map(scope=>"('"+scope+"','"+runtimeLogins[scope]+"','"+runtimeGrantRoles[scope]+"')").join(',\n ');
 return `WITH expected(purpose,login_role,grant_role) AS (
 VALUES ${expected}
)
SELECT current_database() AS database_name,
 e.purpose,e.login_role,e.grant_role,
 r.rolcanlogin AS can_login,
 r.rolinherit AS inherits,
 r.rolsuper AS superuser,
 r.rolbypassrls AS bypass_rls,
 r.rolcreaterole AS can_create_role,
 r.rolcreatedb AS can_create_db,
 r.rolreplication AS replication,
 gr.rolcanlogin AS grant_can_login,
 (gr.rolsuper OR gr.rolbypassrls OR gr.rolcreaterole OR gr.rolcreatedb OR gr.rolreplication) AS grant_elevated,
 (SELECT count(*)::integer FROM pg_auth_members m WHERE m.member=gr.oid) AS grant_parent_memberships,
 EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid AND m.admin_option) AS has_membership_admin_option,
 COALESCE((SELECT m.inherit_option FROM pg_auth_members m WHERE m.member=r.oid AND m.roleid=gr.oid),false) AS inherits_expected_grant,
 (SELECT count(*)::integer FROM pg_auth_members m WHERE m.member=r.oid) AS total_direct_memberships,
 CASE WHEN r.oid IS NULL THEN NULL
      ELSE pg_has_role(r.oid,c.relowner,'MEMBER') END AS owner_member,
 CASE WHEN r.oid IS NULL THEN NULL
      ELSE r.oid = c.relowner END AS table_owner,
 CASE WHEN r.oid IS NULL THEN NULL
      ELSE has_table_privilege(r.oid,c.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER') END AS dangerous_table_privilege,
 CASE WHEN e.purpose IN ('directory','login','session','enrollment') THEN
      has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
      ELSE false END AS function_only_record_access,
 CASE WHEN e.purpose IN ('login','session','enrollment') THEN
      has_table_privilege(r.oid,'nexustalent_identity.principals'::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_table_privilege(r.oid,'nexustalent_identity.sessions'::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_table_privilege(r.oid,'nexustalent_identity.credentials'::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      ELSE false END AS identity_direct_table_access,
 CASE WHEN e.purpose='directory' THEN has_function_privilege(r.oid,'nexustalent.registration_directory()'::regprocedure,'EXECUTE')
      WHEN e.purpose='login' THEN has_function_privilege(r.oid,'nexustalent_identity.login_credential(text)'::regprocedure,'EXECUTE')
       AND has_function_privilege(r.oid,'nexustalent_identity.issue_session(text,text,text)'::regprocedure,'EXECUTE')
       AND has_function_privilege(r.oid,'nexustalent_identity.revoke_session(text)'::regprocedure,'EXECUTE')
       AND has_function_privilege(r.oid,'nexustalent_identity.credential_for_session(text)'::regprocedure,'EXECUTE')
       AND has_function_privilege(r.oid,'nexustalent_identity.change_credential(text,text,text)'::regprocedure,'EXECUTE')
      WHEN e.purpose='session' THEN has_function_privilege(r.oid,'nexustalent_identity.resolve_session(text)'::regprocedure,'EXECUTE')
      WHEN e.purpose='enrollment' THEN has_function_privilege(r.oid,'nexustalent_identity.consume_enrollment(text,text)'::regprocedure,'EXECUTE')
      ELSE true END AS expected_function_access,
 c.relrowsecurity AND c.relforcerowsecurity AS forced_rls,
 coalesce((SELECT array_agg(g.rolname::text ORDER BY g.rolname)
   FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid
   WHERE m.member=r.oid),ARRAY[]::text[]) AS direct_role_memberships
FROM expected e
LEFT JOIN pg_roles r ON r.rolname=e.login_role
LEFT JOIN pg_roles gr ON gr.rolname=e.grant_role
CROSS JOIN pg_class c
WHERE c.oid='nexustalent.records'::regclass
ORDER BY e.purpose`;
}
// The only new SQL form is a SELECT around the existing catalog-only SELECT.
// This produces sanitized JSON for the disposable CI harness; it is never sent
// to a live database by this module.
export function disposablePrivilegeAuditJsonSql(){
 const inner=productionRolePrivilegeAuditSql();
 if(!inner.startsWith('WITH expected')||inner.includes(';'))throw Error('Unsafe audit statement');
 return "SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)::text FROM ("+inner+") a;";
}
const expectedKeys=['database_name','purpose','login_role','grant_role','can_login','inherits','superuser','bypass_rls','can_create_role','can_create_db','replication','grant_can_login','grant_elevated','grant_parent_memberships','has_membership_admin_option','inherits_expected_grant','total_direct_memberships','owner_member','table_owner','dangerous_table_privilege','function_only_record_access','identity_direct_table_access','expected_function_access','forced_rls','direct_role_memberships'];
// Parses an intentionally sanitized query result. Do not use this as
// independent verification that a provider-supplied or synthetic row is real.
function assessPrivilegeRows(rows,expectedDatabase){
 const blockers=new Set();
 if(!Array.isArray(rows)||rows.length!==runtimeScopes.length)blockers.add('INCOMPLETE_SQL_ROLE_CATALOG');
 const seen=new Set();
 if(Array.isArray(rows))for(const row of rows){
  if(!row||typeof row!=='object'||Object.keys(row).some(k=>!expectedKeys.includes(k))){blockers.add('UNSAFE_SQL_AUDIT_RESULT');continue;}
  const scope=row.purpose;
  if(!runtimeScopes.includes(scope)||seen.has(scope)){blockers.add('DUPLICATE_OR_UNKNOWN_SQL_ROLE');continue;}
  seen.add(scope);
  if(row.database_name!==expectedDatabase||row.login_role!==runtimeLogins[scope]||row.grant_role!==runtimeGrantRoles[scope])blockers.add('WRONG_SQL_ROLE_OR_DATABASE');
  if(row.can_login!==true||row.inherits!==true||row.superuser!==false||row.bypass_rls!==false||row.can_create_role!==false||row.can_create_db!==false||row.replication!==false)blockers.add('UNSAFE_SQL_LOGIN_ATTRIBUTES');
  if(row.owner_member!==false||row.table_owner!==false||row.dangerous_table_privilege!==false||row.forced_rls!==true)blockers.add('SQL_RLS_OR_OWNERSHIP_UNSAFE');
  if(row.grant_can_login!==false||row.inherits_expected_grant!==true||row.total_direct_memberships!==1)blockers.add('UNSAFE_SQL_ROLE_INHERITANCE');
  // A single direct parent is insufficient if that parent has its own memberships.
  // Reject all parent memberships and delegated administration, including SET-only edges.
  if(row.grant_elevated!==false||row.grant_parent_memberships!==0||row.has_membership_admin_option!==false)blockers.add('UNSAFE_SQL_GRANT_CHAIN');
  if(row.function_only_record_access!==false||row.identity_direct_table_access!==false||row.expected_function_access!==true)blockers.add('FUNCTION_ONLY_ACCESS_UNVERIFIED');
  if(!Array.isArray(row.direct_role_memberships)||row.direct_role_memberships.length!==1||row.direct_role_memberships[0]!==runtimeGrantRoles[scope])blockers.add('EXCESS_SQL_ROLE_MEMBERSHIP');
 }
 for(const scope of runtimeScopes)if(!seen.has(scope))blockers.add('MISSING_SQL_RUNTIME_ROLE');
 blockers.add('PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED');
 return {format:'nexustalent-production-pg-catalog-assessment-v1',auditedScopes:seen.size,blockers:[...blockers].sort(),decision:'INDEPENDENT_PRIVILEGE_VALIDATION_HOLD',authorizesMigration:false,authorizesCutover:false,executesSql:false,writes:0};
}

// Production assessment never accepts the disposable database name.
export function assessProductionPrivilegeRows(rows){
 return assessPrivilegeRows(rows,'nexustalent');
}
// A separate CI-only interpretation reuses every permission check but cannot
// be mistaken for production attestation or approval.
export function assessDisposablePrivilegeRows(rows){
 const r=assessPrivilegeRows(rows,'nexustalent_ci');
 return {...r,format:'nexustalent-disposable-pg16-rehearsal-v1',
  decision:'DISPOSABLE_SQL_REHEARSAL_ONLY',
  authorizesMigration:false,authorizesCutover:false,productionAuthorized:false};
}
// CLI emits SQL or checks sanitized disposable results. It never executes SQL,
// opens a network connection, changes roles or authorizes production.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length===2)console.log(productionRolePrivilegeAuditSql());
 else if(process.argv.length===3&&process.argv[2]==='--disposable-sql-json')console.log(disposablePrivilegeAuditJsonSql());
 else if(process.argv.length===4&&process.argv[2]==='--verify-disposable'){
  try{
   const result=assessDisposablePrivilegeRows(JSON.parse(await readFile(process.argv[3],'utf8')));
   const expected='PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED';
   if(result.rolesObserved!==undefined||result.auditedScopes!==17||
      result.blockers.length!==1||result.blockers[0]!==expected)throw Error('Unsafe CI privileges');
   console.log(JSON.stringify({format:result.format,observed:result.auditedScopes,
    result:'DISPOSABLE_REHEARSAL_PASSED_NOT_PRODUCTION_READY',
    cutoverAuthorized:false,writes:0}));
  }catch{console.error('Disposable role audit failed');process.exitCode=2;}
 }else{console.error('Usage: [--disposable-sql-json | --verify-disposable path]');process.exitCode=2;}
}

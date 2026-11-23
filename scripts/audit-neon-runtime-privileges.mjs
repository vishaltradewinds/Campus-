import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {runtimeGrantRoles,runtimeLogins} from './check-live-neon-roles.mjs';

// A SQL CATALOG QUERY, NOT A PROVISIONING SCRIPT. PostgreSQL 16 only.
// No credentials, row data, live actions or production cutover authorization.
export function readOnlyRuntimePrivilegeAuditSQL(){
 const tuples=Object.entries(runtimeGrantRoles).map(([scope,grant])=>{
  const login=runtimeLogins[scope];
  if(!/^[a-z_]+$/.test(scope)||!/^nexustalent_[a-z_]+$/.test(grant)||!/^nexustalent_app_[a-z_]+$/.test(login))throw Error('Unsafe static role catalog');
  return "('"+scope+"','"+login+"','"+grant+"')";
 }).join(',\n ');
 return `WITH expected(scope,login_name,grant_name) AS (VALUES
 ${tuples}
), roster AS (
 SELECT e.scope,e.login_name,e.grant_name,l.oid AS login_oid,g.oid AS grant_oid,
        l.rolcanlogin AS login_can_login,l.rolinherit AS login_inherits,
        l.rolsuper AS login_super,l.rolbypassrls AS login_bypassrls,
        l.rolcreaterole AS login_create_role,l.rolcreatedb AS login_create_db,
        l.rolreplication AS login_replication,
        g.rolcanlogin AS grant_can_login,g.rolinherit AS grant_inherits,
        (SELECT count(*)::int FROM pg_auth_members m WHERE m.member=l.oid) AS membership_count,
        COALESCE((SELECT m.inherit_option FROM pg_auth_members m WHERE m.member=l.oid AND m.roleid=g.oid),false) AS expected_grant_inherited,
        l.oid IS NOT NULL AS provisional_login_exists
 FROM expected e
 LEFT JOIN pg_roles l ON l.rolname=e.login_name
 LEFT JOIN pg_roles g ON g.rolname=e.grant_name
), observed AS (
 SELECT r.scope,r.login_name,r.grant_name,
        r.login_oid IS NOT NULL AS login_exists,
        r.grant_oid IS NOT NULL AS grant_exists,
        r.login_can_login,r.login_inherits,r.login_super,r.login_bypassrls,
        r.login_create_role,r.login_create_db,r.login_replication,
        r.grant_can_login,r.grant_inherits,r.membership_count,r.expected_grant_inherited,
        COALESCE(pg_has_role(r.login_oid,c.relowner,'MEMBER'),true) AS table_owner_member,
        COALESCE(has_table_privilege(r.login_oid,c.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER'),true) AS dangerous_record_access,
        COALESCE(has_any_column_privilege(r.login_oid,c.oid,'REFERENCES'),true) AS dangerous_column_access,
        CASE WHEN r.scope IN ('directory','login','session','enrollment') THEN
          COALESCE(has_table_privilege(r.login_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true)
        ELSE false END AS function_only_record_access,
        CASE WHEN r.scope IN ('directory','login','session','enrollment') THEN
          COALESCE(has_any_column_privilege(r.login_oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'),true)
        ELSE false END AS function_only_column_access,
        CASE WHEN r.scope='directory' THEN has_function_privilege(r.login_oid,'nexustalent.registration_directory()'::regprocedure,'EXECUTE')
             WHEN r.scope='login' THEN has_function_privilege(r.login_oid,'nexustalent_identity.login_credential(text)'::regprocedure,'EXECUTE')
                AND has_function_privilege(r.login_oid,'nexustalent_identity.issue_session(text,text,text)'::regprocedure,'EXECUTE')
                AND has_function_privilege(r.login_oid,'nexustalent_identity.revoke_session(text)'::regprocedure,'EXECUTE')
             WHEN r.scope='session' THEN has_function_privilege(r.login_oid,'nexustalent_identity.resolve_session(text)'::regprocedure,'EXECUTE')
             WHEN r.scope='enrollment' THEN has_function_privilege(r.login_oid,'nexustalent_identity.consume_enrollment(text,text)'::regprocedure,'EXECUTE')
             ELSE true END AS expected_function_access,
        CASE WHEN r.scope IN ('login','session','enrollment') THEN
          COALESCE(has_table_privilege(r.login_oid,'nexustalent_identity.principals'::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true)
          OR COALESCE(has_table_privilege(r.login_oid,'nexustalent_identity.sessions'::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true)
          OR COALESCE(has_table_privilege(r.login_oid,'nexustalent_identity.credentials'::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true)
        ELSE false END AS auth_direct_table_access
 FROM roster r CROSS JOIN pg_class c WHERE c.oid='nexustalent.records'::regclass
)
SELECT json_build_object(
 'format','nexustalent-pg16-runtime-privilege-audit-v1',
 'database',current_database(),
 'provider','postgres16-catalog',
 'rls_enabled',(SELECT relrowsecurity FROM pg_class WHERE oid='nexustalent.records'::regclass),
 'rls_forced',(SELECT relforcerowsecurity FROM pg_class WHERE oid='nexustalent.records'::regclass),
 'unexpected_app_login_count',(SELECT count(*)::int FROM pg_roles WHERE rolname LIKE 'nexustalent_app_%')-(SELECT count(*)::int FROM observed WHERE login_exists),
 'roles',(SELECT json_agg(row_to_json(o) ORDER BY o.scope) FROM observed o)
)::text;`;
}
const scopeNames=Object.keys(runtimeGrantRoles).sort();
const functionOnly=new Set(['directory','login','session','enrollment']);
export function checkRuntimePrivilegeAudit(input){
 const blockers=new Set(),isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 if(!isObject(input)||input.format!=='nexustalent-pg16-runtime-privilege-audit-v1'||input.provider!=='postgres16-catalog'||!['nexustalent_ci','nexustalent'].includes(input.database))blockers.add('AUDIT_SOURCE_OR_DATABASE_UNVERIFIED');
 if(input?.rls_enabled!==true||input?.rls_forced!==true)blockers.add('FORCED_RLS_UNVERIFIED');
 if(input?.unexpected_app_login_count!==0)blockers.add('UNRECONCILED_RUNTIME_LOGINS');
 const observations=Array.isArray(input?.roles)?input.roles:[];
 if(observations.length!==scopeNames.length||new Set(observations.map(r=>r?.scope)).size!==scopeNames.length)blockers.add('ROLE_COVERAGE_INCOMPLETE');
 const seen=new Set();
 for(const role of observations){
  if(!isObject(role)||!scopeNames.includes(role.scope)||seen.has(role.scope)){blockers.add('ROLE_METADATA_UNVERIFIED');continue;}
  seen.add(role.scope);
  if(role.login_name!==runtimeLogins[role.scope]||role.grant_name!==runtimeGrantRoles[role.scope]||role.login_exists!==true||role.grant_exists!==true)blockers.add('ROLE_IDENTITY_MISMATCH');
  if(role.login_can_login!==true||role.login_inherits!==true||role.login_super!==false||role.login_bypassrls!==false||role.login_create_role!==false||role.login_create_db!==false||role.login_replication!==false||role.grant_can_login!==false||role.grant_inherits!==false)blockers.add('UNSAFE_RUNTIME_ROLE_FLAGS');
  if(role.membership_count!==1||role.expected_grant_inherited!==true||role.table_owner_member!==false)blockers.add('UNSAFE_ROLE_MEMBERSHIP');
  if(role.dangerous_record_access!==false||role.dangerous_column_access!==false)blockers.add('EXCESS_RECORD_PRIVILEGE');
  if(role.function_only_record_access!==false||role.function_only_column_access!==false||role.auth_direct_table_access!==false||role.expected_function_access!==true)blockers.add('FUNCTION_BOUNDARY_UNVERIFIED');
 }
 const names=[...blockers].sort();
 return {format:'nexustalent-runtime-privilege-review-v1',database:input?.database==='nexustalent'?'nexustalent':input?.database==='nexustalent_ci'?'nexustalent_ci':'UNVERIFIED',rolesObserved:observations.length,blockers:names,decision:names.length?'PRIVILEGE_AUDIT_HOLD':'CATALOG_REHEARSAL_ONLY_REQUIRES_INDEPENDENT_REVIEW',productionAuthorized:false,cutoverAuthorized:false,writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv[2]==='--sql'&&process.argv.length===3){console.log(readOnlyRuntimePrivilegeAuditSQL());}
 else if(process.argv.length===3){
  try{const r=checkRuntimePrivilegeAudit(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(r,null,2));if(r.blockers.length)process.exitCode=2;}
  catch{console.error('Invalid sanitized privilege evidence');process.exitCode=1;}
 }else{console.error('Usage: --sql or sanitized-audit.json');process.exitCode=1;}
}

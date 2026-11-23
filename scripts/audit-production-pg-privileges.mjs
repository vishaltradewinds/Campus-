import {runtimeScopes} from '../server/postgresConnectionBudget.ts';
import {runtimeGrantRoles,runtimeLogins} from './check-live-neon-roles.mjs';

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
 CASE WHEN r.oid IS NULL THEN NULL
      ELSE pg_has_role(r.oid,'nexustalent_owner'::regrole,'MEMBER') END AS owner_member,
 CASE WHEN r.oid IS NULL THEN NULL
      ELSE r.oid = c.relowner END AS table_owner,
 CASE WHEN r.oid IS NULL THEN NULL
      ELSE has_table_privilege(r.oid,c.oid,'TRUNCATE,REFERENCES,TRIGGER') END AS dangerous_table_privilege,
 c.relrowsecurity AND c.relforcerowsecurity AS forced_rls,
 coalesce((SELECT array_agg(g.rolname::text ORDER BY g.rolname)
   FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid
   WHERE m.member=r.oid AND g.rolname LIKE 'nexustalent_%'),ARRAY[]::text[]) AS direct_nexustalent_memberships
FROM expected e
LEFT JOIN pg_roles r ON r.rolname=e.login_role
CROSS JOIN pg_class c
WHERE c.oid='nexustalent.records'::regclass
ORDER BY e.purpose`;
}
const expectedKeys=['database_name','purpose','login_role','grant_role','can_login','inherits','superuser','bypass_rls','can_create_role','can_create_db','replication','owner_member','table_owner','dangerous_table_privilege','forced_rls','direct_nexustalent_memberships'];
// Parses an intentionally sanitized query result. Do not use this as
// independent verification that a provider-supplied or synthetic row is real.
export function assessProductionPrivilegeRows(rows){
 const blockers=new Set();
 if(!Array.isArray(rows)||rows.length!==runtimeScopes.length)blockers.add('INCOMPLETE_SQL_ROLE_CATALOG');
 const seen=new Set();
 if(Array.isArray(rows))for(const row of rows){
  if(!row||typeof row!=='object'||Object.keys(row).some(k=>!expectedKeys.includes(k))){blockers.add('UNSAFE_SQL_AUDIT_RESULT');continue;}
  const scope=row.purpose;
  if(!runtimeScopes.includes(scope)||seen.has(scope)){blockers.add('DUPLICATE_OR_UNKNOWN_SQL_ROLE');continue;}
  seen.add(scope);
  if(row.database_name!=='nexustalent'||row.login_role!==runtimeLogins[scope]||row.grant_role!==runtimeGrantRoles[scope])blockers.add('WRONG_SQL_ROLE_OR_DATABASE');
  if(row.can_login!==true||row.inherits!==true||row.superuser!==false||row.bypass_rls!==false||row.can_create_role!==false||row.can_create_db!==false||row.replication!==false)blockers.add('UNSAFE_SQL_LOGIN_ATTRIBUTES');
  if(row.owner_member!==false||row.table_owner!==false||row.dangerous_table_privilege!==false||row.forced_rls!==true)blockers.add('SQL_RLS_OR_OWNERSHIP_UNSAFE');
  if(!Array.isArray(row.direct_nexustalent_memberships)||row.direct_nexustalent_memberships.length!==1||row.direct_nexustalent_memberships[0]!==runtimeGrantRoles[scope])blockers.add('EXCESS_SQL_ROLE_MEMBERSHIP');
 }
 for(const scope of runtimeScopes)if(!seen.has(scope))blockers.add('MISSING_SQL_RUNTIME_ROLE');
 blockers.add('PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED');
 return {format:'nexustalent-production-pg-catalog-assessment-v1',auditedScopes:seen.size,blockers:[...blockers].sort(),decision:'INDEPENDENT_PRIVILEGE_VALIDATION_HOLD',authorizesMigration:false,authorizesCutover:false,executesSql:false,writes:0};
}

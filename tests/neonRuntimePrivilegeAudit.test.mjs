import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runtimeGrantRoles,runtimeLogins} from '../scripts/check-live-neon-roles.mjs';
import {checkRuntimePrivilegeAudit,readOnlyRuntimePrivilegeAuditSQL} from '../scripts/audit-neon-runtime-privileges.mjs';

const scopes=Object.keys(runtimeGrantRoles).sort();
const role=(scope)=>({
 scope,login_name:runtimeLogins[scope],grant_name:runtimeGrantRoles[scope],
 login_exists:true,grant_exists:true,login_can_login:true,login_inherits:true,
 login_super:false,login_bypassrls:false,login_create_role:false,login_create_db:false,
 login_replication:false,grant_can_login:false,grant_inherits:false,
 membership_count:1,expected_grant_inherited:true,table_owner_member:false,
 dangerous_record_access:false,dangerous_column_access:false,
 function_only_record_access:false,function_only_column_access:false,
 expected_function_access:true,auth_direct_table_access:false
});
const fixture=()=>({
 format:'nexustalent-pg16-runtime-privilege-audit-v1',database:'nexustalent_ci',
 provider:'postgres16-catalog',rls_enabled:true,rls_forced:true,unexpected_app_login_count:0,
 roles:scopes.map(role)
});
test('query is a read-only PostgreSQL16 catalog statement with no role mutation',async()=>{
 const sql=readOnlyRuntimePrivilegeAuditSQL();
 assert.ok(sql.startsWith('WITH expected'));
 assert.match(sql,/pg_auth_members/);
 assert.match(sql,/relforcerowsecurity/);
 assert.match(sql,/has_function_privilege/);
 assert.match(sql,/expected_grant_inherited/);
 assert.equal(sql.match(/nexustalent_app_[a-z_]+/g)?.length,17);
 assert.doesNotMatch(sql,/\b(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|DO)\s+(?:ROLE|TABLE|USER|ON|INTO)\b/i);
 const source=await readFile('db/neon/tests/production_role_shape_rehearsal.sql','utf8');
 for(const scope of scopes){assert.ok(source.includes("'"+runtimeLogins[scope]+"'"));assert.ok(source.includes("'"+runtimeGrantRoles[scope]+"'"));}
 assert.match(source,/nexustalent_ci/);assert.match(source,/NO PASSWORDS ARE SET/);
});
test('17 bounded, separately inherited login roles can only pass catalog rehearsal; never authorize deployment',()=>{
 const result=checkRuntimePrivilegeAudit(fixture());
 assert.deepEqual(result.blockers,[]);assert.equal(result.rolesObserved,17);
 assert.equal(result.decision,'CATALOG_REHEARSAL_ONLY_REQUIRES_INDEPENDENT_REVIEW');
 assert.equal(result.productionAuthorized,false);assert.equal(result.cutoverAuthorized,false);assert.equal(result.writes,0);
});
test('elevated login, RLS bypass, extra group membership, missing privileges are rejected',()=>{
 const permutations=[
  [x=>{x.roles[0].login_super=true;},'UNSAFE_RUNTIME_ROLE_FLAGS'],
  [x=>{x.roles[1].login_bypassrls=true;},'UNSAFE_RUNTIME_ROLE_FLAGS'],
  [x=>{x.roles[2].membership_count=2;},'UNSAFE_ROLE_MEMBERSHIP'],
  [x=>{x.roles[3].expected_grant_inherited=false;},'UNSAFE_ROLE_MEMBERSHIP'],
  [x=>{x.roles[4].table_owner_member=true;},'UNSAFE_ROLE_MEMBERSHIP'],
  [x=>{x.roles[5].dangerous_record_access=true;},'EXCESS_RECORD_PRIVILEGE'],
  [x=>{x.roles.find(x=>x.scope==='session').expected_function_access=false;},'FUNCTION_BOUNDARY_UNVERIFIED'],
  [x=>{x.roles.find(x=>x.scope==='directory').function_only_record_access=true;},'FUNCTION_BOUNDARY_UNVERIFIED'],
  [x=>{x.roles.find(x=>x.scope==='login').auth_direct_table_access=true;},'FUNCTION_BOUNDARY_UNVERIFIED'],
  [x=>{x.rls_enabled=false;},'FORCED_RLS_UNVERIFIED'],
  [x=>{x.unexpected_app_login_count=1;},'UNRECONCILED_RUNTIME_LOGINS'],
  [x=>{x.roles.pop();},'ROLE_COVERAGE_INCOMPLETE'],
  [x=>{x.roles[0].grant_name='nexustalent_api';},'ROLE_IDENTITY_MISMATCH'],
 ];
 for(const [mutate,blocker] of permutations){const x=fixture();mutate(x);assert.ok(checkRuntimePrivilegeAudit(x).blockers.includes(blocker),blocker);}
});
test('wrong database, source, duplicate role and unverified input fail closed',()=>{
 const x=fixture();x.database='other';x.provider='fiction';x.roles[0].scope=x.roles[1].scope;
 const result=checkRuntimePrivilegeAudit(x);
 assert.ok(result.blockers.includes('AUDIT_SOURCE_OR_DATABASE_UNVERIFIED'));
 assert.ok(result.blockers.includes('ROLE_COVERAGE_INCOMPLETE'));
 assert.ok(result.blockers.includes('ROLE_METADATA_UNVERIFIED'));
 assert.ok(checkRuntimePrivilegeAudit(null).blockers.length>0);
});

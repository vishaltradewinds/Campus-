import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runtimeGrantRoles,runtimeLogins} from '../scripts/check-live-neon-roles.mjs';
import {productionRolePrivilegeAuditSql,assessProductionPrivilegeRows,disposablePrivilegeAuditJsonSql,assessDisposablePrivilegeRows} from '../scripts/audit-production-pg-privileges.mjs';
const scopes=Object.keys(runtimeGrantRoles);
function rows(){return scopes.map(purpose=>({
 database_name:'nexustalent',purpose,login_role:runtimeLogins[purpose],grant_role:runtimeGrantRoles[purpose],
 can_login:true,inherits:true,superuser:false,bypass_rls:false,can_create_role:false,can_create_db:false,replication:false,
 grant_can_login:false,inherits_expected_grant:true,total_direct_memberships:1,
 owner_member:false,table_owner:false,dangerous_table_privilege:false,forced_rls:true,
 function_only_record_access:false,identity_direct_table_access:false,expected_function_access:true,
 direct_role_memberships:[runtimeGrantRoles[purpose]]
}));}
test('SQL catalog query is read-only, scoped and includes every expected runtime role',()=>{
 const sql=productionRolePrivilegeAuditSql();
 assert.match(sql,/FROM pg_auth_members/);assert.match(sql,/LEFT JOIN pg_roles/);
 assert.match(sql,/c\.relrowsecurity AND c\.relforcerowsecurity/);
 assert.match(sql,/has_table_privilege/);
 assert.doesNotMatch(sql,/\b(CREATE|ALTER|DROP|INSERT|DELETE|UPDATE|REVOKE|GRANT|CALL)\s+(?:TABLE|ROLE|FUNCTION|SCHEMA|INTO|FROM|\w)/i);
 for(const purpose of scopes){assert.ok(sql.includes(runtimeLogins[purpose]));assert.ok(sql.includes(runtimeGrantRoles[purpose]));}
});
test('complete synthetic results still do not attest provider, approval or cutover',()=>{
 const a=assessProductionPrivilegeRows(rows());
 assert.deepEqual(a.blockers,['PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED']);
 assert.equal(a.auditedScopes,17);assert.equal(a.authorizesCutover,false);assert.equal(a.executesSql,false);assert.equal(a.writes,0);
});
test('missing, duplicate, spoofed role names and metadata leaks fail closed',()=>{
 const v=rows();
 for(const changed of [
  v.slice(0,-1),
  [...v,v[0]],
  v.map((r,i)=>i===0?{...r,login_role:'nexustalent_owner'}:r),
  v.map((r,i)=>i===0?{...r,token:'PRIVATE_VALUE'}:r),
  v.map((r,i)=>i===0?{...r,database_name:'postgres'}:r)
 ]){const a=assessProductionPrivilegeRows(changed);assert.ok(a.blockers.length>1);assert.ok(!JSON.stringify(a).includes('PRIVATE_VALUE'));}
});
test('owner membership, excessive grants, unsafe flags and disabled RLS are rejected',()=>{
 const c=rows();
 for(const change of [
  {owner_member:true},{table_owner:true},{dangerous_table_privilege:true},{forced_rls:false},
  {superuser:true},{bypass_rls:true},{can_create_role:true},{can_create_db:true},
  {replication:true},{can_login:false},{inherits:false},
  {grant_can_login:true},{inherits_expected_grant:false},{total_direct_memberships:2},
  {function_only_record_access:true},{identity_direct_table_access:true},{expected_function_access:false},
  {direct_role_memberships:[runtimeGrantRoles.reader,'nexustalent_owner']},
  {direct_role_memberships:[runtimeGrantRoles.reader,'neon_superuser']}
 ]){
  const changed=c.map((r,i)=>i===0?{...r,...change}:r);
  const a=assessProductionPrivilegeRows(changed);
  assert.ok(a.blockers.length>1,JSON.stringify(change));
 }
});

test('guarded disposable role fixture maps all 17 grant purposes with no secrets',async()=>{
 const source=await readFile('db/neon/tests/production_role_shape_rehearsal.sql','utf8');
 assert.match(source,/current_database\(\) <> 'nexustalent_ci'/);
 assert.match(source,/current_user <> 'postgres'/);
 assert.match(source,/inet_server_addr\(\)/);
 assert.match(source,/inet '172\.16\.0\.0\/12'/);
 assert.match(source,/inet_server_addr\(\) IS NULL/);
 assert.match(source,/current_user <> 'postgres'/);
 assert.match(source,/PASSWORD NULL/);
 assert.match(source,/WITH INHERIT TRUE/);
 for(const purpose of scopes){
  assert.ok(source.includes("'nexustalent_app_"+purpose+"'"),purpose);
  assert.ok(source.includes("'"+runtimeGrantRoles[purpose]+"'"),purpose);
 }
 assert.doesNotMatch(source,/synthetic-.*password|PASSWORD '[^']+'/i);
});
test('disposable catalog query is only a JSON SELECT wrapper, never a role operation',()=>{
 const sql=disposablePrivilegeAuditJsonSql();
 assert.match(sql,/^SELECT COALESCE\(json_agg\(row_to_json\(a\)\)/);
 assert.match(sql,/FROM \(WITH expected/);
 assert.match(sql,/pg_auth_members/);
 assert.doesNotMatch(sql,/\b(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE)\s+(?:ROLE|TABLE|USER|ON|INTO)\b/i);
});
test('disposable privilege rehearsal is never accepted as production attestation',()=>{
 const x=rows().map(r=>({...r,database_name:'nexustalent_ci'}));
 const ci=assessDisposablePrivilegeRows(x);
 assert.deepEqual(ci.blockers,['PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED']);
 assert.equal(ci.auditedScopes,17);
 assert.equal(ci.authorizesCutover,false);
 assert.equal(ci.productionAuthorized,false);
 const production=assessProductionPrivilegeRows(x);
 assert.ok(production.blockers.includes('WRONG_SQL_ROLE_OR_DATABASE'));
});
test('disposable privilege audit still rejects owner grants, bypass RLS and extra memberships',()=>{
 for(const change of [{superuser:true},{bypass_rls:true},{direct_role_memberships:['neon_superuser']},
                      {grant_can_login:true},{function_only_record_access:true},{expected_function_access:false},
                      {total_direct_memberships:2},{owner_member:true},{forced_rls:false}]){
  const x=rows().map(r=>({...r,database_name:'nexustalent_ci'}));
  Object.assign(x[0],change);
  const ci=assessDisposablePrivilegeRows(x);
  assert.ok(ci.blockers.length>1,JSON.stringify(change));
  assert.equal(ci.productionAuthorized,false);
 }
});

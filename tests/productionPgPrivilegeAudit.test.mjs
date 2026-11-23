import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeGrantRoles,runtimeLogins} from '../scripts/check-live-neon-roles.mjs';
import {productionRolePrivilegeAuditSql,assessProductionPrivilegeRows} from '../scripts/audit-production-pg-privileges.mjs';
const scopes=Object.keys(runtimeGrantRoles);
function rows(){return scopes.map(purpose=>({
 database_name:'nexustalent',purpose,login_role:runtimeLogins[purpose],grant_role:runtimeGrantRoles[purpose],
 can_login:true,inherits:true,superuser:false,bypass_rls:false,can_create_role:false,can_create_db:false,replication:false,
 owner_member:false,table_owner:false,dangerous_table_privilege:false,forced_rls:true,
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
  {direct_role_memberships:[runtimeGrantRoles.reader,'nexustalent_owner']},
  {direct_role_memberships:[runtimeGrantRoles.reader,'neon_superuser']}
 ]){
  const changed=c.map((r,i)=>i===0?{...r,...change}:r);
  const a=assessProductionPrivilegeRows(changed);
  assert.ok(a.blockers.length>1,JSON.stringify(change));
 }
});

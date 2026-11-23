import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {loadMigrationRoleCatalog,checkLiveRoleInventory,runtimeGrantRoles,runtimeLogins,releaseSchemaRoleCatalog} from '../scripts/check-live-neon-roles.mjs';
const target={projectId:'rough-butterfly-67822299',branchId:'br-rapid-brook-b3bqvuxx',databaseName:'nexustalent',inventorySource:'neon-role-api',inventoryComplete:true};
const current={...target,roles:[{name:'nexustalent_api',authentication_method:'no_login'},{name:'nexustalent_owner',authentication_method:'password'}]};
const grant=(name)=>({name,authentication_method:'no_login'});
const login=(name)=>({name,authentication_method:'password'});
test('complete 001–020 source catalog covers all seventeen scoped runtime grants',async()=>{
 const catalog=await loadMigrationRoleCatalog(join(process.cwd(),'db/neon/migrations'));
 assert.deepEqual(catalog,releaseSchemaRoleCatalog);assert.equal(Object.keys(runtimeGrantRoles).length,17);
 assert.equal(Object.values(runtimeLogins).length,new Set(Object.values(runtimeLogins)).size);
 for(const role of Object.values(runtimeGrantRoles))assert.ok(catalog.includes(role),role);
});
test('actual Neon Free API inventory has no restricted login roles and must HOLD',async()=>{
 const c=await loadMigrationRoleCatalog(join(process.cwd(),'db/neon/migrations'));
 const r=checkLiveRoleInventory(current,c);
 assert.equal(r.decision,'PRODUCTION_IDENTITY_HOLD');assert.equal(r.missingRuntimeLogins.length,17);
 assert.equal(r.missingGrantRoles.length,c.length-1);
 assert.ok(r.blockers.includes('REQUIRED_SCHEMA_GRANT_ROLES_MISSING'));
 assert.ok(r.blockers.includes('RESTRICTED_RUNTIME_LOGINS_MISSING'));
 assert.equal(r.writes,0);assert.equal(r.startsCompute,false);assert.equal(r.authorizesCutover,false);
});
test('even a synthetic full role roster cannot attest grants and RLS security',async()=>{
 const c=await loadMigrationRoleCatalog(join(process.cwd(),'db/neon/migrations'));
 const r=checkLiveRoleInventory({...target,roles:[login('nexustalent_owner'),...c.map(grant),...Object.values(runtimeLogins).map(login)]},c);
 assert.deepEqual(r.missingGrantRoles,[]);assert.deepEqual(r.missingRuntimeLogins,[]);
 assert.deepEqual(r.blockers,['INDEPENDENT_SQL_GRANT_AND_RLS_AUDIT_REQUIRED']);
 assert.equal(r.decision,'PRODUCTION_IDENTITY_HOLD');
});
test('wrong target, unverified inventory, unexpected role and unsafe secret fields fail closed',async()=>{
 const c=await loadMigrationRoleCatalog(join(process.cwd(),'db/neon/migrations'));
 const r=checkLiveRoleInventory({...current,projectId:'wrong',inventoryComplete:false,roles:[...current.roles,{name:'nexustalent_unexpected',authentication_method:'password'},{name:'nexustalent_app_reader',authentication_method:'password',password:'NEVER ACCEPT'}]},c);
 for(const b of ['CANONICAL_NEON_TARGET_UNVERIFIED','PROVIDER_ROLE_INVENTORY_UNVERIFIED','UNRECONCILED_EXTRA_ROLES','ROLE_METADATA_UNSAFE_OR_DUPLICATED'])assert.ok(r.blockers.includes(b),b);
 assert.ok(!JSON.stringify(r).includes('NEVER ACCEPT'));
});
test('grant login escalation and weak login-method metadata fail closed',async()=>{
 const c=await loadMigrationRoleCatalog(join(process.cwd(),'db/neon/migrations'));
 const r=checkLiveRoleInventory({...target,roles:[login('nexustalent_owner'),...c.map(n=>n==='nexustalent_reader'?login(n):grant(n)),login(runtimeLogins.login),{name:runtimeLogins.session,authentication_method:'no_login'}]},c);
 assert.ok(r.blockers.includes('SCHEMA_ROLE_CAN_LOG_IN'));assert.ok(r.blockers.includes('RUNTIME_LOGIN_AUTHENTICATION_UNVERIFIED'));
});

test('caller cannot supply a reduced or altered role catalog to bypass missing migrations',()=>{assert.throws(()=>checkLiveRoleInventory(current,['nexustalent_api']),/Invalid migration role catalog/);});

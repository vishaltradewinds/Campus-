import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeScopes,type RuntimeScope} from '../server/postgresConnectionBudget';
import {planProductionPostgresRoles,productionRoleName,productionNeonTarget,productionUrlEnvName} from '../server/productionPostgresRolePlan';
import {rehearseProductionPostgresBindings} from '../server/productionPostgresBindingsRehearsal';
const env={NODE_ENV:'test',NEXUSTALENT_PG_BINDING_REHEARSAL:'1'};
function plan(){
 const e:NodeJS.ProcessEnv={NODE_ENV:'production',NEXUSTALENT_DATASTORE:'postgres'};
 for(const s of runtimeScopes)e[productionUrlEnvName(s)]='postgresql://'+productionRoleName(s)+':synthetic-long-secret-'+s+'@'+productionNeonTarget.host+'/nexustalent';
 return planProductionPostgresRoles(e,{...productionNeonTarget,poolerEnabled:false});
}
test('all 17 distinct scoped bindings are constructed and closed without network or fixture-owner pool',async()=>{
 const opened:RuntimeScope[]=[],ended:RuntimeScope[]=[];
 const runtime=await rehearseProductionPostgresBindings(plan(),(scope,options)=>{
  opened.push(scope);assert.equal(options.user,productionRoleName(scope));assert.equal(options.ssl.rejectUnauthorized,true);
  return {connect:async()=>{throw Error('No network permitted');},end:async()=>{ended.push(scope);}};
 },env);
 assert.deepEqual(opened,[...runtimeScopes]);assert.equal(typeof runtime.records('reader').begin,'function');
 assert.equal(typeof runtime.records('verification').commit,'function');
 assert.throws(()=>runtime.records('login' as any),/Record scope/);
 await runtime.close();await runtime.close();assert.equal(ended.length,17);
 assert.throws(()=>runtime.records('reader'),/unavailable/);
});
test('failed binding construction closes already-created pools, rejects reuse and forbids production activation',async()=>{
 const p=plan();let closed=0;
 const shared={connect:async()=>{throw Error('No network');},end:async()=>{closed++;}};
 await assert.rejects(rehearseProductionPostgresBindings(p,()=>shared,env),/rehearsal failed/);assert.equal(closed,1);
 await assert.rejects(rehearseProductionPostgresBindings(p,()=>shared,{NODE_ENV:'production'}),/rehearsal-only/);
});
test('identity function calls use their own scoped pool and reject wrong database role',async()=>{
 const invoked:RuntimeScope[]=[];
 const runtime=await rehearseProductionPostgresBindings(plan(),scope=>({
  connect:async()=>({query:async(sql:string)=>{
   if(sql.startsWith('SELECT current_user'))return {rows:[{role:productionRoleName(scope),db:'nexustalent',restricted:true,grant_safe:scope!=='session',function_only:true}]};
   if(sql.includes('resolve_session'))throw Error('Unsafe identity reached');
   if(sql.includes('revoke_session')){invoked.push(scope);return {rows:[{revoked:true}]};}
   return {rows:[]};
  },release:()=>{}}),end:async()=>{}
 }),env);
 const token=Buffer.alloc(32,2).toString('base64url');
 assert.equal(await runtime.credentials.logout(token),true);
 assert.equal((await runtime.verify(token)).status,'unavailable');
 assert.deepEqual(invoked,['login']);await runtime.close();
});

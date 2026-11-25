import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionBudget,runtimeScopes} from '../server/postgresConnectionBudget';
const env={NODE_ENV:'test',NEXUSTALENT_DATASTORE:'postgres',NEXUSTALENT_PG_INTEGRATION:'1'};
test('bounded browser keeps all seventeen distinct restricted roles under eighteen connections',()=>{
 const b=connectionBudget({...env,NEXUSTALENT_PG_POOL_PROFILE:'bounded-browser'});
 assert.equal(runtimeScopes.length,17);assert.equal(b.maximumConnections,18);
 assert.equal(b.pools.reader,2);assert.equal(b.pools.login,1);assert.equal(b.pools.directory,1);
 assert.ok(Object.entries(b.pools).every(([scope,n])=>scope==='reader'?n===2:n===1));
});
test('concurrency integration retains separate transaction capacity',()=>{
 const b=connectionBudget(env);assert.equal(b.maximumConnections,43);assert.equal(b.pools.demand,3);assert.equal(b.pools.reader,3);
});
test('production, missing opt-in and unknown profiles are refused',()=>{
 assert.throws(()=>connectionBudget({...env,NODE_ENV:'production'}),/test-only/);
 assert.throws(()=>connectionBudget({...env,NEXUSTALENT_PG_INTEGRATION:'0'}),/test-only/);
 assert.throws(()=>connectionBudget({...env,NEXUSTALENT_PG_POOL_PROFILE:'unknown'}),/Unknown/);
});

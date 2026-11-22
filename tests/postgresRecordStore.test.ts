import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresRecordStore,gatedPostgresStore,postgresDocumentPath } from '../server/postgresRecordStore';
function fixture(state:any={role:'runtime',db:'ci',restricted:true,safe_table:true}){
 const calls:Array<{sql:string;params?:any[]}>=[];const releases:boolean[]=[];
 const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[state]:sql.startsWith('SELECT payload')?[{payload:{uid:'synthetic',role:'student'}}]:[]};},release(destroy?:boolean){releases.push(!!destroy);}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'runtime','ci');
 return {store,client,calls,releases};
}
test('serializable transaction uses bound paths, append-only audit and one commit',async()=>{
 const f=fixture(),t=await f.store.begin();
 assert.equal(f.calls[0].sql,'BEGIN ISOLATION LEVEL SERIALIZABLE');
 assert.deepEqual(await f.store.read(t,"users/a'--"),{uid:'synthetic',role:'student'});
 assert.deepEqual(f.calls.at(-1)?.params,["users/a'--"]);
 await f.store.commit(t,[{name:'students/synthetic',data:{id:'synthetic'}},{name:'auditEvents/event',data:{immutable:true}}]);
 assert.match(f.calls.find(x=>x.params?.[0]==='students/synthetic')!.sql,/ON CONFLICT/);
 assert.doesNotMatch(f.calls.find(x=>x.params?.[0]==='auditEvents/event')!.sql,/ON CONFLICT/);
 assert.equal(f.calls.at(-1)?.sql,'COMMIT');await f.store.rollback(t);assert.deepEqual(f.releases,[false]);
});
test('unsafe runtime role or missing forced RLS destroys the connection',async()=>{
 for(const state of [{role:'owner',db:'ci',restricted:true,safe_table:true},{role:'runtime',db:'ci',restricted:false,safe_table:true},{role:'runtime',db:'ci',restricted:true,safe_table:false}]){
  const f=fixture(state);await assert.rejects(()=>f.store.begin(),/unavailable/);assert.deepEqual(f.releases,[true]);assert.equal(f.calls.at(-1)?.sql,'ROLLBACK');
 }
});
test('failed write rolls back without commit',async()=>{
 const f=fixture(),t=await f.store.begin();
 const query=f.client.query;f.client.query=async(sql,params)=>{if(sql.startsWith('INSERT'))throw new Error('synthetic conflict');return query(sql,params);};
 await assert.rejects(()=>f.store.commit(t,[{name:'students/synthetic',data:{id:'synthetic'}}]),/unavailable/);
 assert.equal(f.calls.at(-1)?.sql,'ROLLBACK');assert.deepEqual(f.releases,[false]);
});
test('invalid paths and production PostgreSQL activation fail closed',()=>{
 for(const [c,id] of [['invalid','x'],['users','../x'],['users','..'],['users','']])assert.throws(()=>postgresDocumentPath(c,id));
 assert.equal(gatedPostgresStore({}),null);
 assert.throws(()=>gatedPostgresStore({NEXUSTALENT_DATASTORE:'postgres',NODE_ENV:'production'}),/not enabled/);
 assert.throws(()=>gatedPostgresStore({NEXUSTALENT_DATASTORE:'postgres',NODE_ENV:'test',NEXUSTALENT_PG_INTEGRATION:'1',NEXUSTALENT_TEST_DATABASE_URL:'postgresql://nexustalent_runtime_ci:x@remote.example/nexustalent_ci'}),/Unsafe/);
});
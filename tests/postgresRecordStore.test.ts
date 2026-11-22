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
function readerFixture(rights:any={can_read:true,can_write:false,resolver_member:false,writer_member:false,reader_member:true}){
 const calls:Array<{sql:string;params?:any[]}>=[];const releases:boolean[]=[];
 const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'reader',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:[]};},release(destroy?:boolean){releases.push(!!destroy);}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'reader','ci',true);
 return {store,calls,releases};
}
test('scoped reader uses a read-only transaction and bound local principal context',async()=>{
 const f=readerFixture(),t=await f.store.begin({uid:"actor'--",adminClaim:false});
 assert.equal(f.calls[0].sql,'BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY');
 assert.deepEqual(f.calls.at(-1)?.params,["actor'--",'false']);
 assert.match(f.calls.at(-1)!.sql,/set_config\('nexustalent.actor_uid',\$1,true\)/);
 await assert.rejects(()=>f.store.commit(t,[{name:'students/actor',data:{}}]),/unavailable/);
 assert.ok(!f.calls.some(c=>c.sql.startsWith('INSERT')));
 await f.store.rollback(t);assert.equal(f.calls.at(-1)?.sql,'ROLLBACK');assert.deepEqual(f.releases,[false]);
});
test('reader denies missing principal and any unexpected write, resolver or writer privilege',async()=>{
 const normal={can_read:true,can_write:false,resolver_member:false,writer_member:false,reader_member:true};
 for(const rights of [{...normal,can_write:true},{...normal,resolver_member:true},{...normal,writer_member:true},{...normal,reader_member:false}]){
  const f=readerFixture(rights);await assert.rejects(()=>f.store.begin({uid:'actor',adminClaim:false}),/unavailable/);assert.deepEqual(f.releases,[true]);
 }
 const f=readerFixture();await assert.rejects(()=>f.store.begin(),/unavailable/);assert.deepEqual(f.releases,[true]);
});
test('registrar validates scope and restricted privilege, then emits INSERT only',async()=>{
 const rights={can_read:true,can_insert:true,can_modify:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:true};
 const calls:Array<{sql:string;params?:any[]}>=[];const releases:boolean[]=[];
 const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'registrar',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:[]};},release(destroy?:boolean){releases.push(!!destroy);}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'registrar','ci',false,true);
 await assert.rejects(()=>store.begin({uid:'actor',adminClaim:false,registrationRole:'super_admin',registrationEmail:'test@example.test'}),/unavailable/);
 const scope={uid:'actor',adminClaim:false,registrationRole:'student',registrationEmail:'test@example.test'};
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['actor','student','test@example.test']);
 await store.commit(t,[{name:'users/actor',data:{uid:'actor'}},{name:'students/actor',data:{id:'actor'}}]);
 const writes=calls.filter(c=>c.sql.startsWith('INSERT'));assert.equal(writes.length,2);
 assert.ok(writes.every(c=>!c.sql.includes('ON CONFLICT')));assert.equal(calls.at(-1)?.sql,'COMMIT');
 rights.can_modify=true;await assert.rejects(()=>store.begin(scope),/unavailable/);
 assert.deepEqual(releases,[true,false,true]);
});
test('demand writer binds action and request, inserts calls and updates only an existing campaign',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:true,institution_member:false,consent_member:false,assessment_member:false,offer_member:false,joining_member:false,verification_member:false,academic_member:false};
 const calls:Array<{sql:string;params?:any[]}>=[];const releases:boolean[]=[];
 let updated=true;
 const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'demand',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')&&updated?[{document_path:params?.[0]}]:[]};},release(destroy?:boolean){releases.push(!!destroy);}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'demand','ci',false,false,true);
 const scope={uid:'actor',adminClaim:false,demandAction:'SEND_CALLS',requestId:'demand-001'};
 await assert.rejects(()=>store.begin({...scope,demandAction:'GLOBAL_CONSENT'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['actor','SEND_CALLS','demand-001']);
 await store.commit(t,[{name:'calls/call-1',data:{id:'call-1'}},{name:'campaigns/camp-1',data:{id:'camp-1'}}]);
 assert.ok(calls.some(x=>x.sql.startsWith('INSERT')&&!x.sql.includes('ON CONFLICT')));
 assert.ok(calls.some(x=>x.sql.startsWith('UPDATE')&&x.sql.includes('RETURNING document_path')));
 updated=false;const t2=await store.begin(scope);
 await assert.rejects(()=>store.commit(t2,[{name:'campaigns/camp-1',data:{}}]),/unavailable/);
 assert.equal(calls.at(-1)?.sql,'ROLLBACK');rights.can_delete=true;await assert.rejects(()=>store.begin(scope),/unavailable/);
});

test('institution writer binds exact call context and requires existing campaign and call updates',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:false,institution_member:true,consent_member:false,assessment_member:false,offer_member:false,joining_member:false,verification_member:false,academic_member:false};
 const calls:Array<{sql:string;params?:any[]}>=[];const releases:boolean[]=[];
 const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'inst',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')?[{document_path:params?.[0]}]:[]};},release(destroy?:boolean){releases.push(!!destroy);}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'inst','ci',false,false,'institution');
 const scope={uid:'inst',adminClaim:false,demandAction:'ACTIVATE_STUDENTS',requestId:'inst-0011',callId:'call-1'};
 await assert.rejects(()=>store.begin({...scope,callId:'other/path'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['inst','ACTIVATE_STUDENTS','inst-0011','call-1']);
 await store.commit(t,[{name:'opportunities/opp-1',data:{id:'opp-1'}},{name:'calls/call-1',data:{id:'call-1'}},{name:'campaigns/camp-1',data:{id:'camp-1'}}]);
 assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,2);
 assert.equal(calls.filter(c=>c.sql.startsWith('INSERT')&&!c.sql.includes('ON CONFLICT')).length,1);
 rights.demand_member=true;await assert.rejects(()=>store.begin(scope),/unavailable/);
});

test('consent writer binds student action and opportunity; cannot inherit other writer roles',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:false,institution_member:false,consent_member:true,assessment_member:false,offer_member:false,joining_member:false,verification_member:false,academic_member:false};
 const calls:Array<{sql:string;params?:any[]}>=[];const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'consent',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')?[{document_path:params?.[0]}]:[]};},release(){}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'consent','ci',false,false,'consent');
 const scope={uid:'student',adminClaim:false,demandAction:'SUBMIT_CONSENT',requestId:'consent-001',opportunityId:'opp-1'};
 await assert.rejects(()=>store.begin({...scope,opportunityId:'../foreign'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['student','SUBMIT_CONSENT','consent-001','opp-1']);
 await store.commit(t,[{name:'opportunities/opp-1',data:{id:'opp-1'}},{name:'campaigns/camp-1',data:{id:'camp-1'}}]);
 assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,2);
 rights.institution_member=true;await assert.rejects(()=>store.begin(scope),/unavailable/);
});

test('assessment writer binds opportunity and rejects combined privileges',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:false,institution_member:false,consent_member:false,assessment_member:true,offer_member:false,joining_member:false,verification_member:false,academic_member:false};
 const calls:Array<{sql:string;params?:any[]}>=[];const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'assessment',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')?[{document_path:params?.[0]}]:[]};},release(){}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'assessment','ci',false,false,'assessment');
 const scope={uid:'student',adminClaim:false,demandAction:'ADVANCE_CANDIDATE_STAGE',requestId:'assessment-001',opportunityId:'opp-1'};
 await assert.rejects(()=>store.begin({...scope,opportunityId:'other/path'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['student','ADVANCE_CANDIDATE_STAGE','assessment-001','opp-1']);
 await store.commit(t,[{name:'opportunities/opp-1',data:{id:'opp-1'}},{name:'campaigns/camp-1',data:{id:'camp-1'}},{name:'assessmentSubmissions/assess-1',data:{id:'assess-1'}}]);
 assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,2);
 assert.equal(calls.filter(c=>c.sql.startsWith('INSERT')&&!c.sql.includes('ON CONFLICT')).length,1);
 rights.consent_member=true;await assert.rejects(()=>store.begin(scope),/unavailable/);
});

test('offer writer binds stage and actor and uses exact updates for acceptance',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:false,institution_member:false,consent_member:false,assessment_member:false,offer_member:true,joining_member:false,verification_member:false,academic_member:false};
 const calls:Array<{sql:string;params?:any[]}>=[];const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'offer',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')?[{document_path:params?.[0]}]:[]};},release(){}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'offer','ci',false,false,'offer');
 const scope={uid:'student',adminClaim:false,demandAction:'ADVANCE_CANDIDATE_STAGE',requestId:'offer-001',opportunityId:'opp-1',nextStage:'accepted'};
 await assert.rejects(()=>store.begin({...scope,nextStage:'joined'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['student','accepted','offer-001','opp-1']);
 await store.commit(t,[{name:'opportunities/opp-1',data:{id:'opp-1'}},{name:'campaigns/camp-1',data:{id:'camp-1'}},{name:'offers/offer-1',data:{id:'offer-1'}}]);
 assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,3);
 rights.assessment_member=true;await assert.rejects(()=>store.begin(scope),/unavailable/);
});

test('joining writer binds opportunity and issues exact updates and insert-only fee',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:false,institution_member:false,consent_member:false,assessment_member:false,offer_member:false,joining_member:true,verification_member:false,academic_member:false};
 const calls:Array<{sql:string;params?:any[]}>=[];const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'joining',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')?[{document_path:params?.[0]}]:[]};},release(){}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'joining','ci',false,false,'joining');
 const scope={uid:'employer',adminClaim:false,demandAction:'ADVANCE_CANDIDATE_STAGE',requestId:'joining-001',opportunityId:'opp-1',nextStage:'joined'};
 await assert.rejects(()=>store.begin({...scope,nextStage:'offered'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['employer','joined','joining-001','opp-1']);
 await store.commit(t,['opportunities/opp-1','campaigns/camp-1','offers/offer-1','students/student-1','successFees/fee-1'].map(name=>({name,data:{}})));
 assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,4);
 assert.equal(calls.filter(c=>c.sql.startsWith('INSERT')&&!c.sql.includes('ON CONFLICT')).length,1);
 rights.offer_member=true;await assert.rejects(()=>store.begin(scope),/unavailable/);
});

test('verification store binds target and trusted admin claim without upsert',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:false,institution_member:false,consent_member:false,assessment_member:false,offer_member:false,joining_member:false,verification_member:true,academic_member:false};
 const calls:Array<{sql:string;params?:any[]}>=[];const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'verification',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')?[{document_path:params?.[0]}]:[]};},release(){}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'verification','ci',false,false,'verification');
 const scope={uid:'admin',adminClaim:true,demandAction:'UPDATE_EMPLOYER_VERIFICATION',requestId:'verify-001',targetId:'employer'};
 await assert.rejects(()=>store.begin({...scope,targetId:'bad/path'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['admin','UPDATE_EMPLOYER_VERIFICATION','verify-001','employer','true']);
 await store.commit(t,[{name:'employers/employer',data:{id:'employer'}},{name:'auditEvents/audit',data:{}}]);
 assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,1);
 assert.equal(calls.filter(c=>c.sql.startsWith('INSERT')&&!c.sql.includes('ON CONFLICT')).length,1);
});

test('academic writer binds exact student and correction context and updates existing records',async()=>{
 const rights={can_read:true,can_insert:true,can_update:true,can_delete:false,resolver_member:false,writer_member:false,reader_member:false,registrar_member:false,demand_member:false,institution_member:false,consent_member:false,assessment_member:false,offer_member:false,joining_member:false,verification_member:false,academic_member:true};
 const calls:Array<{sql:string;params?:any[]}>=[];const client={async query(sql:string,params?:any[]){calls.push({sql,params});return {rows:sql.startsWith('SELECT current_user')?[{role:'academic',db:'ci',restricted:true,safe_table:true}]:sql.startsWith('SELECT has_table_privilege')?[rights]:sql.startsWith('UPDATE')?[{document_path:params?.[0]}]:[]};},release(){}};
 const store=createPostgresRecordStore({connect:async()=>client,end:async()=>{}},'academic','ci',false,false,'academic');
 const scope={uid:'inst',adminClaim:false,demandAction:'REVIEW_ACADEMIC_CORRECTION',requestId:'academic-001',targetId:'student',correctionId:'correction'};
 await assert.rejects(()=>store.begin({...scope,correctionId:'bad/path'}),/unavailable/);
 const t=await store.begin(scope);assert.deepEqual(calls.at(-1)?.params,['inst','REVIEW_ACADEMIC_CORRECTION','academic-001','student','false','correction']);
 await store.commit(t,[{name:'academicCorrections/correction',data:{}},{name:'students/student',data:{}},{name:'auditEvents/audit',data:{}}]);
 assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,2);
 assert.equal(calls.filter(c=>c.sql.startsWith('INSERT')&&!c.sql.includes('ON CONFLICT')).length,1);
});

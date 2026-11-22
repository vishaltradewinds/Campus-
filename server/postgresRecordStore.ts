import { matchesWorkspaceQuery, type WorkspaceQuery } from './workspaceScope';
import pg from 'pg';

const roots=new Set(['users','employers','institutions','students','academicCorrections','careerEvidence','assessmentSubmissions','offers','candidateProfiles','auditEvents','requirements','campaigns','calls','opportunities','commercialAccounts','subscriptions','campaignCharges','successFees','invoices','billingEvents','system']);
export function postgresDocumentPath(collection:string,id:string){
 if(!roots.has(collection)||typeof id!=='string'||!id||id.length>200||id.includes('/')||id==='.'||id==='..'||id.includes('\0'))throw new Error('Invalid document identifier');
 return collection+'/'+id;
}
export class PostgresUnavailable extends Error {constructor(){super('PostgreSQL transactional store unavailable');}}
type Row={ [key:string]:any };
type Client={query:(sql:string,params?:any[])=>Promise<{rows:Row[]}>;release:(destroy?:boolean)=>void};
type Pool={connect:()=>Promise<Client>;end:()=>Promise<void>};
export type PostgresTransaction={client:Client;closed:boolean;readOnly?:boolean;insertOnly?:boolean;demandAction?:string};
type Write={name:string;data:Record<string,unknown>};
function validRootPath(path:string){const [col,id,...extra]=path.split('/');if(extra.length||postgresDocumentPath(col,id)!==path)throw new Error('Invalid document identifier');}
export function createPostgresRecordStore(pool:Pool,expectedRole:string,expectedDb:string,readOnly=false,insertOnly=false,demand:boolean|'institution'|'consent'|'assessment'|'offer'|'joining'|'verification'|'academic'|'evidence'|'disclosure'|'profile'=false){
 const finish=async(tx:PostgresTransaction,commit:boolean)=>{
  if(tx.closed)return;
  tx.closed=true;
  let healthy=false;
  try{await tx.client.query(commit?'COMMIT':'ROLLBACK');healthy=true;}
  catch{throw new PostgresUnavailable();}
  finally{tx.client.release(!healthy);}
 };
 return {
  async begin(scope?:{uid:string;adminClaim:boolean;registrationRole?:string;registrationEmail?:string;demandAction?:string;requestId?:string;callId?:string;opportunityId?:string;nextStage?:string;targetId?:string;correctionId?:string;evidenceId?:string;campaignId?:string;studentId?:string;submissionId?:string}):Promise<PostgresTransaction>{
   let client:Client|undefined;
   try{
    client=await pool.connect();
    if((readOnly||insertOnly||demand)&&(!scope||typeof scope.uid!=='string'||!scope.uid||scope.uid.length>200||scope.uid.includes('/')||scope.uid.includes(String.fromCharCode(0))))throw new Error('Missing scoped actor');
    await client.query((readOnly||(demand==='disclosure'&&scope?.demandAction==='READ_ASSESSMENT'))?'BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY':'BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query("SET LOCAL statement_timeout='10s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
    const state=await client.query("SELECT current_user AS role,current_database() AS db, NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb) AS restricted, c.relrowsecurity AND c.relforcerowsecurity AND NOT pg_has_role(current_user,c.relowner,'MEMBER') AS safe_table FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname=current_user AND c.oid='nexustalent.records'::regclass");
    const s=state.rows[0];
    if(s?.role!==expectedRole||s?.db!==expectedDb||s?.restricted!==true||s?.safe_table!==true)throw new Error('Unsafe database runtime identity');
    if(readOnly){
     const rights=await client.query("SELECT has_table_privilege(current_user,'nexustalent.records','SELECT') AS can_read, has_table_privilege(current_user,'nexustalent.records','INSERT,UPDATE,DELETE,TRUNCATE') AS can_write, pg_has_role(current_user,'nexustalent_scope_resolver','MEMBER') AS resolver_member, pg_has_role(current_user,'nexustalent_api','MEMBER') AS writer_member, pg_has_role(current_user,'nexustalent_reader','MEMBER') AS reader_member");
     const r=rights.rows[0];if(r?.can_read!==true||r?.can_write!==false||r?.resolver_member!==false||r?.writer_member!==false||r?.reader_member!==true)throw new Error('Unsafe scoped reader');
     await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.admin_claim',$2,true)",[scope!.uid,scope!.adminClaim===true?'true':'false']);
    }
    if(insertOnly){
     if(!scope||!['student','institution','employer'].includes(scope.registrationRole||'')||!scope.registrationEmail||scope.registrationEmail.length>320||!scope.registrationEmail.includes('@'))throw new Error('Missing registration scope');
     const rights=await client.query("SELECT has_table_privilege(current_user,'nexustalent.records','SELECT') AS can_read, has_table_privilege(current_user,'nexustalent.records','INSERT') AS can_insert, has_table_privilege(current_user,'nexustalent.records','UPDATE,DELETE,TRUNCATE') AS can_modify, pg_has_role(current_user,'nexustalent_scope_resolver','MEMBER') AS resolver_member, pg_has_role(current_user,'nexustalent_api','MEMBER') AS writer_member, pg_has_role(current_user,'nexustalent_reader','MEMBER') AS reader_member, pg_has_role(current_user,'nexustalent_registrar','MEMBER') AS registrar_member");
     const r=rights.rows[0];if(r?.can_read!==true||r?.can_insert!==true||r?.can_modify!==false||r?.resolver_member!==false||r?.writer_member!==false||r?.reader_member!==false||r?.registrar_member!==true)throw new Error('Unsafe registration role');
     await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.registration_role',$2,true),set_config('nexustalent.registration_email',$3,true)",[scope.uid,scope.registrationRole,scope.registrationEmail]);
    }
    if(demand){
     const inst=demand==='institution',consent=demand==='consent',assessment=demand==='assessment',offer=demand==='offer',joining=demand==='joining',verification=demand==='verification',academic=demand==='academic',evidence=demand==='evidence',disclosure=demand==='disclosure',profile=demand==='profile';
     if(!scope||!(profile?['UPDATE_GLOBAL_PRIVACY','PUBLISH_INSTITUTION_AVAILABILITY','UPDATE_STUDENT_AVAILABILITY','ADD_VERIFIED_SKILL','REGISTER_INDEPENDENT_CANDIDATE','PROVISION_USER_ROLE']:disclosure?['PROVISION_PROJECTION','READ_ASSESSMENT']:evidence?['CAREER_EVIDENCE_SUBMITTED','REVIEW_CAREER_EVIDENCE','DISPUTE_CAREER_EVIDENCE','RESOLVE_CAREER_EVIDENCE_DISPUTE']:academic?['REQUEST_ACADEMIC_CORRECTION','REVIEW_ACADEMIC_CORRECTION']:verification?['UPDATE_EMPLOYER_VERIFICATION','UPDATE_INSTITUTION_EMPANELMENT','UPDATE_STUDENT_INSTITUTION_VERIFICATION','UPDATE_STUDENT_PLATFORM_VERIFICATION']:(assessment||offer||joining)?['ADVANCE_CANDIDATE_STAGE']:consent?['GLOBAL_CONSENT','UPDATE_CONSENT_SCOPE','SUBMIT_CONSENT']:inst?['RESPOND_CALL','ACTIVATE_STUDENTS']:['CREATE_REQUIREMENT_CAMPAIGN','SEND_CALLS']).includes(scope.demandAction||'')||!scope.requestId||!/^[A-Za-z0-9._:-]{8,128}$/.test(scope.requestId))throw new Error('Missing demand scope');
     if(profile)postgresDocumentPath('users',scope.targetId!);
     if(disclosure){if(scope.demandAction==='READ_ASSESSMENT')postgresDocumentPath('assessmentSubmissions',scope.submissionId!);else{postgresDocumentPath('campaigns',scope.campaignId!);postgresDocumentPath('students',scope.studentId!);}}
     if(evidence)postgresDocumentPath('careerEvidence',scope.evidenceId!);
     if(verification||academic)postgresDocumentPath('students',scope.targetId!);
     if(academic&&scope.demandAction==='REVIEW_ACADEMIC_CORRECTION')postgresDocumentPath('academicCorrections',scope.correctionId!);
     if(inst&&(!scope.callId||scope.callId.length>200||scope.callId.includes('/')||scope.callId.includes(String.fromCharCode(0))||scope.callId==='.'||scope.callId==='..'))throw new Error('Missing call scope');
     if(offer&&!['shortlisted','interviewing','offered','accepted'].includes(scope.nextStage||''))throw new Error('Invalid offer stage');
     if(joining&&scope.nextStage!=='joined')throw new Error('Invalid joining stage');
     if(joining||offer||assessment||(consent&&scope.demandAction==='SUBMIT_CONSENT'))postgresDocumentPath('opportunities',scope.opportunityId!);
     const rights=await client.query("SELECT has_table_privilege(current_user,'nexustalent.records','SELECT') AS can_read, has_table_privilege(current_user,'nexustalent.records','INSERT') AS can_insert, has_table_privilege(current_user,'nexustalent.records','UPDATE') AS can_update, has_table_privilege(current_user,'nexustalent.records','DELETE,TRUNCATE') AS can_delete, pg_has_role(current_user,'nexustalent_scope_resolver','MEMBER') AS resolver_member, pg_has_role(current_user,'nexustalent_api','MEMBER') AS writer_member, pg_has_role(current_user,'nexustalent_reader','MEMBER') AS reader_member, pg_has_role(current_user,'nexustalent_registrar','MEMBER') AS registrar_member, pg_has_role(current_user,'nexustalent_demand_writer','MEMBER') AS demand_member, pg_has_role(current_user,'nexustalent_institution_writer','MEMBER') AS institution_member, pg_has_role(current_user,'nexustalent_consent_writer','MEMBER') AS consent_member, pg_has_role(current_user,'nexustalent_assessment_writer','MEMBER') AS assessment_member, pg_has_role(current_user,'nexustalent_offer_writer','MEMBER') AS offer_member, pg_has_role(current_user,'nexustalent_joining_writer','MEMBER') AS joining_member, pg_has_role(current_user,'nexustalent_verification_writer','MEMBER') AS verification_member, pg_has_role(current_user,'nexustalent_academic_writer','MEMBER') AS academic_member, pg_has_role(current_user,'nexustalent_evidence_writer','MEMBER') AS evidence_member, pg_has_role(current_user,'nexustalent_disclosure_writer','MEMBER') AS disclosure_member, pg_has_role(current_user,'nexustalent_disclosure_resolver','MEMBER') AS disclosure_resolver_member, pg_has_role(current_user,'nexustalent_profile_writer','MEMBER') AS profile_member");
     const r=rights.rows[0];
     const memberships={demand_member:demand===true,institution_member:inst,consent_member:consent,assessment_member:assessment,offer_member:offer,joining_member:joining,verification_member:verification,academic_member:academic,evidence_member:evidence,disclosure_member:disclosure,disclosure_resolver_member:false,profile_member:profile};
     if(r?.can_read!==true||r?.can_insert!==true||r?.can_update!==true||r?.can_delete!==false||r?.resolver_member!==false||r?.writer_member!==false||r?.reader_member!==false||r?.registrar_member!==false||Object.entries(memberships).some(([key,value])=>r?.[key]!==value))throw new Error('Unsafe scoped writer');
     if(profile)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.profile_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.target_id',$4,true),set_config('nexustalent.admin_claim',$5,true)",[scope.uid,scope.demandAction,scope.requestId,scope.targetId,scope.adminClaim===true?'true':'false']);
     else if(disclosure)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.disclosure_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.disclosure_campaign',$4,true),set_config('nexustalent.disclosure_student',$5,true),set_config('nexustalent.disclosure_submission',$6,true)",[scope.uid,scope.demandAction,scope.requestId,scope.campaignId||'',scope.studentId||'',scope.submissionId||'']);
     else if(evidence)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.evidence_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.evidence_id',$4,true),set_config('nexustalent.admin_claim',$5,true)",[scope.uid,scope.demandAction,scope.requestId,scope.evidenceId,scope.adminClaim===true?'true':'false']);
     else if(academic)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.academic_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.target_id',$4,true),set_config('nexustalent.admin_claim',$5,true),set_config('nexustalent.correction_id',$6,true)",[scope.uid,scope.demandAction,scope.requestId,scope.targetId,scope.adminClaim===true?'true':'false',scope.correctionId||'']);
     else if(verification)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.verification_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.target_id',$4,true),set_config('nexustalent.admin_claim',$5,true)",[scope.uid,scope.demandAction,scope.requestId,scope.targetId,scope.adminClaim===true?'true':'false']);
     else if(joining)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.joining_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.opportunity_id',$4,true)",[scope.uid,'joined',scope.requestId,scope.opportunityId]);
     else if(offer)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.offer_stage',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.opportunity_id',$4,true)",[scope.uid,scope.nextStage,scope.requestId,scope.opportunityId]);
     else if(assessment)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.assessment_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.opportunity_id',$4,true)",[scope.uid,scope.demandAction,scope.requestId,scope.opportunityId]);
     else if(consent)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.consent_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.opportunity_id',$4,true)",[scope.uid,scope.demandAction,scope.requestId,scope.opportunityId||'']);
     else if(inst)await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.institution_action',$2,true),set_config('nexustalent.request_id',$3,true),set_config('nexustalent.call_id',$4,true)",[scope.uid,scope.demandAction,scope.requestId,scope.callId]);
     else await client.query("SELECT set_config('nexustalent.actor_uid',$1,true),set_config('nexustalent.demand_action',$2,true),set_config('nexustalent.request_id',$3,true)",[scope.uid,scope.demandAction,scope.requestId]);
    }
    return {client,closed:false,readOnly:readOnly||(demand==='disclosure'&&scope?.demandAction==='READ_ASSESSMENT'),insertOnly,demandAction:demand==='joining'?'JOINING':demand==='offer'?'OFFER_'+scope!.nextStage:demand?scope!.demandAction:undefined};
   }catch{if(client){try{await client.query('ROLLBACK');}catch{}client.release(true);}throw new PostgresUnavailable();}
  },
  async read(tx:PostgresTransaction,path:string):Promise<Row|null>{
   validRootPath(path);
   if(tx.closed)throw new PostgresUnavailable();
   try{
    const r=await tx.client.query('SELECT payload FROM nexustalent.records WHERE document_path=$1',[path]);
    const data=r.rows[0]?.payload;
    if(!r.rows.length)return null;
    if(r.rows.length!==1||!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid stored record');
    return data;
   }catch{throw new PostgresUnavailable();}
  },
  async listWorkspaceRecords(tx:PostgresTransaction,q:WorkspaceQuery){
   if(tx.closed)throw new PostgresUnavailable();
   try{
    const args:any[]=[q.collection];
    let sql="SELECT document_path,payload FROM nexustalent.records WHERE collection=$1 AND document_path NOT LIKE '%/%/%'";
    if(q.filter){args.push(q.filter.field,JSON.stringify(q.filter.op==='contains'?[q.filter.value]:q.filter.value));sql+=q.filter.op==='contains'?' AND (payload->$2::text) @> $3::jsonb':' AND (payload->$2::text) = $3::jsonb';}
    args.push(q.limit+1);sql+=' ORDER BY document_path LIMIT $'+args.length;
    const r=await tx.client.query(sql,args);
    return r.rows.map(row=>{
     const data=row.payload;const id=q.collection==='users'?data?.uid:data?.id;
     if(typeof id!=='string'||postgresDocumentPath(q.collection,id)!==row.document_path||!matchesWorkspaceQuery(q,data))throw new Error('Invalid workspace record');
     return data;
    });
   }catch{throw new PostgresUnavailable();}
  },
  async commit(tx:PostgresTransaction,writes:Write[]){
   if(tx.closed||tx.readOnly)throw new PostgresUnavailable();
   try{
    // Serialized transactions preserve read-before-write authorization and idempotency.
    // Audit inserts never update existing audit events, even on conflict.
    for(const w of writes){validRootPath(w.name);if(!w.data||typeof w.data!=='object'||Array.isArray(w.data))throw new Error('Invalid payload');
     if((['UPDATE_GLOBAL_PRIVACY','UPDATE_STUDENT_AVAILABILITY','ADD_VERIFIED_SKILL'].includes(tx.demandAction||'')&&w.name.startsWith('students/'))||(tx.demandAction==='PUBLISH_INSTITUTION_AVAILABILITY'&&w.name.startsWith('institutions/'))||(tx.demandAction==='PROVISION_USER_ROLE'&&w.name.startsWith('users/'))||(['REVIEW_CAREER_EVIDENCE','DISPUTE_CAREER_EVIDENCE','RESOLVE_CAREER_EVIDENCE_DISPUTE'].includes(tx.demandAction||'')&&(w.name.startsWith('careerEvidence/')||w.name.startsWith('students/')))||(['REQUEST_ACADEMIC_CORRECTION','REVIEW_ACADEMIC_CORRECTION'].includes(tx.demandAction||'')&&w.name.startsWith('students/'))||(tx.demandAction==='REVIEW_ACADEMIC_CORRECTION'&&w.name.startsWith('academicCorrections/'))||(['UPDATE_EMPLOYER_VERIFICATION','UPDATE_INSTITUTION_EMPANELMENT','UPDATE_STUDENT_INSTITUTION_VERIFICATION','UPDATE_STUDENT_PLATFORM_VERIFICATION'].includes(tx.demandAction||'')&&['employers/','institutions/','students/'].some(prefix=>w.name.startsWith(prefix)))||(tx.demandAction==='JOINING'&&['opportunities/','campaigns/','offers/','students/'].some(prefix=>w.name.startsWith(prefix)))||(tx.demandAction?.startsWith('OFFER_')&&(w.name.startsWith('opportunities/')||w.name.startsWith('campaigns/')||(tx.demandAction==='OFFER_accepted'&&w.name.startsWith('offers/'))))||(tx.demandAction==='ADVANCE_CANDIDATE_STAGE'&&(w.name.startsWith('opportunities/')||w.name.startsWith('campaigns/')))||(['GLOBAL_CONSENT','UPDATE_CONSENT_SCOPE'].includes(tx.demandAction||'')&&w.name.startsWith('students/'))||(tx.demandAction==='SUBMIT_CONSENT'&&(w.name.startsWith('opportunities/')||w.name.startsWith('campaigns/')))||(tx.demandAction==='SEND_CALLS'&&w.name.startsWith('campaigns/'))||(['RESPOND_CALL','ACTIVATE_STUDENTS'].includes(tx.demandAction||'')&&(w.name.startsWith('campaigns/')||w.name.startsWith('calls/')))){
      const updated=await tx.client.query('UPDATE nexustalent.records SET payload=$2::jsonb WHERE document_path=$1 RETURNING document_path',[w.name,JSON.stringify(w.data)]);
      if(updated.rows.length!==1||updated.rows[0].document_path!==w.name)throw new Error('Demand update denied');
      continue;
     }
     if(tx.demandAction==='PROVISION_PROJECTION'&&w.name.startsWith('candidateProfiles/')){
      await tx.client.query('INSERT INTO nexustalent.records(document_path,payload) VALUES($1,$2::jsonb) ON CONFLICT(document_path) DO UPDATE SET payload=EXCLUDED.payload',[w.name,JSON.stringify(w.data)]);continue;
     }
     const sql=tx.demandAction||tx.insertOnly||w.name.startsWith('auditEvents/')?'INSERT INTO nexustalent.records(document_path,payload) VALUES($1,$2::jsonb)':'INSERT INTO nexustalent.records(document_path,payload) VALUES($1,$2::jsonb) ON CONFLICT(document_path) DO UPDATE SET payload=EXCLUDED.payload';
     await tx.client.query(sql,[w.name,JSON.stringify(w.data)]);
    }
    await finish(tx,true);
   }catch{try{await finish(tx,false);}catch{}throw new PostgresUnavailable();}
  },
  async rollback(tx:PostgresTransaction){try{await finish(tx,false);}catch{}},
  async close(){await pool.end();}
 };
}
// Only a disposable PostgreSQL test database is selectable in this batch.
// Production cannot switch while any browser still uses Firestore.
export function gatedPostgresStore(env:NodeJS.ProcessEnv=process.env,readOnly=false,insertOnly=false,demand:boolean|'institution'|'consent'|'assessment'|'offer'|'joining'|'verification'|'academic'|'evidence'|'disclosure'|'profile'=false){
 if(!postgresIntegrationEnabled(env))return null;
 const raw=demand==='profile'?env.NEXUSTALENT_TEST_PROFILE_URL:demand==='disclosure'?env.NEXUSTALENT_TEST_DISCLOSURE_URL:demand==='evidence'?env.NEXUSTALENT_TEST_EVIDENCE_URL:demand==='academic'?env.NEXUSTALENT_TEST_ACADEMIC_URL:demand==='verification'?env.NEXUSTALENT_TEST_VERIFICATION_URL:demand==='joining'?env.NEXUSTALENT_TEST_JOINING_URL:demand==='offer'?env.NEXUSTALENT_TEST_OFFER_URL:demand==='assessment'?env.NEXUSTALENT_TEST_ASSESSMENT_URL:demand==='consent'?env.NEXUSTALENT_TEST_CONSENT_URL:demand==='institution'?env.NEXUSTALENT_TEST_INSTITUTION_URL:demand?env.NEXUSTALENT_TEST_DEMAND_URL:insertOnly?env.NEXUSTALENT_TEST_REGISTRAR_URL:readOnly?env.NEXUSTALENT_TEST_READER_URL:env.NEXUSTALENT_TEST_DATABASE_URL;
 if(!raw)throw new Error('Scoped PostgreSQL reader is required');
 const expectedRole=demand==='profile'?'nexustalent_profile_ci':demand==='disclosure'?'nexustalent_disclosure_ci':demand==='evidence'?'nexustalent_evidence_ci':demand==='academic'?'nexustalent_academic_ci':demand==='verification'?'nexustalent_verification_ci':demand==='joining'?'nexustalent_joining_ci':demand==='offer'?'nexustalent_offer_ci':demand==='assessment'?'nexustalent_assessment_ci':demand==='consent'?'nexustalent_consent_ci':demand==='institution'?'nexustalent_institution_ci':demand?'nexustalent_demand_ci':insertOnly?'nexustalent_registrar_ci':readOnly?'nexustalent_reader_ci':'nexustalent_runtime_ci';
 const target=new URL(raw);
 if(target.protocol!=='postgresql:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/nexustalent_ci'||target.username!==expectedRole||target.search||target.hash)throw new Error('Unsafe PostgreSQL integration target');
 const pool=new pg.Pool({connectionString:target.toString(),max:3,idleTimeoutMillis:1000,connectionTimeoutMillis:5000});
 pool.on('error',()=>{/* Pool releases failed idle clients; never log credential data. */});
 return createPostgresRecordStore(pool,expectedRole,'nexustalent_ci',readOnly,insertOnly,demand);
}
/** Selection is independent of the disposable fixture-writer credential. */
export function postgresIntegrationEnabled(env:NodeJS.ProcessEnv=process.env):boolean{
 const mode=env.NEXUSTALENT_DATASTORE;
 if(!mode||mode==='firestore')return false;
 if(mode!=='postgres'||env.NODE_ENV!=='test'||env.NEXUSTALENT_PG_INTEGRATION!=='1')throw new Error('PostgreSQL cutover is not enabled');
 return true;
}
/** Function-only login: no raw record-table privileges. */
export function createPostgresDirectory(pool:Pool,expectedRole:string,expectedDb:string){
 return {
  async list(){
   let client:Client|undefined,healthy=false;
   try{
    client=await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY');
    await client.query("SET LOCAL statement_timeout='10s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
    const check=await client.query("SELECT current_user AS role,current_database() AS db,NOT(r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb) AS restricted,c.relrowsecurity AND c.relforcerowsecurity AND NOT pg_has_role(current_user,c.relowner,'MEMBER') AS safe_table,has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS table_access,has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS column_access,pg_has_role(current_user,'nexustalent_directory_reader','MEMBER') AS member,pg_has_role(current_user,'nexustalent_directory_resolver','MEMBER') AS resolver,has_function_privilege(current_user,'nexustalent.registration_directory()','EXECUTE') AS can_execute FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname=current_user AND c.oid='nexustalent.records'::regclass");
    const s=check.rows[0];
    if(s?.role!==expectedRole||s?.db!==expectedDb||s?.restricted!==true||s?.safe_table!==true||s?.table_access!==false||s?.column_access!==false||s?.member!==true||s?.resolver!==false||s?.can_execute!==true)throw new Error('Unsafe directory runtime identity');
    const result=await client.query('SELECT id,name,code FROM nexustalent.registration_directory() ORDER BY id');
    if(result.rows.length>100||new Set(result.rows.map(row=>row.id)).size!==result.rows.length)throw new Error('Directory exceeds validated limit');
    const rows=result.rows.map(row=>{
     if(typeof row.id!=='string'||typeof row.name!=='string'||typeof row.code!=='string')throw new Error('Invalid directory record');
     postgresDocumentPath('institutions',row.id);
     return {id:row.id,name:row.name,code:row.code};
    });
    await client.query('COMMIT');healthy=true;return rows;
   }catch{if(client){try{await client.query('ROLLBACK');}catch{}}throw new PostgresUnavailable();}
   finally{client?.release(!healthy);}
  },
  async close(){await pool.end();}
 };
}
export function gatedPostgresDirectory(env:NodeJS.ProcessEnv=process.env){
 if(!postgresIntegrationEnabled(env))return null;
 if(!env.NEXUSTALENT_TEST_DIRECTORY_URL)throw new Error('Scoped PostgreSQL directory is required');
 const target=new URL(env.NEXUSTALENT_TEST_DIRECTORY_URL);
 if(target.protocol!=='postgresql:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/nexustalent_ci'||target.username!=='nexustalent_directory_ci'||target.search||target.hash)throw new Error('Unsafe PostgreSQL directory target');
 const pool=new pg.Pool({connectionString:target.toString(),max:1,idleTimeoutMillis:1000,connectionTimeoutMillis:5000});
 pool.on('error',()=>{});
 return createPostgresDirectory(pool,'nexustalent_directory_ci','nexustalent_ci');
}

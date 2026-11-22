import { matchesWorkspaceQuery, workspaceCollections, workspaceQueries, WorkspaceDenied, type WorkspaceQuery } from './workspaceScope';
import { academicEligibility } from '../src/lib/academicEligibility';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getDatastoreAccessToken } from './workloadIdentity';
import { gatedPostgresStore, gatedPostgresDirectory, postgresIntegrationEnabled, postgresDocumentPath, type PostgresTransaction } from './postgresRecordStore';
const postgresMode = postgresIntegrationEnabled();
const postgresDirectory = postgresMode ? gatedPostgresDirectory() : null;
const postgresReader = postgresMode ? gatedPostgresStore(process.env,true) : null;
const postgresRegistrar = postgresMode ? gatedPostgresStore(process.env,false,true) : null;
const postgresDemand = postgresMode ? gatedPostgresStore(process.env,false,false,true) : null;
const postgresInstitution = postgresMode ? gatedPostgresStore(process.env,false,false,'institution') : null;
const postgresConsent = postgresMode ? gatedPostgresStore(process.env,false,false,'consent') : null;
const postgresAssessment = postgresMode ? gatedPostgresStore(process.env,false,false,'assessment') : null;
const postgresOffer = postgresMode ? gatedPostgresStore(process.env,false,false,'offer') : null;
const postgresJoining = postgresMode ? gatedPostgresStore(process.env,false,false,'joining') : null;
const postgresVerification = postgresMode ? gatedPostgresStore(process.env,false,false,'verification') : null;
const postgresAcademic = postgresMode ? gatedPostgresStore(process.env,false,false,'academic') : null;
const postgresEvidence = postgresMode ? gatedPostgresStore(process.env,false,false,'evidence') : null;
const postgresDisclosure = postgresMode ? gatedPostgresStore(process.env,false,false,'disclosure') : null;
const postgresProfile = postgresMode ? gatedPostgresStore(process.env,false,false,'profile') : null;
import { quoteSuccessFee } from '../src/lib/commercial';
import { registrationSchema, registrationProfile, RegistrationConflict } from './registration';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const DATABASE = process.env.FIREBASE_DATABASE_ID || '(default)';
const emulatorHost=process.env.FIRESTORE_EMULATOR_HOST;
const emulatorMode=process.env.NEXUSTALENT_EMULATOR_TEST==='1';
if(emulatorMode && (process.env.NODE_ENV==='production' || PROJECT_ID!=='demo-nexustalent-acceptance' || DATABASE!=='(default)' || emulatorHost!=='127.0.0.1:8080')) throw new Error('Unsafe Firestore emulator configuration');
const BASE = PROJECT_ID ? `${emulatorMode?'http://127.0.0.1:8080':'https://firestore.googleapis.com'}/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE)}/documents` : '';
const firebaseIdTokenContext = new AsyncLocalStorage<string>();

type FirebaseTokenContext = { token: string; uid?: string };
const firebaseContext = new AsyncLocalStorage<FirebaseTokenContext>();
type Doc = { name?: string; fields?: Record<string, Value> };
type Value = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: string; timestampValue?: string; arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> } };
const fromValue = (v?: Value): any => !v ? undefined : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : 'nullValue' in v ? null : 'timestampValue' in v ? v.timestampValue : 'arrayValue' in v ? (v.arrayValue?.values || []).map(fromValue) : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue?.fields || {}).map(([k,x]) => [k,fromValue(x)])) : undefined;
const fromDoc = (d?: Doc | null): Record<string,any> | null => !d ? null : Object.fromEntries(Object.entries(d.fields || {}).map(([k,v]) => [k,fromValue(v)]));
const toValue = (v: any): Value => v == null ? { nullValue:'NULL_VALUE' } : typeof v === 'string' ? {stringValue:v} : typeof v === 'boolean' ? {booleanValue:v} : typeof v === 'number' ? (Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v}) : Array.isArray(v) ? {arrayValue:{values:v.map(toValue)}} : {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,toValue(x)]))}};
const toDoc = (name:string,data:Record<string,unknown>):Doc => ({name:decodeURIComponent(name.split('/v1/')[1] || name),fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,toValue(v)]))});
const nameOf = (collection:string,id:string) => { if(postgresMode)return postgresDocumentPath(collection,id); if(!PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID is required for trusted Firestore operations'); if(typeof id!=='string'||!id||id.length>200||id.includes('/')||id==='.'||id==='..')throw new Error('Invalid document identifier'); return `${BASE}/${collection}/${encodeURIComponent(id)}`; };
// Firebase ID tokens establish the request actor at the HTTP boundary. They must
// never authorize trusted Firestore writes: those collections are server-owned.
// A server-only Google OAuth credential must be provisioned with least privilege.
async function token(){ if(emulatorMode) return 'owner'; return getDatastoreAccessToken(); }
export class DatastoreUnavailable extends Error {
 constructor(){super('Datastore temporarily unavailable');this.name='DatastoreUnavailable';}
}
async function request<T>(url:string,init:RequestInit={}):Promise<T>{
 let r:Response;
 try{
  r=await fetch(url,{...init,signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json',...(init.headers||{})}});
 }catch{throw new DatastoreUnavailable();}
 if(r.status===429||r.status>=500)throw new DatastoreUnavailable();
 if(!r.ok){throw new Error(`Firestore trusted request failed (${r.status})`);}
 return r.status===204?{} as T:await r.json() as T;
}
/** One explicitly requested read using the SAME server identity as recruitment transactions.
 * This does not certify write authorization, deployment readiness or billing.
 * Return no document content and never fall back to a caller's Firebase token.
 */
export async function checkTrustedRecruitmentRead(actorUid:string):Promise<boolean>{
 try{
  if(postgresMode){const tx=await beginScopedRead(actorUid,false);try{const actor=await readTx(nameOf('users',actorUid),tx);return actor?.uid===actorUid&&['student','institution','employer','super_admin'].includes(actor.role);}finally{await rollback(tx);}}
  const url=nameOf('users',actorUid);
  const doc=await request<Doc>(url+'?mask.fieldPaths=uid&mask.fieldPaths=role',{method:'GET'});
  const actor=fromDoc(doc);
  return doc.name===decodeURIComponent(url.split('/v1/')[1])&&actor?.uid===actorUid&&['student','institution','employer','super_admin'].includes(actor.role);
 }catch{return false;}
}
type StoreTransaction = string | PostgresTransaction;
async function begin():Promise<StoreTransaction>{if(postgresMode)throw new DatastoreUnavailable();const r=await request<{transaction?:string}>(`${BASE}:beginTransaction`,{method:'POST',body:JSON.stringify({options:{readWrite:{}}})});if(!r.transaction)throw new Error('Firestore transaction was not created');return r.transaction;}
async function readTx(n:string,t:StoreTransaction){
 if(postgresMode){if(typeof t==='string')throw new DatastoreUnavailable();try{return await postgresReader!.read(t,n);}catch{throw new DatastoreUnavailable();}}
 const document=decodeURIComponent(n.split('/v1/')[1] || n);
 const results=await request<Array<{found?:Doc;missing?:string}>>(`${BASE}:batchGet`,{method:'POST',body:JSON.stringify({documents:[document],transaction:t})});
 if(!Array.isArray(results)||results.length!==1)throw new Error('Unexpected Firestore transactional read response');
 const row=results[0];
 if(row.found?.name===document)return fromDoc(row.found);
 if(row.missing===document)return null;
 throw new Error('Firestore transaction did not return the requested document');
}
async function commit(t:StoreTransaction,w:Array<{name:string,data:Record<string,unknown>}>){if(postgresMode){if(typeof t==='string')throw new DatastoreUnavailable();try{await postgresReader!.commit(t,w);return;}catch{throw new DatastoreUnavailable();}}await request(`${BASE}:commit`,{method:'POST',body:JSON.stringify({transaction:t,writes:w.map(x=>({update:toDoc(x.name,x.data)}))})});}
async function rollback(t:StoreTransaction){if(postgresMode){if(typeof t!=='string')await postgresReader!.rollback(t);return;}try{await request(`${BASE}:rollback`,{method:'POST',body:JSON.stringify({transaction:t})});}catch{}}
/** The authenticated principal supplies the UID; no arbitrary account lookup.
 * Missing accounts are distinct from invalid records or datastore failures.
 */
export async function readOwnAccount(actorUid:string){
 const t=await beginScopedRead(actorUid,false);
 try{
  const record=await readTx(nameOf('users',actorUid),t);
  if(!record)return null;
  if(record.uid!==actorUid||!['student','institution','employer','super_admin','simulation'].includes(record.role)||typeof record.name!=='string'||typeof record.email!=='string')throw new DatastoreUnavailable();
  return {uid:actorUid,role:record.role as string,name:record.name,email:record.email};
 }catch{throw new DatastoreUnavailable();}finally{await rollback(t);}
}
export async function registerOwnStakeholder(actorUid:string,verifiedEmail:string,rawInput:unknown){
 const input=registrationSchema.parse(rawInput);
 if(!verifiedEmail||verifiedEmail.length>320||!verifiedEmail.includes('@'))throw new RegistrationConflict();
 const selected=input.role==='employer'?'employers':input.role==='institution'?'institutions':'students';
 const t=await beginRegistration(actorUid,input.role,verifiedEmail);
 let committed=false;
 try{
  const account=await readTx(nameOf('users',actorUid),t);
  const profiles=new Map<string,Record<string,any>|null>();
  for(const c of ['employers','institutions','students'])profiles.set(c,await readTx(nameOf(c,actorUid),t));
  const existing=profiles.get(selected);
  if(account||Array.from(profiles.values()).some(Boolean)){
   if(account?.uid===actorUid&&account.role===input.role&&account.email===verifiedEmail&&existing?.id===actorUid&&Array.from(profiles.values()).filter(Boolean).length===1)return {replayed:true};
   throw new RegistrationConflict();
  }
  const institution=input.role==='student'&&input.registrationType==='empanelled'?await readTx(nameOf('institutions',input.institutionId),t):null;
  const profile=registrationProfile(actorUid,verifiedEmail,input,institution);
  const now=new Date().toISOString();
  const eventId=createHash('sha256').update('REGISTER_STAKEHOLDER:'+actorUid).digest('hex');
  if(await readTx(nameOf('auditEvents',eventId),t))throw new RegistrationConflict();
  await commit(t,[{name:nameOf('users',actorUid),data:{uid:actorUid,email:verifiedEmail,name:input.name,role:input.role,createdAt:now,updatedAt:now}},{name:nameOf(selected,actorUid),data:profile},{name:nameOf('auditEvents',eventId),data:{eventId,actorUid,actorRole:input.role,action:'REGISTER_STAKEHOLDER',ids:[actorUid],timestamp:now,immutable:true}}]);
  committed=true;
  return {replayed:false};
 }finally{if(!committed)await rollback(t);}
}
/** Fixed-scope registration directory. Caller must be authenticated at the HTTP boundary. */
export async function listRegistrationInstitutions(){
 if(postgresMode){try{if(!postgresDirectory)throw new DatastoreUnavailable();return await postgresDirectory.list();}catch{throw new DatastoreUnavailable();}}
 const t=await begin();
 try{
  const rows=await request<Array<{document?:Doc;readTime?:string}>>(BASE+':runQuery',{method:'POST',body:JSON.stringify({transaction:t,structuredQuery:{from:[{collectionId:'institutions'}],select:{fields:['id','name','code','empanelmentStatus'].map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:'empanelmentStatus'},op:'EQUAL',value:{stringValue:'empanelled'}}},orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:100}})});
  if(!Array.isArray(rows)||rows.length>101)throw new DatastoreUnavailable();
  const result:Array<{id:string;name:string;code:string}>=[];
  for(const row of rows){
   if(!row.document){if(!row.readTime)throw new DatastoreUnavailable();continue;}
   const data=fromDoc(row.document);
   if(!data||typeof data.id!=='string'||row.document.name!==decodeURIComponent(nameOf('institutions',data.id).split('/v1/')[1])||data.empanelmentStatus!=='empanelled'||typeof data.name!=='string'||typeof data.code!=='string')throw new DatastoreUnavailable();
   result.push({id:data.id,name:data.name,code:data.code});
  }
  if(result.length>100||new Set(result.map(r=>r.id)).size!==result.length)throw new DatastoreUnavailable();
  return result;
 }catch{throw new DatastoreUnavailable();}finally{await rollback(t);}
}
async function readWorkspaceRows(t:StoreTransaction,q:WorkspaceQuery){
 if(postgresMode){if(typeof t==='string')throw new DatastoreUnavailable();return await postgresReader!.listWorkspaceRecords(t,q);}
 const where=q.filter?{fieldFilter:{field:{fieldPath:q.filter.field},op:q.filter.op==='contains'?'ARRAY_CONTAINS':'EQUAL',value:{stringValue:q.filter.value}}}:undefined;
 const rows=await request<Array<{document?:Doc;readTime?:string}>>(BASE+':runQuery',{method:'POST',body:JSON.stringify({transaction:t,structuredQuery:{from:[{collectionId:q.collection}],where,orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:q.limit+1}})});
 if(!Array.isArray(rows)||rows.length>q.limit+2)throw new DatastoreUnavailable();
 const result:Record<string,any>[]=[];
 for(const row of rows){
  if(!row.document){if(!row.readTime)throw new DatastoreUnavailable();continue;}
  const data=fromDoc(row.document);const id=q.collection==='users'?data?.uid:data?.id;
  if(!data||typeof id!=='string'||row.document.name!==decodeURIComponent(nameOf(q.collection,id).split('/v1/')[1])||!matchesWorkspaceQuery(q,data))throw new DatastoreUnavailable();
  result.push(data);
 }
 return result;
}
/** Single confirmed transaction; the browser cannot specify a role, collection, ID or filter. */
export async function readStakeholderWorkspace(actorUid:string,adminClaim=false){
 const t=await beginScopedRead(actorUid,adminClaim);
 try{
  const account=await readTx(nameOf('users',actorUid),t);
  if(!account||account.uid!==actorUid)throw new WorkspaceDenied();
  const role=account.role;
  const plan=workspaceQueries(role,actorUid,adminClaim);
  const collections=Object.fromEntries(workspaceCollections.map(c=>[c,[] as Record<string,any>[]]));
  const ownCollection=role==='employer'?'employers':role==='institution'?'institutions':role==='student'?'students':null;
  const profile=ownCollection?await readTx(nameOf(ownCollection,actorUid),t):null;
  if(profile&&profile.id!==actorUid)throw new DatastoreUnavailable();
  if(ownCollection&&!profile)return {uid:actorUid,role,status:'missing',profile:null,collections};
  for(const q of plan){
   const rows=await readWorkspaceRows(t,q);
   if(rows.length>q.limit||new Set(rows.map(r=>q.collection==='users'?r.uid:r.id)).size!==rows.length)throw new DatastoreUnavailable();
   collections[q.collection]=q.collection==='users'?rows.map(r=>({uid:r.uid,role:r.role,name:r.name,email:r.email,createdAt:r.createdAt,updatedAt:r.updatedAt})):rows;
  }
  if(role==='student'&&profile)collections.students=[profile];
  const result={uid:actorUid,role,status:'ready',profile,collections};
  if(Buffer.byteLength(JSON.stringify(result))>2*1024*1024)throw new DatastoreUnavailable();
  return result;
 }catch(error){if(error instanceof WorkspaceDenied)throw error;throw new DatastoreUnavailable();}finally{await rollback(t);}
}
/** Fixed evidence views; only the student or a separately claimed administrator may read these records. */
export async function readCareerEvidenceQueue(actorUid:string,adminClaim=false){
 const t=await beginScopedRead(actorUid,adminClaim);
 try{
  const actor=await readTx(nameOf('users',actorUid),t);
  if(actor?.uid!==actorUid)throw new WorkspaceDenied();
  const queries:WorkspaceQuery[]=actor.role==='student'?[{collection:'careerEvidence',limit:200,filter:{field:'studentId',op:'eq',value:actorUid}}]:actor.role==='super_admin'&&adminClaim?['submitted','under_review'].map(value=>({collection:'careerEvidence',limit:100,filter:{field:'status',op:'eq',value}})):[];
  if(!queries.length)throw new WorkspaceDenied();
  const result:Record<string,any>[]=[];
  for(const q of queries){const records=await readWorkspaceRows(t,q);if(records.length>q.limit)throw new DatastoreUnavailable();result.push(...records);}
  const max=actor.role==='student'?200:100;
  if(result.length>max||new Set(result.map(r=>r.id)).size!==result.length||Buffer.byteLength(JSON.stringify(result))>1024*1024)throw new DatastoreUnavailable();
  return result;
 }catch(error){if(error instanceof WorkspaceDenied)throw error;throw new DatastoreUnavailable();}finally{await rollback(t);}
}
async function beginScopedRead(actorUid:string,adminClaim:boolean):Promise<StoreTransaction>{
 if(!postgresMode)return begin();
 if(!postgresReader)throw new DatastoreUnavailable();
 try{return await postgresReader.begin({uid:actorUid,adminClaim});}catch{throw new DatastoreUnavailable();}
}
async function beginRegistration(uid:string,role:string,email:string):Promise<StoreTransaction>{
 if(!postgresMode)return begin();
 if(!postgresRegistrar)throw new DatastoreUnavailable();
 try{return await postgresRegistrar.begin({uid,adminClaim:false,registrationRole:role,registrationEmail:email});}catch{throw new DatastoreUnavailable();}
}
async function beginRecruitment(input:RecruitmentTransitionRequest):Promise<StoreTransaction>{
 if(!postgresMode)return begin();
 if(input.action==='ADVANCE_CANDIDATE_STAGE'&&input.payload?.nextStage==='joined'){
  if(!postgresJoining)throw new DatastoreUnavailable();
  try{return await postgresJoining.begin({uid:input.actorUid,adminClaim:false,demandAction:input.action,requestId:input.requestId,opportunityId:input.payload?.opportunityId,nextStage:'joined'});}catch{throw new DatastoreUnavailable();}
 }
 if(input.action==='ADVANCE_CANDIDATE_STAGE'&&['shortlisted','interviewing','offered','accepted'].includes(input.payload?.nextStage)){
  if(!postgresOffer)throw new DatastoreUnavailable();
  try{return await postgresOffer.begin({uid:input.actorUid,adminClaim:false,demandAction:input.action,requestId:input.requestId,opportunityId:input.payload?.opportunityId,nextStage:input.payload?.nextStage});}catch{throw new DatastoreUnavailable();}
 }
 if(input.action==='ADVANCE_CANDIDATE_STAGE'&&input.payload?.nextStage==='assessment_completed'){
  if(!postgresAssessment)throw new DatastoreUnavailable();
  try{return await postgresAssessment.begin({uid:input.actorUid,adminClaim:false,demandAction:input.action,requestId:input.requestId,opportunityId:input.payload?.opportunityId});}catch{throw new DatastoreUnavailable();}
 }
 if(['GLOBAL_CONSENT','UPDATE_CONSENT_SCOPE','SUBMIT_CONSENT'].includes(input.action)){
  if(!postgresConsent)throw new DatastoreUnavailable();
  try{return await postgresConsent.begin({uid:input.actorUid,adminClaim:false,demandAction:input.action,requestId:input.requestId,opportunityId:input.action==='SUBMIT_CONSENT'?input.payload?.opportunityId:undefined});}catch{throw new DatastoreUnavailable();}
 }
 if(['RESPOND_CALL','ACTIVATE_STUDENTS'].includes(input.action)){
  if(!postgresInstitution)throw new DatastoreUnavailable();
  try{return await postgresInstitution.begin({uid:input.actorUid,adminClaim:false,demandAction:input.action,requestId:input.requestId,callId:input.payload?.callId});}catch{throw new DatastoreUnavailable();}
 }
 if(!['CREATE_REQUIREMENT_CAMPAIGN','SEND_CALLS'].includes(input.action))throw new DatastoreUnavailable();
 if(!postgresDemand)throw new DatastoreUnavailable();
 try{return await postgresDemand.begin({uid:input.actorUid,adminClaim:false,demandAction:input.action,requestId:input.requestId});}catch{throw new DatastoreUnavailable();}
}
export async function closePostgresIntegrationStore(){await postgresProfile?.close();await postgresDisclosure?.close();await postgresEvidence?.close();await postgresAcademic?.close();await postgresVerification?.close();await postgresJoining?.close();await postgresOffer?.close();await postgresAssessment?.close();await postgresConsent?.close();await postgresInstitution?.close();await postgresDemand?.close();await postgresRegistrar?.close();await postgresReader?.close();await postgresDirectory?.close();}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
async function findIndividualInvitation(campaign:any,cid:string,student:any,sid:string,read:(collection:string,id:string)=>Promise<any>){
 const calls=Array.isArray(campaign.callsSent)?campaign.callsSent:[];
 const candidates=calls.filter((call:any)=>call?.institutionId===student.institutionId&&typeof call.id==='string').slice(0,10);
 for(const call of candidates){
  const id=hash(`${call.id}:${sid}`);
  const o=await read('opportunities',id);
  if(o&&o.id===id&&o.callId===call.id&&o.campaignId===cid&&o.studentId===sid&&o.employerId===campaign.employerId&&o.institutionId===student.institutionId)return id;
 }
 throw new Error('Student is not authorized: individual invitation is required');
}

const RE=/^[A-Za-z0-9._:-]{8,128}$/;

export interface CandidateProjectionRequest { actorUid:string; campaignId:string; studentId:string; requestId:string }

export interface CareerEvidenceRequest {
 actorUid:string; requestId:string; evidenceId:string; studentId:string; claimType:string; claimKey:string; claimValue:string;
 sourceType:string; sourceId?:string; evidenceUri?:string; expiresAt?:string;
}

export type TrustedProfileMutationAction =
  | 'REQUEST_ACADEMIC_CORRECTION'
  | 'REVIEW_ACADEMIC_CORRECTION'
  | 'UPDATE_GLOBAL_PRIVACY'
  | 'PUBLISH_INSTITUTION_AVAILABILITY'
  | 'UPDATE_STUDENT_AVAILABILITY'
  | 'ADD_VERIFIED_SKILL'
  | 'UPDATE_EMPLOYER_VERIFICATION'
  | 'UPDATE_INSTITUTION_EMPANELMENT'
  | 'UPDATE_STUDENT_INSTITUTION_VERIFICATION'
  | 'UPDATE_STUDENT_PLATFORM_VERIFICATION'
  | 'REGISTER_INDEPENDENT_CANDIDATE'
  | 'PROVISION_USER_ROLE'
  | 'REVIEW_CAREER_EVIDENCE'
  | 'DISPUTE_CAREER_EVIDENCE'
  | 'RESOLVE_CAREER_EVIDENCE_DISPUTE';

export interface TrustedProfileMutationRequest {
  actorUid: string;
  requestId: string;
  action: TrustedProfileMutationAction;
  payload: Record<string, any>;
  firebaseIdToken?: string;
  /** Set only by the authenticated server boundary, never from request payload. */
  adminClaim?: boolean;
}

export async function executeTrustedProfileMutation(input:TrustedProfileMutationRequest):Promise<{replayed:boolean;auditEventId:string;ids:string[]}>{
 return firebaseIdTokenContext.run(input.firebaseIdToken||'',async()=>{
  if(!RE.test(input.requestId))throw new Error('Invalid requestId');
  const verification=['UPDATE_EMPLOYER_VERIFICATION','UPDATE_INSTITUTION_EMPANELMENT','UPDATE_STUDENT_INSTITUTION_VERIFICATION','UPDATE_STUDENT_PLATFORM_VERIFICATION'].includes(input.action);
  const target=verification?(input.action==='UPDATE_EMPLOYER_VERIFICATION'?input.payload?.employerId:input.action==='UPDATE_INSTITUTION_EMPANELMENT'?input.payload?.institutionId:input.payload?.studentId):undefined;
  const academic=['REQUEST_ACADEMIC_CORRECTION','REVIEW_ACADEMIC_CORRECTION'].includes(input.action);
  const evidence=['REVIEW_CAREER_EVIDENCE','DISPUTE_CAREER_EVIDENCE','RESOLVE_CAREER_EVIDENCE_DISPUTE'].includes(input.action);
  const profile=['UPDATE_GLOBAL_PRIVACY','PUBLISH_INSTITUTION_AVAILABILITY','UPDATE_STUDENT_AVAILABILITY','ADD_VERIFIED_SKILL','REGISTER_INDEPENDENT_CANDIDATE','PROVISION_USER_ROLE'].includes(input.action);
  const t=await (async()=>{
   if(!postgresMode)return begin();
   if(!verification&&!academic&&!evidence&&!profile)throw new DatastoreUnavailable();
   try{
    const store=profile?postgresProfile:evidence?postgresEvidence:academic?postgresAcademic:postgresVerification;
    if(!store)throw new DatastoreUnavailable();
    return await store.begin({uid:input.actorUid,adminClaim:input.adminClaim===true,demandAction:input.action,requestId:input.requestId,targetId:profile?(input.action==='ADD_VERIFIED_SKILL'?input.payload?.studentId:input.action==='PROVISION_USER_ROLE'?input.payload?.targetUid:input.actorUid):academic?(input.action==='REQUEST_ACADEMIC_CORRECTION'?input.actorUid:input.payload?.studentId):target,correctionId:academic&&input.action==='REVIEW_ACADEMIC_CORRECTION'?input.payload?.correctionId:undefined,evidenceId:evidence?input.payload?.evidenceId:undefined});
   }catch{throw new DatastoreUnavailable();}
  })();
  try{
   const actor=await readTx(nameOf('users',input.actorUid),t); if(!actor||actor.uid!==input.actorUid)throw new Error('Actor record was not found');
   if(actor.role==='super_admin'&&input.adminClaim!==true)throw new Error('Super admin authorization is required');
   const aid=hash(`${input.requestId}:${input.actorUid}:${input.action}`),an=nameOf('auditEvents',aid),existing=await readTx(an,t);
   if(existing){await rollback(t);return {replayed:true,auditEventId:aid,ids:[]};}
   const p=input.payload||{},now=new Date().toISOString(),writes:any[]=[],ids:string[]=[];
   const read=async(c:string,id:string)=>readTx(nameOf(c,id),t);
   const must=async(c:string,id:string)=>{const v=await read(c,id);if(!v)throw new Error(`${c}/${id} was not found`);return v;};
   const admin=()=>{if(actor.role!=='super_admin'||input.adminClaim!==true)throw new Error('Super admin authorization is required');};
   switch(input.action){
    case 'REQUEST_ACADEMIC_CORRECTION':{
     role(actor,['student']);const id=input.actorUid,s=await must('students',id);
     if(s.academicCorrection?.status==='pending')throw new Error('An academic correction is already pending');
     const incoming=p.proposed||{},reason=typeof p.reason==='string'?p.reason.trim():'';
     if(!reason||reason.length>1000)throw new Error('A correction reason is required');
     const proposed:Record<string,any>={},before:Record<string,any>={};
     const allowed=['program','branch','graduationYear','cgpa','rollNumber'];
     if(!Object.keys(incoming).length||Object.keys(incoming).some(k=>!allowed.includes(k)))throw new Error('Invalid correction fields');
     for(const key of Object.keys(incoming)){
       const value=incoming[key];
       if(key==='graduationYear'){if(!Number.isInteger(value)||value<1950||value>2100)throw new Error('Invalid graduation year');}
       else if(key==='cgpa'){if(!Number.isFinite(value)||value<0||value>10)throw new Error('Invalid CGPA');}
       else if(typeof value!=='string'||value.length>200||!value.trim())throw new Error('Invalid academic text');
       const clean=typeof value==='string'?value.trim():value;
       if(clean!==s[key]){proposed[key]=clean;before[key]=s[key]??null;}
     }
     if(!Object.keys(proposed).length)throw new Error('At least one changed academic value is required');
     const correction={id:aid,studentId:id,institutionId:s.institutionId||'',status:'pending',before,proposed,reason,requestedAt:now};
     writes.push({name:nameOf('academicCorrections',aid),data:correction},{name:nameOf('students',id),data:{...s,academicCorrection:correction}});
     ids.push(aid,id);break;
    }
    case 'REVIEW_ACADEMIC_CORRECTION':{
     role(actor,['institution','super_admin']);const id=String(p.studentId||''),s=await read('students',id);
     const correction=await read('academicCorrections',String(p.correctionId||''));
     if(!s||!correction)throw new Error('Reviewer is not authorized for this correction');
     if(correction.studentId!==id||s.academicCorrection?.id!==correction.id)throw new Error('Reviewer is not authorized for this correction');
     if(actor.role==='institution'){
       if(s.institutionId!==input.actorUid||correction.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this correction');
       const authority=await must('institutions',input.actorUid);if(authority.empanelmentStatus!=='empanelled')throw new Error('Empanelled institution is required');
     }
     if(correction.status!=='pending')throw new Error('Correction already reviewed');
     if(!['approved','rejected'].includes(p.decision)||typeof p.note!=='string'||!p.note.trim()||p.note.length>1000)throw new Error('Invalid review decision or evidence note');
     const reviewed={...correction,status:p.decision,reviewNote:p.note.trim(),reviewedBy:input.actorUid,reviewedAt:now};
     let updated:Record<string,any>={...s,academicCorrection:reviewed};
     if(p.decision==='approved'){
       if(!correction.proposed||!Object.keys(correction.proposed).length||Object.keys(correction.proposed).some(key=>!['program','branch','graduationYear','cgpa','rollNumber'].includes(key)))throw new Error('Invalid historical correction fields');
       for(const [key,old] of Object.entries(correction.before||{}))if((s[key]??null)!==old)throw new Error('Invalid stale correction; submit current values for review');
       const grants=Object.fromEntries(Object.entries(s.campaignConsents||{}).map(([key,value]:[string,any])=>[key,{...value,status:'denied',academicDataShared:false,skillBenchmarksShared:false,projectReposShared:false,contactInfoShared:false,updatedAt:now,reasonForDenial:'Academic profile corrected; fresh consent required'}]));
       updated={...updated,...correction.proposed,academicCorrectedAt:now,institutionVerificationStatus:s.institutionVerificationStatus==='not_applicable'?'not_applicable':'pending',platformVerificationStatus:'pending',verificationNotes:'Academic correction reviewed; fresh verification required.',campaignConsents:grants};
       if(s.independentCredentials){const d={...s.independentCredentials};for(const [key,value] of Object.entries(correction.proposed))d[key==='program'?'degree':key]=value;updated.independentCredentials=d;}
     }
     writes.push({name:nameOf('academicCorrections',correction.id),data:reviewed},{name:nameOf('students',id),data:updated});
     ids.push(correction.id,id);break;
    }
    case 'UPDATE_GLOBAL_PRIVACY':{
     role(actor,['student']); const s=await must('students',input.actorUid); const current=s.globalDataPrivacy||{allowUnsolicitedPings:false,anonymizeProfileUntilConsent:true,shareVerifiedBadgesGlobally:false,autoDeclineBelowMinSalary:false};
     const allowed=['allowUnsolicitedPings','anonymizeProfileUntilConsent','shareVerifiedBadgesGlobally','autoDeclineBelowMinSalary'];
     const patch:any={}; for(const k of allowed)if(typeof p.settings?.[k]==='boolean')patch[k]=p.settings[k];
     writes.push({name:nameOf('students',input.actorUid),data:{...s,globalDataPrivacy:{...current,...patch}}}); ids.push(input.actorUid); break;
    }
    case 'PUBLISH_INSTITUTION_AVAILABILITY':{
     role(actor,['institution']); const id=String(p.institutionId||''); if(id!==input.actorUid)throw new Error('Institution is not authorized to publish this availability');
     const inst=await must('institutions',id); if(inst.empanelmentStatus!=='empanelled')throw new Error('Empanelled institution is required'); const count=Number(p.count); const batchYear=Number(p.batchYear); const branch=String(p.branch||'').trim(),description=String(p.description||'').trim();
     if(!Number.isInteger(batchYear)||batchYear<2000||batchYear>2100||!Number.isSafeInteger(count)||count<0||count>100000||!branch||branch.length>200||!description||description.length>2000)throw new Error('Invalid institution availability');
     const published=Array.isArray(inst.publishedAvailability)?inst.publishedAvailability:[]; if(published.length>=200)throw new Error('Availability publication limit reached; archive review required'); const entry={batchYear,branch,talentCount:Math.floor(count),description,publishedAt:now.slice(0,10)};
     writes.push({name:nameOf('institutions',id),data:{...inst,publishedAvailability:[entry,...published]}}); ids.push(id); break;
    }
    case 'UPDATE_STUDENT_AVAILABILITY':{
     role(actor,['student']); const id=String(p.studentId||input.actorUid); if(id!==input.actorUid)throw new Error('Student is not authorized to change another student availability');
     const s=await must('students',id); if(!['actively_seeking','open_to_offers','not_currently_available'].includes(p.availability))throw new Error('Invalid student availability');
     writes.push({name:nameOf('students',id),data:{...s,availability:p.availability}}); ids.push(id); break;
    }
    case 'ADD_VERIFIED_SKILL':{
     admin(); const id=String(p.studentId||''); const s=await must('students',id),skill=p.skill||{}; if(typeof skill.name!=='string'||!skill.name.trim()||skill.name.length>200||!['technical','domain','communication','tools'].includes(skill.category)||!Number.isFinite(Number(skill.score)))throw new Error('Invalid verified skill');
     const score=Math.max(0,Math.min(100,Number(skill.score))),existingSkills=Array.isArray(s.skills)?s.skills.filter((x:any)=>String(x.name).toLowerCase()!==String(skill.name).toLowerCase()):[];
     const verified={name:String(skill.name),category:skill.category,score,percentile:Math.min(99,Math.round(score*1.05)),badge:['Gold','Silver','Bronze','Verified'].includes(skill.badge)?skill.badge:'Verified',verifiedAt:now.slice(0,10),verifiedBy:input.actorUid};
     writes.push({name:nameOf('students',id),data:{...s,skills:[verified,...existingSkills]}}); ids.push(id); break;
    }
    case 'UPDATE_EMPLOYER_VERIFICATION':{
     admin(); const id=String(p.employerId||''),status=String(p.status); const e=await must('employers',id); if(!['pending','verified','rejected'].includes(status))throw new Error('Invalid employer verification status');
     writes.push({name:nameOf('employers',id),data:{...e,verificationStatus:status,verifiedByAdmin:status==='verified',verificationNotes:p.notes!==undefined?String(p.notes):e.verificationNotes}}); ids.push(id); break;
    }
    case 'UPDATE_INSTITUTION_EMPANELMENT':{
     admin(); const id=String(p.institutionId||''),status=String(p.status); const inst=await must('institutions',id); if(!['pending','empanelled','rejected'].includes(status))throw new Error('Invalid institution empanelment status');
     const tier=['Tier-1 High Assurance','Tier-2 Verified','Tier-3 Provisional'].includes(p.tier)?p.tier:(inst.tier||'Tier-3 Provisional');
     writes.push({name:nameOf('institutions',id),data:{...inst,empanelmentStatus:status,verifiedByAdmin:status==='empanelled',tier,empanelmentNotes:p.notes!==undefined?String(p.notes):inst.empanelmentNotes}}); ids.push(id); break;
    }
    case 'UPDATE_STUDENT_INSTITUTION_VERIFICATION':{
     role(actor,['institution','super_admin']); const id=String(p.studentId||''),status=String(p.status); const s=await read('students',id); if(!s)throw new Error('Reviewer is not authorized for this student'); if(actor.role==='institution'){if(s.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this student');const authority=await must('institutions',input.actorUid);if(authority.empanelmentStatus!=='empanelled')throw new Error('Empanelled institution is required');} if(!['pending','verified','rejected'].includes(status))throw new Error('Invalid student institution verification status'); if(typeof p.notes!=='string'||!p.notes.trim()||p.notes.length>2000)throw new Error('Actual verification evidence note is required');
     writes.push({name:nameOf('students',id),data:{...s,institutionVerificationStatus:status,verificationNotes:p.notes!==undefined?String(p.notes):s.verificationNotes}}); ids.push(id); break;
    }
    case 'UPDATE_STUDENT_PLATFORM_VERIFICATION':{
     admin(); const id=String(p.studentId||''),status=String(p.status); const s=await must('students',id); if(!['pending','verified','rejected'].includes(status))throw new Error('Invalid student platform verification status');
     writes.push({name:nameOf('students',id),data:{...s,platformVerificationStatus:status,verificationNotes:p.notes!==undefined?String(p.notes):s.verificationNotes}}); ids.push(id); break;
    }
    case 'REGISTER_INDEPENDENT_CANDIDATE':{
     role(actor,['student']);const id=input.actorUid;if(await read('students',id))throw new Error('Student profile already exists');
     const d=p.candidateData||{},cred=d.independentCredentials||{};
     const text=(value:unknown,max:number,required=false)=>{
       if(value===undefined&&!required)return '';
       if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error('Required or invalid candidate data');
       return value.trim();
     };
     const name=text(d.name,200,true),email=text(actor.email,320,true);
     const degree=text(cred.degree,200,true),branch=text(cred.branch,200,true),college=text(cred.collegeName,200,true),state=text(cred.state,200,true);
     const graduationYear=cred.graduationYear,cgpa=cred.cgpa;
     if(!Number.isInteger(graduationYear)||graduationYear<1950||graduationYear>2100||!Number.isFinite(cgpa)||cgpa<0||cgpa>10)throw new Error('Invalid academic year or CGPA');
     const student={id,name,email,avatar:'',candidateType:'independent_direct',isEmpanelledCampus:false,institutionId:'inst-independent',institutionName:college+' (Direct)',institutionCode:'DIRECT-IND',rollNumber:text(cred.rollNumber,100),institutionVerificationStatus:'not_applicable',platformVerificationStatus:'pending',verificationNotes:'Pending Platform Admin credential review.',independentCredentials:{collegeName:college,universityAffiliation:text(cred.universityAffiliation,200),state,city:text(cred.city,200),degree,branch,graduationYear,cgpa,rollNumber:text(cred.rollNumber,100),submissionDate:now.slice(0,10)},state,program:degree,branch,graduationYear,cgpa,skills:[],projects:[],internships:[],assessments:[],evidenceIds:[],campaignConsents:{},preferences:{targetRoles:[],preferredLocations:[],minSalaryLPA:0,employmentTypes:['Full-Time']},availability:'actively_seeking',placementStatus:'unplaced',globalDataPrivacy:{allowUnsolicitedPings:false,anonymizeProfileUntilConsent:true,shareVerifiedBadgesGlobally:false,autoDeclineBelowMinSalary:false}};
     writes.push({name:nameOf('students',id),data:student});ids.push(id);break;
    }
    case 'PROVISION_USER_ROLE':{
     admin(); const id=String(p.targetUid||''); const target=await must('users',id); if(id===input.actorUid||target.role==='super_admin'||!['employer','institution','student','simulation'].includes(p.targetRole))throw new Error('Invalid user role; privileged role changes require separate identity administration');
     if(target.role!==p.targetRole){for(const root of ['employers','institutions','students']){const existing=await read(root,id);if(existing&&root!==({employer:'employers',institution:'institutions',student:'students',simulation:''} as Record<string,string>)[p.targetRole])throw new Error('Invalid role change; existing stakeholder profile requires reconciliation');}}
     writes.push({name:nameOf('users',id),data:{...target,role:p.targetRole,updatedAt:now}}); ids.push(id); break;
    }
    case 'REVIEW_CAREER_EVIDENCE':{
     admin(); const id=String(p.evidenceId||''),next=String(p.status); const evidence=await must('careerEvidence',id);
     const allowed=['submitted','under_review','verified','rejected','expired']; if(!allowed.includes(next))throw new Error('Invalid evidence verification status');
     const current=String(evidence.status);
     const transitions:Record<string,string[]>={submitted:['under_review','rejected'],under_review:['verified','rejected'],verified:['under_review','expired'],expired:['under_review'],rejected:[]};
     if(!(transitions[current]||[]).includes(next))throw new Error(`Invalid evidence transition from ${current} to ${next}`);
     if(next==='verified' && (!evidence.sourceId || !['institution','employer'].includes(evidence.sourceType)))throw new Error('Verified evidence requires an authoritative source reference');
     if(next==='verified' && evidence.sourceType==='institution'){
       const authority=await read('institutions',String(evidence.sourceId)); if(!authority||authority.empanelmentStatus!=='empanelled')throw new Error('Institution authority is not verified');
     }
     if(next==='verified' && evidence.sourceType==='employer'){
       const authority=await read('employers',String(evidence.sourceId)); if(!authority||authority.verificationStatus!=='verified')throw new Error('Employer authority is not verified');
     }
     if(next==='rejected' && !String(p.rejectionReason||'').trim())throw new Error('Rejection reason is required');
     if(next==='expired' && (!evidence.expiresAt || new Date(evidence.expiresAt).getTime()>Date.now()))throw new Error('Evidence cannot be expired before its expiry time');
     if(next==='verified' && evidence.expiresAt && new Date(evidence.expiresAt).getTime()<=Date.now())throw new Error('Expired evidence cannot be verified');
     const updated={...evidence,status:next,reviewedAt:now,reviewedBy:input.actorUid,rejectionReason:next==='rejected'?String(p.rejectionReason).trim():'',disputeStatus:next==='verified'?'none':evidence.disputeStatus,lineageHash:hash(JSON.stringify({previousLineageHash:evidence.lineageHash,status:next,reviewedBy:input.actorUid,reviewedAt:now}))};
     writes.push({name:nameOf('careerEvidence',id),data:updated});
     if(next==='verified'){
       const s=await must('students',evidence.studentId); const idsForStudent=Array.isArray(s.evidenceIds)?s.evidenceIds:[]; writes.push({name:nameOf('students',evidence.studentId),data:{...s,evidenceIds:Array.from(new Set([...idsForStudent,id]))}});
     }
     ids.push(id); break;
    }
    case 'DISPUTE_CAREER_EVIDENCE':{
     role(actor,['student']); const id=String(p.evidenceId||''),evidence=await read('careerEvidence',id);
     if(!evidence)throw new Error('Student is not authorized to dispute this evidence');
     if(evidence.studentId!==input.actorUid)throw new Error('Student is not authorized to dispute this evidence');
     if(!['verified','rejected','expired','under_review'].includes(String(evidence.status)))throw new Error('Evidence is not disputable in its current state');
     const reason=String(p.reason||'').trim(); if(reason.length<10||reason.length>4000)throw new Error('A meaningful dispute reason is required');
     const updated={...evidence,disputeStatus:'open',disputeReason:reason,disputeOpenedAt:now,disputeOpenedBy:input.actorUid,lineageHash:hash(JSON.stringify({previousLineageHash:evidence.lineageHash,action:'DISPUTE_OPENED',actorUid:input.actorUid,timestamp:now}))};
     writes.push({name:nameOf('careerEvidence',id),data:updated}); ids.push(id); break;
    }
    case 'RESOLVE_CAREER_EVIDENCE_DISPUTE':{
     admin(); const id=String(p.evidenceId||''),evidence=await must('careerEvidence',id);
     if(evidence.disputeStatus!=='open')throw new Error('Evidence does not have an open dispute');
     const resolution=String(p.resolution||'').trim(); if(resolution.length<10||resolution.length>4000)throw new Error('A meaningful dispute resolution is required');
     const outcome=p.outcome==='reopen'?'reopen':p.outcome==='uphold'?'uphold':'reject';
     const nextStatus=outcome==='reopen'?'under_review':outcome==='uphold'?String(evidence.status):'rejected';
     const updated={...evidence,status:nextStatus,disputeStatus:'resolved',disputeReason:resolution,disputeResolvedAt:now,disputeResolvedBy:input.actorUid,reviewedAt:now,reviewedBy:input.actorUid,rejectionReason:outcome==='reject'?resolution:'',lineageHash:hash(JSON.stringify({previousLineageHash:evidence.lineageHash,action:'DISPUTE_RESOLVED',outcome,actorUid:input.actorUid,timestamp:now}))};
     writes.push({name:nameOf('careerEvidence',id),data:updated}); ids.push(id); break;
    }
    default: throw new Error('Unsupported trusted profile mutation');
   }
   writes.push({name:an,data:{eventId:aid,requestId:input.requestId,actorUid:input.actorUid,actorRole:actor.role,action:input.action,ids,timestamp:now,immutable:true}});
   await commit(t,writes); return {replayed:false,auditEventId:aid,ids};
  }catch(e){await rollback(t);throw e;}
 });
}

export async function submitCareerEvidence(input:CareerEvidenceRequest & {firebaseIdToken?:string}):Promise<{evidenceId:string;replayed:boolean}>{
 return firebaseIdTokenContext.run(input.firebaseIdToken || '', async()=>{ 
  if(!RE.test(input.requestId)||!RE.test(input.evidenceId)) throw new Error('Invalid request or evidence identifier');
  const allowedClaims=['identity','institution','education','skill','project','internship','assessment','employment_outcome'];
  const allowedSources=['student_submission','institution','employer','assessment_provider','platform'];
  if(!allowedClaims.includes(input.claimType)||!allowedSources.includes(input.sourceType)) throw new Error('Unsupported evidence type or source');
  if(input.actorUid!==input.studentId||input.sourceType!=='student_submission')throw new Error('Only the student may submit personal evidence with student_submission source');
  const t=await (async()=>{if(!postgresMode)return begin();try{if(!postgresEvidence)throw new DatastoreUnavailable();return await postgresEvidence.begin({uid:input.actorUid,adminClaim:false,demandAction:'CAREER_EVIDENCE_SUBMITTED',requestId:input.requestId,evidenceId:input.evidenceId});}catch{throw new DatastoreUnavailable();}})();
  try{
   const [actor,student,existing]=await Promise.all([
    readTx(nameOf('users',input.actorUid),t),readTx(nameOf('students',input.studentId),t),readTx(nameOf('careerEvidence',input.evidenceId),t)
   ]);
   if(!actor||actor.uid!==input.actorUid||!student||student.id!==input.studentId) throw new Error('Required identity records were not found');
   if(actor.role!=='student' || input.actorUid!==input.studentId) throw new Error('Only the student may submit personal Career Passport evidence'); if(input.sourceType!=='student_submission') throw new Error('Student evidence submissions must use student_submission as the source type');
   if(existing){
    if(existing.id!==input.evidenceId||existing.studentId!==input.actorUid||existing.claimType!==input.claimType||existing.claimKey!==input.claimKey||existing.claimValue!==input.claimValue||existing.sourceType!=='student_submission'||(existing.sourceId||'')!==(input.sourceId||'')||(existing.evidenceUri||'')!==(input.evidenceUri||'')||(existing.expiresAt||'')!==(input.expiresAt||''))throw new Error('Invalid evidence identifier reuse');
    await rollback(t);return {evidenceId:input.evidenceId,replayed:true};
   }
   const now=new Date().toISOString();
   const lineageHash=hash(JSON.stringify({studentId:input.studentId,claimType:input.claimType,claimKey:input.claimKey,claimValue:input.claimValue,sourceType:input.sourceType,sourceId:input.sourceId||'',evidenceUri:input.evidenceUri||'',submittedAt:now}));
   const evidence={id:input.evidenceId,studentId:input.studentId,claimType:input.claimType,claimKey:input.claimKey,claimValue:input.claimValue,sourceType:input.sourceType,sourceId:input.sourceId||'',evidenceUri:input.evidenceUri||'',submittedAt:now,status:'submitted',expiresAt:input.expiresAt||'',lineageHash};
   const auditIdValue=hash(input.requestId+':'+input.actorUid+':CAREER_EVIDENCE_SUBMITTED');
   const audit={eventId:auditIdValue,requestId:input.requestId,actorUid:input.actorUid,actorRole:actor.role,subjectStudentId:input.studentId,action:'CAREER_EVIDENCE_SUBMITTED',evidenceId:input.evidenceId,timestamp:now,immutable:true};
   await commit(t,[{name:nameOf('careerEvidence',input.evidenceId),data:evidence},{name:nameOf('auditEvents',auditIdValue),data:audit}]);
   return {evidenceId:input.evidenceId,replayed:false};
  }catch(e){await rollback(t);throw e;}
 });
}



/** Read-only estimate. No invoice, payment order or provider event writes. */
export async function authorizeCommercialCampaign(actorUid:string,campaignId:string,firebaseIdToken?:string){
 return firebaseIdTokenContext.run(firebaseIdToken||'',async()=>{
  const t=await beginScopedRead(actorUid,false);
  try{
   const actor=await readTx(nameOf('users',actorUid),t);
   if(!actor||actor.uid!==actorUid||actor.role!=='employer')throw new Error('Only an employer can purchase a hiring campaign');
   const campaign=await readTx(nameOf('campaigns',campaignId),t);
   // Identical denial for missing and foreign campaigns; no cross-tenant existence disclosure.
   if(!campaign||campaign.id!==campaignId||campaign.employerId!==actorUid)throw new Error('Employer is not authorized for this campaign');
   const vacancies=campaign.requirement?.vacancies;
   const ids=campaign.targetedInstitutionIds;
   if(!Number.isSafeInteger(vacancies)||vacancies<1||vacancies>100000||!Array.isArray(ids)||ids.some((id:unknown)=>typeof id!=='string'||!id.trim()))throw new Error('Invalid campaign billing scope');
   const institutions=new Set(ids).size;
   if(institutions<1||institutions>1000)throw new Error('At least one confirmed target institution is required for a quote');
   return {campaignId,vacancies,institutions};
  }finally{await rollback(t);}
 });
}

export async function provisionCandidateProjection(input:CandidateProjectionRequest & {firebaseIdToken?:string;includeEmployerProfile?:boolean}):Promise<{projectionId:string;replayed:boolean;profile?:Record<string,any>}>{
 return firebaseIdTokenContext.run(input.firebaseIdToken || '', async()=>{ if(!RE.test(input.requestId))throw new Error('Invalid requestId'); const t=await (async()=>{if(!postgresMode)return begin();try{if(!postgresDisclosure)throw new DatastoreUnavailable();return await postgresDisclosure.begin({uid:input.actorUid,adminClaim:false,demandAction:'PROVISION_PROJECTION',requestId:input.requestId,campaignId:input.campaignId,studentId:input.studentId});}catch{throw new DatastoreUnavailable();}})(); try{
  const [actor,campaign,student]=await Promise.all([readTx(nameOf('users',input.actorUid),t),readTx(nameOf('campaigns',input.campaignId),t),readTx(nameOf('students',input.studentId),t)]);
  if(!actor||actor.uid!==input.actorUid||!campaign||!student)throw new WorkspaceDenied();
  if(input.includeEmployerProfile&& (actor.uid!==input.actorUid||actor.role!=='employer'||campaign.id!==input.campaignId||student.id!==input.studentId))throw new WorkspaceDenied();
  if(!['employer','institution'].includes(actor.role))throw new Error('Only employers or institutions may provision candidate projections');
  if(actor.role==='employer'&&campaign.employerId!==input.actorUid)throw new Error('Employer is not authorized for this campaign');
  if(actor.role==='institution'&&(!Array.isArray(campaign.targetedInstitutionIds)||!campaign.targetedInstitutionIds.includes(input.actorUid)))throw new Error('Institution is not targeted by this campaign');
  if(actor.role==='institution'&&student.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this student');
  const consent=student.campaignConsents?.[input.campaignId]; if(!consent||consent.status!=='approved')throw new Error('Explicit campaign consent is required before projection'); if(consent.employerId!==campaign.employerId)throw new Error('Consent does not match the campaign employer'); if(typeof consent.updatedAt!=='string'||!consent.updatedAt.trim())throw new Error('Current timestamped consent is required before projection');
  const invitationId=await findIndividualInvitation(campaign,input.campaignId,student,input.studentId,(col,id)=>readTx(nameOf(col,id),t));
  if(consent.opportunityId!==invitationId)throw new Error('Current invitation-bound consent is required before projection');

  const id=hash(`${campaign.employerId}:${input.campaignId}:${input.studentId}`), pn=nameOf('candidateProfiles',id), an=nameOf('auditEvents',hash(`${input.requestId}:${input.actorUid}:${input.campaignId}:${input.studentId}`));
  const existingAudit=await readTx(an,t); if(existingAudit){await rollback(t);return {projectionId:id,replayed:true};}
  const evidenceIds=Array.isArray(student.evidenceIds)?student.evidenceIds:[]; if(evidenceIds.length>200||evidenceIds.some((id:unknown)=>typeof id!=='string'||!id))throw new DatastoreUnavailable(); const evidenceRecords=(await Promise.all(evidenceIds.map((eid:string)=>readTx(nameOf('careerEvidence',eid),t)))).filter(Boolean) as any[];
  const verifiedEvidence=evidenceRecords.filter((e:any)=>e.status==='verified' && e.disputeStatus!=='open' && (!e.expiresAt || new Date(e.expiresAt).getTime()>Date.now()) && e.studentId===input.studentId);
  const projection:any={studentId:input.studentId,employerId:campaign.employerId,campaignId:input.campaignId,role:campaign.requirement?.role||'Hiring Opportunity',name:student.name||'Candidate',institutionId:student.institutionId||'',institutionName:student.institutionName||'',candidateType:student.candidateType||'unknown',consentStatus:'approved',consentUpdatedAt:consent.updatedAt,consentScope:{academicDataShared:consent.academicDataShared===true,skillBenchmarksShared:consent.skillBenchmarksShared===true,projectReposShared:consent.projectReposShared===true,contactInfoShared:consent.contactInfoShared===true},projectionVersion:3,opportunityId:invitationId,academicCorrectedAt:student.academicCorrectedAt||'',updatedAt:new Date().toISOString()};
  const academicCurrent=!student.academicCorrectedAt||student.institutionVerificationStatus==='verified'||student.platformVerificationStatus==='verified';
  if(consent.academicDataShared===true&&academicCurrent)Object.assign(projection,{program:student.program||'',branch:student.branch||'',graduationYear:student.graduationYear||0,cgpa:student.cgpa||0});
  if(consent.skillBenchmarksShared===true){
    const verifiedSkillEvidence=verifiedEvidence.filter((e:any)=>e.claimType==='skill').map((e:any)=>({claimKey:e.claimKey,claimValue:e.claimValue,evidenceId:e.id,sourceType:e.sourceType,verifiedAt:e.reviewedAt,expiresAt:e.expiresAt||null}));
    projection.verifiedSkills=verifiedSkillEvidence;
  }
  // Only claim categories explicitly covered by consent may leave the evidence vault.
  const scopedEvidence=verifiedEvidence.filter((e:any)=> (e.claimType==='education' && consent.academicDataShared===true && academicCurrent && (!student.academicCorrectedAt || (typeof e.reviewedAt==='string' && e.reviewedAt>student.academicCorrectedAt))) || (e.claimType==='skill' && consent.skillBenchmarksShared===true) || (e.claimType==='project' && consent.projectReposShared===true));
  projection.verifiedEvidence=scopedEvidence.map((e:any)=>({id:e.id,claimType:e.claimType,claimKey:e.claimKey,claimValue:e.claimValue,sourceType:e.sourceType,reviewedAt:e.reviewedAt,expiresAt:e.expiresAt||null}));
  if(consent.projectReposShared===true)projection.projects=[]; // Legacy unverified project rows must not be disclosed; scoped verified evidence is provided above.
  if(consent.contactInfoShared===true)projection.email=student.email||'';
  const audit={eventId:an.split('/').pop(),requestId:input.requestId,actorUid:input.actorUid,actorRole:actor.role,subjectStudentId:input.studentId,employerId:campaign.employerId,campaignId:input.campaignId,action:'CANDIDATE_PROJECTION_PROVISIONED',consentScope:{academicDataShared:!!consent.academicDataShared,skillBenchmarksShared:!!consent.skillBenchmarksShared,projectReposShared:!!consent.projectReposShared,contactInfoShared:!!consent.contactInfoShared},projectionId:id,timestamp:new Date().toISOString(),immutable:true};
  // Replace the entire snapshot atomically; a merge would retain revoked fields.
  await commit(t,[{name:pn,data:projection},{name:an,data:audit}]); return {projectionId:id,replayed:false,...(input.includeEmployerProfile&&actor.role==='employer'?{profile:projection}:{})};
 }catch(e){await rollback(t);throw e;}});
}

/** Employer access requires current consent, an exact submission binding and an intact evidence hash. */
export async function readEmployerAssessment(actorUid:string,submissionId:string){
 const t=await (async()=>{if(!postgresMode)return begin();try{if(!postgresDisclosure)throw new DatastoreUnavailable();return await postgresDisclosure.begin({uid:actorUid,adminClaim:false,demandAction:'READ_ASSESSMENT',requestId:'read-assessment',submissionId});}catch{throw new DatastoreUnavailable();}})();
 try{
  const actor=await readTx(nameOf('users',actorUid),t);
  if(actor?.uid!==actorUid||actor.role!=='employer')throw new WorkspaceDenied();
  const a=await readTx(nameOf('assessmentSubmissions',submissionId),t);
  if(!a||a.id!==submissionId||a.employerId!==actorUid||a.shareWithEmployer!==true||typeof a.response!=='string'||a.response.length>12000||!a.response.length||a.evidenceHash!==hash(a.response)||typeof a.studentId!=='string'||typeof a.campaignId!=='string'||typeof a.opportunityId!=='string')throw new WorkspaceDenied();
  const student=await readTx(nameOf('students',a.studentId),t);
  const campaign=await readTx(nameOf('campaigns',a.campaignId),t);
  const o=await readTx(nameOf('opportunities',a.opportunityId),t);
  const grant=student?.campaignConsents?.[a.campaignId];
  if(student?.id!==a.studentId||campaign?.id!==a.campaignId||campaign.employerId!==actorUid||o?.id!==a.opportunityId||o.studentId!==a.studentId||o.campaignId!==a.campaignId||o.employerId!==actorUid||o.assessmentSubmissionId!==submissionId||o.assessmentEvidenceHash!==a.evidenceHash||grant?.status!=='approved'||grant.employerId!==actorUid||grant.opportunityId!==o.id||grant.skillBenchmarksShared!==true||typeof grant.updatedAt!=='string'||!grant.updatedAt)throw new WorkspaceDenied();
  return {submissionId,response:a.response};
 }finally{await rollback(t);}
}
export type RecruitmentTransitionAction='CREATE_REQUIREMENT_CAMPAIGN'|'SEND_CALLS'|'RESPOND_CALL'|'ACTIVATE_STUDENTS'|'SUBMIT_CONSENT'|'UPDATE_CONSENT_SCOPE'|'GLOBAL_CONSENT'|'ADVANCE_CANDIDATE_STAGE';
export interface RecruitmentTransitionRequest { actorUid:string; requestId:string; action:RecruitmentTransitionAction; payload:Record<string,any> }
export interface RecruitmentTransitionResult { replayed:boolean; auditEventId:string; ids:string[] }
const auditId=(i:RecruitmentTransitionRequest)=>hash(`${i.requestId}:${i.actorUid}:${i.action}`);
const role=(a:any,roles:string[])=>{if(!roles.includes(a.role))throw new Error(`Role ${a.role||'unknown'} is not authorized for ${roles.join('/')}`)};
const stages=['invited','assessment_pending','assessment_completed','shortlisted','interviewing','offered','accepted','joined','declined','rejected'];
const allowedTransitions:Record<string,string[]>={
 invited:['assessment_pending','declined'],
 assessment_pending:['assessment_completed','declined'],
 assessment_completed:['shortlisted','rejected'],
 shortlisted:['interviewing','rejected'],
 interviewing:['offered','rejected'],
 offered:['accepted','rejected'],
 accepted:['joined','rejected'],
 joined:[],
 declined:[],
 rejected:[],
};
const stageRoles:Record<string,string[]>={
 assessment_pending:['student'],
 assessment_completed:['student','employer'],
 shortlisted:['employer'],
 interviewing:['employer'],
 offered:['employer'],
 accepted:['student'],
 joined:['employer','institution'],
 declined:['student'],
 rejected:['employer'],
};
const counted:Record<string,string>={assessment_completed:'assessmentsCompleted',shortlisted:'shortlisted',interviewing:'interviewed',offered:'offersMade',accepted:'offersAccepted',joined:'joined'};
// Submission is evidence, not a measure of ability. A human-authorized review is separate.
function validateAssessmentSubmission(meta:any){
 const response=typeof meta?.assessmentResponse==='string'?meta.assessmentResponse.trim():'';
 const templateId=typeof meta?.assessmentTemplateId==='string'?meta.assessmentTemplateId.trim():'';
 if(response.length<1||response.length>12000)throw new Error('Invalid assessment response: 1–12000 characters required');
 if(!/^[A-Za-z0-9._:-]{1,128}$/.test(templateId))throw new Error('Invalid assessment template identifier');
 return {response,templateId,shareWithEmployer:meta?.shareAssessmentResponse===true};
}

export async function executeRecruitmentTransition(input:RecruitmentTransitionRequest & {firebaseIdToken?:string}):Promise<RecruitmentTransitionResult>{
 return firebaseIdTokenContext.run(input.firebaseIdToken || '', async()=>{ if(!RE.test(input.requestId))throw new Error('Invalid requestId'); const t=await beginRecruitment(input); try{
  const aid=auditId(input),an=nameOf('auditEvents',aid),existing=await readTx(an,t); if(existing){await rollback(t);return {replayed:true,auditEventId:aid,ids:[]};}
  const actor=await readTx(nameOf('users',input.actorUid),t); if(!actor||actor.uid!==input.actorUid)throw new Error('Actor record was not found'); const p=input.payload||{},now=new Date().toISOString(); const writes:any[]=[],ids:string[]=[];
  const read=async(c:string,id:string)=>readTx(nameOf(c,id),t); const must=async(c:string,id:string)=>{const v=await read(c,id);if(!v)throw new Error(`${c}/${id} was not found`);return v;};
  switch(input.action){
   case 'CREATE_REQUIREMENT_CAMPAIGN':{
    role(actor,['employer']);
    const r=p.requirement, c=p.campaign;
    if(!r||!c||typeof r.id!=='string'||typeof c.id!=='string'||!RE.test(r.id)||!RE.test(c.id)||c.requirementId!==r.id)throw new Error('Invalid requirement and campaign identifiers');
    if(r.employerId!==input.actorUid||c.employerId!==input.actorUid)throw new Error('Employer is not authorized for this campaign');
    if(await read('requirements',r.id)||await read('campaigns',c.id))throw new Error('Recruitment identifiers already exist; refusing to overwrite');
    const employer=await must('employers',input.actorUid);
    if(employer.verificationStatus!=='verified')throw new Error('Verified employer is required');
    const str=(v:unknown,max:number,required=false)=>{
      if(v===undefined&&!required)return '';
      if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new Error('Invalid requirement text');
      return v.trim();
    };
    const list=(v:unknown)=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>50)throw new Error('Invalid requirement list');return Array.from(new Set(v.map(s=>str(s,200,true))));};
    const years=r.graduationYears??[];
    if(!Array.isArray(years)||years.length>30||years.some((y:unknown)=>!Number.isInteger(y)||Number(y)<1950||Number(y)>2100))throw new Error('Invalid graduation years');
    if(!Number.isSafeInteger(r.vacancies)||r.vacancies<1||r.vacancies>100000)throw new Error('Invalid vacancy count');
    if(!Number.isFinite(r.salaryMinLPA)||!Number.isFinite(r.salaryMaxLPA)||r.salaryMinLPA<0||r.salaryMaxLPA<r.salaryMinLPA||r.salaryMaxLPA>100000)throw new Error('Invalid salary range');
    const requirement={id:r.id,employerId:input.actorUid,employerName:str(employer.name,200,true),role:str(r.role,200,true),vacancies:r.vacancies,education:list(r.education),graduationYears:Array.from(new Set(years)),branches:list(r.branches),requiredSkills:list(r.requiredSkills),experienceLevel:str(r.experienceLevel,200),locations:list(r.locations),salaryMinLPA:r.salaryMinLPA,salaryMaxLPA:r.salaryMaxLPA,joiningWindow:str(r.joiningWindow,200),assessmentRequirements:list(r.assessmentRequirements),selectionProcess:list(r.selectionProcess),candidateProfileSummary:str(r.candidateProfileSummary,4000),createdAt:now,status:'active'};
    const campaign={id:c.id,requirementId:r.id,requirement,title:requirement.role+' - Campaign '+now.slice(0,4),employerId:input.actorUid,employerName:requirement.employerName,createdAt:now,status:'active',funnel:{requiredVacancies:requirement.vacancies,institutionsInvited:0,institutionsAccepted:0,studentsInvited:0,applicationsConsented:0,assessmentsCompleted:0,shortlisted:0,interviewed:0,offersMade:0,offersAccepted:0,joined:0},targetedInstitutionIds:[],callsSent:[],candidateOpportunities:[]};
    writes.push({name:nameOf('requirements',r.id),data:requirement},{name:nameOf('campaigns',c.id),data:campaign});ids.push(r.id,c.id);break;
   }
   case 'SEND_CALLS':{
    role(actor,['employer']);const c=await must('campaigns',p.campaignId);
    if(c.employerId!==input.actorUid)throw new Error('Employer is not authorized for this campaign');
    if(c.status!=='active')throw new Error('Active campaign is required');
    const req=c.requirement;
    const calls=Array.isArray(p.calls)?p.calls:[];
    if(!calls.length||calls.length>100)throw new Error('One to 100 calls are required');
    const seen=new Set<string>(), targeted=new Set<string>(Array.isArray(c.targetedInstitutionIds)?c.targetedInstitutionIds:[]),canonical:any[]=[];
    for(const call of calls){
      if(typeof call.id!=='string'||!RE.test(call.id)||call.campaignId!==c.id||call.employerId!==input.actorUid||typeof call.institutionId!=='string'||!call.institutionId||call.institutionId.includes('/'))throw new Error('Invalid call ownership or identifiers');
      if(seen.has(call.id)||await read('calls',call.id)||targeted.has(call.institutionId))throw new Error('One or more call identifiers or target institutions already exist');
      const institution=await must('institutions',call.institutionId);
      if(institution.empanelmentStatus!=='empanelled')throw new Error('Empanelled institution is required');
      if(!Number.isSafeInteger(call.vacanciesRequested)||call.vacanciesRequested<1||call.vacanciesRequested>req.vacancies)throw new Error('Invalid requested vacancy count');
      if(typeof call.deadline!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(call.deadline)||!Number.isFinite(Date.parse(call.deadline))||call.deadline<now.slice(0,10))throw new Error('Invalid call deadline');
      const record={id:call.id,campaignId:c.id,employerId:input.actorUid,employerName:c.employerName,institutionId:call.institutionId,institutionName:institution.name,role:req.role,vacanciesRequested:call.vacanciesRequested,salaryLPA:`₹${req.salaryMinLPA} - ${req.salaryMaxLPA} LPA`,locations:req.locations,joiningWindow:req.joiningWindow,deadline:call.deadline,status:'pending',activatedStudentsCount:0,createdAt:now};
      seen.add(call.id);targeted.add(call.institutionId);canonical.push(record);
      writes.push({name:nameOf('calls',call.id),data:record});
    }
    writes.push({name:nameOf('campaigns',c.id),data:{...c,targetedInstitutionIds:[...targeted],callsSent:[...(Array.isArray(c.callsSent)?c.callsSent:[]),...canonical],candidateOpportunities:[],funnel:{...c.funnel,institutionsInvited:targeted.size}}});
    ids.push(...canonical.map(x=>x.id),c.id);break;
   }
   case 'RESPOND_CALL':{role(actor,['institution']);const call=await must('calls',p.callId);if(call.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this call');const institution=await must('institutions',input.actorUid);if(institution.empanelmentStatus!=='empanelled')throw new Error('Empanelled institution is required');const c=await must('campaigns',call.campaignId);if(call.status!=='pending')throw new Error('Call has already been responded to');if(!['accepted','partial','counter','declined'].includes(p.status))throw new Error('Invalid call status');if(p.status!=='declined'&&(!Number.isSafeInteger(p.offeredCandidatesCount)||p.offeredCandidatesCount<1||p.offeredCandidatesCount>100000))throw new Error('Actual offered candidate count is required');const updated={...call,status:p.status,responseNotes:String(p.responseNotes||''),offeredCandidatesCount:p.status==='declined'?0:p.offeredCandidatesCount,counterDaysExtension:p.counterDaysExtension,respondedAt:now};const f={...c.funnel,institutionsAccepted:Number(c.funnel?.institutionsAccepted||0)+(['accepted','partial'].includes(p.status)?1:0)};writes.push({name:nameOf('calls',call.id),data:updated},{name:nameOf('campaigns',c.id),data:{...c,funnel:f}});ids.push(call.id,c.id);break;}
   case 'ACTIVATE_STUDENTS':{role(actor,['institution']);const call=await must('calls',p.callId);if(call.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this call');if(!['accepted','partial'].includes(call.status))throw new Error('Accepted or partially accepted call is required before activation');const institution=await must('institutions',input.actorUid);if(institution.empanelmentStatus!=='empanelled')throw new Error('Empanelled institution is required');const c=await must('campaigns',call.campaignId);const studentIds=Array.isArray(p.studentIds)?Array.from(new Set(p.studentIds)):[];if(!studentIds.length||studentIds.length>100||studentIds.some(sid=>typeof sid!=='string'||!sid))throw new Error('One to 100 valid students are required');if(!Number.isSafeInteger(call.activatedStudentsCount)||call.activatedStudentsCount<0||!Number.isSafeInteger(call.offeredCandidatesCount)||call.offeredCandidatesCount<1)throw new Error('Invalid activation ledger; historical call requires reconciliation');if(call.activatedStudentsCount+studentIds.length>call.offeredCandidatesCount)throw new Error('Invalid activation count: exceeds institution committed candidate count');const opps:any[]=[];for(const sid of studentIds){const s=await must('students',sid);if(s.institutionId!==input.actorUid)throw new Error('Institution is not authorized for one or more students');if(s.institutionVerificationStatus!=='verified')throw new Error('Institution-verified student is required');if(!academicEligibility(c.requirement||{},s))throw new Error('Invalid student eligibility for the published academic criteria');const id=hash(`${call.id}:${sid}`);if(await read('opportunities',id))throw new Error('Opportunity already exists; refusing to duplicate');opps.push({id,callId:call.id,campaignId:c.id,employerId:call.employerId,employerName:call.employerName,role:call.role,salaryLPA:c.requirement?.salaryMinLPA||0,locations:call.locations,joiningWindow:call.joiningWindow,studentId:sid,studentName:'Candidate',institutionId:call.institutionId,institutionName:call.institutionName,matchScore:0,matchBreakdown:{skillMatchScore:0,academicMatchScore:0,preferenceMatchScore:0,aiRationale:'Candidate activated through institutional workflow; human evaluation required.'},stage:'invited',invitedAt:now,stageUpdatedAt:now});}for(const o of opps)writes.push({name:nameOf('opportunities',o.id),data:o});writes.push({name:nameOf('calls',call.id),data:{...call,activatedStudentsCount:call.activatedStudentsCount+opps.length}});writes.push({name:nameOf('campaigns',c.id),data:{...c,candidateOpportunities:[],funnel:{...c.funnel,studentsInvited:Number(c.funnel?.studentsInvited||0)+opps.length}}});ids.push(...opps.map(o=>o.id),c.id);break;}
   case 'SUBMIT_CONSENT':{role(actor,['student']);const o=await must('opportunities',p.opportunityId);if(o.studentId!==input.actorUid)throw new Error('Student is not authorized for this opportunity');const c=await must('campaigns',o.campaignId);if(typeof p.consented!=='boolean')throw new Error('Explicit application choice required');const yes=p.consented,next=yes?'assessment_pending':'declined';if(yes){const student=await must('students',input.actorUid);const consent=student.campaignConsents?.[o.campaignId];if(consent?.status!=='approved'||consent.employerId!==o.employerId)throw new Error('Current employer-specific consent is required before applying');}if(!['invited','declined','assessment_pending'].includes(o.stage))throw new Error('Opportunity is not in a consentable state');const f={...c.funnel};if(yes&&o.stage!=='assessment_pending')f.applicationsConsented=Number(f.applicationsConsented||0)+1;if(!yes&&o.stage==='assessment_pending')f.applicationsConsented=Math.max(0,Number(f.applicationsConsented||0)-1);writes.push({name:nameOf('opportunities',o.id),data:{...o,stage:next,consentedAt:yes?now:undefined,stageUpdatedAt:now}},{name:nameOf('campaigns',c.id),data:{...c,funnel:f}});ids.push(o.id,c.id);break;}
   case 'UPDATE_CONSENT_SCOPE':{role(actor,['student']);const s=await must('students',input.actorUid),cid=String(p.campaignId),cons={...(s.campaignConsents||{})},cur=cons[cid];if(!cur||cur.status!=='approved')throw new Error('Approved campaign consent is required before changing scope');if(!['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared'].includes(p.scopeKey))throw new Error('Invalid consent scope');if(typeof p.value!=='boolean')throw new Error('Explicit consent scope choice required');cons[cid]={...cur,[p.scopeKey]:p.value,updatedAt:now};writes.push({name:nameOf('students',input.actorUid),data:{...s,campaignConsents:cons}});ids.push(input.actorUid,cid);break;}
   case 'GLOBAL_CONSENT':{
    role(actor,['student']);
    if(typeof p.approved!=='boolean')throw new Error('Explicit consent choice required');
    const s=await must('students',input.actorUid),cons={...(s.campaignConsents||{})};
    const idsRequested=Array.isArray(p.campaignIds)?p.campaignIds:Array.isArray(p.campaigns)?p.campaigns.map((c:any)=>c?.id):[];
    const unique=Array.from(new Set(idsRequested.filter((x:any)=>typeof x==='string'&&x.length>0))) as string[];
    if(!unique.length||unique.length>200)throw new Error('One to 200 campaigns required');
    for(const cid of unique){
     const current=cons[cid];
     // Existing permissions may always be revoked, including archived or untargeted campaigns.
     if(!p.approved&&current){cons[cid]={...current,status:'denied',academicDataShared:false,skillBenchmarksShared:false,projectReposShared:false,contactInfoShared:false,updatedAt:now,reasonForDenial:'Student revoked permission'};continue;}
     const c=await must('campaigns',cid);
     const eligible=Array.isArray(c.targetedInstitutionIds)&&s.institutionId&&c.targetedInstitutionIds.includes(s.institutionId);
     if(!eligible)throw new Error('Student is not eligible for one or more requested campaigns');
     const opportunityId=p.approved?await findIndividualInvitation(c,cid,s,input.actorUid,read):current?.opportunityId;
     // Grant minimal visibility first. Each additional scope requires a separate student action.
     if(p.approved&&current?.status==='approved'&&current.employerId===c.employerId&&current.opportunityId===opportunityId)continue;
     cons[cid]={campaignId:cid,opportunityId,employerId:c.employerId,employerName:c.employerName,role:c.requirement?.role||'Hiring Opportunity',salaryLPA:`₹${c.requirement?.salaryMinLPA||0} - ${c.requirement?.salaryMaxLPA||0} LPA`,status:p.approved?'approved':'denied',academicDataShared:false,skillBenchmarksShared:false,projectReposShared:false,contactInfoShared:false,updatedAt:now,...(!p.approved?{reasonForDenial:'Student revoked permission'}:{})};
    }
    writes.push({name:nameOf('students',input.actorUid),data:{...s,campaignConsents:cons}});
    ids.push(input.actorUid,...unique);break;
   }
   case 'ADVANCE_CANDIDATE_STAGE':{
 const o=await must('opportunities',p.opportunityId);
 role(actor,['employer','institution','student']);
 if(actor.role==='employer'&&o.employerId!==input.actorUid)throw new Error('Employer is not authorized for this opportunity');
 if(actor.role==='institution'&&o.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this opportunity');
 if(actor.role==='student'&&o.studentId!==input.actorUid)throw new Error('Student is not authorized for this opportunity');
 const next=String(p.nextStage);
 if(next==='assessment_pending')throw new Error('Use explicit application consent before assessment');
 if(!stages.includes(next))throw new Error('Invalid recruitment stage');
 if(!(allowedTransitions[o.stage]||[]).includes(next))throw new Error(`Invalid transition from ${o.stage} to ${next}`);
 if(!(stageRoles[next]||[]).includes(actor.role))throw new Error(`Role ${actor.role} cannot advance to ${next}`);
 if(actor.role==='employer'&&['shortlisted','interviewing','offered'].includes(next)){
   const student=await must('students',o.studentId);const grant=student.campaignConsents?.[o.campaignId];
   if(grant?.status!=='approved'||grant.employerId!==input.actorUid||typeof grant.updatedAt!=='string'||!grant.updatedAt)throw new Error('Current employer-specific consent is required before recruitment progression');
 }
 if(next==='assessment_completed'&&actor.role!=='student')throw new Error('Only the student may submit assessment evidence');
 const assessment=next==='assessment_completed'?validateAssessmentSubmission(p.meta):undefined;
 const assessmentId=assessment?hash(`assessment:${o.id}`):undefined;
 if(assessmentId&&await read('assessmentSubmissions',assessmentId))throw new Error('Assessment already submitted');
 if(next==='offered'&&actor.role!=='employer')throw new Error('Only the employer may issue an offer');
 if(next==='offered'&&(!p.meta?.offer || typeof p.meta.offer.salaryLPA!=='number' || !Number.isFinite(p.meta.offer.salaryLPA) || p.meta.offer.salaryLPA<0 || !Number.isSafeInteger(Math.round(p.meta.offer.salaryLPA*10000000))))throw new Error('Valid offer terms are required before offered stage');
 const c=await must('campaigns',o.campaignId),f={...c.funnel},old=o.stage;
 let acceptedOffer:Record<string,any>|undefined;
 if(next==='accepted'||next==='joined'){
   if(typeof o.offerRecordId!=='string'||!o.offerRecordId)throw new Error('Authoritative offer record is required');
   acceptedOffer=await must('offers',o.offerRecordId);
   if(acceptedOffer.id!==o.offerRecordId||acceptedOffer.opportunityId!==o.id||acceptedOffer.campaignId!==o.campaignId||acceptedOffer.employerId!==o.employerId||acceptedOffer.studentId!==o.studentId||acceptedOffer.institutionId!==o.institutionId||acceptedOffer.currency!=='INR')throw new Error('Invalid offer ownership or currency');
   if(acceptedOffer.status!==(next==='accepted'?'issued':'accepted'))throw new Error('Invalid offer lifecycle status');
   if(typeof acceptedOffer.salaryLPA!=='number'||!Number.isFinite(acceptedOffer.salaryLPA)||acceptedOffer.salaryLPA<0||!Number.isSafeInteger(Math.round(acceptedOffer.salaryLPA*10000000)))throw new Error('Invalid authoritative offer salary');
 }
 if(counted[next]&&old!==next){
   const markers={...(o.funnelCountedStages||{})};
   if(!markers[next]){f[counted[next]]=Number(f[counted[next]]||0)+1;markers[next]=true;}
 }
 const offerRecordId=next==='offered'?hash(`offer:${o.id}:${input.requestId}`):undefined;
 const offerRecord=next==='offered'?{id:offerRecordId,opportunityId:o.id,campaignId:o.campaignId,employerId:o.employerId,studentId:o.studentId,institutionId:o.institutionId,role:o.role,salaryLPA:Number(p.meta.offer.salaryLPA),currency:'INR',joiningWindow:o.joiningWindow,terms:String(p.meta.offer.terms||'Standard employer offer terms; subject to candidate acceptance.'),offerLetterUrl:p.meta.offer.offerLetterUrl?String(p.meta.offer.offerLetterUrl):'',status:'issued',issuedAt:now,issuedBy:input.actorUid}:undefined;
 const updated={...o,stage:next,assessmentScore:assessment?null:o.assessmentScore,assessmentEvidenceHash:assessment?hash(assessment.response):o.assessmentEvidenceHash,assessmentTemplateId:assessment?assessment.templateId:o.assessmentTemplateId,assessmentSubmissionId:assessmentId||o.assessmentSubmissionId,assessmentReviewStatus:assessment?'pending_review':o.assessmentReviewStatus,interviewFeedback:actor.role==='employer'&&['shortlisted','interviewing','offered'].includes(next)?(p.meta?.interviewFeedback??o.interviewFeedback):o.interviewFeedback,offerLetterUrl:next==='offered'&&p.meta?.offer?.offerLetterUrl?String(p.meta.offer.offerLetterUrl):o.offerLetterUrl,offerRecordId:offerRecordId||o.offerRecordId,stageUpdatedAt:now,...(next==='joined'?{joinedAt:now,joinedSalaryLPA:acceptedOffer!.salaryLPA}:{}),funnelCountedStages:{...(o.funnelCountedStages||{}),...(old!==next&&counted[next]?{[next]:true}:{})}};
 writes.push({name:nameOf('opportunities',o.id),data:updated},{name:nameOf('campaigns',c.id),data:{...c,funnel:f}});
 if(assessment&&assessmentId)writes.push({name:nameOf('assessmentSubmissions',assessmentId),data:{id:assessmentId,opportunityId:o.id,campaignId:o.campaignId,employerId:o.employerId,studentId:o.studentId,templateId:assessment.templateId,response:assessment.response,shareWithEmployer:assessment.shareWithEmployer,evidenceHash:hash(assessment.response),status:'pending_review',submittedAt:now,submittedBy:input.actorUid}});
 if(offerRecord)writes.push({name:nameOf('offers',offerRecord.id),data:offerRecord});
 if(acceptedOffer)writes.push({name:nameOf('offers',acceptedOffer.id),data:{...acceptedOffer,status:next,...(next==='accepted'?{acceptedAt:now,acceptedBy:input.actorUid}:{joinedAt:now,joinedBy:input.actorUid})}});
 if(next==='joined'){
   const s=await must('students',o.studentId);
   writes.push({name:nameOf('students',o.studentId),data:{...s,placementStatus:'placed',placedCompany:o.employerName,placedSalaryLPA:acceptedOffer!.salaryLPA,availability:'not_currently_available'}});
   const successFeeId=hash(`success-fee:${o.id}`); const existingFee=await read('successFees',successFeeId);
   if(existingFee)throw new Error('Existing success fee requires reconciliation before joining');
   {
     // LPA -> rupees -> paise; charge only against the authoritative accepted offer.
     const {compensationMinor,feeAmountMinor}=quoteSuccessFee(Math.round(acceptedOffer!.salaryLPA*10000000));
     writes.push({name:nameOf('successFees',successFeeId),data:{id:successFeeId,opportunityId:o.id,campaignId:o.campaignId,employerId:o.employerId,studentId:o.studentId,compensationMinor,feeRateBps:500,feeAmountMinor,currency:'INR',status:'earned',earnedAt:now}});
   }
 }
 ids.push(o.id,c.id);
 break;
}
   default:throw new Error('Unsupported recruitment transition');
  }
  writes.push({name:an,data:{eventId:aid,requestId:input.requestId,actorUid:input.actorUid,actorRole:actor.role,action:input.action,ids,timestamp:now,immutable:true}});await commit(t,writes);return {replayed:false,auditEventId:aid,ids};
 }catch(e){await rollback(t);throw e;}});
}

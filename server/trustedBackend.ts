import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const DATABASE = process.env.FIREBASE_DATABASE_ID || '(default)';
const BASE = PROJECT_ID ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE)}/documents` : '';
const firebaseIdTokenContext = new AsyncLocalStorage<string>();

type FirebaseTokenContext = { token: string; uid?: string };
const firebaseContext = new AsyncLocalStorage<FirebaseTokenContext>();
type Doc = { name?: string; fields?: Record<string, Value> };
type Value = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: string; timestampValue?: string; arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> } };
const fromValue = (v?: Value): any => !v ? undefined : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : 'nullValue' in v ? null : 'timestampValue' in v ? v.timestampValue : 'arrayValue' in v ? (v.arrayValue?.values || []).map(fromValue) : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue?.fields || {}).map(([k,x]) => [k,fromValue(x)])) : undefined;
const fromDoc = (d?: Doc | null): Record<string,any> | null => !d ? null : Object.fromEntries(Object.entries(d.fields || {}).map(([k,v]) => [k,fromValue(v)]));
const toValue = (v: any): Value => v == null ? { nullValue:'NULL_VALUE' } : typeof v === 'string' ? {stringValue:v} : typeof v === 'boolean' ? {booleanValue:v} : typeof v === 'number' ? (Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v}) : Array.isArray(v) ? {arrayValue:{values:v.map(toValue)}} : {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,toValue(x)]))}};
const toDoc = (name:string,data:Record<string,unknown>):Doc => ({name,fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,toValue(v)]))});
const nameOf = (collection:string,id:string) => { if(!PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID is required for trusted Firestore operations'); return `${BASE}/${collection}/${encodeURIComponent(id)}`; };
async function token(){ const firebaseIdToken=firebaseIdTokenContext.getStore(); if(firebaseIdToken) return firebaseIdToken; if(process.env.GOOGLE_OAUTH_ACCESS_TOKEN) return process.env.GOOGLE_OAUTH_ACCESS_TOKEN; const r=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'}}); if(!r.ok) throw new Error(`Unable to obtain Google workload identity token (${r.status})`); const d=await r.json() as any; if(!d.access_token) throw new Error('Google workload identity token was not returned'); return d.access_token; }
async function request<T>(url:string,init:RequestInit={}):Promise<T>{ const r=await fetch(url,{...init,headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json',...(init.headers||{})}}); if(!r.ok){const b=await r.text();throw new Error(`Firestore trusted request failed (${r.status}): ${b.slice(0,500)}`)} return r.status===204?{} as T:await r.json() as T; }
async function begin(){const r=await request<{transaction?:string}>(`${BASE}:beginTransaction`,{method:'POST',body:JSON.stringify({options:{readWrite:{}}})});if(!r.transaction)throw new Error('Firestore transaction was not created');return r.transaction;}
async function readTx(n:string,t:string){try{return fromDoc(await request<Doc>(`${n}?transaction=${encodeURIComponent(t)}`));}catch(e){if(String(e).includes('(404)'))return null;throw e;}}
async function commit(t:string,w:Array<{name:string,data:Record<string,unknown>}>){await request(`${BASE}:commit`,{method:'POST',body:JSON.stringify({transaction:t,writes:w.map(x=>({update:toDoc(x.name,x.data)}))})});}
async function rollback(t:string){try{await request(`${BASE}:rollback`,{method:'POST',body:JSON.stringify({transaction:t})});}catch{}}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const RE=/^[A-Za-z0-9._:-]{8,128}$/;

export interface CandidateProjectionRequest { actorUid:string; campaignId:string; studentId:string; requestId:string }

export interface CareerEvidenceRequest {
 actorUid:string; requestId:string; evidenceId:string; studentId:string; claimType:string; claimKey:string; claimValue:string;
 sourceType:string; sourceId?:string; evidenceUri?:string; expiresAt?:string;
}

export type TrustedProfileMutationAction =
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
}

export async function executeTrustedProfileMutation(input:TrustedProfileMutationRequest):Promise<{replayed:boolean;auditEventId:string;ids:string[]}>{
 return firebaseIdTokenContext.run(input.firebaseIdToken||'',async()=>{
  if(!RE.test(input.requestId))throw new Error('Invalid requestId');
  const t=await begin();
  try{
   const aid=hash(`${input.requestId}:${input.actorUid}:${input.action}`),an=nameOf('auditEvents',aid),existing=await readTx(an,t);
   if(existing){await rollback(t);return {replayed:true,auditEventId:aid,ids:[]};}
   const actor=await readTx(nameOf('users',input.actorUid),t); if(!actor)throw new Error('Actor record was not found');
   const p=input.payload||{},now=new Date().toISOString(),writes:any[]=[],ids:string[]=[];
   const read=async(c:string,id:string)=>readTx(nameOf(c,id),t);
   const must=async(c:string,id:string)=>{const v=await read(c,id);if(!v)throw new Error(`${c}/${id} was not found`);return v;};
   const admin=()=>{if(actor.role!=='super_admin')throw new Error('Super admin authorization is required');};
   switch(input.action){
    case 'UPDATE_GLOBAL_PRIVACY':{
     role(actor,['student']); const s=await must('students',input.actorUid); const current=s.globalDataPrivacy||{allowUnsolicitedPings:false,anonymizeProfileUntilConsent:false,shareVerifiedBadgesGlobally:true,autoDeclineBelowMinSalary:false};
     const allowed=['allowUnsolicitedPings','anonymizeProfileUntilConsent','shareVerifiedBadgesGlobally','autoDeclineBelowMinSalary'];
     const patch:any={}; for(const k of allowed)if(typeof p.settings?.[k]==='boolean')patch[k]=p.settings[k];
     writes.push({name:nameOf('students',input.actorUid),data:{...s,globalDataPrivacy:{...current,...patch}}}); ids.push(input.actorUid); break;
    }
    case 'PUBLISH_INSTITUTION_AVAILABILITY':{
     role(actor,['institution']); const id=String(p.institutionId||''); if(id!==input.actorUid)throw new Error('Institution is not authorized to publish this availability');
     const inst=await must('institutions',id); const count=Number(p.count); const batchYear=Number(p.batchYear); const branch=String(p.branch||'').trim(),description=String(p.description||'').trim();
     if(!Number.isInteger(batchYear)||batchYear<2000||batchYear>2100||!Number.isFinite(count)||count<0||!branch||!description)throw new Error('Invalid institution availability');
     const published=Array.isArray(inst.publishedAvailability)?inst.publishedAvailability:[]; const entry={batchYear,branch,talentCount:Math.floor(count),description,publishedAt:now.slice(0,10)};
     writes.push({name:nameOf('institutions',id),data:{...inst,publishedAvailability:[entry,...published]}}); ids.push(id); break;
    }
    case 'UPDATE_STUDENT_AVAILABILITY':{
     role(actor,['student']); const id=String(p.studentId||input.actorUid); if(id!==input.actorUid)throw new Error('Student is not authorized to change another student availability');
     const s=await must('students',id); if(!['actively_seeking','open_to_offers','not_currently_available'].includes(p.availability))throw new Error('Invalid student availability');
     writes.push({name:nameOf('students',id),data:{...s,availability:p.availability}}); ids.push(id); break;
    }
    case 'ADD_VERIFIED_SKILL':{
     admin(); const id=String(p.studentId||''); const s=await must('students',id),skill=p.skill||{}; if(!skill.name||!['technical','domain','communication','tools'].includes(skill.category)||!Number.isFinite(Number(skill.score)))throw new Error('Invalid verified skill');
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
     admin(); const id=String(p.studentId||''),status=String(p.status); const s=await must('students',id); if(!['pending','verified','rejected'].includes(status))throw new Error('Invalid student institution verification status');
     writes.push({name:nameOf('students',id),data:{...s,institutionVerificationStatus:status,verificationNotes:p.notes!==undefined?String(p.notes):s.verificationNotes}}); ids.push(id); break;
    }
    case 'UPDATE_STUDENT_PLATFORM_VERIFICATION':{
     admin(); const id=String(p.studentId||''),status=String(p.status); const s=await must('students',id); if(!['pending','verified','rejected'].includes(status))throw new Error('Invalid student platform verification status');
     writes.push({name:nameOf('students',id),data:{...s,platformVerificationStatus:status,verificationNotes:p.notes!==undefined?String(p.notes):s.verificationNotes}}); ids.push(id); break;
    }
    case 'REGISTER_INDEPENDENT_CANDIDATE':{
     role(actor,['student']); const id=input.actorUid; if(await read('students',id))throw new Error('Student profile already exists');
     const d=p.candidateData||{}; if(!d.name||!d.email||!d.program||!d.branch||!d.independentCredentials)throw new Error('Required independent candidate data is missing');
     const student={...d,id,name:String(d.name),email:String(d.email),candidateType:'independent_direct',isEmpanelledCampus:false,institutionId:'inst-independent',institutionName:d.independentCredentials.collegeName?`${d.independentCredentials.collegeName} (Direct)`:'Direct Independent Candidate',institutionCode:'DIRECT-IND',institutionVerificationStatus:'not_applicable',platformVerificationStatus:'pending',verificationNotes:`Direct candidate submission on ${now.slice(0,10)}. Pending Platform Admin credential review.`,independentCredentials:{...d.independentCredentials,submissionDate:now.slice(0,10)},availability:'actively_seeking',placementStatus:'unplaced',globalDataPrivacy:{allowUnsolicitedPings:true,anonymizeProfileUntilConsent:false,shareVerifiedBadgesGlobally:true,autoDeclineBelowMinSalary:false}};
     writes.push({name:nameOf('students',id),data:student}); ids.push(id); break;
    }
    case 'PROVISION_USER_ROLE':{
     admin(); const id=String(p.targetUid||''); const target=await must('users',id); if(!['employer','institution','student','simulation','super_admin'].includes(p.targetRole))throw new Error('Invalid user role');
     writes.push({name:nameOf('users',id),data:{...target,role:p.targetRole,updatedAt:now}}); ids.push(id); break;
    }
    case 'REVIEW_CAREER_EVIDENCE':{
     admin(); const id=String(p.evidenceId||''),next=String(p.status); const evidence=await must('careerEvidence',id);
     const allowed=['submitted','under_review','verified','rejected','expired']; if(!allowed.includes(next))throw new Error('Invalid evidence verification status');
     const current=String(evidence.status);
     const transitions:Record<string,string[]>={submitted:['under_review','rejected'],under_review:['verified','rejected'],verified:['under_review','expired'],expired:['under_review'],rejected:[]};
     if(!(transitions[current]||[]).includes(next))throw new Error(`Invalid evidence transition from ${current} to ${next}`);
     if(next==='verified' && (!evidence.sourceId || evidence.sourceType==='student_submission'))throw new Error('Verified evidence requires an authoritative source reference');
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
     role(actor,['student']); const id=String(p.evidenceId||''),evidence=await must('careerEvidence',id);
     if(evidence.studentId!==input.actorUid)throw new Error('Student is not authorized to dispute this evidence');
     if(!['verified','rejected','expired','under_review'].includes(String(evidence.status)))throw new Error('Evidence is not disputable in its current state');
     const reason=String(p.reason||'').trim(); if(reason.length<10)throw new Error('A meaningful dispute reason is required');
     const updated={...evidence,disputeStatus:'open',disputeReason:reason,disputeOpenedAt:now,disputeOpenedBy:input.actorUid,lineageHash:hash(JSON.stringify({previousLineageHash:evidence.lineageHash,action:'DISPUTE_OPENED',actorUid:input.actorUid,timestamp:now}))};
     writes.push({name:nameOf('careerEvidence',id),data:updated}); ids.push(id); break;
    }
    case 'RESOLVE_CAREER_EVIDENCE_DISPUTE':{
     admin(); const id=String(p.evidenceId||''),evidence=await must('careerEvidence',id);
     if(evidence.disputeStatus!=='open')throw new Error('Evidence does not have an open dispute');
     const resolution=String(p.resolution||'').trim(); if(resolution.length<10)throw new Error('A meaningful dispute resolution is required');
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
  const t=await begin(); try{
   const [actor,student,existing]=await Promise.all([
    readTx(nameOf('users',input.actorUid),t),readTx(nameOf('students',input.studentId),t),readTx(nameOf('careerEvidence',input.evidenceId),t)
   ]);
   if(!actor||!student) throw new Error('Required identity records were not found');
   if(actor.role!=='student' || input.actorUid!==input.studentId) throw new Error('Only the student may submit personal Career Passport evidence'); if(input.sourceType!=='student_submission') throw new Error('Student evidence submissions must use student_submission as the source type');
   if(existing){await rollback(t);return {evidenceId:input.evidenceId,replayed:true};}
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



export async function authorizeCommercialCampaign(actorUid:string,campaignId:string,firebaseIdToken?:string){
 return firebaseIdTokenContext.run(firebaseIdToken||'',async()=>{ const t=await begin(); try{ const actor=await readTx(nameOf('users',actorUid),t); const campaign=await readTx(nameOf('campaigns',campaignId),t); if(!actor||actor.role!=='employer')throw new Error('Only an employer can purchase a hiring campaign'); if(!campaign)throw new Error('Campaign was not found'); if(campaign.employerId!==actorUid)throw new Error('Employer is not authorized for this campaign'); await rollback(t); return {campaignId}; }catch(e){await rollback(t);throw e;} });
}

export async function createCommercialInvoice(input:{actorUid:string;requestId:string;invoiceId:string;ownerUid:string;amountMinor:number;currency:string;description:string;providerOrderId:string;campaignId?:string;firebaseIdToken?:string}){
 return firebaseIdTokenContext.run(input.firebaseIdToken||'',async()=>{ if(!RE.test(input.requestId)||!RE.test(input.invoiceId))throw new Error('Invalid commercial identifier'); if(input.actorUid!==input.ownerUid)throw new Error('Commercial invoice ownership mismatch'); if(!Number.isInteger(input.amountMinor)||input.amountMinor<=0)throw new Error('Invoice amount must be a positive integer in minor currency units');
  const t=await begin(); try{
   const actor=await readTx(nameOf('users',input.actorUid),t); if(!actor||!['employer','institution','super_admin'].includes(actor.role))throw new Error('Commercial invoicing is not authorized');
   if(input.campaignId){ const campaign=await readTx(nameOf('campaigns',input.campaignId),t); if(!campaign)throw new Error('Campaign was not found'); if(actor.role==='employer'&&campaign.employerId!==input.actorUid)throw new Error('Employer is not authorized for this campaign'); }
   const existing=await readTx(nameOf('invoices',input.invoiceId),t); if(existing){await rollback(t);return {invoiceId:input.invoiceId,replayed:true};}
   const now=new Date().toISOString(); const auditId=hash(input.requestId+':'+input.actorUid+':COMMERCIAL_INVOICE');
   const invoice={id:input.invoiceId,ownerUid:input.ownerUid,amountMinor:input.amountMinor,currency:input.currency,description:input.description,campaignId:input.campaignId||'',provider:'razorpay',providerOrderId:input.providerOrderId,status:'issued',createdAt:now};
   const event={id:auditId,eventId:auditId,ownerUid:input.ownerUid,type:'invoice_issued',invoiceId:input.invoiceId,providerOrderId:input.providerOrderId,amountMinor:input.amountMinor,currency:input.currency,timestamp:now,immutable:true};
   const writes:any[]=[{name:nameOf('invoices',input.invoiceId),data:invoice},{name:nameOf('billingEvents',auditId),data:event}];
   if(input.campaignId) writes.push({name:nameOf('campaignCharges',input.invoiceId),data:{id:input.invoiceId,invoiceId:input.invoiceId,campaignId:input.campaignId,employerId:input.ownerUid,amountMinor:input.amountMinor,currency:input.currency,status:'pending',provider:'razorpay',providerOrderId:input.providerOrderId,createdAt:now}});
   await commit(t,writes); return {invoiceId:input.invoiceId,replayed:false};
  }catch(e){await rollback(t);throw e;}
 });
}

export async function recordRazorpayWebhook(input:{eventId:string;eventType:string;orderId?:string;paymentId?:string;invoiceId?:string;status:string;amountMinor?:number;currency?:string}){
 const t=await begin(); try{
  if(!input.eventId||input.eventId.length>200)throw new Error('Invalid webhook event identifier');
  const existing=await readTx(nameOf('billingEvents',input.eventId),t); if(existing){await rollback(t);return {replayed:true};}
  const now=new Date().toISOString();
  let ownerUid:string|undefined; let invoice:any=null;
  if(input.invoiceId) invoice=await readTx(nameOf('invoices',input.invoiceId),t);
  if(invoice) ownerUid=invoice.ownerUid;
  if(!invoice&&input.orderId){
    // Provider order IDs are stored on invoices; webhook remains immutable even when
    // the invoice lookup is unavailable, and reconciliation can resolve it later.
  }
  const event={id:input.eventId,eventId:input.eventId,ownerUid:ownerUid||'',type:input.eventType,provider:'razorpay',orderId:input.orderId||'',paymentId:input.paymentId||'',invoiceId:input.invoiceId||'',status:input.status,amountMinor:Number.isInteger(input.amountMinor)?input.amountMinor:0,currency:input.currency||'INR',timestamp:now,immutable:true};
  const writes:any[]=[{name:nameOf('billingEvents',input.eventId),data:event}];
  if(invoice){
    const nextStatus=input.status==='captured'?'paid':input.status==='failed'?'payment_failed':input.status==='refunded'?'refunded':invoice.status;
    writes.push({name:nameOf('invoices',invoice.id),data:{...invoice,status:nextStatus,lastPaymentId:input.paymentId||invoice.lastPaymentId,lastProviderEventId:input.eventId,updatedAt:now}});
    if(invoice.campaignId) {
      const charge=await readTx(nameOf('campaignCharges',invoice.id),t);
      if(charge) writes.push({name:nameOf('campaignCharges',invoice.id),data:{...charge,status:nextStatus,updatedAt:now,lastProviderEventId:input.eventId}});
    }
  }
  await commit(t,writes); return {replayed:false};
 }catch(e){await rollback(t);throw e;}
}

export async function provisionCandidateProjection(input:CandidateProjectionRequest & {firebaseIdToken?:string}):Promise<{projectionId:string;replayed:boolean}>{
 return firebaseIdTokenContext.run(input.firebaseIdToken || '', async()=>{ if(!RE.test(input.requestId))throw new Error('Invalid requestId'); const t=await begin(); try{
  const [actor,campaign,student]=await Promise.all([readTx(nameOf('users',input.actorUid),t),readTx(nameOf('campaigns',input.campaignId),t),readTx(nameOf('students',input.studentId),t)]);
  if(!actor||!campaign||!student)throw new Error('Required recruitment records were not found');
  if(!['employer','institution'].includes(actor.role))throw new Error('Only employers or institutions may provision candidate projections');
  if(actor.role==='employer'&&campaign.employerId!==input.actorUid)throw new Error('Employer is not authorized for this campaign');
  if(actor.role==='institution'&&(!Array.isArray(campaign.targetedInstitutionIds)||!campaign.targetedInstitutionIds.includes(input.actorUid)))throw new Error('Institution is not targeted by this campaign');
  if(actor.role==='institution'&&student.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this student');
  const consent=student.campaignConsents?.[input.campaignId]; if(!consent||consent.status!=='approved')throw new Error('Explicit campaign consent is required before projection'); if(consent.employerId!==campaign.employerId)throw new Error('Consent does not match the campaign employer');
  const id=hash(`${campaign.employerId}:${input.campaignId}:${input.studentId}`), pn=nameOf('candidateProfiles',id), an=nameOf('auditEvents',hash(`${input.requestId}:${input.actorUid}:${input.campaignId}:${input.studentId}`));
  const [existing,existingAudit]=await Promise.all([readTx(pn,t),readTx(an,t)]); if(existingAudit){await rollback(t);return {projectionId:id,replayed:true};}
  const evidenceIds=Array.isArray(student.evidenceIds)?student.evidenceIds:[]; const evidenceRecords=(await Promise.all(evidenceIds.map((eid:string)=>readTx(nameOf('careerEvidence',eid),t)))).filter(Boolean) as any[];
  const verifiedEvidence=evidenceRecords.filter((e:any)=>e.status==='verified' && (!e.expiresAt || new Date(e.expiresAt).getTime()>Date.now()) && e.studentId===input.studentId);
  const projection:any={studentId:input.studentId,employerId:campaign.employerId,campaignId:input.campaignId,role:campaign.requirement?.role||'Hiring Opportunity',name:student.name||'Candidate',institutionId:student.institutionId||'',institutionName:student.institutionName||'',candidateType:student.candidateType||'unknown',consentStatus:'approved',consentUpdatedAt:consent.updatedAt||new Date().toISOString(),projectionVersion:2,updatedAt:new Date().toISOString()};
  if(consent.academicDataShared)Object.assign(projection,{program:student.program||'',branch:student.branch||'',graduationYear:student.graduationYear||0,cgpa:student.cgpa||0});
  if(consent.skillBenchmarksShared){
    const verifiedSkillEvidence=verifiedEvidence.filter((e:any)=>e.claimType==='skill').map((e:any)=>({claimKey:e.claimKey,claimValue:e.claimValue,evidenceId:e.id,sourceType:e.sourceType,verifiedAt:e.reviewedAt,expiresAt:e.expiresAt||null}));
    projection.verifiedSkills=verifiedSkillEvidence;
  }
  projection.verifiedEvidence=verifiedEvidence.map((e:any)=>({id:e.id,claimType:e.claimType,claimKey:e.claimKey,claimValue:e.claimValue,sourceType:e.sourceType,reviewedAt:e.reviewedAt,expiresAt:e.expiresAt||null}));
  if(consent.projectReposShared)projection.projects=Array.isArray(student.projects)?student.projects:[]; if(consent.contactInfoShared)projection.email=student.email||'';
  const audit={eventId:an.split('/').pop(),requestId:input.requestId,actorUid:input.actorUid,actorRole:actor.role,subjectStudentId:input.studentId,employerId:campaign.employerId,campaignId:input.campaignId,action:'CANDIDATE_PROJECTION_PROVISIONED',consentScope:{academicDataShared:!!consent.academicDataShared,skillBenchmarksShared:!!consent.skillBenchmarksShared,projectReposShared:!!consent.projectReposShared,contactInfoShared:!!consent.contactInfoShared},projectionId:id,timestamp:new Date().toISOString(),immutable:true};
  await commit(t,existing?[{name:an,data:audit}]:[{name:pn,data:projection},{name:an,data:audit}]); return {projectionId:id,replayed:false};
 }catch(e){await rollback(t);throw e;}});
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
 assessment_pending:['student','employer'],
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
const scoreAssessmentResponse=(response:string)=>{const text=response.trim();if(text.length<80)throw new Error('Assessment response is too short to score');const words=text.split(/\\s+/).filter(Boolean).length;const sentences=(text.match(/[.!?]/g)||[]).length;const paragraphs=(text.match(/\\n\\s*\\n/g)||[]).length+1;return Math.min(100,Math.max(20,20+Math.min(35,Math.floor(words/12)*5)+Math.min(30,Math.floor(text.length/160)*5)+Math.min(15,sentences*2)+Math.min(10,paragraphs*2)));};

export async function executeRecruitmentTransition(input:RecruitmentTransitionRequest & {firebaseIdToken?:string}):Promise<RecruitmentTransitionResult>{
 return firebaseIdTokenContext.run(input.firebaseIdToken || '', async()=>{ if(!RE.test(input.requestId))throw new Error('Invalid requestId'); const t=await begin(); try{
  const aid=auditId(input),an=nameOf('auditEvents',aid),existing=await readTx(an,t); if(existing){await rollback(t);return {replayed:true,auditEventId:aid,ids:[]};}
  const actor=await readTx(nameOf('users',input.actorUid),t); if(!actor)throw new Error('Actor record was not found'); const p=input.payload||{},now=new Date().toISOString(); const writes:any[]=[],ids:string[]=[];
  const read=async(c:string,id:string)=>readTx(nameOf(c,id),t); const must=async(c:string,id:string)=>{const v=await read(c,id);if(!v)throw new Error(`${c}/${id} was not found`);return v;};
  switch(input.action){
   case 'CREATE_REQUIREMENT_CAMPAIGN':{role(actor,['employer']);const r=clone(p.requirement),c=clone(p.campaign);if(!r?.id||!c?.id||c.requirementId!==r.id)throw new Error('Requirement and campaign identifiers are required and must match');if(r.employerId!==input.actorUid||c.employerId!==input.actorUid)throw new Error('Employer ownership mismatch');if(await read('requirements',r.id)||await read('campaigns',c.id))throw new Error('Recruitment identifiers already exist; refusing to overwrite');writes.push({name:nameOf('requirements',r.id),data:r},{name:nameOf('campaigns',c.id),data:c});ids.push(r.id,c.id);break;}
   case 'SEND_CALLS':{role(actor,['employer']);const c=await must('campaigns',p.campaignId);if(c.employerId!==input.actorUid)throw new Error('Employer is not authorized for this campaign');const calls=Array.isArray(p.calls)?p.calls:[];if(!calls.length)throw new Error('At least one call is required');const seen=new Set<string>();for(const call of calls){if(!call.id||call.campaignId!==c.id||call.employerId!==input.actorUid)throw new Error('Call ownership or campaign mismatch');if(seen.has(call.id)||await read('calls',call.id))throw new Error('One or more call identifiers already exist');seen.add(call.id);writes.push({name:nameOf('calls',call.id),data:call});}const targeted=Array.from(new Set([...(Array.isArray(c.targetedInstitutionIds)?c.targetedInstitutionIds:[]),...calls.map((x:any)=>x.institutionId)]));writes.push({name:nameOf('campaigns',c.id),data:{...c,targetedInstitutionIds:targeted,callsSent:[...(Array.isArray(c.callsSent)?c.callsSent:[]),...calls],funnel:{...c.funnel,institutionsInvited:targeted.length}}});ids.push(...calls.map((x:any)=>x.id),c.id);break;}
   case 'RESPOND_CALL':{role(actor,['institution']);const call=await must('calls',p.callId);if(call.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this call');const c=await must('campaigns',call.campaignId);if(call.status!=='pending')throw new Error('Call has already been responded to');if(!['accepted','declined','countered'].includes(p.status))throw new Error('Invalid call status');const updated={...call,status:p.status,responseNotes:String(p.responseNotes||''),offeredCandidatesCount:p.offeredCandidatesCount??call.vacanciesRequested*2,counterDaysExtension:p.counterDaysExtension,respondedAt:now};const f={...c.funnel,institutionsAccepted:Number(c.funnel?.institutionsAccepted||0)+(p.status==='declined'?0:1)};writes.push({name:nameOf('calls',call.id),data:updated},{name:nameOf('campaigns',c.id),data:{...c,funnel:f}});ids.push(call.id,c.id);break;}
   case 'ACTIVATE_STUDENTS':{role(actor,['institution']);const call=await must('calls',p.callId);if(call.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this call');const c=await must('campaigns',call.campaignId);const studentIds=Array.isArray(p.studentIds)?Array.from(new Set(p.studentIds)):[];if(!studentIds.length)throw new Error('At least one student is required');const opps:any[]=[];for(const sid of studentIds){const s=await must('students',sid);if(s.institutionId!==input.actorUid)throw new Error('Institution is not authorized for one or more students');const id=String(p.opportunityIds?.[sid]||hash(`${call.id}:${sid}`));if(await read('opportunities',id))throw new Error('Opportunity already exists; refusing to duplicate');opps.push({id,callId:call.id,campaignId:c.id,employerId:call.employerId,employerName:call.employerName,role:call.role,salaryLPA:c.requirement?.salaryMinLPA||0,locations:call.locations,joiningWindow:call.joiningWindow,studentId:sid,studentName:s.name||'Student',institutionId:call.institutionId,institutionName:call.institutionName,matchScore:0,matchBreakdown:{skillMatchScore:0,academicMatchScore:0,preferenceMatchScore:0,aiRationale:'Candidate activated through institutional workflow; human evaluation required.'},stage:'invited',invitedAt:now,stageUpdatedAt:now});}for(const o of opps)writes.push({name:nameOf('opportunities',o.id),data:o});writes.push({name:nameOf('campaigns',c.id),data:{...c,candidateOpportunities:[...(Array.isArray(c.candidateOpportunities)?c.candidateOpportunities:[]),...opps],funnel:{...c.funnel,studentsInvited:Number(c.funnel?.studentsInvited||0)+opps.length}}});ids.push(...opps.map(o=>o.id),c.id);break;}
   case 'SUBMIT_CONSENT':{role(actor,['student']);const o=await must('opportunities',p.opportunityId);if(o.studentId!==input.actorUid)throw new Error('Student is not authorized for this opportunity');const c=await must('campaigns',o.campaignId);const yes=Boolean(p.consented),next=yes?'assessment_pending':'declined';if(!['invited','declined','assessment_pending'].includes(o.stage))throw new Error('Opportunity is not in a consentable state');const f={...c.funnel};if(yes&&o.stage!=='assessment_pending')f.applicationsConsented=Number(f.applicationsConsented||0)+1;if(!yes&&o.stage==='assessment_pending')f.applicationsConsented=Math.max(0,Number(f.applicationsConsented||0)-1);writes.push({name:nameOf('opportunities',o.id),data:{...o,stage:next,consentedAt:yes?now:undefined,stageUpdatedAt:now}},{name:nameOf('campaigns',c.id),data:{...c,funnel:f}});ids.push(o.id,c.id);break;}
   case 'UPDATE_CONSENT_SCOPE':{role(actor,['student']);const s=await must('students',input.actorUid),cid=String(p.campaignId),cons={...(s.campaignConsents||{})},cur=cons[cid];if(!cur||cur.status!=='approved')throw new Error('Approved campaign consent is required before changing scope');if(!['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared'].includes(p.scopeKey))throw new Error('Invalid consent scope');cons[cid]={...cur,[p.scopeKey]:Boolean(p.value),updatedAt:now};writes.push({name:nameOf('students',input.actorUid),data:{...s,campaignConsents:cons}});ids.push(input.actorUid,cid);break;}
   case 'GLOBAL_CONSENT':{role(actor,['student']);const s=await must('students',input.actorUid);const idsRequested=Array.isArray(p.campaignIds)?p.campaignIds:Array.isArray(p.campaigns)?p.campaigns.map((c:any)=>c?.id):[];const unique=Array.from(new Set(idsRequested.filter((x:any)=>typeof x==='string'&&x.length>0))) as string[];if(!unique.length)throw new Error('At least one campaign is required');const cons={...(s.campaignConsents||{})};for(const cid of unique){const c=await must('campaigns',cid);const eligible=Array.isArray(c.targetedInstitutionIds)&&s.institutionId&&c.targetedInstitutionIds.includes(s.institutionId);if(!eligible)throw new Error('Student is not eligible for one or more requested campaigns');cons[cid]={campaignId:cid,employerId:c.employerId,employerName:c.employerName,role:c.requirement?.role||'Hiring Opportunity',salaryLPA:`₹${c.requirement?.salaryMinLPA||0} - ${c.requirement?.salaryMaxLPA||0} LPA`,status:p.approved?'approved':'denied',academicDataShared:Boolean(p.approved),skillBenchmarksShared:Boolean(p.approved),projectReposShared:Boolean(p.approved),contactInfoShared:Boolean(p.approved),updatedAt:now,...(p.approved?{}:{reasonForDenial:'Student engaged Global Privacy Lock.'})};}writes.push({name:nameOf('students',input.actorUid),data:{...s,campaignConsents:cons}});ids.push(input.actorUid,...unique);break;}
   case 'ADVANCE_CANDIDATE_STAGE':{
 const o=await must('opportunities',p.opportunityId);
 role(actor,['employer','institution','student']);
 if(actor.role==='employer'&&o.employerId!==input.actorUid)throw new Error('Employer is not authorized for this opportunity');
 if(actor.role==='institution'&&o.institutionId!==input.actorUid)throw new Error('Institution is not authorized for this opportunity');
 if(actor.role==='student'&&o.studentId!==input.actorUid)throw new Error('Student is not authorized for this opportunity');
 const next=String(p.nextStage);
 if(!stages.includes(next))throw new Error('Invalid recruitment stage');
 if(!(allowedTransitions[o.stage]||[]).includes(next))throw new Error(`Invalid transition from ${o.stage} to ${next}`);
 if(!(stageRoles[next]||[]).includes(actor.role))throw new Error(`Role ${actor.role} cannot advance to ${next}`);
 if(next==='assessment_completed'&&actor.role!=='student')throw new Error('Only the student may submit assessment evidence');
 const assessmentScore=next==='assessment_completed'?scoreAssessmentResponse(String(p.meta?.assessmentResponse||'')):undefined;
 if(next==='offered'&&actor.role!=='employer')throw new Error('Only the employer may issue an offer');
 if(next==='offered'&&(!p.meta?.offer || typeof p.meta.offer.salaryLPA!=='number' || p.meta.offer.salaryLPA<0))throw new Error('Offer terms are required before offered stage');
 const c=await must('campaigns',o.campaignId),f={...c.funnel},old=o.stage;
 if(counted[next]&&old!==next){
   const markers={...(o.funnelCountedStages||{})};
   if(!markers[next]){f[counted[next]]=Number(f[counted[next]]||0)+1;markers[next]=true;}
 }
 const offerRecordId=next==='offered'?hash(`offer:${o.id}:${input.requestId}`):undefined;
 const offerRecord=next==='offered'?{id:offerRecordId,opportunityId:o.id,campaignId:o.campaignId,employerId:o.employerId,studentId:o.studentId,institutionId:o.institutionId,role:o.role,salaryLPA:Number(p.meta.offer.salaryLPA),currency:'INR',joiningWindow:o.joiningWindow,terms:String(p.meta.offer.terms||'Standard employer offer terms; subject to candidate acceptance.'),offerLetterUrl:p.meta.offer.offerLetterUrl?String(p.meta.offer.offerLetterUrl):'',status:'issued',issuedAt:now,issuedBy:input.actorUid}:undefined;
 const updated={...o,stage:next,assessmentScore:next==='assessment_completed'?assessmentScore:o.assessmentScore,assessmentEvidenceHash:next==='assessment_completed'?hash(String(p.meta.assessmentResponse||'')):o.assessmentEvidenceHash,assessmentTemplateId:next==='assessment_completed'?String(p.meta.assessmentTemplateId||'platform-deterministic'):o.assessmentTemplateId,interviewFeedback:p.meta?.interviewFeedback??o.interviewFeedback,offerLetterUrl:p.meta?.offer?.offerLetterUrl?String(p.meta.offer.offerLetterUrl):o.offerLetterUrl,offerRecordId:offerRecordId||o.offerRecordId,stageUpdatedAt:now,funnelCountedStages:{...(o.funnelCountedStages||{}),...(old!==next&&counted[next]?{[next]:true}:{})}};
 writes.push({name:nameOf('opportunities',o.id),data:updated},{name:nameOf('campaigns',c.id),data:{...c,funnel:f}});
 if(offerRecord)writes.push({name:nameOf('offers',offerRecord.id),data:offerRecord});
 if(next==='joined'){
   const s=await must('students',o.studentId);
   writes.push({name:nameOf('students',o.studentId),data:{...s,placementStatus:'placed',placedCompany:o.employerName,placedSalaryLPA:o.salaryLPA,availability:'not_currently_available'}});
   const successFeeId=hash(`success-fee:${o.id}`); const existingFee=await read('successFees',successFeeId);
   if(!existingFee){
     const compensationLpa=Number(o.salaryLPA||0); const compensationMinor=Math.max(0,Math.floor(compensationLpa*100000)); const feeAmountMinor=Math.floor(compensationMinor*500/10000);
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

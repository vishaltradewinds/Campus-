import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';

const PROJECT='demo-nexustalent-acceptance';
const BASE='http://127.0.0.1:8080/v1/projects/'+PROJECT+'/databases/(default)/documents';
const AUTH='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const collections=['users','employers','institutions','students','requirements','campaigns','calls','opportunities','offers','assessmentSubmissions','candidateProfiles','auditEvents','successFees'];

function guard() {
  assert.equal(process.env.NEXUSTALENT_EMULATOR_TEST,'1');
  assert.equal(process.env.FIREBASE_PROJECT_ID,PROJECT);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
  assert.notEqual(process.env.NODE_ENV,'production');
}
async function request(url,token='owner',init={},status=200) {
  guard();
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});
  assert.equal(response.status,status,'Unexpected status for synthetic '+new URL(url).pathname);
  return response.json();
}
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
async function snapshot() {
  const manifest={};
  for(const collection of collections) {
    const records=[];
    let pageToken;
    do {
      const query=new URLSearchParams({pageSize:'100'});
      if(pageToken) query.set('pageToken',pageToken);
      const page=await request(BASE+'/'+collection+'?'+query);
      for(const doc of page.documents||[]) records.push({name:doc.name,fields:doc.fields||{}});
      pageToken=page.nextPageToken;
      assert.ok(records.length<=1000,'Unexpectedly large synthetic dataset');
    } while(pageToken);
    records.sort((a,b)=>a.name.localeCompare(b.name));
    assert.ok(records.length>0,'Missing expected synthetic collection '+collection);
    manifest[collection]={count:records.length,sha256:createHash('sha256').update(JSON.stringify(canonical(records))).digest('hex')};
  }
  return manifest;
}
export async function captureSyntheticBackup({accounts,opportunityId,campaignId,auditId}) {
  guard();
  const manifest=await snapshot();
  const joined=await request(BASE+'/opportunities/'+opportunityId);
  assert.equal(joined.fields.stage.stringValue,'joined');
  const offerId=joined.fields.offerRecordId.stringValue;
  const projectionId=createHash('sha256').update(accounts[0].uid+':'+campaignId+':'+accounts[2].uid).digest('hex');
  const evidence={project:PROJECT,accounts:accounts.map(a=>({uid:a.uid,email:a.email,role:a.role})),opportunityId,campaignId,offerId,projectionId,auditId,manifest,capturedAt:new Date().toISOString()};
  await writeFile('acceptance-evidence/backup-manifest.json',JSON.stringify(evidence,null,2));
  console.log('Synthetic backup baseline:',JSON.stringify(manifest));
}

export async function verifySyntheticRestore() {
  guard();
  const started=performance.now();
  const baseline=JSON.parse(await readFile('acceptance-evidence/backup-manifest.json','utf8'));
  assert.equal(baseline.project,PROJECT);
  const actual=await snapshot();
  assert.deepEqual(actual,baseline.manifest,'Restored document counts or canonical content differ');
  const tokens=[];
  for(const account of baseline.accounts) {
    const signed=await request(AUTH+'/accounts:signInWithPassword?key=demo-key','',{method:'POST',body:JSON.stringify({email:account.email,password:'Synthetic-only-123456!',returnSecureToken:true})});
    assert.equal(signed.localId,account.uid);
    tokens.push(signed.idToken);
  }
  const [employerToken,institutionToken,studentToken,outsiderToken]=tokens;
  const joined=await request(BASE+'/opportunities/'+baseline.opportunityId,studentToken);
  assert.equal(joined.fields.stage.stringValue,'joined');
  assert.equal(joined.fields.joinedSalaryLPA.integerValue,'10');
  const institutional=await request(BASE+'/opportunities/'+baseline.opportunityId,institutionToken);
  assert.equal(institutional.fields.stage.stringValue,'joined');
  await request(BASE+'/opportunities/'+baseline.opportunityId,outsiderToken,{},403);
  const offer=await request(BASE+'/offers/'+baseline.offerId,employerToken);
  assert.equal(offer.fields.status.stringValue,'joined');
  // The earlier employer projection was invalidated by revocation and a fresh grant.
  await request(BASE+'/candidateProfiles/'+baseline.projectionId,employerToken,{},403);
  const audit=await request(BASE+'/auditEvents/'+baseline.auditId);
  assert.ok(audit.fields);
  const result={scope:'isolated Firebase emulator export/import, not cloud backup evidence',restoredCollections:Object.keys(actual).length,restoredDocuments:Object.values(actual).reduce((s,v)=>s+v.count,0),exactContentHashesMatch:true,authenticatedAccounts:tokens.length,joinedOfferVerified:true,outsiderDenied:true,staleProjectionDenied:true,auditPresent:true,verificationMs:performance.now()-started};
  await writeFile('acceptance-evidence/restore-results.json',JSON.stringify(result,null,2));
  console.log('Synthetic backup restore passed:',JSON.stringify(result));
}

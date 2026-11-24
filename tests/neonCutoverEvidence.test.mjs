import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNeonCutoverEvidence} from '../scripts/build-neon-cutover-evidence.mjs';
import {required} from '../scripts/check-database-cutover.mjs';
const uid='synthetic-private-id';
function fixture(){
 const source={projectId:'quadratic-button-s8gvj',databaseId:'ai-studio-nexustalentcampu-045f276b-0185-4999-9fd0-a789c15aa363',collections:[...required],documents:[],authIdentities:[{uid,disabled:false,providers:[{providerId:'google.com',providerUid:'synthetic-provider'}],claims:{role:'student'}}]};
 source.documents.push({name:'projects/'+source.projectId+'/databases/'+source.databaseId+'/documents/users/'+uid,fields:{uid:{stringValue:uid},role:{stringValue:'student'},name:{stringValue:'Synthetic student'}}});
 const destination={format:'nexustalent-postgres-snapshot-v1',projectId:'rough-butterfly-67822299',branchId:'br-rapid-brook-b3bqvuxx',databaseId:'nexustalent',collections:[...required],records:[{document_path:'users/'+uid,payload:{name:'Synthetic student',role:'student',uid}}],authIdentities:[{uid,disabled:false,adminAuthorized:false}]};
 return [source,destination];
}
test('normalized collection and identity manifests compare across engines without proving provider parity',()=>{
 const result=buildNeonCutoverEvidence(...fixture());assert.equal(result.blockers,0);assert.deepEqual(result.source.collections,result.destination.collections);assert.deepEqual(result.source.authIdentityManifest,result.destination.authIdentityManifest);assert.equal(result.complete,false);assert.equal(result.identity.providerEquivalenceVerified,false);assert.equal(result.automaticCutover,false);assert.equal(result.writes,0);assert.ok(!JSON.stringify(result).includes(uid));assert.ok(!JSON.stringify(result).includes('Synthetic student'));
});
test('changed roles, missing identities, disabled status and administrator elevation block cutover',()=>{
 for(const change of [(s,d)=>d.authIdentities.pop(),(s,d)=>d.authIdentities[0].disabled=true,(s,d)=>d.authIdentities[0].adminAuthorized=true,(s,d)=>s.authIdentities[0].claims.role='super_admin',(s,d)=>d.records[0].payload.role='employer']){
  const [s,d]=fixture();change(s,d);assert.ok(buildNeonCutoverEvidence(s,d).blockers>0);
 }
});
test('unsupported source metadata and wrong target fail closed',()=>{
 const [s,d]=fixture();s.documents[0].fields.createdAt={timestampValue:'2026-01-01T00:00:00Z'};assert.ok(buildNeonCutoverEvidence(s,d).blockers>0);
 d.branchId='wrong';assert.throws(()=>buildNeonCutoverEvidence(s,d));
});
test('extra sensitive identity fields and duplicate destination identities are rejected',()=>{
 for(const change of [d=>d.authIdentities[0].email='private@example.invalid',d=>d.authIdentities.push({...d.authIdentities[0]})]){
  const [s,d]=fixture();change(d);assert.throws(()=>buildNeonCutoverEvidence(s,d));
 }
});
test('identity-only pending registrations are not silently discarded',()=>{
 const [s,d]=fixture();s.authIdentities.push({uid:'pending',disabled:false,providers:[],claims:{}});let r=buildNeonCutoverEvidence(s,d);assert.ok(r.blockers>0);d.authIdentities.push({uid:'pending',disabled:false,adminAuthorized:false});r=buildNeonCutoverEvidence(s,d);assert.equal(r.blockers,0);assert.equal(r.identity.source.unregistered,1);assert.equal(r.identity.reEnrollmentVerified,false);
});

test('same external provider identity linked to distinct source accounts is a reconciliation blocker',()=>{
 const [s,d]=fixture();s.authIdentities.push({uid:'other-synthetic',disabled:false,providers:[{...s.authIdentities[0].providers[0]}],claims:{}});
 d.authIdentities.push({uid:'other-synthetic',disabled:false,adminAuthorized:false});
 const r=buildNeonCutoverEvidence(s,d);assert.equal(r.identity.mismatch,0);assert.equal(r.identity.source.providerIdentityCollision,1);assert.equal(r.decision,'CUTOVER_HOLD');assert.ok(!JSON.stringify(r).includes('synthetic-provider'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRollbackTrajectory,syntheticCollections} from '../scripts/verify-rollback-trajectory.mjs';

const candidate='a'.repeat(40),baseline='b'.repeat(40);
function fixture(){
 const manifest=Object.fromEntries(syntheticCollections.map((collection,i)=>[collection,{count:i+1,sha256:String(i%10).repeat(64)}]));
 const probes=Object.fromEntries([
  ['candidate-before',candidate],
  ['rollback-baseline',baseline],
  ['candidate-after',candidate]
 ].map(([phase,sha])=>[phase,{phase,sha,health:200,replay:200,allRestoredContentHashesMatch:true,elapsedMs:150}]));
 return {probes,backup:{project:'demo-nexustalent-acceptance',manifest},
  restore:{scope:'isolated Firebase emulator export/import, not cloud backup evidence',
   restoredCollections:14,restoredDocuments:105,exactContentHashesMatch:true,authenticatedAccounts:4,
   joinedOfferVerified:true,outsiderDenied:true,staleProjectionDenied:true,auditPresent:true,verificationMs:5}};
}

test('candidate-to-baseline-to-same-candidate recovery proof stays disposable-only',()=>{
 const result=verifyRollbackTrajectory(fixture(),candidate,baseline);
 assert.equal(result.phasesVerified,3);
 assert.equal(result.documentsVerified,105);
 assert.equal(result.cutoverAuthorized,false);
 assert.equal(result.productionRecoveryVerified,false);
 assert.equal(result.liveBackupVerified,false);
 assert.equal(result.writes,0);
 assert.ok(!JSON.stringify(result).includes('account'));
});

test('missing phases, wrong SHA, swapped baseline and stale reapply are rejected',()=>{
 for(const mutate of [
  e=>{delete e.probes['candidate-after'];},
  e=>{e.probes['rollback-baseline'].sha=candidate;},
  e=>{e.probes['candidate-after'].sha=baseline;},
  e=>{e.probes['candidate-after'].phase='candidate-before';},
  e=>{e.probes['candidate-before'].health=503;},
  e=>{e.probes['rollback-baseline'].replay=401;},
  e=>{e.probes['candidate-after'].allRestoredContentHashesMatch=false;},
  e=>{e.probes['rollback-baseline'].elapsedMs=-1;},
  e=>{e.probes['candidate-before'].extra='unreviewed';}
 ]){
  const evidence=fixture();mutate(evidence);
  assert.throws(()=>verifyRollbackTrajectory(evidence,candidate,baseline),/Invalid or incomplete/);
 }
 assert.throws(()=>verifyRollbackTrajectory(fixture(),candidate,candidate));
 assert.throws(()=>verifyRollbackTrajectory(fixture(),'wrong',baseline));
});

test('inconsistent or missing backup and restored authorization evidence is rejected',()=>{
 for(const mutate of [
  e=>{e.backup.manifest[syntheticCollections[0]].sha256='invalid';},
  e=>{e.backup.manifest[syntheticCollections[0]].count=0;},
  e=>{delete e.backup.manifest[syntheticCollections[0]];},
  e=>{e.restore.secret='unexpected';},
  e=>{e.restore.restoredDocuments++;},
  e=>{e.restore.restoredCollections=13;},
  e=>{e.restore.scope='live cloud backup';},
  e=>{e.restore.authenticatedAccounts=3;},
  e=>{e.restore.outsiderDenied=false;},
  e=>{e.restore.staleProjectionDenied=false;},
  e=>{e.restore.auditPresent=false;},
  e=>{e.restore.exactContentHashesMatch=false;},
  e=>{e.restore.joinedOfferVerified=false;},
  e=>{e.restore.verificationMs=-1;}
 ]){
  const evidence=fixture();mutate(evidence);
  assert.throws(()=>verifyRollbackTrajectory(evidence,candidate,baseline),/Invalid or incomplete/);
 }
});

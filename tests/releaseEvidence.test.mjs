import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReleaseEvidence,requiredWorkflows,requiredExternalGates} from '../scripts/check-release-evidence.mjs';
const repository='vishaltradewinds/Campus-',candidateSha='a'.repeat(40);
const fixture=()=>({repository,candidateSha,prAuthor:'author',prReadyForReview:true,mainProtected:true,requiredChecksVerified:true,requiredIndependentReviewVerified:true,runs:requiredWorkflows.map((name,index)=>({name,head_sha:candidateSha,repository:{full_name:repository},id:index+1,run_number:1,run_attempt:1,status:'completed',conclusion:'success'})),reviews:[{user:{login:'reviewer',type:'User'},state:'APPROVED',commit_id:candidateSha,submitted_at:'2026-11-20T12:00:00Z'}],external:Object.fromEntries(requiredExternalGates.map(k=>[k,{status:'verified',candidateSha,evidenceUrl:'https://example.test/evidence',reviewer:'approved operator'}]))});
test('even complete evidence is not automatic production authorization',()=>{
 const report=evaluateReleaseEvidence(fixture());assert.equal(report.blocked.length,0);assert.equal(report.automaticDeployment,false);assert.equal(report.decision,'EVIDENCE_COMPLETE_PENDING_FINAL_HUMAN_AUTHORIZATION');
});
test('missing external evidence and unprotected main hold release',()=>{
 const f=fixture();f.mainProtected=false;f.external={};
 const r=evaluateReleaseEvidence(f);assert.equal(r.gates.branchGovernance,'HOLD');assert.equal(r.blocked.length,requiredExternalGates.length+1);
});
test('wrong SHA, rerun failure, self approval, stale review and draft fail closed',()=>{
 const f=fixture();f.runs[0].head_sha='b'.repeat(40);
 f.runs.push({...f.runs[1],id:100,run_attempt:2,conclusion:'failure'});
 f.reviews[0].user.login='author';f.prReadyForReview=false;
 const r=evaluateReleaseEvidence(f);assert.equal(r.gates[requiredWorkflows[0]],'HOLD');assert.equal(r.gates[requiredWorkflows[1]],'HOLD');assert.equal(r.gates.independentReview,'HOLD');
 const g=fixture();g.reviews[0].commit_id='b'.repeat(40);assert.equal(evaluateReleaseEvidence(g).gates.independentReview,'HOLD');
});
test('later change request cancels reviewer approval and foreign repo run cannot pass',()=>{
 const f=fixture();f.reviews.push({...f.reviews[0],state:'CHANGES_REQUESTED',submitted_at:'2026-11-20T13:00:00Z'});f.runs[3].repository.full_name='wrong/repo';
 const r=evaluateReleaseEvidence(f);assert.equal(r.gates.independentReview,'HOLD');assert.equal(r.gates[requiredWorkflows[3]],'HOLD');
});

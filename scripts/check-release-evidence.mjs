import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const requiredWorkflows=['CI','NexusTalent Production Gate','NexusTalent Authenticated Acceptance','NexusTalent Live Staging Smoke'];
export const requiredExternalGates=['firebaseTargetAndIam','historicalReconciliation','hostingAutoDeployControl','cloudBackupAndRollback','capacityAndMonitoring','privacyAndEmploymentApproval','controlledInstitutionalPilot','incidentAndSupportOwnership'];
const shaPattern=/^[a-f0-9]{40}$/;
const repo='vishaltradewinds/Campus-';
const validLink=(link)=>typeof link==='string'&&link.startsWith('https://')&&link.length<=2048;
export function evaluateReleaseEvidence(input){
 if(input?.repository!==repo||!shaPattern.test(input?.candidateSha||''))throw new Error('Exact canonical repository and candidate SHA required');
 if(!Array.isArray(input.runs)||!Array.isArray(input.reviews))throw new Error('Workflow and review evidence arrays required');
 const gates={};
 for(const name of requiredWorkflows){
   const matches=input.runs.filter(r=>r.name===name&&r.head_sha===input.candidateSha&&r.repository?.full_name===repo);
   matches.sort((a,b)=>Number(b.run_number||0)-Number(a.run_number||0)||Number(b.run_attempt||0)-Number(a.run_attempt||0)||Number(b.id||0)-Number(a.id||0));
   const result=matches[0];
   gates[name]=result?.status==='completed'&&result.conclusion==='success'&&Number.isSafeInteger(result.id)&&result.id>0?'PASS':'HOLD';
 }
 const byReviewer=new Map();
 for(const review of [...input.reviews].sort((a,b)=>String(a.submitted_at||'').localeCompare(String(b.submitted_at||'')))){
   if(review.user?.login&&['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(review.state))byReviewer.set(review.user.login,review);
 }
 const approvals=[...byReviewer.values()].filter(r=>r.state==='APPROVED'&&r.commit_id===input.candidateSha&&r.user?.type==='User'&&r.user.login!==input.prAuthor);
 gates.independentReview=approvals.length>0&&input.prReadyForReview===true?'PASS':'HOLD';
 // Do not infer branch governance from "protected" alone.
 gates.branchGovernance=input.mainProtected===true&&input.requiredChecksVerified===true&&input.requiredIndependentReviewVerified===true?'PASS':'HOLD';
 for(const name of requiredExternalGates){
   const evidence=input.external?.[name];
   gates[name]=evidence?.status==='verified'&&evidence.candidateSha===input.candidateSha&&validLink(evidence.evidenceUrl)&&typeof evidence.reviewer==='string'&&evidence.reviewer.trim().length>0?'EVIDENCE_RECORDED_REQUIRES_HUMAN_VALIDATION':'HOLD';
 }
 const blocked=Object.entries(gates).filter(([,v])=>v==='HOLD').map(([k])=>k);
 return {repository:repo,candidateSha:input.candidateSha,gates,blocked,decision:blocked.length?'RELEASE_HOLD':'EVIDENCE_COMPLETE_PENDING_FINAL_HUMAN_AUTHORIZATION',automaticDeployment:false,scope:'Offline evidence consistency only; sources and reviewer authority must be independently verified.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw new Error('Usage: node scripts/check-release-evidence.mjs evidence.json');
 const result=evaluateReleaseEvidence(JSON.parse(await readFile(process.argv[2],'utf8')));
 console.log(JSON.stringify(result,null,2));
 if(result.blocked.length)process.exitCode=2;
}

import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const repo='https://github.com/vishaltradewinds/Campus-';
export const CANONICAL_SERVICE='srv-datjr5qd0e5s73cddh9g';
export const LEGACY_SERVICE='srv-datjqppsrm7s7390aaj0';
const known={
 'srv-datjr5qd0e5s73cddh9g':'nexustalent-zero-cost-v2',
 'srv-datjqppsrm7s7390aaj0':'nexustalent-zero-cost',
};
const sha=/^[a-f0-9]{40}$/;
// Offline metadata only; no provider calls or deployment authorization.
export function checkHostingRelease(input){
 if(!sha.test(input?.candidateSha||'')||!Array.isArray(input?.services))throw new Error('Exact candidate SHA and service inventory required');
 const blockers=new Set();
 const seen=new Set();
 const observations=[];
 for(const service of input.services){
   if(!service||typeof service.id!=='string'){blockers.add('INVALID_SERVICE_METADATA');continue;}
   const sameRepo=typeof service.repo==='string'&&service.repo.replace(/\.git$/,'').replace(/\/$/,'').toLowerCase()===repo.toLowerCase();
   if(!sameRepo&&!Object.hasOwn(known,service.id))continue;
   if(seen.has(service.id)){blockers.add('DUPLICATE_SERVICE_METADATA');continue;}
   seen.add(service.id);
   if(!sameRepo||!Object.hasOwn(known,service.id)||service.name!==known[service.id])blockers.add('UNRECONCILED_HOSTING_TARGET');
   if(service.branch!=='main')blockers.add('UNEXPECTED_DEPLOYMENT_BRANCH');
   if(service.autoDeploy!=='no'||service.autoDeployTrigger!=='off')blockers.add('AUTO_DEPLOY_NOT_EXPLICITLY_DISABLED');
   if(service.pullRequestPreviewsEnabled!=='no')blockers.add('PREVIEW_DEPLOY_CONTROL_UNVERIFIED');
   if(service.id===LEGACY_SERVICE){
     blockers.add('LEGACY_HOSTING_TARGET_NOT_RETIRED');
     observations.push({service:known[service.id],role:'retirement-candidate',autoDeployDisabled:service.autoDeploy==='no'&&service.autoDeployTrigger==='off',liveCandidateMatches:false});
     continue;
   }
   const live=service.liveDeploy;
   if(service.suspended!=='not_suspended'||live?.status!=='live'||typeof live.id!=='string'||!/^dep-[a-z0-9]+$/.test(live.id)||!sha.test(live.commitSha||''))blockers.add('ROLLBACK_REFERENCE_UNVERIFIED');
   if(Object.hasOwn(known,service.id))observations.push({service:known[service.id],role:'canonical',autoDeployDisabled:service.autoDeploy==='no'&&service.autoDeployTrigger==='off',liveCandidateMatches:live?.commitSha===input.candidateSha});
 }
 if(!seen.has(CANONICAL_SERVICE))blockers.add('KNOWN_HOSTING_TARGET_MISSING');
 if(!seen.has(LEGACY_SERVICE)){
   // Absence alone is not proof of retirement or safe dependency disposition.
   const r=input.legacyRetirement;
   if(r?.serviceId!==LEGACY_SERVICE||r?.dependencyReviewComplete!==true||r?.ownerApproved!==true||r?.rollbackRecordPreserved!==true||r?.providerRemovalVerified!==true)blockers.add('LEGACY_RETIREMENT_EVIDENCE_UNVERIFIED');
 }
 if(input.inventoryComplete!==true)blockers.add('INVENTORY_COMPLETENESS_UNVERIFIED');
 return {mode:'offline-read-only',candidateSha:input.candidateSha,observations,blockers:[...blockers].sort(),decision:blockers.size?'HOSTING_CONTROL_HOLD':'HOSTING_CONTROL_METADATA_COMPLETE_REQUIRES_INDEPENDENT_VERIFICATION',automaticDeployment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
   if(process.argv.length!==3)throw new Error('Expected sanitized metadata path');
   const result=checkHostingRelease(JSON.parse(await readFile(process.argv[2],'utf8')));
   console.log(JSON.stringify(result,null,2));if(result.blockers.length)process.exitCode=2;
 }catch{console.error('Invalid or unavailable sanitized hosting metadata');process.exitCode=1;}
}
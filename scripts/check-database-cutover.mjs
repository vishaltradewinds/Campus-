import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
// Metadata only. An independent migration steward must produce full manifests.
const sha=/^[a-f0-9]{64}$/;
const required=['users','employers','institutions','students','requirements','campaigns','calls','opportunities','offers','candidateProfiles','auditEvents','assessmentSubmissions','careerEvidence','successFees','academicCorrections','invoices','commercialAccounts','subscriptions','campaignCharges','billingEvents','system'];
const valid=m=>m&&Number.isSafeInteger(m.count)&&m.count>=0&&sha.test(m.sha256||'');
const equal=(a,b)=>valid(a)&&valid(b)&&a.count===b.count&&a.sha256===b.sha256;
export function checkDatabaseCutover(e){
 if(!/^[a-f0-9]{40}$/.test(e?.candidateSha||''))throw new Error('Exact candidate SHA required');
 const blockers=[];
 const s=e.source,t=e.destination;
 if(!s?.projectId||!s?.databaseId||!t?.projectId||!t?.databaseId||s.projectId===t.projectId)blockers.push('DISTINCT_APPROVED_TARGET_REQUIRED');
 if(s?.complete!==true||t?.complete!==true||e.subcollectionsIncluded!==true)blockers.push('COMPLETE_INVENTORY_REQUIRED');
 if(e.sourceWritesFrozen!==true||e.destinationPublicWritesDisabled!==true)blockers.push('SINGLE_WRITER_NOT_VERIFIED');
 const before=s?.collections||{},after=t?.collections||{};
 const keys=new Set([...required,...Object.keys(before),...Object.keys(after)]);
 let differences=0;
 for(const k of keys)if(!Object.hasOwn(before,k)||!Object.hasOwn(after,k)||!equal(before[k],after[k]))differences++;
 if(differences)blockers.push('DOCUMENT_MANIFEST_MISMATCH');
 if(!equal(s?.authIdentityManifest,t?.authIdentityManifest))blockers.push('AUTH_IDENTITY_MANIFEST_MISMATCH');
 if(e.authProviderAndRoleValidation!==true)blockers.push('AUTH_PROVIDER_ROLE_VALIDATION_REQUIRED');
 if(e.reconciliationBlockers!==0||e.reconciliationCompleted!==true)blockers.push('RECONCILIATION_REQUIRED');
 if(e.rulesAndIndexesVerified!==true||e.runtimeIdentityVerified!==true||e.negativeAccessTestsPassed!==true)blockers.push('SECURITY_VALIDATION_REQUIRED');
 if(e.backupAndRollbackVerified!==true||e.ownerAuthorized!==true)blockers.push('RECOVERY_AND_APPROVAL_REQUIRED');
 return {candidateSha:e.candidateSha,collectionManifestDifferences:differences,blockers,decision:blockers.length?'CUTOVER_HOLD':'METADATA_COMPLETE_REQUIRES_INDEPENDENT_CUTOVER_APPROVAL',automaticCutover:false,writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)throw new Error('Missing metadata');const r=checkDatabaseCutover(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(r,null,2));if(r.blockers.length)process.exitCode=2;}catch{console.error('Invalid or unavailable cutover metadata');process.exitCode=1;}
}
export {required};
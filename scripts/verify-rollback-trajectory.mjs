import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Offline acceptance-evidence verification only. Never contacts providers,
// authenticates a user, restores a database, or grants release approval.
const sha=/^[0-9a-f]{40}$/;
const hash=/^[0-9a-f]{64}$/;
const phases=['candidate-before','rollback-baseline','candidate-after'];
export const syntheticCollections=['users','employers','institutions','students','requirements','campaigns','calls','opportunities','offers','assessmentSubmissions','candidateProfiles','auditEvents','successFees','academicCorrections'].sort();
const restoreKeys=['scope','restoredCollections','restoredDocuments','exactContentHashesMatch','authenticatedAccounts','joinedOfferVerified','outsiderDenied','staleProjectionDenied','auditPresent','verificationMs'];
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw Error('Invalid or incomplete synthetic rollback evidence');};
const exact=(v,keys)=>{
 if(!isObject(v))return false;
 const actual=Object.keys(v).sort(),expected=[...keys].sort();
 return actual.length===expected.length&&actual.every((key,i)=>key===expected[i]);
};

export function verifyRollbackTrajectory(evidence,candidateSha,baselineSha){
 if(!sha.test(candidateSha)||!sha.test(baselineSha)||candidateSha===baselineSha||!isObject(evidence))fail();
 const {probes,backup,restore}=evidence;
 if(!exact(probes,phases)||!isObject(backup)||backup.project!=='demo-nexustalent-acceptance'||
    !isObject(backup.manifest)||!isObject(restore))fail();
 let documentCount=0;
 const roots=Object.keys(backup.manifest).sort();
 if(roots.length!==syntheticCollections.length||roots.some((name,i)=>name!==syntheticCollections[i]))fail();
 if(!exact(restore,restoreKeys))fail();
 for(const root of roots){
  const m=backup.manifest[root];
  if(!exact(m,['count','sha256'])||!Number.isSafeInteger(m.count)||m.count<1||
     !hash.test(m.sha256))fail();
  documentCount+=m.count;
  if(!Number.isSafeInteger(documentCount))fail();
 }
 const expected={
  'candidate-before':candidateSha,
  'rollback-baseline':baselineSha,
  'candidate-after':candidateSha
 };
 for(const phase of phases){
  const p=probes[phase];
  if(!exact(p,['phase','sha','health','replay','allRestoredContentHashesMatch','elapsedMs'])||
     p.phase!==phase||p.sha!==expected[phase]||p.health!==200||p.replay!==200||
     p.allRestoredContentHashesMatch!==true||!Number.isFinite(p.elapsedMs)||p.elapsedMs<0)fail();
 }
 if(restore.scope!=='isolated Firebase emulator export/import, not cloud backup evidence'||
    restore.restoredCollections!==roots.length||restore.restoredDocuments!==documentCount||
    restore.exactContentHashesMatch!==true||restore.authenticatedAccounts!==4||
    restore.joinedOfferVerified!==true||restore.outsiderDenied!==true||
    restore.staleProjectionDenied!==true||restore.auditPresent!==true||
    !Number.isFinite(restore.verificationMs)||restore.verificationMs<0)fail();
 return {
  format:'nexustalent-synthetic-rollback-trajectory-v1',
  candidateSha,baselineSha,
  phasesVerified:phases.length,
  collectionsVerified:roots.length,
  documentsVerified:documentCount,
  decision:'DISPOSABLE_REHEARSAL_PASSED_NOT_PRODUCTION_RECOVERY',
  liveBackupVerified:false,cutoverAuthorized:false,productionRecoveryVerified:false,writes:0
 };
}

export async function verifyRollbackEvidenceDirectory(folder,candidateSha,baselineSha){
 const load=async file=>JSON.parse(await readFile(join(folder,file),'utf8'));
 const probes={};
 for(const phase of phases)probes[phase]=await load('rollback-'+phase+'.json');
 return verifyRollbackTrajectory({probes,backup:await load('backup-manifest.json'),restore:await load('restore-results.json')},candidateSha,baselineSha);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==5)fail();
  const result=await verifyRollbackEvidenceDirectory(process.argv[2],process.argv[3],process.argv[4]);
  console.log(JSON.stringify(result,null,2));
 }catch{
  console.error('Missing, inconsistent or invalid disposable rollback trajectory');
  process.exitCode=2;
 }
}

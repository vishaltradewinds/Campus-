import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {required} from './check-database-cutover.mjs';
import {preparePostgresSnapshot,reconcilePostgres} from './reconcile-postgres.mjs';
import {validateImport} from './validate-postgres-import.mjs';
const fail=()=>{throw Error('Invalid offline cross-engine inventory');};
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const digest=v=>createHash('sha256').update(canonical(v),'utf8').digest('hex');
const manifest=rows=>{const sorted=[...rows].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);return {count:sorted.length,sha256:digest(sorted)};};
function collectionManifests(records){
 const roots=new Map(required.map(k=>[k,[]]));
 for(const r of records){const root=roots.get(r.document_path.split('/')[0]);if(!root)fail();root.push([r.document_path,r.payload]);}
 return Object.fromEntries([...roots].map(([k,rows])=>[k,manifest(rows)]));
}
function roles(records){
 const result=new Map();
 for(const {document_path,payload} of records.filter(r=>r.document_path.startsWith('users/'))){
  const uid=document_path.split('/')[1];
  if(payload.uid!==uid||!['student','institution','employer','super_admin','simulation'].includes(payload.role))fail();
  result.set(uid,payload.role);
 }
 return result;
}
// Only authorized offline inventories, no credentials, email addresses or provider secrets.
// This compares identity continuity and authority, NOT password or provider equivalence.
function identityManifest(entries,roleMap,source){
 if(!Array.isArray(entries))fail();
 const seen=new Set(),rows=[];let authorityMismatch=0,simulation=0,unregistered=0,missingAccountIdentity=0;
 for(const entry of entries){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.uid!=='string'||!entry.uid||entry.uid.length>200||entry.uid.includes('/')||typeof entry.disabled!=='boolean'||seen.has(entry.uid))fail();
  if(!source&&(Object.keys(entry).sort().join(',')!=='adminAuthorized,disabled,uid'||typeof entry.adminAuthorized!=='boolean'))fail();
  seen.add(entry.uid);
  const role=roleMap.get(entry.uid)||'unregistered';
  const admin=source?entry.claims.role==='super_admin':entry.adminAuthorized;
  if(admin!==(role==='super_admin'))authorityMismatch++;
  if(role==='simulation')simulation++;
  if(role==='unregistered')unregistered++;
  rows.push([entry.uid,{disabled:entry.disabled,role,adminAuthorized:admin}]);
 }
 for(const uid of roleMap.keys())if(!seen.has(uid))missingAccountIdentity++;
 return {manifest:manifest(rows),authorityMismatch,simulation,unregistered,missingAccountIdentity};
}
export function buildNeonCutoverEvidence(source,destination){
 // The destination is independently captured in existing normalized content format,
 // with an extra identity inventory of exactly uid, disabled and adminAuthorized.
 const data=reconcilePostgres(source,destination);
 const preflight=validateImport(source);
 if(destination.projectId!=='rough-butterfly-67822299'||destination.branchId!=='br-rapid-brook-b3bqvuxx'||destination.databaseId!=='nexustalent'||source.projectId!=='quadratic-button-s8gvj'||source.databaseId!=='ai-studio-nexustalentcampu-045f276b-0185-4999-9fd0-a789c15aa363')fail();
 const {snapshot}=preparePostgresSnapshot(source);
 const from=identityManifest(source.authIdentities,roles(snapshot.records),true);
 const to=identityManifest(destination.authIdentities,roles(destination.records),false);
 const identityMismatch=Number(from.manifest.count!==to.manifest.count||from.manifest.sha256!==to.manifest.sha256);
 const blockers=data.blockers+preflight.blockers+identityMismatch+from.authorityMismatch+to.authorityMismatch+from.simulation+to.simulation+from.missingAccountIdentity+to.missingAccountIdentity;
 return {
  format:'nexustalent-cross-engine-evidence-v1',
  source:{engine:'firestore',projectId:source.projectId,databaseId:source.databaseId,complete:false,collections:collectionManifests(snapshot.records),authIdentityManifest:from.manifest},
  destination:{engine:'postgresql',provider:'neon',projectId:destination.projectId,branchId:destination.branchId,databaseId:destination.databaseId,pgVersion:16,complete:false,collections:collectionManifests(destination.records),authIdentityManifest:to.manifest},
  content:{...data},preflight,identity:{source:from,destination:to,mismatch:identityMismatch,providerEquivalenceVerified:false,reEnrollmentVerified:false},
  blockers,decision:blockers?'CUTOVER_HOLD':'CONTENT_AND_IDENTITY_METADATA_MATCH_REQUIRES_INDEPENDENT_VALIDATION',complete:false,automaticCutover:false,writes:0
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==4)fail();const result=buildNeonCutoverEvidence(JSON.parse(await readFile(process.argv[2],'utf8')),JSON.parse(await readFile(process.argv[3],'utf8')));console.log(JSON.stringify(result,null,2));if(result.blockers)process.exitCode=2;}
 catch{console.error('Invalid or unavailable authorized offline cross-engine inventory');process.exitCode=1;}
}

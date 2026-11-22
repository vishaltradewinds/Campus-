import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {required} from './check-database-cutover.mjs';

const fail=()=>{throw new Error('Invalid offline snapshot structure');};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v,k)=>Object.hasOwn(v,k);
const nonempty=v=>typeof v==='string'&&v.length>0;
const compare=(a,b)=>a<b?-1:a>b?1:0;
// Explicitly encode numeric negative zero, and sort map keys independently of locale.
function canonical(v){
 if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
 if(typeof v==='number'){if(!Number.isFinite(v))fail();return Object.is(v,-0)?'-0':JSON.stringify(v);}
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(!record(v))fail();
 return '{'+Object.keys(v).sort(compare).map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
const digest=v=>createHash('sha256').update(canonical(v),'utf8').digest('hex');
const pathParts=p=>{if(!nonempty(p))fail();const parts=p.split('/');if(parts.length%2!==0||parts.some(x=>!x||x==='.'||x==='..'))fail();return parts;};
function typedValue(v,prefix){
 if(!record(v)||Object.keys(v).length!==1)fail();
 const [kind]=Object.keys(v),x=v[kind];
 switch(kind){
  case 'nullValue':if(x!==null&&x!=='NULL_VALUE')fail();return [kind,null];
  case 'booleanValue':if(typeof x!=='boolean')fail();break;
  case 'integerValue':if(typeof x!=='string'||! /^-?(0|[1-9][0-9]*)$/.test(x)||BigInt(x)<-9223372036854775808n||BigInt(x)>9223372036854775807n)fail();break;
  case 'doubleValue':if(!(typeof x==='number'&&Number.isFinite(x))&&!['NaN','Infinity','-Infinity'].includes(x))fail();break;
  case 'stringValue':case 'timestampValue':case 'bytesValue':if(typeof x!=='string')fail();break;
  case 'referenceValue':{
   if(!nonempty(x)||!/^projects\/[^/]+\/databases\/[^/]+\/documents\//.test(x))fail();
   if(x.startsWith(prefix)){const relative=x.slice(prefix.length);pathParts(relative);return [kind,'internal',relative];}
   return [kind,'external',x];
  }
  case 'geoPointValue':if(!record(x)||Object.keys(x).length!==2||typeof x.latitude!=='number'||typeof x.longitude!=='number'||!Number.isFinite(x.latitude)||!Number.isFinite(x.longitude)||Math.abs(x.latitude)>90||Math.abs(x.longitude)>180)fail();break;
  case 'arrayValue':if(!record(x)||Object.keys(x).some(k=>k!=='values')||(own(x,'values')&&!Array.isArray(x.values)))fail();return [kind,(x.values||[]).map(y=>typedValue(y,prefix))];
  case 'mapValue':if(!record(x)||Object.keys(x).some(k=>k!=='fields'))fail();return [kind,typedFields(x.fields??{},prefix)];
  default:fail();
 }
 return [kind,x];
}
function typedFields(fields,prefix){
 if(!record(fields))fail();
 return Object.keys(fields).sort(compare).map(k=>[k,typedValue(fields[k],prefix)]);
}
// Input must be an independently authorized full Firestore REST-shaped snapshot.
// Auth data must be normalized to UID, disabled, providers and custom claims only.
// This tool never authenticates, enumerates a remote project or attests completeness.
export function buildCutoverManifest(snapshot){
 if(!record(snapshot)||!nonempty(snapshot.projectId)||!nonempty(snapshot.databaseId)||snapshot.projectId.includes('/')||snapshot.databaseId.includes('/')||!Array.isArray(snapshot.collections)||!Array.isArray(snapshot.documents)||!Array.isArray(snapshot.authIdentities))fail();
 const prefix='projects/'+snapshot.projectId+'/databases/'+snapshot.databaseId+'/documents/';
 const roots=new Map();
 for(const col of snapshot.collections){if(!nonempty(col)||col.includes('/')||col==='.'||col==='..'||roots.has(col))fail();roots.set(col,[]);}
 if(required.some(k=>!roots.has(k)))fail();
 const seen=new Set();
 for(const d of snapshot.documents){
  if(!record(d)||!nonempty(d.name)||!d.name.startsWith(prefix))fail();
  const relative=d.name.slice(prefix.length),parts=pathParts(relative);
  if(!roots.has(parts[0])||seen.has(relative))fail();
  seen.add(relative);
  roots.get(parts[0]).push([relative,typedFields(d.fields??{},prefix)]);
 }
 const identities=new Map();
 for(const a of snapshot.authIdentities){
  if(!record(a)||Object.keys(a).some(k=>!['uid','disabled','providers','claims'].includes(k))||!nonempty(a.uid)||typeof a.disabled!=='boolean'||!Array.isArray(a.providers)||!record(a.claims)||identities.has(a.uid))fail();
  const providers=new Map();
  for(const p of a.providers){if(!record(p)||Object.keys(p).some(k=>!['providerId','providerUid'].includes(k))||!nonempty(p.providerId)||!nonempty(p.providerUid)||providers.has(p.providerId))fail();providers.set(p.providerId,p.providerUid);}
  identities.set(a.uid,[a.disabled,[...providers].sort(([a],[b])=>compare(a,b)),a.claims]);
 }
 const collections=Object.fromEntries([...roots].sort(([a],[b])=>compare(a,b)).map(([k,docs])=>[k,{count:docs.length,sha256:digest(docs.sort(([a],[b])=>compare(a,b)))}]));
 return {format:'nexustalent-cutover-manifest-v1',projectId:snapshot.projectId,databaseId:snapshot.databaseId,complete:false,collections,authIdentityManifest:{count:identities.size,sha256:digest([...identities].sort(([a],[b])=>compare(a,b)))},writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)fail();console.log(JSON.stringify(buildCutoverManifest(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));}
 catch{console.error('Invalid or unavailable authorized offline snapshot');process.exitCode=1;}
}
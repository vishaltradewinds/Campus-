import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildCutoverManifest} from './build-cutover-manifest.mjs';
import {required} from './check-database-cutover.mjs';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw new Error('Unsupported or invalid migration input');};
const str=v=>{if(typeof v!=='string'||v.includes(String.fromCharCode(0))||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))fail();return v;};
function json(v){
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='string')return str(v);
 if(typeof v==='number'){if(!Number.isFinite(v)||Object.is(v,-0)||(Number.isInteger(v)&&!Number.isSafeInteger(v)))fail();return v;}
 if(Array.isArray(v))return v.map(json);
 if(!object(v))fail();
 return Object.fromEntries(Object.keys(v).sort().map(k=>[str(k),json(v[k])]));
}
function fields(v){if(!object(v))fail();return Object.fromEntries(Object.keys(v).sort().map(k=>[str(k),decode(v[k])]));}
function decode(v){
 const k=Object.keys(v)[0],x=v[k];
 switch(k){
 case 'nullValue':return null;
 case 'booleanValue':case 'stringValue':case 'doubleValue':if(k==='doubleValue'&&typeof x!=='number')fail();return json(x);
 case 'integerValue':if(!Number.isSafeInteger(Number(x))||x==='-0')fail();return Number(x);
 case 'arrayValue':return (x.values||[]).map(decode);
 case 'mapValue':return fields(x.fields??{});
 default:fail();
 }
}
const canonical=v=>JSON.stringify(json(v));
function path(p){if(typeof p!=='string')fail();const a=p.split('/');if(a.length!==2||!required.includes(a[0])||!a[1]||a[1].length>200||['.','..'].includes(a[1]))fail();str(p);return p;}
export function reconcilePostgres(source,destination){
 const manifest=buildCutoverManifest(source);
 if(!object(destination)||destination.format!=='nexustalent-postgres-snapshot-v1'||!Array.isArray(destination.records)||!Array.isArray(destination.collections))fail();
 const roots=new Set(destination.collections);
 if(roots.size!==destination.collections.length||roots.size!==required.length||required.some(k=>!roots.has(k)))fail();
 const expected=new Map(),actual=new Map();
 let unsupported=0;
 const prefix='projects/'+source.projectId+'/databases/'+source.databaseId+'/documents/';
 for(const d of source.documents){try{const p=path(d.name.slice(prefix.length));expected.set(p,canonical(fields(d.fields??{})));}catch{unsupported++;}}
 for(const r of destination.records){if(!object(r)||!object(r.payload))fail();const p=path(r.document_path);if(actual.has(p))fail();actual.set(p,canonical(r.payload));}
 let missing=0,extra=0,changed=0;
 for(const [p,v] of expected){if(!actual.has(p))missing++;else if(actual.get(p)!==v)changed++;}
 for(const p of actual.keys())if(!expected.has(p))extra++;
 const unknownCollections=source.collections.filter(k=>!required.includes(k)).length;
 const blockers=unsupported+missing+extra+changed+unknownCollections;
 return {sourceRecords:source.documents.length,destinationRecords:actual.size,unsupported,missing,extra,changed,unknownCollections,blockers,decision:blockers?'RECONCILIATION_HOLD':'CONTENT_MATCH_REQUIRES_INDEPENDENT_VALIDATION',complete:false,authVerified:false,automaticCutover:false,writes:manifest.writes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==4)fail();const r=reconcilePostgres(JSON.parse(await readFile(process.argv[2],'utf8')),JSON.parse(await readFile(process.argv[3],'utf8')));console.log(JSON.stringify(r,null,2));if(r.blockers)process.exitCode=2;}
 catch{console.error('Invalid or unavailable offline migration input');process.exitCode=1;}
}

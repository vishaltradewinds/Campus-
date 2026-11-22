import {createHash} from 'node:crypto';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
// Inspect only the generated standalone browser artifact. Never package credentials,
// promote the production entry or communicate with a hosting provider.
export async function inspectStandaloneBuild(directory,candidateSha){
 if(!/^[a-f0-9]{40}$/.test(candidateSha||''))throw Error('Exact candidate SHA required');
 const root=resolve(directory),files=[];
 if(!(await lstat(root)).isDirectory())throw Error('Invalid build directory');
 async function walk(dir){
  for(const name of (await readdir(dir)).sort()){
   const p=join(dir,name),stat=await lstat(p),key=relative(root,p).split(sep).join('/');
   if(stat.isSymbolicLink())throw Error('Symbolic link prohibited');
   if(stat.isDirectory()){if(!['assets','.vite'].includes(key))throw Error('Unexpected directory');await walk(p);continue;}
   if(!stat.isFile()||!(/^(standalone\.html|\.vite\/manifest\.json|assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?|png|svg|webp|ico))$/).test(key))throw Error('Unexpected file in standalone build');
   const bytes=await readFile(p);files.push({path:key,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }
 await walk(root);files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const names=new Set(files.map(f=>f.path)),manifest=JSON.parse(await readFile(join(root,'.vite','manifest.json'),'utf8'));
 const entry=manifest['standalone.html'];
 if(!entry?.isEntry||!names.has('standalone.html')||!names.has(entry.file)||!Array.isArray(entry.css)||!entry.css.length)throw Error('Incomplete standalone entry');
 for(const item of Object.values(manifest)){
  if(!item||!names.has(item.file))throw Error('Missing manifest asset');
  for(const key of ['assets','css'])for(const asset of item[key]||[])if(!names.has(asset))throw Error('Missing manifest asset');
  for(const key of ['imports','dynamicImports'])for(const imported of item[key]||[])if(!Object.hasOwn(manifest,imported))throw Error('Missing manifest import');
 }
 const totalBytes=files.reduce((a,f)=>a+f.bytes,0);
 const artifactDigest=createHash('sha256').update(JSON.stringify(files)).digest('hex');
 return {format:'nexustalent-standalone-build-evidence-v1',candidateSha,artifactDigest,fileCount:files.length,totalBytes,files,decision:'BROWSER_ARTIFACT_ONLY_NOT_DEPLOYABLE',automaticDeployment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==4)throw Error();console.log(JSON.stringify(await inspectStandaloneBuild(process.argv[2],process.argv[3]),null,2));}
 catch{console.error('Standalone build evidence unavailable or invalid');process.exitCode=1;}
}

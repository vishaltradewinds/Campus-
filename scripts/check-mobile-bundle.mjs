import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=resolve('dist');
const manifest=JSON.parse(readFileSync(resolve(root,'.vite/manifest.json'),'utf8'));
const entry='index.html';
const roles=['auth/AuthScreens','employer/EmployerPortal','institution/InstitutionPortal','student/StudentPortal','admin/SuperAdminPortal','simulation/KillerLoopSimulation'].map(p=>'src/components/'+p+'.tsx');
assert.equal(manifest[entry]?.isEntry,true);
const visited=new Set(),files=new Set();
function include(key){
 if(visited.has(key))return;
 visited.add(key);
 const chunk=manifest[key];assert.ok(chunk,'Missing static import '+key);
 assert.ok(typeof chunk.file==='string'&&chunk.file.endsWith('.js'));
 files.add(chunk.file);
 for(const dep of chunk.imports||[])include(dep);
}
include(entry);
for(const role of roles){
 assert.equal(manifest[role]?.isDynamicEntry,true,role+' must be lazy');
 assert.ok(!visited.has(role)&&!files.has(manifest[role].file),role+' is loaded eagerly');
}
let bytes=0,gzipBytes=0;
for(const file of files){
 const path=resolve(root,file);assert.ok(path.startsWith(root+sep));
 const data=readFileSync(path);bytes+=data.length;gzipBytes+=gzipSync(data).length;
}
console.log(JSON.stringify({initialJavaScriptBytes:bytes,initialJavaScriptGzipBytes:gzipBytes,lazyScreens:roles.length,staticFiles:files.size},null,2));
assert.ok(bytes<=1030000,'Initial JavaScript exceeds 1.03 MB budget');
assert.ok(gzipBytes<=270000,'Initial compressed JavaScript exceeds 270 KB budget');
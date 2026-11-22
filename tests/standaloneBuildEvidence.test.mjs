import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectStandaloneBuild} from '../scripts/inspect-standalone-build.mjs';
const sha='a'.repeat(40);
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'nexus-build-fixture-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(join(dir,'assets'));await mkdir(join(dir,'.vite'));
 await writeFile(join(dir,'standalone.html'),'<html><script type="module" src="/assets/main.js"></script></html>');
 await writeFile(join(dir,'assets/main.js'),'console.log("synthetic")');
 await writeFile(join(dir,'assets/main.css'),'body {color:black}');
 await writeFile(join(dir,'.vite/manifest.json'),JSON.stringify({'standalone.html':{file:'assets/main.js',isEntry:true,css:['assets/main.css']}}));
 return dir;
}
test('standalone digest is stable, exact and not authorization',async t=>{
 const dir=await fixture(t),a=await inspectStandaloneBuild(dir,sha),b=await inspectStandaloneBuild(dir,sha);
 assert.deepEqual(a,b);assert.equal(a.fileCount,4);assert.equal(a.automaticDeployment,false);
 await writeFile(join(dir,'assets/main.js'),'changed');assert.notEqual((await inspectStandaloneBuild(dir,sha)).artifactDigest,a.artifactDigest);
});
test('extra legacy or private files are rejected',async t=>{
 const dir=await fixture(t);
 await writeFile(join(dir,'firebase-applet-config.json'),'{}');await assert.rejects(()=>inspectStandaloneBuild(dir,sha),/Unexpected file/);
 await rm(join(dir,'firebase-applet-config.json'));await writeFile(join(dir,'.env'),'SYNTHETIC=1');await assert.rejects(()=>inspectStandaloneBuild(dir,sha),/Unexpected file/);
});
test('missing compiled assets and wrong candidate are rejected',async t=>{
 const dir=await fixture(t);await assert.rejects(()=>inspectStandaloneBuild(dir,'main'),/Exact candidate/);
 await rm(join(dir,'assets/main.css'));await assert.rejects(()=>inspectStandaloneBuild(dir,sha),/Missing manifest asset/);
});

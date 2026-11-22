import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
test('browser source uses Firebase only for authentication, never Firestore',()=>{
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):/\.[jt]sx?$/.test(e.name)?[join(dir,e.name)]:[]);
 for(const file of walk('src')){
  const s=readFileSync(file,'utf8');
  assert.doesNotMatch(s,/['"](?:firebase\/firestore(?:\/[^'"]*)?|@firebase\/firestore(?:\/[^'"]*)?)['"]/,file);
  assert.doesNotMatch(s,/\b(?:initializeFirestore|connectFirestoreEmulator|getFirestore)\s*\(/,file);
 }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkloadTokenProvider, getDatastoreAccessToken, DATASTORE_SCOPE } from '../server/workloadIdentity';

test('concurrent callers share one credential acquisition and subsequent calls refresh through the source', async()=>{
  let count=0, resolve: (value:string)=>void=()=>{};
  const provider=createWorkloadTokenProvider(async()=>{
    count++;
    if(count===1) return new Promise<string>(r=>{resolve=r;});
    return 'synthetic-refreshed-token';
  });
  const first=provider(), second=provider();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(count,1);
  resolve('synthetic-initial-token');
  assert.deepEqual(await Promise.all([first,second]),['synthetic-initial-token','synthetic-initial-token']);
  assert.equal(await provider(),'synthetic-refreshed-token');
  assert.equal(count,2);
});
test('credential errors are sanitized and failed acquisition can recover',async()=>{
  let count=0;
  const provider=createWorkloadTokenProvider(async()=>{
    if(++count===1) throw new Error('secret synthetic credential details');
    return 'synthetic-recovered';
  });
  await assert.rejects(provider(),{message:'Workload identity unavailable'});
  assert.equal(await provider(),'synthetic-recovered');
});
test('credential wait is bounded without launching duplicate pending refreshes',async()=>{
  let count=0, resolve:(value:string)=>void=()=>{};
  const provider=createWorkloadTokenProvider(()=>{count++;return new Promise<string>(r=>{resolve=r;});},15);
  await assert.rejects(provider(),/timed out/);
  await assert.rejects(provider(),/timed out/);
  assert.equal(count,1);
  resolve('synthetic-late-token');
});
test('empty credentials and fixed production tokens fail closed', async()=>{
  await assert.rejects(createWorkloadTokenProvider(async()=>null)(),/unavailable/);
  await assert.rejects(getDatastoreAccessToken({NODE_ENV:'production',FIREBASE_PROJECT_ID:'nexustalent-test',GOOGLE_OAUTH_ACCESS_TOKEN:'fixed'}),/not supported/);
  await assert.rejects(getDatastoreAccessToken({NODE_ENV:'test',FIREBASE_PROJECT_ID:'other-project',GOOGLE_OAUTH_ACCESS_TOKEN:'fixed'}),/not supported/);
  assert.equal(await getDatastoreAccessToken({NODE_ENV:'test',FIREBASE_PROJECT_ID:'nexustalent-test',GOOGLE_OAUTH_ACCESS_TOKEN:'fixture'}),'fixture');
  assert.equal(DATASTORE_SCOPE,'https://www.googleapis.com/auth/datastore');
});

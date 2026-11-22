import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRefresh} from '../src/lib/workspaceRefresh';
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
test('duplicate focus while loading and immediately after a successful read is coalesced',async()=>{
 let n=0,now=0;const values:number[]=[];const first=deferred<number>();
 const c=createWorkspaceRefresh({read:()=>++n===1?first.promise:Promise.resolve(n),apply:v=>values.push(v),unavailable:()=>assert.fail('unexpected failure'),now:()=>now});
 const loading=c.refresh('initial');await c.refresh('focus');await c.refresh('focus');assert.equal(n,1);first.resolve(1);await loading;
 await c.refresh('focus');assert.equal(n,1);now=1001;await c.refresh('focus');assert.equal(n,2);assert.deepEqual(values,[1,2]);
});
test('mutation invalidates in-flight snapshot and reads again even within focus cooldown',async()=>{
 const first=deferred<number>();let n=0;const values:number[]=[];
 const c=createWorkspaceRefresh({read:()=>++n===1?first.promise:Promise.resolve(n),apply:v=>values.push(v),unavailable:()=>assert.fail('unexpected failure'),now:()=>0});
 const loading=c.refresh('initial');await c.refresh('mutation');await c.refresh('mutation');first.resolve(1);await loading;
 assert.deepEqual(values,[2]);await c.refresh('mutation');assert.deepEqual(values,[2,3]);
});
test('disposed identity never receives in-flight data or queued refresh',async()=>{
 const first=deferred<number>();let n=0;
 const c=createWorkspaceRefresh({read:()=>{n++;return first.promise;},apply:()=>assert.fail('stale identity update'),unavailable:()=>assert.fail('stale identity failure')});
 const loading=c.refresh('initial');await c.refresh('mutation');c.dispose();first.resolve(1);await loading;await c.refresh('retry');assert.equal(n,1);
});
test('failed read clears workspace and explicit retry is immediate',async()=>{
 let n=0,errors=0;const values:number[]=[];
 const c=createWorkspaceRefresh({read:async()=>{if(++n===1)throw Error('outage');return n;},apply:v=>values.push(v),unavailable:()=>errors++,now:()=>0});
 await c.refresh('initial');assert.equal(errors,1);await c.refresh('retry');assert.deepEqual(values,[2]);
});

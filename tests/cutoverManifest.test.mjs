import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCutoverManifest} from '../scripts/build-cutover-manifest.mjs';
import {required} from '../scripts/check-database-cutover.mjs';
const snap=(projectId='old',databaseId='named')=>{
 const p='projects/'+projectId+'/databases/'+databaseId+'/documents/';
 return {projectId,databaseId,collections:[...required],documents:[
 {name:p+'students/private-id',fields:{count:{integerValue:'9007199254740993'},name:{stringValue:'private name'},related:{referenceValue:p+'offers/offer-id'}}},
 {name:p+'students/private-id/history/note',fields:{map:{mapValue:{fields:{z:{booleanValue:true},a:{arrayValue:{values:[{nullValue:null},{doubleValue:1}]}}}}}}},
 ],authIdentities:[{uid:'private-id',disabled:false,providers:[{providerId:'google.com',providerUid:'private-provider'}],claims:{role:'student'}}]};
};
test('project-relative paths and internal references compare across projects; ordering is stable',()=>{
 const a=snap(),b=snap('new','(default)');b.documents.reverse();b.collections.reverse();const x=buildCutoverManifest(a),y=buildCutoverManifest(b);
 assert.deepEqual(x.collections,y.collections);assert.deepEqual(x.authIdentityManifest,y.authIdentityManifest);assert.equal(x.collections.students.count,2);assert.equal(x.collections.invoices.count,0);assert.equal(x.complete,false);assert.equal(x.writes,0);
 assert.ok(!JSON.stringify(x).includes('private'));
});
test('typed values, nested documents and identity changes alter the relevant hashes',()=>{
 const a=snap(),b=snap();b.documents[0].fields.count={stringValue:'9007199254740993'};b.authIdentities[0].disabled=true;
 assert.notEqual(buildCutoverManifest(a).collections.students.sha256,buildCutoverManifest(b).collections.students.sha256);
 assert.notEqual(buildCutoverManifest(a).authIdentityManifest.sha256,buildCutoverManifest(b).authIdentityManifest.sha256);
 b.documents.pop();assert.equal(buildCutoverManifest(b).collections.students.count,1);
});
test('invalid paths, duplicate documents, missing inventory and malformed typing are rejected',()=>{
 for(const change of [s=>s.documents.push(s.documents[0]),s=>s.collections.pop(),s=>s.documents[0].name+='/',s=>s.documents[0].fields.count={integerValue:123},s=>s.authIdentities[0].passwordHash='private',s=>s.documents[0].fields.count={integerValue:'9223372036854775808'}]){
  const s=snap();change(s);assert.throws(()=>buildCutoverManifest(s),/Invalid offline snapshot structure/);
 }
});
test('external references remain exact and cannot silently become internal references',()=>{
 const s=snap(),t=snap('new','(default)');t.documents[0].fields.related=s.documents[0].fields.related;
 assert.notEqual(buildCutoverManifest(s).collections.students.sha256,buildCutoverManifest(t).collections.students.sha256);
});
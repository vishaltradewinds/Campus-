import test from 'node:test';
import assert from 'node:assert/strict';
import {checkHostingRelease} from '../scripts/check-hosting-release.mjs';
const candidate='a'.repeat(40), live='b'.repeat(40);
const fixture=()=>({candidateSha:candidate,inventoryComplete:true,services:[
 {id:'srv-datjr5qd0e5s73cddh9g',name:'nexustalent-zero-cost-v2',repo:'https://github.com/vishaltradewinds/Campus-',branch:'main',autoDeploy:'no',autoDeployTrigger:'off',pullRequestPreviewsEnabled:'no',suspended:'not_suspended',liveDeploy:{id:'dep-test1',status:'live',commitSha:live}},
 {id:'srv-datjqppsrm7s7390aaj0',name:'nexustalent-zero-cost',repo:'https://github.com/vishaltradewinds/Campus-',branch:'main',autoDeploy:'no',autoDeployTrigger:'off',pullRequestPreviewsEnabled:'no',suspended:'not_suspended',liveDeploy:{id:'dep-test2',status:'live',commitSha:live}},
]});
test('explicitly disabled automatic deployment still does not authorize release or assert live candidate',()=>{
 const r=checkHostingRelease(fixture());assert.deepEqual(r.blockers,[]);assert.equal(r.automaticDeployment,false);assert.ok(r.observations.every(o=>!o.liveCandidateMatches));assert.match(r.decision,/REQUIRES_INDEPENDENT/);
});
test('either auto-deploy setting or unverified previews prevents release',()=>{
 const x=fixture();x.services[0].autoDeploy='yes';x.services[1].autoDeployTrigger='commit';x.services[1].pullRequestPreviewsEnabled='yes';
 const r=checkHostingRelease(x);assert.ok(r.blockers.includes('AUTO_DEPLOY_NOT_EXPLICITLY_DISABLED'));assert.ok(r.blockers.includes('PREVIEW_DEPLOY_CONTROL_UNVERIFIED'));
});
test('missing known target, incomplete inventory and unknown matching target all block',()=>{
 const x=fixture(),s=x.services.pop();x.inventoryComplete=false;x.services.push({...s,id:'srv-unexpected'});
 const r=checkHostingRelease(x);for(const k of ['KNOWN_HOSTING_TARGET_MISSING','INVENTORY_COMPLETENESS_UNVERIFIED','UNRECONCILED_HOSTING_TARGET'])assert.ok(r.blockers.includes(k));
});
test('unknown rollback, changed branch, duplicate service and repository drift block',()=>{
 const x=fixture();x.services[0].liveDeploy=null;x.services[0].branch='other';x.services[1].repo='https://example.test/private';x.services.push(x.services[1]);
 const r=checkHostingRelease(x);for(const k of ['ROLLBACK_REFERENCE_UNVERIFIED','UNEXPECTED_DEPLOYMENT_BRANCH','DUPLICATE_SERVICE_METADATA','UNRECONCILED_HOSTING_TARGET'])assert.ok(r.blockers.includes(k));assert.ok(!JSON.stringify(r).includes('example.test'));
});
test('missing candidate and malformed metadata fail closed',()=>{
 assert.throws(()=>checkHostingRelease({services:[]}),/Exact candidate/);
 assert.throws(()=>checkHostingRelease({candidateSha:candidate}),/inventory/);
});
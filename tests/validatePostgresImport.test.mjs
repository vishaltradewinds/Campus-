import test from 'node:test';
import assert from 'node:assert/strict';
import {validateImport} from '../scripts/validate-postgres-import.mjs';
import {required} from '../scripts/check-database-cutover.mjs';
const fixture=()=>({projectId:'old',databaseId:'named',collections:[...required],authIdentities:[],documents:[{name:'projects/old/databases/named/documents/users/private-id',fields:{uid:{stringValue:'private-id'},role:{stringValue:'student'}}}]});
test('valid offline content never executes import',()=>{const r=validateImport(fixture());assert.equal(r.blockers,0);assert.equal(r.automaticImport,false);assert.equal(r.complete,false);assert.equal(r.writes,0);assert.ok(!JSON.stringify(r).includes('private'));});
test('identity and role mismatches block',()=>{for(const fields of [{uid:{stringValue:'other'},role:{stringValue:'student'}},{uid:{stringValue:'private-id'},role:{stringValue:'admin'}},{}]){const s=fixture();s.documents[0].fields=fields;assert.equal(validateImport(s).identityMismatch,1);}});
test('stakeholder identity mismatch blocks',()=>{const s=fixture();s.documents[0].name=s.documents[0].name.replace('/users/','/students/');assert.equal(validateImport(s).identityMismatch,1);});
test('unsupported source value and unknown root block',()=>{const s=fixture();s.documents[0].fields.x={timestampValue:'2026-01-01T00:00:00Z'};s.collections.push('other');const r=validateImport(s);assert.equal(r.unsupported,1);assert.equal(r.unknownCollections,1);assert.equal(r.decision,'IMPORT_HOLD');});
test('source import preflight propagates orphan assessment and success-fee blockers',()=>{
 const s=fixture();
 const prefix='projects/old/databases/named/documents/';
 s.documents.push({name:prefix+'assessmentSubmissions/assess-orphan',fields:{id:{stringValue:'assess-orphan'},opportunityId:{stringValue:'missing'},response:{stringValue:'Synthetic evidence only'}}});
 s.documents.push({name:prefix+'successFees/fee-orphan',fields:{id:{stringValue:'fee-orphan'},opportunityId:{stringValue:'missing'},compensationMinor:{integerValue:'12345'},feeAmountMinor:{integerValue:'616'}}});
 const result=validateImport(s);
 assert.ok(result.relationships.findings.ASSESSMENT_SUBMISSION_LINK_MISMATCH>0);
 assert.ok(result.relationships.findings.SUCCESS_FEE_LINK_MISMATCH>0);
 assert.ok(result.relationships.findings.SUCCESS_FEE_AMOUNT_MISMATCH>0);
 assert.equal(result.decision,'IMPORT_HOLD');
 assert.equal(result.writes,0);
 assert.ok(!JSON.stringify(result).includes('Synthetic evidence'));
});

test('oversize payload blocks',()=>{const s=fixture();s.documents[0].fields.x={stringValue:'x'.repeat(1024*1024)};assert.equal(validateImport(s).oversize,1);});

test('incomplete approved institution records prevent directory-breaking import',()=>{
 const s=fixture();const prefix='projects/old/databases/named/documents/';
 s.documents.push({name:prefix+'institutions/private-campus',fields:{id:{stringValue:'private-campus'},empanelmentStatus:{stringValue:'empanelled'},name:{stringValue:'  '}}});
 const r=validateImport(s);assert.equal(r.registrationDirectory.invalidDirectoryRecords,1);assert.equal(r.decision,'IMPORT_HOLD');assert.ok(!JSON.stringify(r).includes('private-campus'));
 s.documents[1].fields.name={stringValue:'Synthetic Campus'};s.documents[1].fields.code={stringValue:'SYN'};
 assert.equal(validateImport(s).registrationDirectory.invalidDirectoryRecords,0);
});
test('large directory requires multi-page acceptance but no longer imposes a fixed import limit',()=>{
 const s=fixture();const prefix='projects/old/databases/named/documents/';
 for(let i=0;i<101;i++){const id='campus-'+i;s.documents.push({name:prefix+'institutions/'+id,fields:{id:{stringValue:id},name:{stringValue:'Synthetic campus'},code:{stringValue:'CI-'+i},empanelmentStatus:{stringValue:'empanelled'}}});}
 const r=validateImport(s);assert.equal(r.registrationDirectory.requiresMultiPageAcceptance,true);assert.equal(r.registrationDirectory.empanelledInstitutions,101);assert.equal(r.registrationDirectory.pageSize,100);
});

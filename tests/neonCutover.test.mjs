import test from 'node:test';
import assert from 'node:assert/strict';
import {checkNeonCutover,identityRoles} from '../scripts/check-neon-cutover.mjs';
import {required} from '../scripts/check-database-cutover.mjs';
import {releaseSchemaRoleCatalog,runtimeLogins} from '../scripts/check-live-neon-roles.mjs';
const digest='a'.repeat(64);
const manifest=()=>({count:0,sha256:digest});
const fixture=()=>({candidateSha:'b'.repeat(40),source:{engine:'firestore',projectId:'quadratic-button-s8gvj',databaseId:'ai-studio-nexustalentcampu-045f276b-0185-4999-9fd0-a789c15aa363',complete:true,collections:Object.fromEntries(required.map(k=>[k,manifest()])),authIdentityManifest:manifest()},destination:{engine:'postgresql',provider:'neon',pgVersion:16,projectId:'rough-butterfly-67822299',branchId:'br-rapid-brook-b3bqvuxx',databaseId:'nexustalent',complete:true,collections:Object.fromEntries(required.map(k=>[k,manifest()])),authIdentityManifest:manifest()},subcollectionsIncluded:true,sourceWritesFrozen:true,destinationPublicWritesDisabled:true,authProviderAndRoleValidation:true,reconciliationCompleted:true,reconciliationBlockers:0,rulesAndIndexesVerified:true,runtimeIdentityVerified:true,negativeAccessTestsPassed:true,backupAndRollbackVerified:true,ownerAuthorized:true,migrationsVerifiedThrough:20,runtimeRoles:Object.fromEntries(identityRoles.map((r,i)=>[r,{leastPrivilegeVerified:true,negativeTestsPassed:true,evidenceDigest:digest,roleFingerprint:(i+1).toString(16).padStart(64,'0')} ])),liveRoleInventory:{projectId:'rough-butterfly-67822299',branchId:'br-rapid-brook-b3bqvuxx',databaseName:'nexustalent',inventorySource:'neon-role-api',inventoryComplete:true,roles:[{name:'nexustalent_owner',authentication_method:'password'},...releaseSchemaRoleCatalog.map(name=>({name,authentication_method:'no_login'})),...Object.values(runtimeLogins).map(name=>({name,authentication_method:'password'}))]},roleProvisioning:{method:'reviewed-postgresql-sql',defaultNeonAdministratorRolesExcluded:true},sqlGrantAndRlsAuditVerified:true,noOwnerCredentialInRuntime:true,targetTlsVerified:true,runtimeConnectionBudgetVerified:true,rateLimitAndCapacityVerified:true,standaloneBrowserBuildVerified:true,sharedApiAcceptancePassed:true,identityReenrollmentVerified:true,adminAccessVerified:true,accountRecoveryVerified:true,sourceIdentityInventoryVerified:true,sourceDataDispositionApproved:true,noPaidUpgrade:true,hostingQuotaVerified:true,databaseQuotaVerified:true,evidence:Object.fromEntries(['schemaDigest','migrationHistoryDigest','sqlGrantAuditDigest','roleProvisioningDigest','sourceInventoryDigest','destinationInventoryDigest','identityReconciliationDigest','costBoundaryDigest','reviewDigest','rollbackDigest','cutoverPlanDigest'].map(k=>[k,digest]))});
test('complete Neon evidence metadata still cannot authorize or execute cutover',()=>{const r=checkNeonCutover(fixture());assert.deepEqual(r.blockers,[]);assert.equal(r.automaticCutover,false);assert.equal(r.writes,0);});
test('incorrect destination, old migration and missing role separation deny cutover',()=>{const x=fixture();x.destination.branchId='wrong';x.migrationsVerifiedThrough=18;x.runtimeRoles.login.roleFingerprint=x.runtimeRoles.session.roleFingerprint;const r=checkNeonCutover(x);for(const b of ['APPROVED_ENGINE_AND_TARGET_REQUIRED','SCHEMA_MIGRATION_EVIDENCE_REQUIRED','DISTINCT_RESTRICTED_RUNTIME_ROLES_REQUIRED'])assert.ok(r.blockers.includes(b));});
test('missing source, privacy, cost, recovery or operational evidence fails closed',()=>{const x=fixture();x.accountRecoveryVerified=false;x.sourceDataDispositionApproved=false;x.noPaidUpgrade=false;x.noOwnerCredentialInRuntime=false;delete x.evidence.reviewDigest;const r=checkNeonCutover(x);for(const b of ['OPERATIONAL_SECURITY_REQUIRED','INDEPENDENT_RUNTIME_ACCEPTANCE_REQUIRED','SOURCE_DISPOSITION_AND_RECONCILIATION_REQUIRED','NO_SURPRISE_BILLING_EVIDENCE_REQUIRED','INDEPENDENT_REVIEW_EVIDENCE_REQUIRED'])assert.ok(r.blockers.includes(b));});

test('full artificial role evidence cannot hide the actual unprovisioned Neon roles',()=>{const x=fixture();x.liveRoleInventory.roles=[{name:'nexustalent_owner',authentication_method:'password'},{name:'nexustalent_api',authentication_method:'no_login'}];const r=checkNeonCutover(x);assert.ok(r.blockers.includes('LIVE_NEON_ROLE_AND_PRIVILEGE_INVENTORY_REQUIRED'));assert.equal(r.automaticCutover,false);});
test('complete-looking role list without audited grants is not cutover evidence',()=>{const x=fixture();x.sqlGrantAndRlsAuditVerified=false;assert.ok(checkNeonCutover(x).blockers.includes('LIVE_NEON_ROLE_AND_PRIVILEGE_INVENTORY_REQUIRED'));x.sqlGrantAndRlsAuditVerified=true;delete x.evidence.sqlGrantAuditDigest;assert.ok(checkNeonCutover(x).blockers.includes('LIVE_NEON_ROLE_AND_PRIVILEGE_INVENTORY_REQUIRED'));});

test('Neon Console, API and default CLI admin-role provisioning fail closed',()=>{
 for(const method of ['neon-console','neon-api','neon-cli-default','neon-cli-read_write',undefined]){
  const x=fixture();x.roleProvisioning.method=method;
  const r=checkNeonCutover(x);
  assert.ok(r.blockers.includes('LEAST_PRIVILEGE_ROLE_PROVISIONING_REQUIRED'),String(method));
  assert.equal(r.automaticCutover,false);
 }
});
test('missing independent provisioning record and superuser exclusion fail closed',()=>{
 const x=fixture();x.roleProvisioning.defaultNeonAdministratorRolesExcluded=false;
 assert.ok(checkNeonCutover(x).blockers.includes('LEAST_PRIVILEGE_ROLE_PROVISIONING_REQUIRED'));
 x.roleProvisioning.defaultNeonAdministratorRolesExcluded=true;
 delete x.evidence.roleProvisioningDigest;
 assert.ok(checkNeonCutover(x).blockers.includes('LEAST_PRIVILEGE_ROLE_PROVISIONING_REQUIRED'));
});

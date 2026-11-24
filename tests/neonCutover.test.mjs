import test from 'node:test';
import assert from 'node:assert/strict';
import {checkNeonCutover,identityRoles} from '../scripts/check-neon-cutover.mjs';
import {required} from '../scripts/check-database-cutover.mjs';
import {releaseSchemaRoleCatalog,runtimeLogins,runtimeGrantRoles} from '../scripts/check-live-neon-roles.mjs';
const digest='a'.repeat(64);
const manifest=()=>({count:0,sha256:digest});
const privilegeRows=()=>identityRoles.map(purpose=>({
 database_name:'nexustalent',purpose,login_role:runtimeLogins[purpose],grant_role:runtimeGrantRoles[purpose],
 can_login:true,inherits:true,superuser:false,bypass_rls:false,can_create_role:false,can_create_db:false,replication:false,
 grant_can_login:false,grant_elevated:false,grant_parent_memberships:0,has_membership_admin_option:false,
 inherits_expected_grant:true,total_direct_memberships:1,owner_member:false,table_owner:false,
 dangerous_table_privilege:false,function_only_record_access:false,identity_direct_table_access:false,
 offline_operator_access:false,expected_function_access:true,forced_rls:true,direct_role_memberships:[runtimeGrantRoles[purpose]]
}));
const fixture=()=>({candidateSha:'b'.repeat(40),source:{engine:'firestore',projectId:'quadratic-button-s8gvj',databaseId:'ai-studio-nexustalentcampu-045f276b-0185-4999-9fd0-a789c15aa363',complete:true,collections:Object.fromEntries(required.map(k=>[k,manifest()])),authIdentityManifest:manifest()},destination:{engine:'postgresql',provider:'neon',pgVersion:16,projectId:'rough-butterfly-67822299',branchId:'br-rapid-brook-b3bqvuxx',databaseId:'nexustalent',complete:true,collections:Object.fromEntries(required.map(k=>[k,manifest()])),authIdentityManifest:manifest()},subcollectionsIncluded:true,sourceWritesFrozen:true,destinationPublicWritesDisabled:true,authProviderAndRoleValidation:true,reconciliationCompleted:true,reconciliationBlockers:0,rulesAndIndexesVerified:true,runtimeIdentityVerified:true,negativeAccessTestsPassed:true,backupAndRollbackVerified:true,ownerAuthorized:true,migrationsVerifiedThrough:20,runtimeRoles:Object.fromEntries(identityRoles.map((r,i)=>[r,{leastPrivilegeVerified:true,negativeTestsPassed:true,evidenceDigest:digest,roleFingerprint:(i+1).toString(16).padStart(64,'0')} ])),liveRoleInventory:{projectId:'rough-butterfly-67822299',branchId:'br-rapid-brook-b3bqvuxx',databaseName:'nexustalent',inventorySource:'neon-role-api',inventoryComplete:true,roles:[{name:'nexustalent_owner',authentication_method:'password'},...releaseSchemaRoleCatalog.map(name=>({name,authentication_method:'no_login'})),...Object.values(runtimeLogins).map(name=>({name,authentication_method:'password'}))]},roleProvisioning:{method:'reviewed-postgresql-sql',defaultNeonAdministratorRolesExcluded:true},sqlGrantAndRlsAuditVerified:true,sqlPrivilegeRows:privilegeRows(),adminAuthentication:{candidateSha:'b'.repeat(40),proofMode:'verified-webauthn-ceremony',syntheticProofUsed:false,ownerCredentialUsed:false,accountAuthorityVerified:true,sessionRevocationVerified:true},registrationDirectoryAcceptance:{candidateSha:'b'.repeat(40),pageSize:100,multiPageVerified:true,privateFieldsExcluded:true,registrationVerified:true},noOwnerCredentialInRuntime:true,targetTlsVerified:true,runtimeConnectionBudgetVerified:true,rateLimitAndCapacityVerified:true,standaloneBrowserBuildVerified:true,sharedApiAcceptancePassed:true,identityReenrollmentVerified:true,adminAccessVerified:true,accountRecoveryVerified:true,sourceIdentityInventoryVerified:true,sourceDataDispositionApproved:true,noPaidUpgrade:true,hostingQuotaVerified:true,databaseQuotaVerified:true,evidence:Object.fromEntries(['schemaDigest','migrationHistoryDigest','sqlGrantAuditDigest','roleProvisioningDigest','sourceInventoryDigest','destinationInventoryDigest','identityReconciliationDigest','costBoundaryDigest','reviewDigest','rollbackDigest','cutoverPlanDigest','adminAuthenticationDigest','adminRevocationDigest','registrationDirectoryDigest'].map(k=>[k,digest]))});
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

test('disposable rows, missing privilege data and offline operator authority cannot pass the production gate',()=>{
 for(const change of [x=>delete x.sqlPrivilegeRows,x=>x.sqlPrivilegeRows.forEach(r=>r.database_name='nexustalent_ci'),x=>x.sqlPrivilegeRows[0].offline_operator_access=true,x=>x.sqlPrivilegeRows[0].grant_parent_memberships=1]){
  const x=fixture();change(x);assert.ok(checkNeonCutover(x).blockers.includes('COMPLETE_PRODUCTION_SQL_PRIVILEGE_ROWS_REQUIRED'));
 }
});
test('synthetic administrator proof or missing revocation evidence cannot be used as live acceptance',()=>{
 for(const change of [x=>delete x.adminAuthentication,x=>x.adminAuthentication.syntheticProofUsed=true,x=>x.adminAuthentication.ownerCredentialUsed=true,x=>x.adminAuthentication.proofMode='synthetic',x=>x.adminAuthentication.sessionRevocationVerified=false,x=>x.adminAuthentication.candidateSha='c'.repeat(40),x=>delete x.evidence.adminAuthenticationDigest]){
  const x=fixture();change(x);assert.ok(checkNeonCutover(x).blockers.includes('REAL_ADMINISTRATOR_AUTHENTICATION_EVIDENCE_REQUIRED'));
 }
});

test('registration directory acceptance must be candidate-bound and demonstrate multi-page enrollment without private data',()=>{
 for(const change of [x=>delete x.registrationDirectoryAcceptance,x=>x.registrationDirectoryAcceptance.multiPageVerified=false,x=>x.registrationDirectoryAcceptance.candidateSha='c'.repeat(40),x=>x.registrationDirectoryAcceptance.privateFieldsExcluded=false,x=>x.registrationDirectoryAcceptance.registrationVerified=false,x=>delete x.evidence.registrationDirectoryDigest]){
 const x=fixture();change(x);assert.ok(checkNeonCutover(x).blockers.includes('REGISTRATION_DIRECTORY_ACCEPTANCE_REQUIRED'));
 }
});

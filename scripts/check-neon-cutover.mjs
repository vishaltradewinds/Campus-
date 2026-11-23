import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {checkDatabaseCutover} from './check-database-cutover.mjs';
import {checkLiveRoleInventory} from './check-live-neon-roles.mjs';
// Read-only metadata gate. Never reads credentials, opens a database or authorizes cutover.
const validRef=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const identityRoles=['reader','registrar','demand','institution','consent','assessment','offer','joining','verification','academic','evidence','disclosure','profile','directory','login','session','enrollment'];
export function checkNeonCutover(e){
 const common=checkDatabaseCutover(e);
 const blockers=[...common.blockers];
 const s=e.source,t=e.destination,proof=e.evidence||{};
 if(s?.engine!=='firestore'||t?.engine!=='postgresql'||t?.provider!=='neon'||t?.pgVersion!==16||s?.projectId!=='quadratic-button-s8gvj'||s?.databaseId!=='ai-studio-nexustalentcampu-045f276b-0185-4999-9fd0-a789c15aa363'||t?.projectId!=='rough-butterfly-67822299'||t?.branchId!=='br-rapid-brook-b3bqvuxx'||t?.databaseId!=='nexustalent')blockers.push('APPROVED_ENGINE_AND_TARGET_REQUIRED');
 if(e.migrationsVerifiedThrough!==19||!validRef(proof.schemaDigest)||!validRef(proof.migrationHistoryDigest))blockers.push('SCHEMA_MIGRATION_EVIDENCE_REQUIRED');
 const roles=e.runtimeRoles||{};
 if(identityRoles.some(r=>roles[r]?.leastPrivilegeVerified!==true||roles[r]?.negativeTestsPassed!==true||!validRef(roles[r]?.evidenceDigest))||new Set(identityRoles.map(r=>roles[r]?.roleFingerprint)).size!==identityRoles.length||identityRoles.some(r=>!validRef(roles[r]?.roleFingerprint)))blockers.push('DISTINCT_RESTRICTED_RUNTIME_ROLES_REQUIRED');
 const liveRoles=checkLiveRoleInventory(e.liveRoleInventory);
 // Real Neon API role metadata must correspond to the migration catalog and
 // 17 distinct app logins. API listing alone cannot prove SQL memberships.
 if(liveRoles.blockers.some(b=>b!=='INDEPENDENT_SQL_GRANT_AND_RLS_AUDIT_REQUIRED')||e.sqlGrantAndRlsAuditVerified!==true||!validRef(proof.sqlGrantAuditDigest))blockers.push('LIVE_NEON_ROLE_AND_PRIVILEGE_INVENTORY_REQUIRED');
 const provisioning=e.roleProvisioning||{};
 // Neon Console/API and default CLI role creation grant neon_superuser membership.
 // Custom RLS-scoped runtime identities must be created through reviewed SQL,
 // then independently checked in pg_auth_members; metadata alone proves nothing.
 if(provisioning.method!=='reviewed-postgresql-sql'||
    provisioning.defaultNeonAdministratorRolesExcluded!==true||
    !validRef(proof.roleProvisioningDigest))blockers.push('LEAST_PRIVILEGE_ROLE_PROVISIONING_REQUIRED');
 if(e.noOwnerCredentialInRuntime!==true||e.targetTlsVerified!==true||e.runtimeConnectionBudgetVerified!==true||e.rateLimitAndCapacityVerified!==true)blockers.push('OPERATIONAL_SECURITY_REQUIRED');
 if(e.standaloneBrowserBuildVerified!==true||e.sharedApiAcceptancePassed!==true||e.identityReenrollmentVerified!==true||e.adminAccessVerified!==true||e.accountRecoveryVerified!==true)blockers.push('INDEPENDENT_RUNTIME_ACCEPTANCE_REQUIRED');
 if(e.sourceIdentityInventoryVerified!==true||e.sourceDataDispositionApproved!==true||!validRef(proof.sourceInventoryDigest)||!validRef(proof.destinationInventoryDigest)||!validRef(proof.identityReconciliationDigest))blockers.push('SOURCE_DISPOSITION_AND_RECONCILIATION_REQUIRED');
 if(e.noPaidUpgrade!==true||e.hostingQuotaVerified!==true||e.databaseQuotaVerified!==true||!validRef(proof.costBoundaryDigest))blockers.push('NO_SURPRISE_BILLING_EVIDENCE_REQUIRED');
 if(!validRef(proof.reviewDigest)||!validRef(proof.rollbackDigest)||!validRef(proof.cutoverPlanDigest))blockers.push('INDEPENDENT_REVIEW_EVIDENCE_REQUIRED');
 return {...common,blockers,decision:blockers.length?'CUTOVER_HOLD':'METADATA_COMPLETE_REQUIRES_INDEPENDENT_CUTOVER_APPROVAL',automaticCutover:false,writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)throw Error('Missing metadata');const result=checkNeonCutover(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(result,null,2));if(result.blockers.length)process.exitCode=2;}
 catch{console.error('Invalid or unavailable cutover metadata');process.exitCode=1;}
}
export {identityRoles};

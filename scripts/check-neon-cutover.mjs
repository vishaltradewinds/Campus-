import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {checkDatabaseCutover,required} from './check-database-cutover.mjs';
import {checkLiveRoleInventory} from './check-live-neon-roles.mjs';
import {assessProductionPrivilegeRows} from './audit-production-pg-privileges.mjs';
// Read-only metadata gate. Never reads credentials, opens a database or authorizes cutover.
const validRef=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const identityRoles=['reader','registrar','demand','institution','consent','assessment','offer','joining','verification','academic','evidence','disclosure','profile','directory','login','session','enrollment'];
// Bind the sanitized generated report to the separately reviewed release metadata.
// A matching hash proves consistency, not authenticity or completeness of either inventory.
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export function crossEngineReportDigest(report){return createHash('sha256').update(canonical(report),'utf8').digest('hex');}
function matchingManifest(a,b){
 return !!a&&!!b&&Number.isSafeInteger(a.count)&&a.count>=0&&a.count===b.count&&validRef(a.sha256)&&a.sha256===b.sha256;
}
function matchingInventory(report,declared,keys){
 if(!report||!declared||report.complete!==false||declared.complete!==true||keys.some(k=>report[k]!==declared[k]))return false;
 const actual=report.collections,expected=declared.collections;
 if(!actual||!expected||Object.keys(actual).length!==required.length||Object.keys(expected).length!==required.length||required.some(k=>!Object.hasOwn(actual,k)||!Object.hasOwn(expected,k)||!matchingManifest(actual[k],expected[k])))return false;
 return matchingManifest(report.authIdentityManifest,declared.authIdentityManifest);
}
function validCrossEngineReport(e){
 const binding=e.crossEngineReconciliation,report=binding?.report;
 if(!report||binding.candidateSha!==e.candidateSha||!validRef(e.evidence?.crossEngineReportDigest)||crossEngineReportDigest(report)!==e.evidence.crossEngineReportDigest)return false;
 if(report.format!=='nexustalent-cross-engine-evidence-v1'||report.blockers!==0||report.decision!=='CONTENT_AND_IDENTITY_METADATA_MATCH_REQUIRES_INDEPENDENT_VALIDATION'||report.complete!==false||report.automaticCutover!==false||report.writes!==0)return false;
 if(!matchingInventory(report.source,e.source,['engine','projectId','databaseId'])||!matchingInventory(report.destination,e.destination,['engine','provider','pgVersion','projectId','branchId','databaseId']))return false;
 const content=report.content,preflight=report.preflight,identity=report.identity;
 if(!content||!preflight||!identity||content.blockers!==0||preflight.blockers!==0||identity.mismatch!==0||content.writes!==0||preflight.writes!==0||identity.providerEquivalenceVerified!==false||identity.reEnrollmentVerified!==false)return false;
 if(['unsupported','missing','extra','changed','unknownCollections'].some(k=>content[k]!==0))return false;
 // Top-level zero blockers cannot override contradictory detailed preflight findings.
 if(content.complete!==false||content.authVerified!==false||content.automaticCutover!==false||content.decision!=='CONTENT_MATCH_REQUIRES_INDEPENDENT_VALIDATION'||preflight.complete!==false||preflight.automaticImport!==false||preflight.decision!=='OFFLINE_VALIDATION_PASSED')return false;
 if(['unsupported','unknownCollections','identityMismatch','oversize'].some(k=>preflight[k]!==0))return false;
 const relationships=preflight.relationships,directory=preflight.registrationDirectory;
 if(!relationships||relationships.blocking!==0||relationships.recruitmentBlocking!==0||!relationships.findings||typeof relationships.findings!=='object'||Array.isArray(relationships.findings)||Object.keys(relationships.findings).length!==0)return false;
 if(!directory||directory.invalidDirectoryRecords!==0||!Number.isSafeInteger(directory.empanelledInstitutions)||directory.empanelledInstitutions<0||directory.empanelledInstitutions>report.source.collections.institutions.count||directory.pageSize!==100||directory.requiresMultiPageAcceptance!==(directory.empanelledInstitutions>100))return false;
 const total=Object.values(report.source.collections).reduce((sum,m)=>sum+m.count,0);
 if(!Number.isSafeInteger(total)||content.sourceRecords!==total||content.destinationRecords!==total||preflight.sourceRecords!==total||preflight.convertibleRecords!==total)return false;
 for(const side of ['source','destination']){
  const record=identity[side];
  if(!record||!matchingManifest(record.manifest,report[side].authIdentityManifest)||['authorityMismatch','simulation','missingAccountIdentity','providerIdentityCollision','claimRoleMismatch'].some(k=>record[k]!==0)||!Number.isSafeInteger(record.unregistered)||record.unregistered<0||record.unregistered>record.manifest.count)return false;
 }
 return identity.source.unregistered===identity.destination.unregistered;
}
export function checkNeonCutover(e){
 const common=checkDatabaseCutover(e);
 const blockers=[...common.blockers];
 const s=e.source,t=e.destination,proof=e.evidence||{};
 if(s?.engine!=='firestore'||t?.engine!=='postgresql'||t?.provider!=='neon'||t?.pgVersion!==16||s?.projectId!=='quadratic-button-s8gvj'||s?.databaseId!=='ai-studio-nexustalentcampu-045f276b-0185-4999-9fd0-a789c15aa363'||t?.projectId!=='rough-butterfly-67822299'||t?.branchId!=='br-rapid-brook-b3bqvuxx'||t?.databaseId!=='nexustalent')blockers.push('APPROVED_ENGINE_AND_TARGET_REQUIRED');
 if(e.migrationsVerifiedThrough!==20||!validRef(proof.schemaDigest)||!validRef(proof.migrationHistoryDigest))blockers.push('SCHEMA_MIGRATION_EVIDENCE_REQUIRED');
 const roles=e.runtimeRoles||{};
 if(identityRoles.some(r=>roles[r]?.leastPrivilegeVerified!==true||roles[r]?.negativeTestsPassed!==true||!validRef(roles[r]?.evidenceDigest))||new Set(identityRoles.map(r=>roles[r]?.roleFingerprint)).size!==identityRoles.length||identityRoles.some(r=>!validRef(roles[r]?.roleFingerprint)))blockers.push('DISTINCT_RESTRICTED_RUNTIME_ROLES_REQUIRED');
 const liveRoles=checkLiveRoleInventory(e.liveRoleInventory);
 // Real Neon API role metadata must correspond to the migration catalog and
 // 17 distinct app logins. API listing alone cannot prove SQL memberships.
 if(liveRoles.blockers.some(b=>b!=='INDEPENDENT_SQL_GRANT_AND_RLS_AUDIT_REQUIRED')||e.sqlGrantAndRlsAuditVerified!==true||!validRef(proof.sqlGrantAuditDigest))blockers.push('LIVE_NEON_ROLE_AND_PRIVILEGE_INVENTORY_REQUIRED');
 const privilegeAssessment=assessProductionPrivilegeRows(e.sqlPrivilegeRows);
 if(privilegeAssessment.auditedScopes!==identityRoles.length||privilegeAssessment.blockers.some(b=>b!=='PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED'))blockers.push('COMPLETE_PRODUCTION_SQL_PRIVILEGE_ROWS_REQUIRED');
 if(!validCrossEngineReport(e))blockers.push('CANDIDATE_BOUND_CROSS_ENGINE_RECONCILIATION_REQUIRED');
 const provisioning=e.roleProvisioning||{};
 // Neon Console/API and default CLI role creation grant neon_superuser membership.
 // Custom RLS-scoped runtime identities must be created through reviewed SQL,
 // then independently checked in pg_auth_members; metadata alone proves nothing.
 if(provisioning.method!=='reviewed-postgresql-sql'||
    provisioning.defaultNeonAdministratorRolesExcluded!==true||
    !validRef(proof.roleProvisioningDigest))blockers.push('LEAST_PRIVILEGE_ROLE_PROVISIONING_REQUIRED');
 if(e.noOwnerCredentialInRuntime!==true||e.targetTlsVerified!==true||e.runtimeConnectionBudgetVerified!==true||e.rateLimitAndCapacityVerified!==true)blockers.push('OPERATIONAL_SECURITY_REQUIRED');
 if(e.standaloneBrowserBuildVerified!==true||e.sharedApiAcceptancePassed!==true||e.identityReenrollmentVerified!==true||e.adminAccessVerified!==true||e.accountRecoveryVerified!==true)blockers.push('INDEPENDENT_RUNTIME_ACCEPTANCE_REQUIRED');
 // Live ingress and offline recovery cannot be substituted by localhost HTTPS
 // or authenticated password rotation. Evidence is independently witnessed.
 const ingress=e.productionIngress||{};
 if(ingress.candidateSha!==e.candidateSha||
    ingress.serviceId!=='srv-datjr5qd0e5s73cddh9g'||
    ingress.origin!=='https://nexustalent-zero-cost-v2.onrender.com'||
    ingress.actualHttpsVerified!==true||ingress.trustedProxyBoundaryVerified!==true||
    ingress.forwardingSpoofDenied!==true||ingress.foreignOriginDenied!==true||
    ingress.cookieSecurityVerified!==true||ingress.mixedCredentialDenied!==true||
    ingress.rateLimitsVerified!==true||ingress.processOnlyHealthVerified!==true||
    ingress.disposableTestUsed!==false||!validRef(proof.productionIngressDigest))
  blockers.push('PRODUCTION_HTTPS_INGRESS_EVIDENCE_REQUIRED');
 const recovery=e.ordinaryAccountRecovery||{};
 if(recovery.candidateSha!==e.candidateSha||
    recovery.method!=='offline-dual-control'||recovery.independentIdentityReviewVerified!==true||
    recovery.distinctAuthorizedOperatorsVerified!==true||recovery.oneUseRequestVerified!==true||
    recovery.allPriorSessionsRevoked!==true||recovery.oldCredentialDenied!==true||
    recovery.newCredentialVerified!==true||recovery.adminAndDisabledAccountDenied!==true||
    recovery.runtimeExecuteDenied!==true||recovery.auditRecordVerified!==true||
    recovery.disposableTestUsed!==false||!validRef(proof.ordinaryRecoveryDigest))
  blockers.push('INDEPENDENT_ORDINARY_ACCOUNT_RECOVERY_EVIDENCE_REQUIRED');
 const admin=e.adminAuthentication||{};
 // Synthetic proof adapters and owner-pool fixtures are explicitly not real
 // administrator authentication evidence. Require separately reviewed live
 // provider ceremony, authorization and revocation evidence for this SHA.
 if(admin.candidateSha!==e.candidateSha||admin.proofMode!=='verified-webauthn-ceremony'||
    admin.syntheticProofUsed!==false||admin.ownerCredentialUsed!==false||
    admin.accountAuthorityVerified!==true||admin.sessionRevocationVerified!==true||
    !validRef(proof.adminAuthenticationDigest)||!validRef(proof.adminRevocationDigest))blockers.push('REAL_ADMINISTRATOR_AUTHENTICATION_EVIDENCE_REQUIRED');
 const directory=e.registrationDirectoryAcceptance||{};
 if(directory.candidateSha!==e.candidateSha||directory.pageSize!==100||directory.multiPageVerified!==true||directory.privateFieldsExcluded!==true||directory.registrationVerified!==true||!validRef(proof.registrationDirectoryDigest))blockers.push('REGISTRATION_DIRECTORY_ACCEPTANCE_REQUIRED');
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

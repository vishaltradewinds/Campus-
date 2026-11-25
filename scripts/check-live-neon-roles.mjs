import {readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Stage-one, read-only role inventory. The provider API cannot attest SQL grants,
// superuser/RLS flags or user identity. This NEVER authorizes migration or cutover.
export const runtimeGrantRoles={
 reader:'nexustalent_reader',
 registrar:'nexustalent_registrar',
 demand:'nexustalent_demand_writer',
 institution:'nexustalent_institution_writer',
 consent:'nexustalent_consent_writer',
 assessment:'nexustalent_assessment_writer',
 offer:'nexustalent_offer_writer',
 joining:'nexustalent_joining_writer',
 verification:'nexustalent_verification_writer',
 academic:'nexustalent_academic_writer',
 evidence:'nexustalent_evidence_writer',
 disclosure:'nexustalent_disclosure_writer',
 profile:'nexustalent_profile_writer',
 directory:'nexustalent_directory_reader',
 login:'nexustalent_login_api',
 session:'nexustalent_session_reader',
 enrollment:'nexustalent_enrollment_api'
};
export const runtimeLogins=Object.fromEntries(Object.keys(runtimeGrantRoles).map(k=>[k,'nexustalent_app_'+k]));
// Reviewed 001–018 migration catalog; regression test compares it to SQL source.
export const releaseSchemaRoleCatalog=["nexustalent_academic_writer","nexustalent_api","nexustalent_assessment_writer","nexustalent_consent_writer","nexustalent_demand_writer","nexustalent_directory_reader","nexustalent_directory_resolver","nexustalent_disclosure_resolver","nexustalent_disclosure_writer","nexustalent_enrollment_api","nexustalent_enrollment_resolver","nexustalent_evidence_writer","nexustalent_institution_writer","nexustalent_joining_writer","nexustalent_login_api","nexustalent_login_resolver","nexustalent_offer_writer","nexustalent_profile_writer","nexustalent_reader","nexustalent_registrar","nexustalent_scope_resolver","nexustalent_session_reader","nexustalent_session_resolver","nexustalent_verification_writer"];


export async function loadMigrationRoleCatalog(directory){
 const files=(await readdir(directory)).filter(x=>/^\d{3}_[a-z0-9_]+\.sql$/.test(x)).sort();
 if(files.length!==20||files.some((s,i)=>Number(s.slice(0,3))!==i+1))throw Error('Expected complete 001–020 migration source');
 const names=new Set();
 for(const file of files){
  const sql=await readFile(join(directory,file),'utf8');
  const grants=[...sql.matchAll(/\bCREATE\s+ROLE\s+(nexustalent_[a-z_]+)\s+NOLOGIN\b/gi)].map(x=>x[1]);
  if(!['019','020'].includes(file.slice(0,3))&&grants.length===0)throw Error('Missing source grant roles');
  for(const name of grants){if(names.has(name))throw Error('Duplicate migration grant role');names.add(name);}
 }
 for(const grant of Object.values(runtimeGrantRoles))if(!names.has(grant))throw Error('Runtime grant role missing from migrations');
 return [...names].sort();
}

export function checkLiveRoleInventory(input,schemaGrantRoles=releaseSchemaRoleCatalog){
 if(!Array.isArray(schemaGrantRoles)||schemaGrantRoles.length!==releaseSchemaRoleCatalog.length||[...schemaGrantRoles].sort().join('|')!==releaseSchemaRoleCatalog.join('|'))throw Error('Invalid migration role catalog');
 const blockers=[];
 if(input?.projectId!=='rough-butterfly-67822299'||input?.branchId!=='br-rapid-brook-b3bqvuxx'||input?.databaseName!=='nexustalent')blockers.push('CANONICAL_NEON_TARGET_UNVERIFIED');
 if(input?.inventorySource!=='neon-role-api'||input?.inventoryComplete!==true||!Array.isArray(input?.roles))blockers.push('PROVIDER_ROLE_INVENTORY_UNVERIFIED');
 const actual=new Map();
 if(Array.isArray(input?.roles)){
  for(const item of input.roles){
   if(!item||Object.keys(item).some(k=>!['name','authentication_method'].includes(k))||typeof item.name!=='string'||!/^nexustalent_[a-z_]+$/.test(item.name)||actual.has(item.name)){blockers.push('ROLE_METADATA_UNSAFE_OR_DUPLICATED');continue;}
   actual.set(item.name,item.authentication_method);
  }
 }
 const missingGrantRoles=schemaGrantRoles.filter(name=>!actual.has(name));
 const loginEntries=Object.entries(runtimeLogins);
 const missingRuntimeLogins=loginEntries.filter(([,name])=>!actual.has(name)).map(([purpose])=>purpose);
 if(missingGrantRoles.length)blockers.push('REQUIRED_SCHEMA_GRANT_ROLES_MISSING');
 if(missingRuntimeLogins.length)blockers.push('RESTRICTED_RUNTIME_LOGINS_MISSING');
 if(schemaGrantRoles.some(name=>actual.has(name)&&actual.get(name)!=='no_login'))blockers.push('SCHEMA_ROLE_CAN_LOG_IN');
 if(loginEntries.some(([,name])=>actual.has(name)&&actual.get(name)!=='password'))blockers.push('RUNTIME_LOGIN_AUTHENTICATION_UNVERIFIED');
 if(actual.get('nexustalent_owner')!=='password')blockers.push('EXISTING_OWNER_ROLE_UNVERIFIED');
 const expected=new Set(['nexustalent_owner',...schemaGrantRoles,...Object.values(runtimeLogins)]);
 const unexpected=[...actual.keys()].filter(name=>!expected.has(name)).sort();
 if(unexpected.length)blockers.push('UNRECONCILED_EXTRA_ROLES');
 // Role listings do not prove grants, bypass flags, RLS policies or credentials.
 blockers.push('INDEPENDENT_SQL_GRANT_AND_RLS_AUDIT_REQUIRED');
 return {format:'nexustalent-neon-role-inventory-v1',target:'rough-butterfly-67822299/br-rapid-brook-b3bqvuxx/nexustalent',schemaGrantRoleCount:schemaGrantRoles.length,runtimeLoginRoleCount:loginEntries.length,missingGrantRoles,missingRuntimeLogins,unexpected,blockers:[...new Set(blockers)].sort(),decision:'PRODUCTION_IDENTITY_HOLD',authorizesRoleProvisioning:false,authorizesCutover:false,startsCompute:false,writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error();
  const root=resolve('db/neon/migrations');
  const roles=await loadMigrationRoleCatalog(root);
  const result=checkLiveRoleInventory(JSON.parse(await readFile(process.argv[2],'utf8')),roles);
  console.log(JSON.stringify(result,null,2));if(result.blockers.length)process.exitCode=2;
 }catch{console.error('Invalid sanitized role inventory or migrations');process.exitCode=1;}
}

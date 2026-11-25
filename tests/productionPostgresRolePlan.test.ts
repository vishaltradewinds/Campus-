import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeScopes} from '../server/postgresConnectionBudget';
import {planProductionPostgresRoles,productionAdapterBoundary,productionNeonTarget,productionRoleName,productionUrlEnvName} from '../server/productionPostgresRolePlan';

const provider=()=>({...productionNeonTarget,poolerEnabled:false});
const secret=(scope:string)=>'synthetic-production-secret-'+scope+'-not-real@';
function fixture(){
 const env:NodeJS.ProcessEnv={NODE_ENV:'production',NEXUSTALENT_DATASTORE:'postgres'};
 for(const scope of runtimeScopes)env[productionUrlEnvName(scope)]=`postgresql://${productionRoleName(scope)}:${encodeURIComponent(secret(scope))}@${productionNeonTarget.host}:5432/nexustalent`;
 return env;
}
test('all seventeen independent role connections stay below conservative 18-connection cap',()=>{
 const plan=planProductionPostgresRoles(fixture(),provider());
 assert.equal(plan.summary.roles.length,17);assert.equal(plan.summary.maximumConnections,18);
 assert.deepEqual(plan.summary.roles.map(r=>r.purpose),[...runtimeScopes]);
 assert.equal(plan.summary.authorizesDeployment,false);assert.equal(plan.summary.opensConnections,false);
 for(const scope of runtimeScopes){
  const p=plan.poolOptions(scope);
  assert.equal(p.user,productionRoleName(scope));
  assert.equal(p.password,secret(scope));assert.equal(p.host,productionNeonTarget.host);
  assert.equal(p.ssl.rejectUnauthorized,true);assert.equal(p.ssl.servername,p.host);
  assert.equal(p.max,scope==='reader'?2:1);assert.equal(p.allowExitOnIdle,true);
  assert.equal(p.connectionTimeoutMillis,5000);
 }
 assert.ok(!JSON.stringify(plan).includes('synthetic-production-secret'));
 assert.ok(!JSON.stringify(plan.summary).includes('synthetic-production-secret'));
});
test('provider identity, exact direct hostname, unpooled compute and PG version must match',()=>{
 for(const change of [
  {projectId:'wrong'}, {branchId:'wrong'}, {endpointId:'wrong'},
  {host:'ep-other.aws.neon.tech'}, {database:'neondb'}, {pgVersion:15}, {poolerEnabled:true}
 ])assert.throws(()=>planProductionPostgresRoles(fixture(),{...provider(),...change}),/Unverified canonical/);
});
test('no fixture, emulator, or development mode is accepted',()=>{
 for(const change of [
  {NODE_ENV:'test'}, {NEXUSTALENT_DATASTORE:'firestore'},
  {NEXUSTALENT_PG_INTEGRATION:'1'}, {NEXUSTALENT_STANDALONE_AUTH_TEST:'1'},
  {NEXUSTALENT_TEST_DATABASE_URL:'synthetic'}, {FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'},
  {FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}
 ])assert.throws(()=>planProductionPostgresRoles({...fixture(),...change},provider()),/mode|forbidden/);
});
test('missing, duplicated or too-short secrets cannot bind a runtime role',()=>{
 const x=fixture();delete x[productionUrlEnvName('login')];
 assert.throws(()=>planProductionPostgresRoles(x,provider()),/Required isolated/);
 const y=fixture();y[productionUrlEnvName('session')]=y[productionUrlEnvName('login')]!.replace('nexustalent_app_login','nexustalent_app_session');
 assert.throws(()=>planProductionPostgresRoles(y,provider()),/Unsafe isolated/);
 const z=fixture();z[productionUrlEnvName('enrollment')]=`postgresql://nexustalent_app_enrollment:short@${productionNeonTarget.host}/nexustalent`;
 assert.throws(()=>planProductionPostgresRoles(z,provider()),/Unsafe isolated/);
});
test('insecure and wrong-destination DSN variants fail without echoing secrets',()=>{
 const base=fixture(),key=productionUrlEnvName('reader'),original=base[key]!;
 for(const url of [
  original.replace('postgresql:', 'http:'),
  original.replace(':5432/', ':9999/'),
  original.replace('/nexustalent','/neondb'),
  original.replace(productionNeonTarget.host,'malicious.example'),
  original.replace('nexustalent_app_reader','nexustalent_owner'),
  original+'?sslmode=disable',
  original+'?sslmode=require',
  original+'#fragment',
  original.replace(productionNeonTarget.host,productionNeonTarget.host.replace('.c-4.','-pooler.c-4.'))
 ]){
  const x={...base,[key]:url};
  assert.throws(()=>planProductionPostgresRoles(x,provider()),e=>{
   assert.ok(e instanceof Error);
   assert.ok(!e.message.includes('synthetic-production-secret'));
   return /Unsafe isolated/.test(e.message);
  });
 }
});
test('unregistered scope never creates a connection or exposes another secret',()=>{
 const plan=planProductionPostgresRoles(fixture(),provider());
 assert.throws(()=>plan.poolOptions('owner' as any),/Unknown runtime scope/);
 assert.equal(Object.keys(plan).includes('password'),false);
});


test('production adapter boundaries never select an unscoped writer or a record store for function-only identities',()=>{
 const plan=planProductionPostgresRoles(fixture(),provider());
 for(const role of plan.summary.roles){
  assert.deepEqual(role.adapter,productionAdapterBoundary(role.purpose));
  if(['directory','login','session','enrollment'].includes(role.purpose)){
   assert.deepEqual(role.adapter,{kind:'function-only',purpose:role.purpose});
  }else{
   assert.deepEqual(role.adapter,{kind:'record-store',readOnly:role.purpose==='reader',insertOnly:role.purpose==='registrar',demand:role.purpose==='reader'||role.purpose==='registrar'?false:role.purpose==='demand'?true:role.purpose});
  }
 }
 assert.throws(()=>productionAdapterBoundary('runtime' as any),/Unknown runtime scope/);
 assert.throws(()=>productionAdapterBoundary('owner' as any),/Unknown runtime scope/);
});
test('conflicting generic database credentials, TLS overrides and hidden test bindings fail closed',()=>{
 for(const key of ['NEXUSTALENT_TEST_READER_URL','NEXUSTALENT_TEST_ENROLLMENT_URL','NEXUSTALENT_PG_POOL_PROFILE','PGHOST','PGHOSTADDR','PGUSER','PGPASSWORD','PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSERVICE','DATABASE_URL','POSTGRES_URL','NODE_TLS_REJECT_UNAUTHORIZED','NEXUSTALENT_PROD_OWNER_URL']){
  const x={...fixture(),[key]:'synthetic-conflicting-value'};
  assert.throws(()=>planProductionPostgresRoles(x,provider()),e=>{
   assert.ok(e instanceof Error);assert.ok(!e.message.includes('synthetic-conflicting-value'));return /forbidden|Unknown production/.test(e.message);
  });
 }
});

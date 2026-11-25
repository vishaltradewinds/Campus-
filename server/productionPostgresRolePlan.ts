import {runtimeScopes,type RuntimeScope} from './postgresConnectionBudget';

// Provider IDs and the single existing direct endpoint were confirmed read-only
// on 23 November 2026. A changed endpoint requires a new independent review.
// THIS IS AN INERT CONFIGURATION PLANNER. No production application imports it,
// it never opens a connection and it cannot authorize cutover or role creation.
export const productionNeonTarget=Object.freeze({
 projectId:'rough-butterfly-67822299',
 branchId:'br-rapid-brook-b3bqvuxx',
 endpointId:'ep-wandering-heart-b3eu0l2s',
 host:'ep-wandering-heart-b3eu0l2s.c-4.ap-southeast-1.aws.neon.tech',
 database:'nexustalent',
 pgVersion:16
});

export const productionRoleName=(scope:RuntimeScope)=>'nexustalent_app_'+scope;
export const productionUrlEnvName=(scope:RuntimeScope)=>'NEXUSTALENT_PROD_'+scope.toUpperCase()+'_URL';
const ceilings=Object.fromEntries(runtimeScopes.map(scope=>[scope,scope==='reader'?2:1])) as Record<RuntimeScope,number>;
type RecordScope=Exclude<RuntimeScope,'directory'|'login'|'session'|'enrollment'>;
type WriterScope=Exclude<RecordScope,'reader'|'registrar'|'demand'>;
type AdapterBoundary={kind:'record-store';readOnly:boolean;insertOnly:boolean;demand:boolean|WriterScope}|{kind:'function-only';purpose:'directory'|'login'|'session'|'enrollment'};
// These descriptors carry no credential, create no adapter and open no connection.
// A future approved runtime must use exactly one scoped adapter per role.
export function productionAdapterBoundary(scope:RuntimeScope):AdapterBoundary{
 if(!runtimeScopes.includes(scope))throw Error('Unknown runtime scope');
 if(scope==='directory'||scope==='login'||scope==='session'||scope==='enrollment')return {kind:'function-only',purpose:scope};
 return {kind:'record-store',readOnly:scope==='reader',insertOnly:scope==='registrar',demand:scope==='reader'||scope==='registrar'?false:scope==='demand'?true:scope};
}
type ProviderEvidence={projectId:string;branchId:string;endpointId:string;host:string;database:string;pgVersion:number;poolerEnabled:boolean};
type SafePoolOptions={
 host:string;port:number;database:string;user:string;password:string;
 ssl:{rejectUnauthorized:true;servername:string};max:number;idleTimeoutMillis:number;
 connectionTimeoutMillis:number;allowExitOnIdle:true;
};

/** Validate exact, distinct, direct-Neon TLS bindings; return only a redacted plan.
 * Pool options can be materialized explicitly for a future independently approved
 * runtime, but no connection or provider call occurs here.
 */
export function planProductionPostgresRoles(env:NodeJS.ProcessEnv,provider:ProviderEvidence){
 const target=productionNeonTarget;
 if(!provider||Object.entries(target).some(([key,value])=>provider[key as keyof ProviderEvidence]!==value)||provider.poolerEnabled!==false)throw Error('Unverified canonical direct Neon endpoint');
 if(env.NODE_ENV!=='production'||env.NEXUSTALENT_DATASTORE!=='postgres')throw Error('Production datastore mode not confirmed');
 if(Object.entries(env).some(([key,value])=>!!value&&(key.startsWith('NEXUSTALENT_TEST_')||['NEXUSTALENT_PG_INTEGRATION','NEXUSTALENT_STANDALONE_AUTH_TEST','NEXUSTALENT_PG_POOL_PROFILE','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST'].includes(key))))throw Error('Test or emulator mode forbidden');
 // Do not let libpq/node-postgres environment defaults, generic credentials,
 // or process-wide insecure TLS settings leak into the scoped runtime.
 if(Object.entries(env).some(([key,value])=>!!value&&(/^PG(?:HOST(?:ADDR)?|PORT|USER|PASSWORD|PASSFILE|DATABASE|OPTIONS|SERVICE(?:FILE)?|SSLMODE|SSL(?:CERT|KEY|ROOTCERT|CRL|NEGOTIATION)|CONNECT_TIMEOUT|APPNAME|REQUIREPEER|TARGETSESSIONATTRS|CHANNELBINDING)$/.test(key)||['DATABASE_URL','POSTGRES_URL','POSTGRES_PRISMA_URL','POSTGRES_URL_NON_POOLING','NODE_TLS_REJECT_UNAUTHORIZED'].includes(key))))throw Error('Conflicting database or TLS environment forbidden');
 const expectedKeys=new Set(runtimeScopes.map(productionUrlEnvName));
 if(Object.keys(env).some(key=>key.startsWith('NEXUSTALENT_PROD_')&&key.endsWith('_URL')&&!expectedKeys.has(key)))throw Error('Unknown production credential scope');
 const secrets=new Map<RuntimeScope,string>();
 const uniquePasswords=new Set<string>();
 for(const scope of runtimeScopes){
  const raw=env[productionUrlEnvName(scope)];
  if(typeof raw!=='string'||raw.length>4096||!raw)throw Error('Required isolated runtime credential missing');
  try{
   const url=new URL(raw);
   const name=productionRoleName(scope);
   if(url.protocol!=='postgresql:'||url.hostname!==target.host||url.username!==name||url.pathname!=='/'+target.database||url.port&&url.port!=='5432'||url.search||url.hash)throw Error();
   const password=decodeURIComponent(url.password);
   if(password.length<20||password.length>1024||uniquePasswords.has(password))throw Error();
   uniquePasswords.add(password);
   secrets.set(scope,password);
  }catch{throw Error('Unsafe isolated Neon runtime credential');}
 }
 const summary=Object.freeze({
  format:'nexustalent-neon-production-pool-plan-v1',
  target:{...target},
  roles:runtimeScopes.map(scope=>Object.freeze({purpose:scope,role:productionRoleName(scope),maxConnections:ceilings[scope],adapter:Object.freeze(productionAdapterBoundary(scope))})),
  maximumConnections:runtimeScopes.reduce((sum,scope)=>sum+ceilings[scope],0),
  tlsVerification:'required',directEndpointOnly:true,
  performsQueries:false,opensConnections:false,authorizesProvisioning:false,
  authorizesDeployment:false,decision:'CONFIGURATION_ONLY_GRANTS_AND_CUTOVER_UNVERIFIED'
 });
 return Object.freeze({
  summary,
  toJSON:()=>summary,
  poolOptions(scope:RuntimeScope):SafePoolOptions{
   if(!runtimeScopes.includes(scope))throw Error('Unknown runtime scope');
   const password=secrets.get(scope);
   if(!password)throw Error('Scoped credential missing');
   return {
    host:target.host,port:5432,database:target.database,
    user:productionRoleName(scope),password,
    ssl:{rejectUnauthorized:true,servername:target.host},
    max:ceilings[scope],idleTimeoutMillis:1000,
    connectionTimeoutMillis:5000,allowExitOnIdle:true
   };
  }
 });
}

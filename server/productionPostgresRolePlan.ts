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
 if(env.NEXUSTALENT_PG_INTEGRATION||env.NEXUSTALENT_STANDALONE_AUTH_TEST||env.NEXUSTALENT_TEST_DATABASE_URL||env.FIREBASE_AUTH_EMULATOR_HOST||env.FIRESTORE_EMULATOR_HOST)throw Error('Test or emulator mode forbidden');
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
  roles:runtimeScopes.map(scope=>({purpose:scope,role:productionRoleName(scope),maxConnections:ceilings[scope]})),
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

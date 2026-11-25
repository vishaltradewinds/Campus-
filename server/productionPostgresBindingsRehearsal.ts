import {runtimeScopes,type RuntimeScope} from './postgresConnectionBudget';
import {createPostgresRecordStore,createPostgresDirectory} from './postgresRecordStore';
import {createCredentialService} from './postgresCredentials';
import {createPostgresSessionVerifier} from './postgresSessionIdentity';
import {createEnrollmentService} from './postgresEnrollment';
import {planProductionPostgresRoles,productionRoleName,productionNeonTarget} from './productionPostgresRolePlan';

type Plan=ReturnType<typeof planProductionPostgresRoles>;
type Pool=Parameters<typeof createPostgresRecordStore>[0];
type PoolOptions=ReturnType<Plan['poolOptions']>;
type RecordScope=Exclude<RuntimeScope,'directory'|'login'|'session'|'enrollment'>;
const writerMode={demand:true,institution:'institution',consent:'consent',assessment:'assessment',offer:'offer',joining:'joining',verification:'verification',academic:'academic',evidence:'evidence',disclosure:'disclosure',profile:'profile'} as const;
const identityGrants={login:'nexustalent_login_api',session:'nexustalent_session_reader',enrollment:'nexustalent_enrollment_api'} as const;
const permitted={
 login:new Set(['SELECT uid,password_hash FROM nexustalent_identity.login_credential($1)','SELECT nexustalent_identity.issue_session($1,$2,$3) AS issued','SELECT uid,password_hash FROM nexustalent_identity.credential_for_session($1)','SELECT nexustalent_identity.change_credential($1,$2,$3) AS changed','SELECT nexustalent_identity.revoke_session($1) AS revoked']),
 session:new Set(['SELECT uid,email,admin_claim FROM nexustalent_identity.resolve_session($1)']),
 enrollment:new Set(['SELECT nexustalent_identity.consume_enrollment($1,$2) AS enrolled'])
} as const;

// Composition rehearsal only: no active entrypoint imports this module.
// Injectable pools let tests prove exact wiring without opening Neon sockets.
// Real production runtime, identity administration and cutover remain separate.
export async function rehearseProductionPostgresBindings(plan:Plan,makePool:(scope:RuntimeScope,options:PoolOptions)=>Pool,env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_PG_BINDING_REHEARSAL!=='1')throw Error('Production binding composition is rehearsal-only');
 const pools=new Map<RuntimeScope,Pool>();let closed=false;
 const close=async()=>{if(closed)return;closed=true;const results=await Promise.allSettled([...pools.values()].map(p=>p.end()));if(results.some(r=>r.status==='rejected'))throw Error('Scoped pool closure incomplete');};
 const get=(s:RuntimeScope)=>{const pool=pools.get(s);if(!pool||closed)throw Error('Scoped pool unavailable');return pool;};
 try{
  for(const scope of runtimeScopes){
   const options=plan.poolOptions(scope);
   if(options.user!==productionRoleName(scope)||options.database!==productionNeonTarget.database||options.host!==productionNeonTarget.host||options.max!==(scope==='reader'?2:1)||options.ssl.rejectUnauthorized!==true||options.ssl.servername!==options.host)throw Error('Unsafe binding plan');
   const p=makePool(scope,options);if([...pools.values()].includes(p))throw Error('Shared runtime pool prohibited');pools.set(scope,p);
  }
  const records=(scope:RecordScope)=>{
   if(!runtimeScopes.includes(scope)||scope==='directory' as RuntimeScope||scope==='login' as RuntimeScope||scope==='session' as RuntimeScope||scope==='enrollment' as RuntimeScope)throw Error('Record scope required');
   return createPostgresRecordStore(get(scope),productionRoleName(scope),productionNeonTarget.database,scope==='reader',scope==='registrar',scope==='reader'||scope==='registrar'?false:writerMode[scope]);
  };
  const query=(scope:keyof typeof permitted)=>async(sql:string,params:string[])=>{
   if(!permitted[scope].has(sql))throw Error('Unapproved identity function');
   const c=await get(scope).connect();let healthy=false;
   try{
    await c.query('BEGIN');
    await c.query("SET LOCAL statement_timeout='10s'");
    await c.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
    const state=await c.query("SELECT current_user AS role,current_database() AS db,NOT(r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication) AND r.rolcanlogin AND r.rolinherit AS restricted, (SELECT count(*)=1 FROM pg_auth_members WHERE member=r.oid) AND EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid AND roleid=g.oid AND inherit_option AND NOT admin_option) AND NOT(g.rolcanlogin OR g.rolsuper OR g.rolbypassrls OR g.rolcreaterole OR g.rolcreatedb OR g.rolreplication) AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=g.oid) AS grant_safe, NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='nexustalent_identity' OR (n.nspname='nexustalent' AND c.relname='records')) AND c.relkind IN ('r','p','v','m','f') AND (pg_has_role(r.oid,c.relowner,'MEMBER') OR has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) AS function_only FROM pg_roles r CROSS JOIN pg_roles g WHERE r.rolname=current_user AND g.rolname=$1",[identityGrants[scope]]);
    const r=state.rows[0];if(state.rows.length!==1||r?.role!==productionRoleName(scope)||r?.db!==productionNeonTarget.database||r?.restricted!==true||r?.grant_safe!==true||r?.function_only!==true)throw Error('Unsafe identity binding');
    const result=await c.query(sql,params);await c.query('COMMIT');healthy=true;return result;
   }catch{try{await c.query('ROLLBACK');}catch{}throw Error('Scoped identity operation unavailable');}
   finally{c.release(!healthy);}
  };
  return Object.freeze({records,directory:createPostgresDirectory(get('directory'),productionRoleName('directory'),productionNeonTarget.database),credentials:createCredentialService(query('login')),verify:createPostgresSessionVerifier(query('session')),enroll:createEnrollmentService(query('enrollment')),close});
 }catch{await close();throw Error('Scoped binding rehearsal failed');}
}

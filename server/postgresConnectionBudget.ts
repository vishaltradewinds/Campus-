// Explicit connection ceilings for disposable acceptance. No live provider
// configuration is read, and no production mode can be activated here.
export const runtimeScopes=['reader','registrar','demand','institution','consent','assessment','offer','joining','verification','academic','evidence','disclosure','profile','directory','login','session','enrollment'] as const;
export type RuntimeScope=typeof runtimeScopes[number];
export function connectionBudget(env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV!=='test'||env.NEXUSTALENT_DATASTORE!=='postgres'||env.NEXUSTALENT_PG_INTEGRATION!=='1')throw Error('Database connection profile is test-only');
 const mode=env.NEXUSTALENT_PG_POOL_PROFILE??'ci-concurrency';
 if(mode!=='ci-concurrency'&&mode!=='bounded-browser')throw Error('Unknown connection profile');
 const pools=Object.fromEntries(runtimeScopes.map(scope=>[scope,['directory','login','session','enrollment'].includes(scope)?1:mode==='ci-concurrency'?3:scope==='reader'?2:1])) as Record<RuntimeScope,number>;
 return {mode,pools,maximumConnections:Object.values(pools).reduce((sum,n)=>sum+n,0),idleTimeoutMillis:1000,connectionTimeoutMillis:5000};
}

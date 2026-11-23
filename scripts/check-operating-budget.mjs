import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
// Planning guard, not a billing API or approval. Use fresh provider evidence before deployment.
// Neon API 0 means the Free-plan default (5-minute idle scale-to-zero); -1 disables it.
// Caller evidence still requires independent verification; booleans are not provider attestations.
const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function checkOperatingBudget(x){
 const blockers=[];
 const n=x?.neon,h=x?.hosting,f=x?.forecast;
 if(n?.plan!=='free'||n?.projectId!=='rough-butterfly-67822299'||n?.branchId!=='br-rapid-brook-b3bqvuxx'||n?.databaseName!=='nexustalent'||n?.pgVersion!==16||n?.branchCount!==1||n?.endpointCount!==1||n?.databaseCount!==1||n?.minCu!==0.25||n?.maxCu!==0.25||n?.suspendTimeoutSeconds!==0||n?.scaleToZeroVerified!==true)blockers.push('NEON_CONFIGURATION_UNVERIFIED');
 if(h?.provider!=='render'||h?.plan!=='free'||h?.serviceCount!==1||h?.autoDeployDisabled!==true||h?.workspaceVerified!==true)blockers.push('SINGLE_FREE_HOST_UNVERIFIED');
 if(x?.billingUpgradeAllowed!==false||x?.externalPaidApisEnabled!==false||x?.keepAliveEnabled!==false||x?.paymentActivationEnabled!==false)blockers.push('UNAPPROVED_COST_PATH');
 // 20% reserve of the currently published Neon Free allowances; conservative
 // decimal GB to avoid assuming more space than the documented quota.
 const forecastCuHours=num(f?.activeHoursPerMonth)?f.activeHoursPerMonth*0.25:null;
 const storageBytes=num(f?.existingStorageBytes)&&num(f?.additionalStorageBytes)?f.existingStorageBytes+f.additionalStorageBytes:null;
 if(forecastCuHours===null||forecastCuHours>80)blockers.push('COMPUTE_FORECAST_EXCEEDS_BUDGET');
 if(storageBytes===null||storageBytes>800000000)blockers.push('STORAGE_FORECAST_EXCEEDS_BUDGET');
 if(!num(f?.verifiedMonthlyCuHours)||f.verifiedMonthlyCuHours>=80||!num(f?.verifiedAccountStorageBytes)||f.verifiedAccountStorageBytes>16000000000||x?.currentProviderQuotasVerified!==true||x?.monthlyUsageVerified!==true)blockers.push('CURRENT_QUOTA_HEADROOM_UNVERIFIED');
 if(x?.stopOnQuotaExhaustionVerified!==true||x?.coldStartAcceptanceVerified!==true)blockers.push('DEGRADED_OPERATION_UNVERIFIED');
 return {decision:blockers.length?'OPERATING_BUDGET_HOLD':'FORECAST_WITHIN_BUDGET_REQUIRES_RELEASE_APPROVAL',blockers,forecastCuHours,storageBytes,computeBudgetCuHours:80,storageBudgetBytes:800000000,automaticUpgrade:false,writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)throw Error();const r=checkOperatingBudget(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(r,null,2));if(r.blockers.length)process.exitCode=2;}
 catch{console.error('Invalid or unavailable operating-budget evidence');process.exitCode=1;}
}

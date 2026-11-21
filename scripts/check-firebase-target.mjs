import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function checkFirebaseTarget(config, env) {
  const issues=[];
  const project=env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT;
  const database=env.FIREBASE_DATABASE_ID || '(default)';
  const key=env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY;
  if (!project || project!==config.projectId) issues.push('Backend project does not match browser Firebase project');
  if (database!==(config.firestoreDatabaseId || '(default)')) issues.push('Backend database does not match browser Firestore database');
  if (!key || key!==config.apiKey) issues.push('Backend authentication API key does not match browser configuration');
  if (env.NEXUSTALENT_EMULATOR_TEST==='1' || env.VITE_NEXUSTALENT_EMULATOR_TEST==='1' || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) issues.push('Emulator settings must not be present in the release environment');
  if (env.GOOGLE_OAUTH_ACCESS_TOKEN) issues.push('Static OAuth access token is not acceptable as durable production workload identity');
  return issues;
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const config=JSON.parse(readFileSync(new URL('../firebase-applet-config.json',import.meta.url),'utf8'));
  const issues=checkFirebaseTarget(config,process.env);
  if(issues.length){for(const issue of issues) console.error(issue);process.exitCode=1;}
  else console.log('Firebase target consistency passed. Workload IAM, key restrictions, live access and legal gates still require separate evidence.');
}

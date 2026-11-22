import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require=createRequire(import.meta.url);
const source=fileURLToPath(new URL('../server.ts',import.meta.url));

function rejectsUnsafeDatabase(args){
  const cwd=mkdtempSync(join(tmpdir(),'nexustalent-runtime-'));
  try {
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>! /^(FIREBASE_|VITE_FIREBASE_|NEXUSTALENT_|GOOGLE_|GCLOUD_|DOTENV_|NODE_ENV$|NODE_OPTIONS$|PORT$)/i.test(key)));
    writeFileSync(join(cwd,'.env'),[
      'NODE_ENV=development','PORT=0','NEXUSTALENT_EMULATOR_TEST=1',
      'FIREBASE_PROJECT_ID=demo-nexustalent-acceptance','FIREBASE_DATABASE_ID=unsafe-database',
      'FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099','FIRESTORE_EMULATOR_HOST=127.0.0.1:8080',
    ].join('\n'));
    const result=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',timeout:15000});
    assert.ifError(result.error);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Unsafe Firestore emulator configuration/);
  } finally { rmSync(cwd,{recursive:true,force:true}); }
}
test('dotenv loads before source datastore initialization',()=>rejectsUnsafeDatabase(['--import',pathToFileURL(require.resolve('tsx')).href,source]));
if(process.env.NEXUSTALENT_TEST_BUILT_RUNTIME==='1') test('dotenv loads before bundled datastore initialization',()=>rejectsUnsafeDatabase([fileURLToPath(new URL('../dist/server.mjs',import.meta.url))]));

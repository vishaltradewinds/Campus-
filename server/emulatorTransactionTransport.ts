// Loaded only after trustedBackend has enforced the demo project and loopback gate.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
let client: any;
let metadata: any;
const database = 'projects/demo-nexustalent-acceptance/databases/(default)';
function initialize() {
  if (process.env.NODE_ENV === 'production' || process.env.NEXUSTALENT_EMULATOR_TEST !== '1' ||
      process.env.FIREBASE_PROJECT_ID !== 'demo-nexustalent-acceptance' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error('Unsafe emulator gRPC configuration');
  }
  if (client) return;
  const grpc = require('@grpc/grpc-js');
  const loader = require('@grpc/proto-loader');
  const definition = loader.loadSync(path.resolve('tests/fixtures/firestore-transaction.proto'), {
    keepCase: false, longs: String, enums: String, defaults: false, oneofs: false,
  });
  const service = grpc.loadPackageDefinition(definition).google.firestore.v1.Firestore;
  client = new service('127.0.0.1:8080', grpc.credentials.createInsecure());
  metadata = new grpc.Metadata();
  metadata.set('authorization', 'Bearer owner');
}
export async function emulatorTransactionRequest<T>(url:string, init:RequestInit):Promise<T> {
  initialize();
  const op = url.slice(url.lastIndexOf(':')+1);
  const body = JSON.parse(String(init.body || '{}'));
  const args = { ...body, database, ...(body.transaction ? { transaction: Buffer.from(body.transaction, 'base64') } : {}) };
  const opts = { deadline: new Date(Date.now()+10000) };
  if (op === 'batchGet') {
    return await new Promise<T>((resolve,reject)=>{
      const rows:any[]=[];
      const stream=client.batchGetDocuments(args,metadata,opts);
      stream.on('data',(row:any)=>{ if(row.found || row.missing) rows.push(row); });
      stream.on('error',reject);
      stream.on('end',()=>resolve(rows as T));
    });
  }
  const method:Record<string,string>={beginTransaction:'beginTransaction',commit:'commit',rollback:'rollback'};
  if (!method[op]) throw new Error('Unsupported emulator transaction operation');
  return await new Promise<T>((resolve,reject)=>{
    client[method[op]](args,metadata,opts,(error:any,response:any)=>{
      if(error) return reject(error);
      if(op==='beginTransaction') response.transaction=Buffer.from(response.transaction).toString('base64');
      resolve(response as T);
    });
  });
}

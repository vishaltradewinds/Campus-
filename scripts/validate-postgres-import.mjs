import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {preparePostgresSnapshot} from './reconcile-postgres.mjs';
import {validateRelationships} from './validate-import-relationships.mjs';

// Offline validation only; never emit payloads or connect to a database.
export function validateImport(source){
 const {snapshot,unsupported,unknownCollections}=preparePostgresSnapshot(source);
 let identityMismatch=0,oversize=0,empanelledInstitutions=0,invalidDirectoryRecords=0;
 for(const {document_path,payload} of snapshot.records){
  const [collection,id]=document_path.split('/');
  if(collection==='users'&&(payload.uid!==id||!['student','institution','employer','super_admin','simulation'].includes(payload.role)))identityMismatch++;
  if(['students','institutions','employers'].includes(collection)&&payload.id!==id)identityMismatch++;
  // The restricted registration directory fails closed on malformed approved
  // institutions. A large directory requires independently verified pagination.
  if(collection==='institutions'&&payload.empanelmentStatus==='empanelled'){
   empanelledInstitutions++;
   if(payload.id!==id||typeof payload.name!=='string'||!payload.name.trim()||typeof payload.code!=='string'||!payload.code.trim())invalidDirectoryRecords++;
  }
  // Conservative rehearsal limit, not an assertion of PostgreSQL capacity.
  if(Buffer.byteLength(JSON.stringify(payload),'utf8')>1024*1024)oversize++;
 }
 const relationships=validateRelationships(snapshot.records);
 const directoryCapacityExceeded=empanelledInstitutions>100;
 const blockers=unsupported+unknownCollections+identityMismatch+oversize+relationships.blocking+invalidDirectoryRecords;
 return {sourceRecords:source.documents.length,convertibleRecords:snapshot.records.length,unsupported,unknownCollections,identityMismatch,oversize,registrationDirectory:{empanelledInstitutions,invalidDirectoryRecords,requiresMultiPageAcceptance:directoryCapacityExceeded,pageSize:100},relationships,blockers,decision:blockers?'IMPORT_HOLD':'OFFLINE_VALIDATION_PASSED',complete:false,automaticImport:false,writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)throw Error();const r=validateImport(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(r,null,2));if(r.blockers)process.exitCode=2;}
 catch{console.error('Invalid or unavailable authorized offline snapshot');process.exitCode=1;}
}

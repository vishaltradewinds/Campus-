import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
// Independent build target. It does not replace the current production entry.
export default defineConfig({
 plugins:[react(),tailwindcss(),{
  name:'reject-legacy-firebase-in-standalone',
  generateBundle(_options,bundle){
   for(const output of Object.values(bundle)){
    if(output.type!=='chunk')continue;
    for(const id of Object.keys(output.modules)){
     const normalized=id.replace(/\\/g,'/');
     if(/node_modules\/(?:@firebase\/|firebase\/)|src\/lib\/firebase\.ts$|src\/context\/LegacyAuthProvider\.tsx$/.test(normalized))this.error('Legacy identity dependency in independent browser build');
    }
   }
  }
 }],
 publicDir:false,
 build:{outDir:'dist-standalone',manifest:true,rollupOptions:{input:path.resolve(process.cwd(),'standalone.html')}}
});

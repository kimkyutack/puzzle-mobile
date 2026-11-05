import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('output/garden-world-preview');
await build({configFile:false,root:resolve('apps/client'),publicDir:false,base:'./',plugins:[react()],build:{outDir:out,emptyOutDir:true,rollupOptions:{input:resolve('apps/client/garden-world.html')}}});
await mkdir(resolve(out,'fonts'),{recursive:true});
for(const file of ['jua-OFL.txt','lilitaone-OFL.txt'])await copyFile(resolve('apps/client/public/fonts',file),resolve(out,'fonts',file));
console.log('Independent garden preview built at '+out+'; main/native dist unchanged.');

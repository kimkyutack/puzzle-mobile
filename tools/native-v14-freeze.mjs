import {spawnSync} from 'node:child_process';
import {cp,readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const result=spawnSync('npm',['run','native:local'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const source='apps/client/dist',destination='output/verification/visual-v14/frozen-dist';
try{await stat(destination);throw new Error('Frozen snapshot already exists; refuse overwrite');}catch(error){if(error.code!=='ENOENT')throw error;}
await cp(source,destination,{recursive:true,errorOnExist:true,force:false});
async function hashes(root,dir=''){const out={};for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){const rel=path.posix.join(dir,e.name);if(e.isDirectory())Object.assign(out,await hashes(root,rel));else if(e.isFile())out[rel]=createHash('sha256').update(await readFile(path.join(root,rel))).digest('hex');}return out;}
const frozen=await hashes(destination),current=await hashes(source);
if(JSON.stringify(Object.entries(frozen).sort())!==JSON.stringify(Object.entries(current).sort()))throw new Error('Dist changed during snapshot; hold native builds');
const metadata=JSON.parse(await readFile(path.join(destination,'native-build.json'),'utf8'));
for(const root of ['android/app/src/main/assets/public','ios/App/App/public']){const native=await hashes(root);for(const [name,sha]of Object.entries(frozen))if(native[name]!==sha)throw new Error('Synced native differs from snapshot: '+root+'/'+name);}
await writeFile('output/verification/visual-v14/frozen-dist-sha256.json',JSON.stringify({capturedAt:new Date().toISOString(),source,destination,metadata,fileCount:Object.keys(frozen).length,allThreeCopiesMatch:true,files:frozen},null,2)+'\n');
console.log(JSON.stringify({snapshot:destination,fileCount:Object.keys(frozen).length,metadata}));

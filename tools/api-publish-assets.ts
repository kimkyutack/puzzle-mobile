import { readFile,readdir,stat,mkdir,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root='apps/client/public/assets';const manifest=JSON.parse(await readFile(join(root,'asset-manifest.json'),'utf8')) as {version:string;missing:string[];assets:Array<{runtimePath:string}>};
if(manifest.missing.length)throw new Error('Asset gate failed: '+manifest.missing.join(','));
if(!/^garden-[a-zA-Z0-9_.-]+$/.test(manifest.version))throw new Error('Invalid immutable version');
const bucket=process.env.GARDEN_R2_BUCKET??'cloud-garden-assets';if(!/^[a-z0-9-]+$/.test(bucket))throw new Error('Invalid bucket name');
const files=(await readdir(root)).filter(f=>/\.(png|json)$/.test(f)).map(name=>({path:join(root,name),key:`assets/${name}`}));
for(const name of await readdir('apps/client/public/audio'))if(/\.(mp3|wav|ogg)$/.test(name))files.push({path:join('apps/client/public/audio',name),key:`audio/${name}`});
// Ship approved definitions only. Solver logs, source art and credentials are never public pack inputs.
files.push({path:'packages/content/src/approved.json',key:'content/approved.json'});
await mkdir('output/publish',{recursive:true});
const inventory=await Promise.all(files.map(async file=>({path:file.key,bytes:(await stat(file.path)).size,sha256:createHash('sha256').update(await readFile(file.path)).digest('hex')})));
const packPath=`output/publish/${manifest.version}.json`;
await writeFile(packPath,JSON.stringify({version:manifest.version,files:inventory},null,2));
files.push({path:packPath,key:'pack-manifest.json'});
const remote=process.argv.includes('--remote');let bytes=0;
for(const file of files){bytes+=(await stat(file.path)).size;if(remote){const result=spawnSync('node_modules/.bin/wrangler',['r2','object','put',`${bucket}/${manifest.version}/${file.key}`,'--file',file.path,'--remote','--content-type',file.key.endsWith('.json')?'application/json':file.key.endsWith('.png')?'image/png':file.key.endsWith('.wav')?'audio/wav':'audio/mpeg','--cache-control','public, max-age=31536000, immutable'],{stdio:'inherit'});if(result.status!==0)throw new Error('Upload failed: '+file.key);}}
console.log(JSON.stringify({mode:remote?'uploaded':'dry-run',bucket,version:manifest.version,files:files.length,bytes,sourceArtIncluded:false}));

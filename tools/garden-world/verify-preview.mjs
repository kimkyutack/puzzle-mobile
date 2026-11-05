import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('output/garden-world-preview'),origin='http://127.0.0.1:5192';
async function files(dir){const items=await readdir(dir,{withFileTypes:true});return (await Promise.all(items.map(item=>item.isDirectory()?files(join(dir,item.name)):[join(dir,item.name)]))).flat();}
const inventory=[];
for(const file of await files(root)){
 const path=relative(root,file).split('/').map(encodeURIComponent).join('/'),source=await readFile(file),response=await fetch(origin+'/'+path);
 assert.equal(response.status,200,path);const served=Buffer.from(await response.arrayBuffer());assert.deepEqual(served,source,path);
 inventory.push({path,bytes:served.length,sha256:createHash('sha256').update(served).digest('hex')});
}
assert.equal((await fetch(origin+'/')).status,200);
assert.equal((await fetch(origin+'/api/me')).status,404);
assert.equal((await fetch(origin+'/api/me',{method:'POST'})).status,405);
await mkdir('output/verification/garden-world',{recursive:true});
const report={scope:'Independent sample-only static build; exact HTTP bytes and no API handler. This is not browser rendering or touch validation.',origin,files:inventory,passed:true};
await writeFile('output/verification/garden-world/http-build.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({origin,files:inventory.length,bytes:inventory.reduce((sum,file)=>sum+file.bytes,0),passed:true}));

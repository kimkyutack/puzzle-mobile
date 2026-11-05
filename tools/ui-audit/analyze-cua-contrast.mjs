import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {analyzeContrast} from './cua-contrast.mjs';
const root=process.argv[2]||'output/verification/visual-v9/final-pixels';const results=[];
for(const f of await readdir(root)){if(!f.endsWith('.json')||f==='report.json')continue;const name=f.slice(0,-5);const ink=JSON.parse(await readFile(path.join(root,f),'utf8'));if(!Array.isArray(ink)||!ink.length||!ink[0].rect||!ink[0].color)continue;const result=await analyzeContrast(ink,await readFile(path.join(root,name+'.png')),await readFile(path.join(root,name+'-background.png')));results.push({name,...result});}
await writeFile(path.join(root,'report.json'),JSON.stringify({method:'Official CUA CDP PNG pairs, DOM text temporarily transparent and immediately restored; same offline real-raster-glyph sampler as prior audit.',screens:results},null,2));console.log(JSON.stringify(results.map(r=>({name:r.name,texts:r.results.length,failures:r.failures.map(f=>({text:f.text,owner:f.owner,min:f.minimum,p05:f.p05,outline:f.outlineMinimum,pixels:f.pixels,threshold:f.threshold}))})),null,2));

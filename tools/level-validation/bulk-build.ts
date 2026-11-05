import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {createGame,findMatches,legalActions,replay,stateHash} from '@garden/core';
import {ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {BULK_CONTENT_VERSION,BULK_START,BULK_BATCH_SIZE,bulkProfile,levelFromBulkEntry,type BulkCatalogue,type BulkTemplate} from '../../packages/content/src/bulk';
import {MAX_CAMPAIGN_LEVEL,campaignMoveMargin} from '../../packages/content/src/campaign';
import type {Solution} from './validate';

const directory='packages/content/src/',checkpoint='output/verification/bulk-v22-checkpoint.json';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
type Proofs={version:string;templates:Solution[];stages:Array<[string,number]>};
type Built={key:string;template?:BulkTemplate;proof?:Solution;error?:string};
async function pool<T extends {key:string},R extends {key:string;error?:string}>(jobs:T[],data:unknown,done:(result:R)=>Promise<void>|void){
 let cursor=0,completed=0;const failures:string[]=[];
 await Promise.all(Array.from({length:Math.min(3,jobs.length)},()=>new Promise<void>((resolve,reject)=>{
  const worker=new Worker(new URL('./bulk-worker.mjs',import.meta.url),{workerData:data,execArgv:[]});
  const next=()=>{const job=jobs[cursor++];if(job)worker.postMessage(job);else void worker.terminate().then(()=>resolve());};
  worker.on('error',reject);worker.on('message',async(result:R)=>{
   try{if(result.error)failures.push(`${result.key}: ${result.error}`);else await done(result);completed++;if(completed%20===0||completed===jobs.length)console.log(`Checked ${completed}/${jobs.length} ${jobs[0]?.key?.startsWith('replay')?'replay batches':'parameter variants'}`);next();}catch(e){void worker.terminate();reject(e);}
  });next();
 })));
 if(failures.length)throw new Error(`BULK_UNCERTIFIED (${failures.length}): ${failures.slice(0,12).join('; ')}`);
}
export async function buildBulk(){
 const started=Date.now(),verify=process.argv.includes('--verify'),toArg=process.argv.find(a=>a.startsWith('--to='));
 const catalogue=await read(directory+'bulk-catalogue.json') as BulkCatalogue,proofs=await read(directory+'bulk-proofs.json') as Proofs;
 const end=toArg?Number(toArg.split('=')[1]):verify?catalogue.published:BULK_BATCH_SIZE;
 if(!Number.isInteger(end)||end%BULK_BATCH_SIZE||end<BULK_BATCH_SIZE||end>MAX_CAMPAIGN_LEVEL)throw new Error('EXPECTED_10000_LEVEL_BATCH: --to=10000, 20000 or 30000');
 if(verify&&end>catalogue.published)throw new Error('UNPUBLISHED_BATCH');
 if(!verify&&end<catalogue.published)throw new Error('CANNOT_SHRINK_PUBLISHED_CAMPAIGN');
 const levels=await read(directory+'campaign-approved.json') as LevelDefinition[],originalProofs=await read(directory+'campaign-solutions.json') as Record<string,Solution>;
 const originalHashes={definitions:hash(levels),proofs:hash(originalProofs),recipes:hash(await read(directory+'campaign-recipes.json')),runtime:hash(levels.map(l=>getLevel(l.id)))};
 const baselinePath='tests/fixtures/campaign-first300-hashes.json';
 const baseline=await read(baselinePath).catch(e=>{if(e.code==='ENOENT')return undefined;throw e;});
 if(baseline&&hash(baseline)!==hash(originalHashes))throw new Error('FIRST_300_CHANGED');
 await mkdir('output/verification',{recursive:true});
 const engineSourceHash=createHash('sha256').update(await readFile('packages/game-core/src/index.ts')).digest('hex');
 const buildHash=hash([engineSourceHash,await readFile('tools/level-validation/bulk-variants.ts','utf8'),originalHashes]);
 const staged=new Map<string,{template:BulkTemplate;proof:Solution}>();
 catalogue.templates.forEach((template,i)=>staged.set(template.key,{template,proof:proofs.templates[i]!}));
 if(!verify){
  const saved=await read(checkpoint).catch(e=>{if(e.code==='ENOENT')return undefined;throw e;});
  if(saved?.buildHash===buildHash)for(const item of saved.built)if(!staged.has(item.template.key))staged.set(item.template.key,item);
  const required=new Map(Array.from({length:end-BULK_START+1},(_,i)=>bulkProfile(i+BULK_START)).map(p=>[p.key,p]));
  const missing=[...required.values()].filter(p=>!staged.has(p.key));
  console.log(`Batch 1–${end}: ${required.size} parameter variants, ${missing.length} to certify; preserving first ${levels.length} authored levels.`);
  let sinceSave=0,saves=Promise.resolve();const save=()=>{const text=JSON.stringify({buildHash,built:[...staged.values()]});return saves=saves.then(()=>writeFile(checkpoint,text));};
  await pool<(typeof missing)[number],Built>(missing,{levels,proofs:originalProofs},async result=>{
   staged.set(result.key,{template:result.template!,proof:result.proof!});if(++sinceSave%10===0)await save();
  }).finally(save);
  for(const p of required.values())if(!catalogue.templates.some(t=>t.key===p.key)){const item=staged.get(p.key)!;catalogue.templates.push(item.template);proofs.templates.push(item.proof);}
  const indices=new Map(catalogue.templates.map((t,i)=>[t.key,i]));
  for(let id=catalogue.published+1;id<=end;id++){
   const profile=bulkProfile(id),index=indices.get(profile.key)!,template=catalogue.templates[index]!;
   const variation=(Math.floor(id/10)+id)%3;
   const moves=Math.max(12,template.steps+campaignMoveMargin(profile.beat)+variation);
   catalogue.entries.push([index,moves]);
  }
 }
 const bankChecks=[];
 for(const [index,template]of catalogue.templates.entries()){
  const proof=proofs.templates[index],state=createGame(template.level);
  if(!proof||proof.actions.length!==template.steps||findMatches(state).length||legalActions(state).length<3)throw new Error(`INVALID_TEMPLATE:${template.key}`);
  const result=replay(template.level,proof.actions);
  if(!result.accepted||result.state.status!=='won'||stateHash(result.state)!==proof.hash)throw new Error(`INVALID_TEMPLATE_PROOF:${template.key}`);
  bankChecks.push({key:template.key,source:template.source,steps:template.steps,moves:template.level.moves,goals:template.level.goals,obstacles:template.level.obstacles.map(o=>({kind:o.kind,hp:o.hp}))});
 }
 // Replay every published stage: changing the ID and move budget must also be certified.
 const jobs=Array.from({length:Math.ceil((end-BULK_START+1)/250)},(_,i)=>({key:`replay-${i}`,mode:'verify',start:BULK_START+i*250,end:Math.min(end,BULK_START+(i+1)*250-1)}));
 const checks:Array<[string,number]>=[];
 await pool<(typeof jobs)[number],{key:string;start:number;checks:Array<[string,number]>}>(jobs,{catalogue,bulkProofs:proofs.templates},result=>{
  for(const [i,check]of result.checks.entries()){const at=result.start-BULK_START+i;if(verify&&JSON.stringify(proofs.stages[at])!==JSON.stringify(check))throw new Error(`SAVED_PROOF_CHANGED:${at+BULK_START}`);checks[at]=check;}
 });
 for(const level of levels){const result=replay(getLevel(level.id),originalProofs[level.id]!.actions);if(!result.accepted||result.state.status!=='won'||stateHash(result.state)!==originalProofs[level.id]!.hash)throw new Error(`ORIGINAL_REPLAY_CHANGED:${level.id}`);}
 if(hash(levels.map(l=>getLevel(l.id)))!==originalHashes.runtime)throw new Error('ORIGINAL_RUNTIME_CHANGED');
 if(createHash('sha256').update(await readFile('packages/game-core/src/index.ts')).digest('hex')!==engineSourceHash)throw new Error('ENGINE_CHANGED_DURING_BUILD');
 const beats:Record<string,number>={};for(let id=BULK_START;id<=end;id++){const beat=bulkProfile(id).beat;beats[beat]=(beats[beat]??0)+1;}
 const report={version:BULK_CONTENT_VERSION,engineVersion:ENGINE_VERSION,engineSourceHash,published:end,authored:levels.length,bulkStages:checks.length,certifiedVariants:catalogue.templates.length,uniqueLayouts:new Set(catalogue.templates.map(t=>hash([t.level.shape,t.level.obstacles.map(o=>[o.kind,o.anchor,o.footprint,o.path])]))).size,tiers:[...new Set(catalogue.templates.map(t=>t.tier))],beats,first300Unchanged:true,winningReplays:levels.length+checks.length,bankChecks,humanPlaytest:false,seconds:Math.round((Date.now()-started)/1000),interpretation:'Reused, parameterized board families. Exact no-purchase winning replays establish solvability, not human win rates. Easy and celebration stages recur throughout.'};
 if(!verify){
  catalogue.published=end;proofs.stages=checks;
  if(!baseline)await writeFile(baselinePath,JSON.stringify(originalHashes,null,2)+'\n');
  await writeFile(directory+'bulk-proofs.json.tmp',JSON.stringify(proofs));await rename(directory+'bulk-proofs.json.tmp',directory+'bulk-proofs.json');
  await writeFile(directory+'bulk-catalogue.json.tmp',JSON.stringify(catalogue));await rename(directory+'bulk-catalogue.json.tmp',directory+'bulk-catalogue.json');
 }
 await writeFile('output/verification/bulk-v22.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,bankChecks:bankChecks.length,catalogueBytes:Buffer.byteLength(JSON.stringify(catalogue))}));
}
if(process.argv[1]?.endsWith('/bulk-build.ts'))await buildBulk();

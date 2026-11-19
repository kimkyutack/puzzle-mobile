import {readFileSync,writeFileSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import {fileURLToPath} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {CAMPAIGN_DEVICE_ENGINE_VERSION,GLIDER_SWARM_ENGINE_VERSION} from '@garden/contracts';
import {replay,validateLevel} from '@garden/core';
import {randomAttemptLevel} from '../../apps/api/src/run-initial';
import {BREAKABLE_MAGNET_VERSION,breakableCandidate} from '../../packages/content/src/breakable-campaign-boards';
import {BREAKABLE_CAMPAIGN_VERSION,breakableSlot} from '../../packages/content/src/breakable-campaign-plan';
import {OBSTACLE_GARDEN_CONTENT_VERSION,obstacleGardenCandidate,obstacleGardenSlot} from '../../packages/content/src/obstacle-garden';
import {solve} from './validate';

type Recipe=[seed:number,moves:number];
const magnets=isMainThread?process.argv.includes('--rails'):workerData.magnets as boolean;
const obstacleGarden=isMainThread?process.argv.includes('--obstacle-garden'):workerData.obstacleGarden as boolean;
const version=obstacleGarden?OBSTACLE_GARDEN_CONTENT_VERSION:magnets?BREAKABLE_MAGNET_VERSION:BREAKABLE_CAMPAIGN_VERSION;
const keys=[...new Set(Array.from({length:20000},(_,i)=>(obstacleGarden?obstacleGardenSlot(i+1):breakableSlot(i+1))?.key).filter((key):key is string=>!!key&&(!magnets||key.startsWith('magnet-yard/'))))].sort();
const output=obstacleGarden?'packages/content/src/obstacle-garden-recipes.json':magnets?'packages/content/src/breakable-magnet-recipes.json':'packages/content/src/breakable-recipes.json';
const verify=process.argv.includes('--verify');

function certify(key:string,index:number,expected?:Recipe):Recipe{
 for(let i=0;i<(expected?1:40);i++){
  const seed=expected?.[0]??(267119+index*7591+i*104729);
  const level=obstacleGarden?obstacleGardenCandidate(key,seed):breakableCandidate(key,seed,magnets?GLIDER_SWARM_ENGINE_VERSION:CAMPAIGN_DEVICE_ENGINE_VERSION);
  const errors=validateLevel(level);
  if(errors.length)throw new Error(key+' '+errors.join(','));
  const boards=[level,...[17347,89381].map(attempt=>randomAttemptLevel(level,attempt))];
  const limits=[];
  for(const board of boards){
   const proof=solve(board,'special');
   if(proof.status!=='won'||proof.shuffles!==0||proof.initialChoices<3)break;
   if(replay({...board,moves:proof.actions.length},proof.actions).state.status!=='won')throw new Error(key+' replay');
   limits.push(proof.actions.length);
  }
  if(limits.length===boards.length){
   const moves=Math.max(...limits);
   if(expected&&expected[1]!==moves)throw new Error(key+' proof changed');
   return [seed,moves];
  }
 }
 throw new Error(key+' has no winning traces');
}

if(!isMainThread){
 for(const [key,index,expected] of workerData.tasks as [string,number,Recipe?][]){
  parentPort!.postMessage([key,certify(key,index,expected)]);
 }
}else{
 const baseline=verify?JSON.parse(readFileSync(output,'utf8')) as {version:string;recipes:Record<string,Recipe>}:undefined;
 if(baseline&&(baseline.version!==version||keys.length!==Object.keys(baseline.recipes).length||keys.some(key=>!baseline.recipes[key])))throw new Error('Catalogue mismatch');
 const tasks=keys.map((key,index)=>[key,index,baseline?.recipes[key]] as const);
 const entry=fileURLToPath(import.meta.url),concurrency=Math.min(tasks.length,6,availableParallelism());
 const recipes:Record<string,Recipe>={};
 await Promise.all(Array.from({length:concurrency},(_,i)=>new Promise<void>((resolve,reject)=>{
  const worker=new Worker(`import('tsx/esm/api').then(({tsImport})=>tsImport(${JSON.stringify(entry)},${JSON.stringify(import.meta.url)})).catch(e=>{console.error(e);process.exitCode=1;})`,
   {eval:true,workerData:{magnets,obstacleGarden,tasks:tasks.filter((_,index)=>index%concurrency===i)}});
  worker.on('message',([key,recipe]:[string,Recipe])=>{recipes[key]=recipe;if(!verify)console.log(key,...recipe);});
  worker.on('error',reject);
  worker.on('exit',code=>code===0?resolve():reject(new Error('Proof worker '+code)));
 })));
 if(keys.length!==Object.keys(recipes).length)throw new Error('Incomplete proofs');
 if(!verify)writeFileSync(output,JSON.stringify({version,recipes:Object.fromEntries(keys.map(key=>[key,recipes[key]]))})+'\n');
 console.log('Verified '+keys.length+' obstacle layouts');
}

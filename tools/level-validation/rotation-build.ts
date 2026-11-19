import {readFileSync,writeFileSync} from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_DEVICE_ENGINE_VERSION,GLIDER_SWARM_ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
import {createGame,findMatches,legalActions,replay,validateLevel} from '@garden/core';
import {campaignRotation,rotationCandidate,rotationHasMagnets,ROTATION_MAGNET_VERSION,ROTATION_CONTENT_VERSION,ROTATION_FAMILIES,ROTATION_LAST_LEVEL,type RotationFamily,type RotationPressure} from '../../packages/content/src/campaign-rotation';
import {campaignPosition} from '../../packages/content/src/campaign';
import {randomAttemptLevel} from '../../apps/api/src/run-initial';
import {solve} from './validate';

type Recipe=readonly [layout:number,seed:number,proofMoves:number];
interface Profile {family:RotationFamily;pressure:RotationPressure;layout:number}
const magnets=isMainThread?process.argv.includes('--rails'):workerData.magnets as boolean;
const engine=magnets?GLIDER_SWARM_ENGINE_VERSION:CAMPAIGN_DEVICE_ENGINE_VERSION;
const version=magnets?ROTATION_MAGNET_VERSION:ROTATION_CONTENT_VERSION;
const output=magnets?'packages/content/src/rotation-magnet-recipes.json':'packages/content/src/campaign-rotation-recipes.json';
const profiles=new Map<string,Profile>();
for(let id=31;id<=ROTATION_LAST_LEVEL;id++){
 const slot=campaignRotation(id,campaignPosition(id).beat);
 if(!slot||magnets&&!rotationHasMagnets(slot.family))continue;
 const {family,pressure,layout}=slot;
 profiles.set(family+'/'+pressure+'/'+layout,{family,pressure,layout});
}
const minimum=[3,9,12];
const maxByPressure=[18,29,35];

function certify(profile:Profile):Recipe {
 const {family,pressure,layout}=profile;
 for(let attempt=0;attempt<34;attempt++){
  const seed=314159+ROTATION_FAMILIES.indexOf(family)*65537+pressure*7919+layout*31+attempt*104729;
  const level=rotationCandidate(family,pressure,layout,seed,engine);
  const errors=validateLevel(level);
  if(errors.length)throw Error(family+': '+errors.join(','));
  const results=[solve(level,'goal'),solve(level,'special')];
  const wins=results.filter(s=>s.status==='won'&&s.shuffles===0&&s.initialChoices>=3);
  const moves=Math.min(...wins.map(s=>s.actions.length));
  if(moves<minimum[pressure]!||moves>maxByPressure[pressure]!)continue;
  const proof=wins.find(s=>s.actions.length===moves)!;
  if(replay({...level,moves:moves+9},proof.actions).state.status!=='won')throw Error('Replay failed: '+family);
  // Check two different initial fills. The published floor includes headroom
  // for the worse winning trace, not just the deterministic authoring seed.
  const checks=checkRandomStarts(level);
  if(checks.some(n=>n>maxByPressure[pressure]!+10))continue;
  return [layout,seed,Math.max(moves,...checks)];
 }
 throw Error('Uncertified profile '+[family,pressure,layout].join('/'));
}

function checkRandomStarts(level:LevelDefinition){
 return [17347,89381].map(attemptSeed=>{
  try{
   const result=solve(randomAttemptLevel(level,attemptSeed),'special');
   return result.status==='won'&&result.shuffles===0?result.actions.length:Infinity;
  }catch(error){
   if(error instanceof Error&&['INITIAL_AUTO_MATCH','INITIAL_DEADLOCK'].includes(error.message))return Infinity;
   throw error;
  }
 });
}

if(!isMainThread){
 const input=workerData.tasks as Array<[string,Profile]>;
 for(const [key,profile] of input){
  try{parentPort!.postMessage([key,certify(profile)]);}
  catch(error){console.error(error instanceof Error?error.message:error);}
 }
}else if(process.argv.includes('--verify')){
 const data=JSON.parse(readFileSync(output,'utf8')) as {version:string;recipes:Record<string,Recipe>};
 if(data.version!==version)throw Error('Rotation catalogue version mismatch.');
 for(const [key,profile] of profiles){
  const recipe=data.recipes[key];
  if(!recipe||recipe[0]!==profile.layout)throw Error('Missing '+key);
  const level=rotationCandidate(profile.family,profile.pressure,recipe[0],recipe[1],engine);
  const state=createGame(level);
  if(validateLevel(level).length||findMatches(state).length||legalActions(state).length<3)throw Error('Invalid opening '+key);
  const goal=solve(level,'goal'),special=solve(level,'special');
  if(![goal,special].some(x=>x.status==='won'&&x.shuffles===0&&x.actions.length<=recipe[2]&&
   replay({...level,moves:recipe[2]},x.actions).state.status==='won'))throw Error('Replay failed: '+key);
  if(checkRandomStarts(level).some(moves=>moves>recipe[2]))throw Error('Randomized replay failed: '+key);
 }
 console.log('Verified '+profiles.size+' rotation profiles.');
}else{
 const data:Record<string,Recipe>={};
 const checkpoint=process.env.ROTATION_CHECKPOINT;
 if(checkpoint){
  for(const line of readFileSync(checkpoint,'utf8').split('\n')){
   const [key,layout,seed,moves]=line.split(' ');
   if(key&&profiles.has(key)&&[layout,seed,moves].every(value=>value&&/^\d+$/.test(value)))data[key]=[Number(layout),Number(seed),Number(moves)];
  }
 }
 const pending=[...profiles].filter(([key])=>!data[key]);
 const concurrency=Math.min(8,availableParallelism());
 const scripts=Array.from({length:concurrency},(_,i)=>pending.filter((_,j)=>j%concurrency===i));
 const entry=fileURLToPath(import.meta.url);
 await Promise.all(scripts.map(tasks=>new Promise<void>((resolve,reject)=>{
  const worker=new Worker(`import('tsx/esm/api').then(({tsImport})=>tsImport(${JSON.stringify(entry)},${JSON.stringify(import.meta.url)})).catch(e=>{console.error(e);process.exitCode=1;})`,{eval:true,workerData:{magnets,tasks}});
  worker.on('message',([key,recipe]:[string,Recipe])=>{data[key]=recipe;console.log(key,recipe.join(' '));});
  worker.on('error',reject);
  worker.on('exit',code=>code===0?resolve():reject(Error('Rotation authoring worker exited '+code)));
 })));
 if(Object.keys(data).length!==profiles.size)throw Error('Incomplete rotation data: '+[...profiles.keys()].filter(key=>!data[key]).join(', '));
 writeFileSync(output,JSON.stringify({version,recipes:Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b)))})+'\n');
 console.log('Certified '+profiles.size+' rotation profiles.');
}

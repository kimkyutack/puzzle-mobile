import {readFileSync,writeFileSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import type {Action,GameState,LevelDefinition} from '@garden/contracts';
import {applyAction,createGame,isSpecial,legalActions,replay,validateLevel} from '@garden/core';
import {randomAttemptLevel} from '../../apps/api/src/run-initial';
import {WORKSHOP_CONTENT_VERSION,WORKSHOP_PROFILES,workshopCandidate,workshopKey,type WorkshopSlot} from '../../packages/content/src/garden-workshop';

import {GREENHOUSE_CONTENT_VERSION,GREENHOUSE_PROFILES,greenhouseCandidate,greenhouseKey,type GreenhouseSlot} from '../../packages/content/src/garden-greenhouse';

const greenhouse=isMainThread?process.argv.includes('--greenhouse'):workerData.greenhouse as boolean;
const output=greenhouse?'packages/content/src/garden-greenhouse-recipes.json':'packages/content/src/garden-workshop-recipes.json';
const version=greenhouse?GREENHOUSE_CONTENT_VERSION:WORKSHOP_CONTENT_VERSION;
const profilesForPack=greenhouse?GREENHOUSE_PROFILES:WORKSHOP_PROFILES;
const sampleSeeds=[17347,89381];
type Recipe=[seed:number,moves:number];
type Task={slot:WorkshopSlot|GreenhouseSlot;index:number;expected?:Recipe};
const keyFor=(slot:Task['slot'])=>greenhouse?greenhouseKey(slot as GreenhouseSlot):workshopKey(slot as WorkshopSlot);
const candidateFor=(slot:Task['slot'],seed:number)=>greenhouse?greenhouseCandidate(slot as GreenhouseSlot,seed):workshopCandidate(slot as WorkshopSlot,seed);

function greenhouseScore(state:GameState){
 const device=state.devices!,step=device.steps[device.index],zone=step?.zones[0]??[],width=state.width;
 if(!step)return 0;
 const x=(i:number)=>i%width,y=(i:number)=>Math.floor(i/width);
 const powers=state.cells.flatMap(({tile},at)=>isSpecial(tile)?[{kind:tile.kind,at}]:[]);
 if(step.kind==='echo')return (device.echoAt!==undefined?95:0)+powers.filter(power=>zone.includes(power.at)).length*40;
 if(step.kind==='carrier'||step.kind==='reflector'){
  const distances=powers.flatMap(power=>zone.flatMap(at=>{
   if(step.kind==='carrier')return [Math.abs(x(power.at)-x(at))+Math.abs(y(power.at)-y(at))];
   if(power.kind==='wind-row')return [power.at===at?1:Math.abs(y(power.at)-y(at))];
   if(power.kind==='wind-column')return [power.at===at?1:Math.abs(x(power.at)-x(at))];
   return [];
  }));
  return distances.length?110-12*Math.min(...distances):0;
 }
 return 0;
}
const remaining=(state:GameState)=>state.goals.reduce((sum,goal)=>sum+goal.remaining,0);

function solve(level:LevelDefinition,preference:number){
 let state=createGame(level);
 if(legalActions(state).length<3)return;
 const actions:Action[]=[];
 for(let turn=0;turn<54&&state.status==='playing';turn++){
  let best:{action:Action;state:GameState;score:number}|undefined;
  for(const action of legalActions(state)){
   const result=applyAction(state,action),next=result.state;
   if(!result.accepted||next.status==='lost'||next.status==='error'||result.events.some(e=>e.type==='shuffle'))continue;
   const device=next.devices!;
   const score=(greenhouse?greenhouseScore(next):0)+(next.status==='won'?100_000:0)+device.index*1600+device.progress*80+
    (device.pans?.reduce((sum,n)=>sum+n,0)??0)*18+
    (remaining(state)-remaining(next))*(preference===0?36:65)+
    next.cells.filter(cell=>isSpecial(cell.tile)).length*(preference===0?19:8)+
    result.events.filter(e=>e.type==='hit').length*6+
    result.events.filter(e=>e.kind==='dye-stencil').length*12+
    (greenhouse?result.events.filter(e=>e.type==='remove').length*.05+(next.rng%997)*.00001:0);
   if(!best||score>best.score)best={action,state:next,score};
  }
  if(!best)return;
  actions.push(best.action);
  state=best.state;
 }
 return state.status==='won'?actions:undefined;
}

function certify({slot,index,expected}:Task):Recipe{
 for(let attempt=0;attempt<(expected?1:24);attempt++){
  const seed=expected?.[0]??174089+index*7919+attempt*104729;
  const level=candidateFor(slot,seed);
  const errors=validateLevel(level);
  if(errors.length)throw Error(errors.join(','));
  const boards=[level,...sampleSeeds.map(seed=>randomAttemptLevel(level,seed))];
  const winning=boards.map(board=>solve(board,0)??solve(board,1));
  if(winning.some(trace=>!trace||trace.length>42))continue;
  const moves=Math.max(...winning.map(trace=>trace!.length));
  for(const [i,board] of boards.entries()){
   if(replay({...board,moves},winning[i]!).state.status!=='won')throw Error('Replay did not win');
  }
  if(expected&&moves!==expected[1])throw Error('Verification move count changed');
  return [seed,moves];
 }
 throw Error('No solution for all three starts');
}

if(!isMainThread){
 for(const task of workerData.tasks as Task[]){
  const key=keyFor(task.slot);
  try{parentPort!.postMessage({key,recipe:certify(task)});}
  catch(error){parentPort!.postMessage({key,error:String(error)});}
 }
}else{
 const verify=process.argv.includes('--verify');
 const retained=verify?JSON.parse(readFileSync(output,'utf8')) as {version:string;recipes:Record<string,Recipe>}:undefined;
 if(retained&&retained.version!==version)throw Error('Unexpected catalogue version');
 const profiles=profilesForPack.map((slot,index)=>({slot,index,expected:retained?.recipes[keyFor(slot)]}));
 if(retained&&profiles.some(task=>!task.expected))throw Error('Missing workshop profile');
 const entry=fileURLToPath(import.meta.url),recipes:Record<string,Recipe>={},failures:string[]=[];
 const checkpoint=process.env.WORKSHOP_CHECKPOINT;
 if(checkpoint&&!verify){
  for(const line of readFileSync(checkpoint,'utf8').split('\n')){
   const [key,seed,moves]=line.split(' ');
   if(profiles.some(task=>keyFor(task.slot)===key)&&/^\d+$/.test(seed??'')&&/^\d+$/.test(moves??''))recipes[key!]=[Number(seed),Number(moves)];
  }
 }
 const tasks=profiles.filter(task=>!recipes[keyFor(task.slot)]);
 const workers=Math.min(8,availableParallelism(),tasks.length);
 await Promise.all(Array.from({length:workers},(_,i)=>new Promise<void>((resolve,reject)=>{
  const worker=new Worker(`import('tsx/esm/api').then(({tsImport})=>tsImport(${JSON.stringify(entry)},${JSON.stringify(import.meta.url)})).catch(e=>{console.error(e);process.exitCode=1;})`,
   {eval:true,workerData:{greenhouse,tasks:tasks.filter((_,j)=>j%workers===i)}});
  worker.on('message',({key,recipe,error}:{key:string;recipe?:Recipe;error?:string})=>{
   if(recipe){recipes[key]=recipe;if(!verify)console.log(key,...recipe);}
   else{failures.push(key);console.error(key,error);}
  });
  worker.on('error',reject);
  worker.on('exit',code=>code===0?resolve():reject(Error('Workshop proof worker '+code)));
 })));
 if(failures.length||Object.keys(recipes).length!==profiles.length)throw Error('Workshop proof coverage '+failures.join(','));
 if(!verify)writeFileSync(output,JSON.stringify({version,recipes:Object.fromEntries(Object.entries(recipes).sort())})+'\n');
 console.log('Verified '+profiles.length+' '+(greenhouse?'greenhouse':'workshop')+' profiles against three starts each.');
}

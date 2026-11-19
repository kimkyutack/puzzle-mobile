import {readFileSync,writeFileSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_DEVICE_ENGINE_VERSION,GLIDER_SWARM_ENGINE_VERSION,type Action,type GameState,type LevelDefinition} from '@garden/contracts';
import {applyAction,createGame,isSpecial,legalActions,replay,validateLevel} from '@garden/core';
import {randomAttemptLevel} from '../../apps/api/src/run-initial';
import {LONG_MAGNET_VERSION,longCampaignCandidate,mirrorCampaignBoard} from '../../packages/content/src/long-campaign-boards';
import {LONG_CAMPAIGN_END,LONG_CAMPAIGN_START,LONG_CAMPAIGN_VERSION,longCampaignSlot} from '../../packages/content/src/long-campaign-plan';

const magnets=isMainThread?process.argv.includes('--rails'):workerData.magnets as boolean;
const version=magnets?LONG_MAGNET_VERSION:LONG_CAMPAIGN_VERSION;
const path=magnets?'packages/content/src/long-campaign-magnet-recipes.json':'packages/content/src/long-campaign-recipes.json';
const keys=[...new Set(Array.from({length:LONG_CAMPAIGN_END-LONG_CAMPAIGN_START+1},(_,i)=>longCampaignSlot(i+LONG_CAMPAIGN_START)?.key)
 .filter((key):key is string=>!!key&&(!magnets||key.includes('/magnets/'))))].sort();
type Recipe=[seed:number,moves:number];
const attemptSeeds=[17347,89381];
const total=(s:GameState)=>s.goals.reduce((sum,g)=>sum+g.remaining,0);
function solve(level:LevelDefinition,style:number):Action[]|undefined {
 let state=createGame(level);
 const actions:Action[]=[];
 for(let turn=0;turn<75&&state.status==='playing';turn++){
  let best:{state:GameState;action:Action;score:number}|undefined;
  const before=total(state);
  for(const action of legalActions(state)){
   const result=applyAction(state,action),next=result.state;
   if(!result.accepted||next.status==='error'||next.status==='lost')continue;
   const run=next.devices!,step=run.steps[run.index];
   const specials=next.cells.filter(c=>isSpecial(c.tile)).length;
   let adjacentPowers=0;
   if(step?.kind==='fuse'){
    for(const [at,cell] of next.cells.entries()){
     if(!isSpecial(cell.tile))continue;
     for(const to of [at+1,at+next.width]){
      if((to!==at+1||Math.floor(at/next.width)===Math.floor(to/next.width))&&isSpecial(next.cells[to]?.tile))adjacentPowers++;
     }
    }
   }
   const score=(next.status==='won'?100_000:0)+run.index*1600+run.progress*125+Number(run.color!==undefined)*85+
    (before-total(next))*(style===0?18:38)+specials*(style===0?13:27)+adjacentPowers*80+
    result.events.filter(event=>event.type==='hit').length*4-result.events.filter(event=>event.type==='shuffle').length*600;
   if(!best||score>best.score)best={action,state:next,score};
  }
  if(!best)return;
  actions.push(best.action);state=best.state;
 }
 return state.status==='won'?actions:undefined;
}
function recipe(key:string,index:number,expected?:Recipe):Recipe{
 const maxAttempts=expected?1:20;
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const seed=expected?.[0]??(148327+index*1297+attempt*104729);
  const level=longCampaignCandidate(key,seed,magnets?GLIDER_SWARM_ENGINE_VERSION:CAMPAIGN_DEVICE_ENGINE_VERSION);
  const errors=validateLevel(level);
  if(errors.length)throw Error(key+' '+errors.join(','));
  const trace=solve(level,0)??solve(level,1);
  if(!trace)continue;
  const random=attemptSeeds.map((randomSeed,index)=>{
   const board=randomAttemptLevel(index===0?level:mirrorCampaignBoard(level),randomSeed);
   try{return (solve(board,0)??solve(board,1))?.length??Infinity;}
   catch(error){
    if(error instanceof Error&&['INITIAL_AUTO_MATCH','INITIAL_DEADLOCK'].includes(error.message))return Infinity;
    throw error;
   }
  });
  const moves=Math.max(trace.length,...random);
  if(moves>65)continue;
  if(replay({...level,moves},trace).state.status!=='won')throw Error(key+' replay mismatch');
  if(expected&&expected[1]!==moves)throw Error(key+' move proof changed');
  return [seed,moves];
 }
 throw Error(key+' no winning proof');
}

if(!isMainThread){
 for(const [key,index,expected] of workerData.tasks as [string,number,Recipe?][]){
  try{parentPort!.postMessage([key,recipe(key,index,expected)]);}
  catch(error){parentPort!.postMessage([key,null,String(error)]);}
 }
}else{
 const verify=process.argv.includes('--verify'),data:Record<string,Recipe>={};
 const previous=verify?JSON.parse(readFileSync(path,'utf8')) as {version:string;recipes:Record<string,Recipe>}:undefined;
 if(previous&&previous.version!==version)throw Error('Catalogue version mismatch');
 const checkpoint=process.env.LONG_CAMPAIGN_CHECKPOINT;
 if(checkpoint&&!verify){
  for(const line of readFileSync(checkpoint,'utf8').split('\n')){
   const [key,seed,moves]=line.split(' ');
   if(key&&keys.includes(key)&&/^\d+$/.test(seed??'')&&/^\d+$/.test(moves??''))data[key]=[Number(seed),Number(moves)];
  }
 }
 const tasks=keys.flatMap((key,i):[string,number,Recipe?][]=>data[key]?[]:[[key,i,previous?.recipes[key]]]);
 if(previous&&(Object.keys(previous.recipes).length!==keys.length||tasks.some(task=>!task[2])))throw Error('Catalogue coverage');
 const workers=Math.min(10,availableParallelism());
 const entry=fileURLToPath(import.meta.url),failed:string[]=[];
 await Promise.all(Array.from({length:workers},(_,i)=>new Promise<void>((resolve,reject)=>{
  const worker=new Worker(`import('tsx/esm/api').then(({tsImport})=>tsImport(${JSON.stringify(entry)},${JSON.stringify(import.meta.url)})).catch(e=>{console.error(e);process.exitCode=1;})`,
   {eval:true,workerData:{magnets,tasks:tasks.filter((_,j)=>j%workers===i)}});
  worker.on('message',([key,result,error]:[string,Recipe|null,string?])=>{
   if(result){data[key]=result;if(!verify)console.log(key,...result);}
   else{failed.push(key);console.error(error);}
  });
  worker.on('error',reject);
  worker.on('exit',code=>code===0?resolve():reject(Error('Campaign proof worker '+code)));
 })));
 if(failed.length||Object.keys(data).length!==keys.length)throw Error('Campaign proof coverage '+failed.join(','));
 if(!verify)writeFileSync(path,JSON.stringify({version,recipes:Object.fromEntries(keys.map(key=>[key,data[key]]))})+'\n');
 console.log('Checked '+keys.length+' campaign boards');
}

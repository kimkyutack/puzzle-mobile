import {parentPort,workerData} from 'node:worker_threads';
import {createGame,findMatches,legalActions,replay,stateHash,validateLevel} from '@garden/core';
import type {Action,LevelDefinition} from '@garden/contracts';
import {type BulkTemplate,type BulkBeat,type BulkCatalogue,levelFromBulkEntry,BULK_START} from '../../packages/content/src/bulk';
import {campaignDifficulty,campaignMoveMargin} from '../../packages/content/src/campaign';
import {solve,type Solution} from './validate';
import {varyTemplate} from './bulk-variants';

const {levels,proofs,catalogue,bulkProofs}=workerData as {levels:LevelDefinition[];proofs:Record<string,Solution>;catalogue?:BulkCatalogue;bulkProofs?:Solution[]};
parentPort!.on('message',job=>{
 if(job.mode==='verify'){
  try{
   const checks:Array<[string,number]>=[];
   for(let id=job.start;id<=job.end;id++){
    const entry=catalogue!.entries[id-BULK_START]!,template=catalogue!.templates[entry[0]]!,proof=bulkProofs![entry[0]]!,level=levelFromBulkEntry(id,entry,template);
    const errors=validateLevel(level);if(errors.length)throw new Error(`INVALID:${id}:${errors}`);
    if(!proof.actions.every(a=>a.type==='swap'||a.type==='tap'))throw new Error(`PAID_PROOF:${id}`);
    const result=replay(level,proof.actions);
    if(!result.accepted||result.state.status!=='won'||result.events.some(e=>e.type==='shuffle'))throw new Error(`FAILED_REPLAY:${id}`);
    if(result.state.moves<campaignMoveMargin(level.campaign!.beat))throw new Error(`MARGIN:${id}`);
    checks.push([stateHash(result.state),result.state.moves]);
   }
   parentPort!.postMessage({key:job.key,start:job.start,checks});
  }catch(e){parentPort!.postMessage({key:job.key,error:String(e)});}return;
 }
 const {key,tier,beat,family,variant}=job as {key:string;tier:number;beat:BulkBeat;family:string;variant:number};
 const pool=levels.filter(l=>l.id>30&&l.width===9&&l.strategy?.id===family);
 const limits={easy:32,normal:42,hard:46,super:52,celebration:24};
 let error='NO_SOURCE';
 for(let attempt=0;attempt<Math.max(24,pool.length);attempt++)try{
  const source=pool[(attempt+variant*3+tier)%pool.length]!,{level,mapAction}=varyTemplate(source,tier,beat,variant,Math.floor(attempt/pool.length)),state=createGame(level);
  if(findMatches(state).length||legalActions(state).length<3)throw new Error('OPENING');
  const prefix=proofs[source.id]!.actions.map(mapAction);
  let solution=solve(level,'goal',prefix);
  if(solution.status!=='won'||solution.shuffles||solution.actions.length>limits[beat])solution=solve(level,'special',prefix);
  if(solution.status!=='won'||solution.shuffles||solution.actions.length>limits[beat])throw new Error(`${solution.status}:${solution.actions.length}:${solution.shuffles}`);
  level.moves=Math.min(100,Math.max(12,solution.actions.length+campaignMoveMargin(beat)));level.difficulty=campaignDifficulty(beat);level.approved=true;
  const result=replay(level,solution.actions);
  if(!result.accepted||result.state.status!=='won')throw new Error('REPLAY');
  const template:BulkTemplate={key,tier,beat,family,variant,source:source.id,steps:solution.actions.length,level};
  solution={...solution,hash:stateHash(result.state),movesLeft:result.state.moves};
  parentPort!.postMessage({key,template,proof:solution});return;
 }catch(e){error=String(e);}
 parentPort!.postMessage({key,error});
});

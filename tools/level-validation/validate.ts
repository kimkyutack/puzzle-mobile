import { createHash } from 'node:crypto';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createGame, applyAction, legalActions, findMatches, replay, stateHash, validateLevel, isSpecial } from '@garden/core';
import { ENGINE_VERSION, CONTENT_VERSION, type Action, type GameState, type LevelDefinition } from '@garden/contracts';
import { candidate } from '../../packages/content/src/candidates.ts';

export interface Solution {actions:Action[];status:string;hash:string;movesLeft:number;shuffles:number;initialChoices:number}
const remaining=(s:GameState)=>s.goals.reduce((sum,g)=>sum+g.remaining,0);
export function solve(level:LevelDefinition,policy:'goal'|'special'='goal',prefix:readonly Action[]=[]):Solution {
 let state=createGame(level);const actions:Action[]=[];const initialChoices=legalActions(state).length;let shuffles=0;
 if(level.tutorial){const a:Action={type:'swap',from:level.tutorial.from,to:level.tutorial.to};const r=applyAction(state,a);if(r.accepted){actions.push(a);shuffles+=r.events.filter(e=>e.type==='shuffle').length;state=r.state;}}
 // Batch authoring can extend a certified path after changing counts/layers.
 // Runtime level starts never call this offline search.
 for(const action of prefix){if(state.status!=='playing')break;const result=applyAction(state,action);if(!result.accepted||result.state.status==='error')break;actions.push(action);shuffles+=result.events.filter(e=>e.type==='shuffle').length;state=result.state;}
 while(state.status==='playing'&&actions.length<100){const before=remaining(state);let best:{a:Action;s:GameState;score:number}|undefined;
  for(const a of legalActions(state)){const r=applyAction(state,a);if(!r.accepted||r.state.status==='error')continue;let score=(before-remaining(r.state))*100+(r.state.status==='won'?100000:0)+(r.state.status==='lost'?-20000:0);score-=r.events.filter(e=>e.type==='shuffle').length*2000;score+=r.state.cells.filter(c=>isSpecial(c.tile)).length*(policy==='special'?45:12);score+=r.events.filter(e=>e.type==='hit').length*9;score+=r.events.filter(e=>e.type==='remove').length*(policy==='special'?0.5:0.1);if(!best||score>best.score)best={a,s:r.state,score};}
  if(!best)break;shuffles+=applyAction(state,best.a).events.filter(e=>e.type==='shuffle').length;actions.push(best.a);state=best.s;
 }
 return {actions,status:state.status,hash:stateHash(state),movesLeft:state.moves,shuffles,initialChoices};
}
async function main(){const build=process.argv.includes('--build');await mkdir('output/verification',{recursive:true});let levels:LevelDefinition[]=[];const solutions:Record<string,Solution>={};const rejected:{id:number;attempt:number;reason:string}[]=[];let candidates=0;
 if(build){for(let id=1;id<=200;id++){let found=false;for(let attempt=0;attempt<80;attempt++){candidates++;try{const level=candidate(id,attempt);const solution=solve(level);if(solution.status!=='won'||solution.shuffles||solution.initialChoices<3){rejected.push({id,attempt,reason:solution.status!=='won'?solution.status:solution.shuffles?'EXCESS_SHUFFLE':'TOO_FEW_CHOICES'});continue;}const check=replay(level,solution.actions);if(check.state.status!=='won'||stateHash(check.state)!==solution.hash)throw new Error('REPLAY_MISMATCH');level.approved=true;levels.push(level);solutions[id]=solution;found=true;break;}catch(error){rejected.push({id,attempt,reason:error instanceof Error?error.message:'unknown'});}}
  if(!found)throw new Error(`No verified candidate for level ${id}`);if(id%10===0)console.log(`Approved ${id}/200, candidates ${candidates}`);}
  await writeFile('packages/content/src/approved.json',JSON.stringify(levels));await writeFile('packages/content/src/solutions.json',JSON.stringify(solutions));
 }else{levels=JSON.parse(await readFile('packages/content/src/approved.json','utf8')) as LevelDefinition[];Object.assign(solutions,JSON.parse(await readFile('packages/content/src/solutions.json','utf8')));}
 const checks=[];for(const level of levels){const solution=solutions[level.id]!;const state=createGame(level);const errors=validateLevel(level);if(errors.length||findMatches(state).length||!legalActions(state).length)throw new Error(`Static invalid ${level.id}`);const r=replay(level,solution.actions);if(!r.accepted||r.state.status!=='won'||stateHash(r.state)!==solution.hash)throw new Error(`Replay failed ${level.id}`);checks.push({id:level.id,moves:solution.actions.length,remaining:solution.movesLeft});}
 for(const id of [201,1000,10000]){const source=levels[140+((id-201)%60)]!,level={...structuredClone(source),id};const r=replay(level,solutions[source.id]!.actions);if(r.state.status!=='won')throw new Error(`Distant level failed ${id}`);checks.push({id,moves:solutions[source.id]!.actions.length,remaining:r.state.moves});}
 const secondary=levels.map(level=>({id:level.id,result:solve(level,'special').status}));const previousGeneration=build?undefined:await readFile('output/verification/level-generation.json','utf8').then(JSON.parse).catch(()=>undefined);const engineSourceHash=createHash('sha256').update(await readFile('packages/game-core/src/index.ts')).digest('hex');const report={engineSourceHash,engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,botDisclaimer:'Automated policy success is not a human win rate. No human play-test claim.',approved:levels.length,candidates:build?candidates:previousGeneration?.candidates,policies:['greedy goal progress, then special count','special-first weighted greedy (all 200 approved levels)'],secondary,rejected:build?rejected:(previousGeneration?.rejected??[]),checks};if(build)await writeFile('output/verification/level-generation.json',JSON.stringify(report,null,2));await writeFile('output/verification/levels.json',JSON.stringify(report,null,2));console.log(`Verified ${checks.length} winning logs; secondary ${secondary.filter(s=>s.result==='won').length}/${secondary.length}.`);
}
if(process.argv[1]?.endsWith('/validate.ts'))void main();

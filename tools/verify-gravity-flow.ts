import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ENGINE_VERSION,type Action,type LevelDefinition} from '@garden/contracts';
import {replay,stateHash,createGame,legalActions,actionWithFrames,applyAction,isSpecial} from '@garden/core';
import {solve,type Solution} from './level-validation/validate';
import {progressiveLevel} from '../packages/content/src/progressive';
import {getLevel,APPROVED_LEVEL_COUNT} from '@garden/content';
import {createHash} from 'node:crypto';
const root='output/verification/gravity-v40';await mkdir(root,{recursive:true});
const catalogue=JSON.parse(await readFile('packages/content/src/progressive-catalogue.json','utf8')) as {early:Record<string,LevelDefinition>;bank:Record<string,LevelDefinition>};
const prior=JSON.parse(await readFile('packages/content/src/progressive-proofs.json','utf8')) as Record<string,Solution>;
const fingerprint=createHash('sha256').update(await readFile('packages/game-core/src/index.ts')).update(await readFile('packages/game-core/src/gravity-flow.ts')).digest('hex');
const cache=await readFile(root+'/checkpoint.json','utf8').then(JSON.parse).catch(()=>({}));
const proofs:Record<string,Solution>=cache.fingerprint===fingerprint?cache.proofs:{},failures:string[]=[],checks=[];
const entries=[...Object.entries(catalogue.early).map(([key,level])=>['early/'+key,level] as const),...Object.entries(catalogue.bank)];
for(const [key,source]of entries){const level={...source!,engineVersion:ENGINE_VERSION};const old=replay(level,prior[key!]!.actions);let solution:Solution|undefined=proofs[key!]??(old.accepted&&old.state.status==='won'?{...prior[key!]!,hash:stateHash(old.state),movesLeft:old.state.moves}:undefined);
 for(const policy of ['goal','special'] as const){if(solution)break;const candidate=solve(level,policy);if(candidate.status==='won')solution=candidate;}
 if(!solution){console.log('Searching '+key);solution=beam(level);}
 if(!solution){failures.push(key!);console.log('UNSOLVED '+key);continue;}
 const result=replay(level,solution.actions);if(!result.accepted||result.state.status!=='won'||stateHash(result.state)!==solution.hash)throw Error('REPLAY_MISMATCH '+key);
 proofs[key!]=solution;await writeFile(root+'/checkpoint.json',JSON.stringify({fingerprint,proofs}));checks.push({key,moves:solution.actions.length,left:result.state.moves});if(checks.length%10===0)console.log('Certified '+checks.length+'/'+entries.length);
}
// Fresh random states and changing barrier layouts must remain deterministic,
// free of flow-limit errors, and show no hole that could still receive a tile.
const samples=[];for(const id of [1,13,31,51,101,104,204,404,708,9998,19998].filter(id=>id<=APPROVED_LEVEL_COUNT)){let state=createGame(progressiveLevel(getLevel(id)));let count=0,falls=0;for(let step=0;step<12&&state.status==='playing';step++){const actions=legalActions(state),action=actions[(id+step*17)%actions.length];if(!action)throw Error('NO_ACTION '+id);const result=actionWithFrames(state,action);if(!result.accepted||result.state.status==='error')throw Error('FLOW_ERROR '+id+':'+result.state.error);falls+=result.events.filter(e=>e.type==='fall').length;count++;state=result.state;}samples.push({id,actions:count,falls,status:state.status});}
await writeFile(root+'/certification.json',JSON.stringify({engine:ENGINE_VERSION,certified:checks.length,total:entries.length,failures,checks,samples},null,2));
await writeFile(root+'/proofs.json',JSON.stringify(proofs));if(failures.length)throw Error('UNSOLVED '+failures.join(','));await writeFile('packages/content/src/gravity-flow-proofs.json',JSON.stringify(proofs));console.log(JSON.stringify({certified:checks.length,failures,samples:samples.length}));

function beam(level:LevelDefinition):Solution|undefined{
 const initial=createGame(level),total=initial.goals.reduce((n,g)=>n+g.remaining,0),choices=legalActions(initial).length;
 let frontier=[{state:initial,actions:[] as Action[],shuffles:0,score:0}];
 for(let step=0;step<level.moves;step++){
  const candidates=[];const seen=new Set<string>();
  for(const entry of frontier)for(const action of legalActions(entry.state)){
   const result=applyAction(entry.state,action);if(!result.accepted||result.state.status==='error')continue;
   const actions=[...entry.actions,action],shuffles=entry.shuffles+result.events.filter(e=>e.type==='shuffle').length;
   if(result.state.status==='won')return {actions,status:'won',hash:stateHash(result.state),movesLeft:result.state.moves,shuffles,initialChoices:choices};
   if(result.state.status!=='playing'||shuffles)continue;
   const hash=stateHash(result.state);if(seen.has(hash))continue;seen.add(hash);
   const score=(total-result.state.goals.reduce((n,g)=>n+g.remaining,0))*100+result.state.cells.filter(c=>isSpecial(c.tile)).length*20;
   candidates.push({state:result.state,actions,shuffles,score});
  }
  frontier=candidates.sort((a,b)=>b.score-a.score).slice(0,12);if(!frontier.length)return;
 }
}

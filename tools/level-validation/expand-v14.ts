import {mkdir,writeFile} from 'node:fs/promises';
import {expandedCandidate,STRATEGIES} from '../../packages/content/src/expanded-candidates';
import {solve,type Solution} from './validate';
import {createGame,legalActions,replay,stateHash} from '@garden/core';
import {CONTENT_VERSION,ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
const levels:LevelDefinition[]=[],solutions:Record<string,Solution>={},rejected:Array<{id:number;attempt:number;reason:string}>=[];
for(let id=1;id<=200;id++){
 let approved=false;
 for(let attempt=0;attempt<64&&!approved;attempt++)try{
  const level=expandedCandidate(id,attempt);let solution=solve(level,'goal');if(solution.status!=='won'||solution.shuffles)solution=solve(level,'special');
  if(solution.status!=='won'||solution.shuffles||solution.initialChoices<3){rejected.push({id,attempt,reason:solution.status+':shuffles='+solution.shuffles});continue;}
  if(id>30){const margin=level.difficulty==='super'?2:level.difficulty==='hard'?4:8,minimum=level.difficulty==='super'?18:level.difficulty==='hard'?20:24;level.moves=Math.max(minimum,solution.actions.length+margin);const retimed=replay(level,solution.actions);solution={...solution,hash:stateHash(retimed.state),movesLeft:retimed.state.moves};}
  const check=replay(level,solution.actions);if(!check.accepted||check.state.status!=='won'||stateHash(check.state)!==solution.hash)throw Error('PROOF_MISMATCH');
  level.approved=true;levels.push(level);solutions[id]=solution;approved=true;
 }catch(error){rejected.push({id,attempt,reason:String(error)});}
 if(!approved)throw Error('NO_APPROVED_LAYOUT:'+id+' '+JSON.stringify(rejected.filter(r=>r.id===id).slice(-3)));
 if(id%5===0)console.log('Approved '+id+'/200');
}
await mkdir('output/verification',{recursive:true});
await writeFile('packages/content/src/approved.json',JSON.stringify(levels));await writeFile('packages/content/src/solutions.json',JSON.stringify(solutions));
const report={engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,approved:levels.length,strategyCounts:Object.fromEntries(STRATEGIES.map(([id])=>[id,levels.filter(l=>l.strategy?.id===id).length])),difficulties:Object.fromEntries(['normal','hard','super'].map(d=>[d,levels.filter(l=>l.difficulty===d).length])),strategies:STRATEGIES,rejected,proofs:levels.map(l=>({id:l.id,initialChoices:legalActions(createGame(l)).length,moves:solutions[l.id]!.actions.length,movesLeft:solutions[l.id]!.movesLeft,hash:solutions[l.id]!.hash})),humanPlaytest:false};
await writeFile('output/verification/expanded-levels-v14.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rejected:rejected.length,proofs:report.proofs.length}));

import {mkdir,writeFile} from 'node:fs/promises';
import {ENGINE_VERSION} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {progressiveLevel} from '../packages/content/src/progressive';
import {earlyBalancedLevel} from '../packages/content/src/early-balance';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {solve} from './level-validation/validate';
const root='output/verification/early-balance-v41';await mkdir(root,{recursive:true});
const report=[];for(const id of [6,8,10,13,16,20,27,32,33,38,48,50,53,58,64,68,76,88,93,98]){
 const base=progressiveLevel(getLevel(id,ENGINE_VERSION));let winsBefore=0,winsAfter=0;const runs=[];
 for(const seed of [1013,2047,4093]){
  const old=prepareRunInitial(base,[],true,seed).level,next=earlyBalancedLevel(old),before=solve(old),after=solve(next);
  if(before.status==='won')winsBefore++;if(after.status==='won')winsAfter++;
  runs.push({seed,before:before.status,after:after.status,beforeSteps:before.actions.length,afterSteps:after.actions.length});
 }
 report.push({id,difficulty:base.difficulty,movesBefore:base.moves,movesAfter:earlyBalancedLevel(base).moves,winsBefore,winsAfter,runs});console.log(JSON.stringify(report.at(-1)));
 await writeFile(root+'/random-start-comparison.json',JSON.stringify({engine:ENGINE_VERSION,disclaimer:'Offline greedy policy, same random boards, no starting items. Not player win rates.',runs:report},null,2));
}
console.log(JSON.stringify({samples:report.length*3,winsBefore:report.reduce((n,r)=>n+r.winsBefore,0),winsAfter:report.reduce((n,r)=>n+r.winsAfter,0)}));

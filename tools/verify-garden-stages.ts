import {mkdir,writeFile} from 'node:fs/promises';
import {gardenStageCandidate,GARDEN_STAGE_VARIANTS} from '../packages/content/src/garden-stage-candidates';
import retainedOpenRecipes from '../packages/content/src/garden-stage-recipes-v2.json';
import type {GardenStageRecipe} from '../packages/content/src/garden-stages';
import {solve} from './level-validation/validate';
import {applyAction,createGame,replay,stateHash,validateLevel} from '@garden/core';
import {IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION,OPEN_GARDEN_STAGE_ENGINE_VERSION,GARDEN_STAGE_ENGINE_VERSION} from '@garden/contracts';
const immediate=process.argv.includes('--immediate'),open=process.argv.includes('--open'),rules=immediate?IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION:open?OPEN_GARDEN_STAGE_ENGINE_VERSION:GARDEN_STAGE_ENGINE_VERSION,suffix=immediate?'-v3':open?'-v2':'';
const recipes:GardenStageRecipe[]=[],proofs:unknown[]=[];
for(const kind of ['water','animal'] as const)for(let variant=0;variant<GARDEN_STAGE_VARIANTS;variant++){
 const level=gardenStageCandidate(kind,variant,rules);if(immediate){const retained=retainedOpenRecipes.find(r=>r.kind===kind&&r.variant===variant)!;level.seed=retained.seed;level.moves=retained.moves;}let solution=solve(level);if(immediate&&solution.status!=='won')solution=solve(level,'special');
 const minimum=immediate?1:variant<3?2:variant<9?3:4;
 for(let attempt=0;(solution.status!=='won'||solution.actions.length<minimum||solution.shuffles)&&!immediate&&attempt<32;attempt++){
  level.seed+=104729;solution=solve(level);if(solution.status!=='won')solution=solve(level,'special');
 }
 if(solution.status!=='won'||solution.actions.some(a=>!['swap','tap'].includes(a.type)))throw Error('UNSOLVED_STAGE:'+kind+'/'+variant);
 if(solution.actions.length<minimum||solution.shuffles)throw Error('UNCERTIFIED_STAGE:'+kind+'/'+variant);
 if(!immediate)level.moves=Math.max(14,Math.min(100,solution.actions.length+(variant<3?10:variant<9?7:4)));
 const result=replay(level,solution.actions),opening=solution.actions.find((a):a is Extract<typeof a,{type:'swap'}>=>a.type==='swap');
 if(!opening||!result.accepted||result.state.status!=='won'||validateLevel(level).length)throw Error('INVALID_STAGE:'+kind+'/'+variant);
 const first=applyAction(createGame(level),opening);if(!first.accepted)throw Error('INVALID_OPENING');
 recipes.push({kind,variant,seed:level.seed,moves:level.moves,opening,hash:stateHash(result.state)});
 proofs.push({kind,variant,actions:solution.actions,hash:stateHash(result.state),movesLeft:result.state.moves,shuffles:solution.shuffles});
 console.log(JSON.stringify({kind,variant,moves:level.moves,steps:solution.actions.length,shuffles:solution.shuffles}));
}
await mkdir('output/verification/garden-stages',{recursive:true});
await writeFile(`packages/content/src/garden-stage-recipes${suffix}.json`,JSON.stringify(recipes,null,2)+'\n');
await writeFile(`packages/content/src/garden-stage-proofs${suffix}.json`,JSON.stringify(proofs)+'\n');
await writeFile(`output/verification/garden-stages/certification${suffix}.json`,JSON.stringify({rules,recipes:recipes.length,proofs,humanPlaytest:false},null,2));

import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {solve,type Solution} from './level-validation/validate';
import {animalExpeditionCandidate,EXPEDITION_BALANCE} from '../packages/content/src/animal-expedition-candidates';
import {validateLevel,replay,stateHash} from '@garden/core';
const recipes:Array<{stage:number;seeds:number[]}>=[],proofs=[];
type ExpeditionProof=Solution&{stage:number;variant:number;seed:number};
const checkpointRoot='output/verification/expedition-v47';await mkdir(checkpointRoot,{recursive:true});
const stageOption=process.argv.find(arg=>arg.startsWith('--stage=')),onlyStage=stageOption?Number(stageOption.slice(8)):undefined;
if(onlyStage!==undefined&&(!Number.isInteger(onlyStage)||onlyStage<1||onlyStage>EXPEDITION_BALANCE.length))throw Error('INVALID_EXPEDITION_STAGE');
for(let stage=onlyStage??1;stage<=(onlyStage??EXPEDITION_BALANCE.length);stage++){
 const signature=JSON.stringify({level:animalExpeditionCandidate(stage,0),balance:EXPEDITION_BALANCE[stage-1]}),checkpoint=checkpointRoot+'/stage-'+stage+'.json';
 const saved=await readFile(checkpoint,'utf8').then(JSON.parse).catch(()=>null);
 if(saved?.signature===signature&&Array.isArray(saved.proofs)&&saved.proofs.length===3&&saved.proofs.every((proof:ExpeditionProof)=>{
  const level=animalExpeditionCandidate(stage,proof.seed),result=replay(level,proof.actions);return proof.stage===stage&&saved.recipe?.seeds?.[proof.variant]===proof.seed&&!validateLevel(level).length&&result.accepted&&result.state.status==='won'&&stateHash(result.state)===proof.hash&&!result.events.some(event=>event.type==='shuffle')&&proof.actions.every((action:{type:string})=>action.type==='swap'||action.type==='tap');
 })){recipes.push(saved.recipe);proofs.push(...saved.proofs);console.log({stage,cached:true});continue;}
 const stageProofs=[];
 const seeds:number[]=[];
 for(let variant=0;variant<3;variant++){
  let seed=94781+stage*104729+variant*7919,solution;
  const balance=EXPEDITION_BALANCE[stage-1]!;
  for(let attempt=0;attempt<180;attempt++,seed+=127){if(attempt%20===0)console.log({stage,variant,attempt,seed});const level=animalExpeditionCandidate(stage,seed),goal=solve(level);if(goal.status==='won'&&!goal.shuffles&&goal.actions.length<balance.minSolution)continue;const candidates=[goal,solve(level,'special')].filter(result=>result.status==='won'&&!result.shuffles).sort((a,b)=>a.actions.length-b.actions.length);solution=candidates[0];if(solution&&solution.actions.length>=balance.minSolution&&solution.actions.length<=balance.maxSolution)break;solution=undefined;}
  if(!solution)throw Error('No verified animal route: '+stage+'/'+variant);
  const level=animalExpeditionCandidate(stage,seed),result=replay(level,solution.actions);if(validateLevel(level).length||!result.accepted||result.state.status!=='won'||stateHash(result.state)!==solution.hash)throw Error('Invalid expedition proof');
  seeds.push(seed);stageProofs.push({stage,variant,seed,...solution});console.log({stage,variant,seed,moves:solution.actions.length,shuffles:solution.shuffles});
 }
 const recipe={stage,seeds};recipes.push(recipe);proofs.push(...stageProofs);await writeFile(checkpoint,JSON.stringify({signature,recipe,proofs:stageProofs})+'\n');
}
if(onlyStage===undefined){await writeFile('packages/content/src/animal-expedition-recipes.json',JSON.stringify(recipes)+'\n');await writeFile('packages/content/src/animal-expedition-proofs.json',JSON.stringify(proofs)+'\n');}

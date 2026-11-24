import {writeFile,mkdir} from 'node:fs/promises';
import {ENGINE_VERSION,type Action} from '@garden/contracts';
import {createGame,findMatches,legalActions,replay,validateLevel} from '@garden/core';
import {gardenCircuitCandidate,gardenCircuitProfiles,circuitProfileKey} from '../../packages/content/src/garden-circuit';
import {unsuppliedTileCells} from '../../packages/content/src/refill-corridors';
import {solve} from './validate';
const saved:Record<string,[number,number]>={},proof:Record<string,{seed:number;actions:Action[];moves:number;shuffles:number}>={};
for(const profile of gardenCircuitProfiles()){
 const key=circuitProfileKey(profile);let found=false;
 for(let attempt=0;attempt<48;attempt++){
  const seed=(925781+profile.tier*2381+Number(profile.mirror)*523+attempt*7283)>>>0;
  const board=gardenCircuitCandidate(profile,seed,ENGINE_VERSION),errors=validateLevel(board),holes=unsuppliedTileCells(board);
  if(errors.length||holes.length)throw Error(`${key}: ${errors} / no supply ${holes}`);
  const state=createGame(board);if(findMatches(state).length||legalActions(state).length<3)continue;
  const result=solve(board);if(result.status!=='won'||result.shuffles)continue;
  if(!profile.intro&&result.actions.length<(profile.tier>=2?12:8))continue;
  const replayed=replay(board,result.actions);if(!replayed.accepted||replayed.state.status!=='won')throw Error(`REPLAY ${key}`);
  saved[key]=[seed,result.actions.length];proof[key]={seed,actions:result.actions,moves:result.actions.length,shuffles:0};found=true;break;
 }
 if(!found)throw Error(`NO_PROOF ${key}`);
 await writeFile('packages/content/src/garden-circuit-recipes.json',JSON.stringify(saved,null,2)+'\n');
 console.log(`${Object.keys(proof).length}/${gardenCircuitProfiles().length} ${key}: ${saved[key]![1]} moves`);
}
await writeFile('packages/content/src/garden-circuit-proofs.json',JSON.stringify(proof)+'\n');
await mkdir('output/verification',{recursive:true});
await writeFile('output/verification/garden-circuit.json',JSON.stringify({engine:ENGINE_VERSION,note:'Deterministic bot clears, not measured human win rates.',proof},null,2));

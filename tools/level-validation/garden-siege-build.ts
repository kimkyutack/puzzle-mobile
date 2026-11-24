import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ENGINE_VERSION,type Action} from '@garden/contracts';
import {createGame,findMatches,legalActions,replay,validateLevel} from '@garden/core';
import {gardenSiegeCandidate,gardenSiegeProfiles,siegeProfileKey} from '../../packages/content/src/garden-siege';
import {unsuppliedTileCells} from '../../packages/content/src/refill-corridors';
import {solve} from './validate';
const file='packages/content/src/garden-siege-recipes.json';
const saved:Record<string,[number,number]>=JSON.parse(await readFile(file,'utf8'));
const proof:Record<string,{seed:number;actions:Action[];moves:number;shuffles:number}>={};
for(const profile of gardenSiegeProfiles()){
 const key=siegeProfileKey(profile);let found=false;
 for(let attempt=0;attempt<32;attempt++){
  const seed=(791381+profile.tier*1709+Number(profile.mirror)*271+attempt*4729)>>>0;
  const level=gardenSiegeCandidate(profile,seed,ENGINE_VERSION),errors=validateLevel(level),holes=unsuppliedTileCells(level);
  if(errors.length||holes.length)throw Error(`${key}: ${errors} / no supply: ${holes}`);
  const initial=createGame(level);if(findMatches(initial).length||legalActions(initial).length<3)continue;
  const result=solve(level);
  if(result.status!=='won'||result.shuffles)continue;
  if(!profile.intro&&result.actions.length<(profile.tier>=2?12:8))continue;
  const check=replay(level,result.actions);if(!check.accepted||check.state.status!=='won')throw Error(`REPLAY ${key}`);
  saved[key]=[seed,result.actions.length];proof[key]={seed,actions:result.actions,moves:result.actions.length,shuffles:result.shuffles};found=true;break;
 }
 if(!found)throw Error(`NO_PROOF ${key}`);
 await writeFile(file,JSON.stringify(saved,null,2)+'\n');
 console.log(`${Object.keys(proof).length}/${gardenSiegeProfiles().length} ${key}: ${saved[key]![1]} moves`);
}
await writeFile('packages/content/src/garden-siege-proofs.json',JSON.stringify(proof)+'\n');
await mkdir('output/verification',{recursive:true});
await writeFile('output/verification/garden-siege.json',JSON.stringify({engine:ENGINE_VERSION,note:'Deterministic bot clears, not human win rates.',proof},null,2));

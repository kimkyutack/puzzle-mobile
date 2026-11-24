import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ENGINE_VERSION} from '@garden/contracts';
import {createGame,findMatches,legalActions,replay,validateLevel} from '@garden/core';
import {variedCampaignCandidate,variedProfiles,variedProfileKey} from '../../packages/content/src/varied-campaign';
import {solve} from './validate';

const file='packages/content/src/varied-campaign-recipes.json';
const saved:Record<string,[number,number]>=JSON.parse(await readFile(file,'utf8'));
const proof:Record<string,unknown>=JSON.parse(await readFile('output/verification/varied-campaign.json','utf8').catch(()=>'{}')).proof??{};
const selected=process.argv.find(arg=>arg.startsWith('--family='))?.split('=')[1];
const layout=process.argv.find(arg=>arg.startsWith('--layout='))?.split('=')[1];
for(const profile of variedProfiles().filter(profile=>(!selected||profile.family===selected)&&(!process.argv.includes('--intro')||profile.intro)&&(layout===undefined||!profile.intro&&profile.layout===Number(layout)))){
 const key=variedProfileKey(profile);let found=false;
 for(let attempt=0;attempt<16;attempt++){
  const seed=attempt===0&&saved[key]?saved[key]![0]:(613081+profile.tier*271+profile.layout*1709+attempt*4729)>>>0;
  const level=variedCampaignCandidate(profile,seed,ENGINE_VERSION);
  const errors=validateLevel(level);if(errors.length)throw Error(`${key}: ${errors.join(',')}`);
  const state=createGame(level);if(findMatches(state).length||!legalActions(state).length)continue;
  const result=solve(level);
  if(result.status!=='won')continue;
  const check=replay(level,result.actions);if(!check.accepted||check.state.status!=='won')throw Error(`REPLAY ${key}`);
  saved[key]=[seed,result.actions.length];proof[key]={moves:result.actions.length,shuffles:result.shuffles,actions:result.actions};found=true;break;
 }
 if(!found)throw Error(`NO_PROOF ${key}`);
 await writeFile(file,JSON.stringify(saved,null,2)+'\n');
 console.log(`${Object.keys(proof).length}/${variedProfiles().length} ${key} ${saved[key]![1]} moves`);
}
await mkdir('output/verification',{recursive:true});
await writeFile('output/verification/varied-campaign.json',JSON.stringify({engineVersion:ENGINE_VERSION,note:'Deterministic bot clears, not measured human difficulty.',proof},null,2));

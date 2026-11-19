import {supportsCampaignDevices,supportsGliderSwarm,type LevelDefinition} from '@garden/contracts';
import {campaignDifficulty,campaignMoveMargin,campaignPosition} from './campaign';
import {LONG_MAGNET_VERSION,longCampaignCandidate,mirrorCampaignBoard} from './long-campaign-boards';
import {LONG_CAMPAIGN_VERSION,longCampaignSlot} from './long-campaign-plan';
import catalogue from './long-campaign-recipes.json';
import magnets from './long-campaign-magnet-recipes.json';

type Recipe=readonly [seed:number,moves:number];

export function longCampaignLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsCampaignDevices(source.engineVersion)||!source.approved||source.gardenStage)return source;
 const slot=longCampaignSlot(source.id);
 if(!slot)return source;
 // Keep the early switch lesson but reuse a certified switch-and-rail layout
 // for the campaign's returning magnet board at 414.
 const upgraded=supportsGliderSwarm(source.engineVersion);
 const key=upgraded&&source.id===414?'mix/switch/magnets/1':slot.key;
 const long=upgraded&&key.includes('/magnets/');
 const selected=long?magnets:catalogue,version=long?LONG_MAGNET_VERSION:LONG_CAMPAIGN_VERSION;
 const recipes=selected.recipes as unknown as Readonly<Partial<Record<string,Recipe>>>;
 const recipe=selected.version===version&&recipes[key];
 if(!recipe)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,proofMoves]=recipe;
 const authored=longCampaignCandidate(key,seed,source.engineVersion);
 const board=slot.variant===2?mirrorCampaignBoard(authored):authored;
 return {...board,id:source.id,approved:true,
  moves:Math.max(source.moves,proofMoves+campaignMoveMargin(slot.beat)),
  difficulty:campaignDifficulty(slot.beat),
  campaign:{...campaignPosition(source.id),beat:slot.beat},
 };
}

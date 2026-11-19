import {supportsCampaignDevices,supportsGliderSwarm,type LevelDefinition} from '@garden/contracts';
import {campaignDifficulty,campaignMoveMargin,campaignPosition} from './campaign';
import {BREAKABLE_MAGNET_VERSION,breakableCandidate} from './breakable-campaign-boards';
import {BREAKABLE_CAMPAIGN_VERSION,breakableSlot} from './breakable-campaign-plan';
import catalogue from './breakable-recipes.json';
import magnets from './breakable-magnet-recipes.json';

type Recipe=readonly [seed:number,moves:number];

export function breakableCampaignLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsCampaignDevices(source.engineVersion)||!source.approved||source.gardenStage)return source;
 const slot=breakableSlot(source.id);
 if(!slot)return source;
 const long=supportsGliderSwarm(source.engineVersion)&&slot.key.startsWith('magnet-yard/');
 const selected=long?magnets:catalogue,version=long?BREAKABLE_MAGNET_VERSION:BREAKABLE_CAMPAIGN_VERSION;
 const recipes=selected.recipes as unknown as Partial<Record<string,Recipe>>;
 const recipe=selected.version===version&&recipes[slot.key];
 if(!recipe)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,moves]=recipe;
 const board=breakableCandidate(slot.key,seed,source.engineVersion);
 return {...board,id:source.id,approved:true,moves:Math.max(source.moves,moves+campaignMoveMargin(slot.beat)),
  difficulty:campaignDifficulty(slot.beat),campaign:{...campaignPosition(source.id),beat:slot.beat}};
}

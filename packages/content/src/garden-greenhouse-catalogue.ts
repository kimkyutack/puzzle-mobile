import {supportsGreenhouse,type CampaignBeat,type LevelDefinition} from '@garden/contracts';
import {campaignDifficulty,campaignMoveMargin,campaignPosition} from './campaign';
import {GREENHOUSE_CONTENT_VERSION,greenhouseCandidate,greenhouseKey,greenhouseSlot} from './garden-greenhouse';
import catalogue from './garden-greenhouse-recipes.json';

const recipes:Readonly<Partial<Record<string,readonly number[]>>>=catalogue.recipes;

export function greenhouseLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsGreenhouse(source.engineVersion)||source.gardenStage||!source.approved)return source;
 const slot=greenhouseSlot(source.id);
 if(!slot)return source;
 const recipe=catalogue.version===GREENHOUSE_CONTENT_VERSION&&recipes[greenhouseKey(slot)];
 if(!recipe)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,moves]=recipe;
 const position=campaignPosition(source.id);
 const beat:CampaignBeat=slot.style==='lesson'?(slot.variant===0?'introduction':'practice'):position.beat;
 return {
  ...greenhouseCandidate(slot,seed!),
  id:source.id,
  engineVersion:source.engineVersion,
  approved:true,
  moves:Math.max(source.moves,moves!+campaignMoveMargin(beat)),
  difficulty:campaignDifficulty(beat),
  campaign:{...position,beat},
 };
}

import {supportsGardenWorkshop,type CampaignBeat,type LevelDefinition} from '@garden/contracts';
import {campaignDifficulty,campaignMoveMargin,campaignPosition} from './campaign';
import {WORKSHOP_CONTENT_VERSION,workshopCandidate,workshopKey,workshopSlot} from './garden-workshop';
import catalogue from './garden-workshop-recipes.json';

const recipes:Readonly<Partial<Record<string,readonly number[]>>>=catalogue.recipes;

export function workshopLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsGardenWorkshop(source.engineVersion)||source.gardenStage||!source.approved)return source;
 const slot=workshopSlot(source.id);
 if(!slot)return source;
 const recipe=catalogue.version===WORKSHOP_CONTENT_VERSION&&recipes[workshopKey(slot)];
 if(!recipe)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,moves]=recipe;
 const position=campaignPosition(source.id);
 const beat:CampaignBeat=slot.style==='lesson'?(slot.variant===0?'introduction':'practice'):position.beat;
 return {
  ...workshopCandidate(slot,seed!),
  id:source.id,
  engineVersion:source.engineVersion,
  approved:true,
  moves:Math.max(source.moves,moves!+campaignMoveMargin(beat)),
  difficulty:campaignDifficulty(beat),
  campaign:{...position,beat},
 };
}

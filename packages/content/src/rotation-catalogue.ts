import {supportsGliderSwarm,supportsSeedDelivery,type LevelDefinition,type ObstacleKind} from '@garden/contracts';
import {campaignDifficulty,campaignMoveMargin,campaignPosition} from './campaign';
import {campaignRotation,rotationHasMagnets,ROTATION_CONTENT_VERSION,ROTATION_MAGNET_VERSION,rotationCandidate,type RotationFamily} from './campaign-rotation';
import catalogue from './campaign-rotation-recipes.json';
import magnets from './rotation-magnet-recipes.json';

type Recipe=readonly [layout:number,seed:number,verifiedMoves:number];
const introLessons:Partial<Record<RotationFamily,ObstacleKind>>={
 'magnet-ends':'pipe',
 'pipe-delivery':'cabinet',
 carousel:'carousel',
};

/** Replaces only the definition used for a new campaign attempt. */
export function rotatedCampaignLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsSeedDelivery(source.engineVersion)||!source.approved||source.gardenStage)return source;
 const position=campaignPosition(source.id);
 const slot=campaignRotation(source.id,position.beat);
 if(!slot)return source;
 const long=supportsGliderSwarm(source.engineVersion)&&rotationHasMagnets(slot.family);
 const selected=long?magnets:catalogue,version=long?ROTATION_MAGNET_VERSION:ROTATION_CONTENT_VERSION;
 const recipes=selected.recipes as unknown as Readonly<Partial<Record<string,Recipe>>>;
 const recipe=selected.version===version&&recipes[`${slot.family}/${slot.pressure}/${slot.layout}`];
 if(!recipe&&long)throw Error('LEVEL_CONTENT_PENDING');
 if(!recipe)return source;
 const [layout,seed,verifiedMoves]=recipe;
 const board=rotationCandidate(slot.family,slot.pressure,layout,seed,source.engineVersion);
 const {lesson:_lesson,...campaign}=position;
 const teaching=slot.beat==='introduction'||slot.beat==='practice';
 const lesson=teaching?introLessons[slot.family]:undefined;
 return {
  ...board,
  id:source.id,
  approved:true,
  difficulty:campaignDifficulty(slot.beat),
  moves:Math.max(source.moves,verifiedMoves+campaignMoveMargin(slot.beat)),
  campaign:{...campaign,beat:slot.beat,...(lesson?{lesson}:{})},
 };
}

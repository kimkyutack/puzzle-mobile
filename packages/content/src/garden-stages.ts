import {GARDEN_STAGE_ENGINE_VERSION,supportsOpenGardenStages,supportsImmediateGardenStages,type GardenStageKind,type LevelDefinition,type Action} from '@garden/contracts';
import {gardenStageCandidate,GARDEN_STAGE_VARIANTS} from './garden-stage-candidates';
import recipes from './garden-stage-recipes.json';
import openRecipes from './garden-stage-recipes-v2.json';
import immediateRecipes from './garden-stage-recipes-v3.json';
import {campaignPosition} from './campaign';
export interface GardenStageRecipe {kind:GardenStageKind;variant:number;seed:number;moves:number;opening:Extract<Action,{type:'swap'}>;hash:string}
export function gardenStageKind(id:number):GardenStageKind|null {
 return Number.isSafeInteger(id)&&id>=10&&id%10===0?(id%20===10?'water':'animal'):null;
}
/** Only completed, winning-replay-certified recipes can enter the live catalog. */
export function getGardenStage(id:number,engineVersion:string=GARDEN_STAGE_ENGINE_VERSION):LevelDefinition|null {
 const kind=gardenStageKind(id);if(!kind)return null;
 const variant=Math.floor((id-10)/20)%GARDEN_STAGE_VARIANTS,recipe=((supportsImmediateGardenStages(engineVersion)?immediateRecipes:supportsOpenGardenStages(engineVersion)?openRecipes:recipes) as GardenStageRecipe[]).find(r=>r.kind===kind&&r.variant===variant);
 if(!recipe)throw new Error('LEVEL_CONTENT_PENDING');
 const level=gardenStageCandidate(kind,variant,engineVersion),first=id===10||id===20;
 return {...level,id,seed:recipe.seed,moves:recipe.moves,engineVersion,campaign:{...campaignPosition(id),beat:'celebration'},approved:true,
  ...(first?{tutorial:{feature:'garden-'+kind,text:level.strategy!.hint,from:recipe.opening.from,to:recipe.opening.to}}:{})};
}

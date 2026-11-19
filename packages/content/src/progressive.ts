import {IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION,supportsEndpointPipes,supportsImmediateGardenStages,type LevelDefinition} from '@garden/contracts';
import catalogue from './progressive-catalogue.json';
import cellCatalogue from './progressive-cell-catalogue-v38.json';
import {PROGRESSIVE_CONTENT_VERSION,progressionLayout,progressionBand} from './progressive-plan';
export {PROGRESSIVE_CONTENT_VERSION,progressionBand,progressionLayout,progressionMargin} from './progressive-plan';
interface Catalogue {version:string;early:Record<string,LevelDefinition>;bank:Record<string,LevelDefinition>}

/** Substitute a certified rail board only when the published board still uses buds. */
export function replaceFlowerObstacle(base:LevelDefinition):LevelDefinition{
 if(!base.obstacles.some(obstacle=>obstacle.kind==='bud'))return base;
 const beat=base.campaign?.beat;
 const challenge=beat==='hard'||beat==='super'?beat:'normal';
 const learning=beat==='introduction'||beat==='practice';
 const relaxed=learning||beat==='easy'||beat==='celebration';
 // The short rail teaches both ends. Reserve the large, winding layouts for hard beats.
 const mapBand=Math.max(2,progressionBand(base.id));
 const band=relaxed?Math.min(mapBand,3):mapBand;
 const variant=(Math.floor(base.id/10)+base.id)%2===0?1:3;
 const source=(catalogue as unknown as Catalogue).bank[`${band}/${challenge}/${variant}`]!;
 const level=structuredClone(source);
 level.id=base.id;
 level.engineVersion=base.engineVersion;
 level.version=PROGRESSIVE_CONTENT_VERSION+':flower-rail-v1';
 level.difficulty=base.difficulty;
 level.approved=base.approved;
 level.moves+=learning?8:relaxed?6:0;
 level.campaign=base.campaign?.lesson==='bud'?{...base.campaign,lesson:'pipe'}:base.campaign;
 // Older clients already support the same long footprint as an ordinary pipe.
 if(!supportsEndpointPipes(base.engineVersion)){
  for(const obstacle of level.obstacles)delete obstacle.endOnly;
  level.moves+=6;
  delete level.strategy;
 }
 return level;
}
/** Older catalogue families also used large charged curtains. New starts swap
 * those layouts for certified cell barriers; their saved runs remain intact. */
export function progressionSelection(base:LevelDefinition){
 const beat=base.campaign?.beat??'normal',scheduled=progressionLayout(base.id,beat);if(scheduled)return scheduled;
 if(base.id<=100||!base.obstacles.some(o=>o.kind==='curtain'&&o.footprint.length>1))return null;
 const rest=['introduction','practice','easy','celebration'].includes(beat),band=rest?1:progressionBand(base.id),challenge=rest||band===1?'intro':beat==='super'?'super':beat==='hard'?'hard':'normal';
 const variant=(Math.floor((base.id-101)/10)+base.id)%4;
 const introVariant=variant===0?1:variant;
 return {band,challenge,variant:challenge==='intro'?introVariant:variant,key:`${band}/${challenge}/${challenge==='intro'?introVariant:variant}`};
}
/** New starts receive certified data; saved Run.level and all retained bundles stay intact. */
export function progressiveLevel(base:LevelDefinition):LevelDefinition{
 if(base.id<=30||base.gardenStage||!supportsImmediateGardenStages(base.engineVersion))return base;
 const retained=base.engineVersion===IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION,data=(retained?cellCatalogue:catalogue) as unknown as Catalogue;if(!retained&&data.version!==PROGRESSIVE_CONTENT_VERSION)return base;const profile=progressionSelection(base);
 const selected=data.early[base.id]??(profile?data.bank[profile.key]:undefined);
 if(!selected)return base;
 const level=structuredClone(selected);level.id=base.id;level.version=data.version;level.engineVersion=base.engineVersion;
 level.campaign=base.campaign?{...base.campaign,...(base.campaign.lesson==='curtain'?{lesson:'crate' as const}:{})}:undefined;level.difficulty=base.difficulty;level.approved=true;
 if(base.id===101&&level.tutorial){level.campaign={...base.campaign!,beat:'introduction',lesson:'crate'};}
 else if(base.id===102||base.id===103){delete level.tutorial;level.campaign={...base.campaign!,beat:'practice',lesson:'crate'};}
 else delete level.tutorial;
 return level;
}

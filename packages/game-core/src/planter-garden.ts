import {supportsPlanterGarden,type GameEvent,type GameState,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {isGardenOpener} from '../../contracts/src/breakable-obstacles';

export function validatePlanterGarden(level:LevelDefinition):string[]{
 const present=level.obstacles.some(o=>o.cover!==undefined||o.storedRocket!==undefined||o.kind==='garden-planter'||isGardenOpener(o.kind));
 if(!present)return [];
 if(!supportsPlanterGarden(level.engineVersion)||level.gardenStage)return ['PLANTER_GARDEN_ENGINE'];
 const obstacles=new Map(level.obstacles.map(obstacle=>[obstacle.id,obstacle]));
 const coveredBy=new Set<string>();
 for(const obstacle of level.obstacles){
  const {kind,cover,storedRocket}=obstacle;
  const opener=isGardenOpener(kind);
  if(!opener&&kind!=='garden-planter'&&cover===undefined&&storedRocket===undefined)continue;
  if(cover!==undefined){
   const source=cover&&obstacles.get(cover.source);
   if(kind!=='garden-planter'||!source||source.kind!==cover.kind||!isGardenOpener(source.kind))return ['PLANTER_GARDEN_COVER'];
   coveredBy.add(source.id);
  }
  if(storedRocket!==undefined&&(kind!=='rotating-shelf'||!['wind-row','wind-column'].includes(storedRocket)))return ['PLANTER_GARDEN_ROCKET'];
  if(opener&&(obstacle.hp!==1||obstacle.maxHp!==1))return ['PLANTER_GARDEN_OPENER'];
 }
 if(level.obstacles.some(o=>isGardenOpener(o.kind)&&!coveredBy.has(o.id)&&!o.storedRocket))return ['PLANTER_GARDEN_OPENER'];
 return [];
}

/** Apply after the striking effect. Only later effects can damage exposed planters. */
export function revealPlanters(state:GameState,opener:Obstacle,events:GameEvent[]):void{
 const targets=Object.values(state.obstacles).filter(o=>o.cover?.source===opener.id).sort((a,b)=>a.anchor-b.anchor);
 const effectId=++state.effectSequence;
 events.push({type:'mechanic',kind:`${opener.kind}-open`,from:opener.anchor,cells:targets.map(o=>o.anchor),effectId});
 for(const planter of targets){
  delete planter.cover;
  events.push({type:'hit',kind:'planter-reveal',cells:[planter.anchor],obstacleId:planter.id,obstacleAfter:{...planter},effectId});
 }
 if(opener.storedRocket){
  state.cells[opener.anchor]!.tile={id:state.nextTileId++,kind:opener.storedRocket};
  events.push({type:'spawn',kind:opener.storedRocket,cells:[opener.anchor],effectId});
 }
}

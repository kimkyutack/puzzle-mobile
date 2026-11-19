import {supportsCampaignDevices,supportsLayeredObstacles,supportsObstacleGarden,supportsVisibleTargets,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {isBreakableObstacle,isObstacleGardenKind} from '../../contracts/src/breakable-obstacles';

export function validateBreakable(level:LevelDefinition,obstacle:Obstacle):string[]{
 const {kind,contents,footprint}=obstacle;
 if(obstacle.link!==undefined&&kind!=='wind-pod')return ['WIND_LINK'];
 if(!isBreakableObstacle(kind))return contents?['BREAKABLE_CONTENTS']:[];
 if(!supportsCampaignDevices(level.engineVersion)||level.gardenStage)return ['BREAKABLE_ENGINE'];
 if(isObstacleGardenKind(kind)&&!supportsObstacleGarden(level.engineVersion))return ['BREAKABLE_ENGINE'];
 if(kind==='flower-seal'&&!supportsVisibleTargets(level.engineVersion))return ['BREAKABLE_ENGINE'];
 if(kind==='starlight-lantern'&&obstacle.maxHp!==3||kind==='wind-pod'&&obstacle.maxHp>2)return ['BREAKABLE_FIELDS'];
 if(obstacle.color||obstacle.endOnly||obstacle.path||obstacle.seeds||obstacle.maxHp>6)return ['BREAKABLE_FIELDS'];
 if(kind==='supply-crate'){
  if(!contents||!['urn','crystal'].includes(contents.kind)||!Number.isInteger(contents.hp)||contents.hp<1||contents.hp>3)return ['BREAKABLE_CONTENTS'];
  if(contents.innerCrateHp!==undefined&&(!supportsLayeredObstacles(level.engineVersion)||contents.kind!=='urn'||
   !Number.isInteger(contents.innerCrateHp)||contents.innerCrateHp<1||contents.innerCrateHp>3))return ['BREAKABLE_CONTENTS'];
 }else if(contents)return ['BREAKABLE_CONTENTS'];
 if(footprint.length===1&&kind!=='windmill')return [];
 const wideCrate=kind==='supply-crate'&&supportsLayeredObstacles(level.engineVersion)&&contents?.kind==='urn';
 if(kind!=='statue'&&kind!=='windmill'&&!wideCrate)return ['BREAKABLE_FOOTPRINT'];
 const first=Math.min(...footprint),width=level.width;
 return first%width<width-1&&footprint.length===4&&[first,first+1,first+width,first+width+1].every(at=>footprint.includes(at))
  ?[]:['BREAKABLE_FOOTPRINT'];
}

/** Each pod delivers one hit. A published layout needs enough pods for each rotor. */
export function validateWindLinks(obstacles:Obstacle[]):string[]{
 const windmills=new Map(obstacles.filter(o=>o.kind==='windmill').map(o=>[o.id,o]));
 const pods=obstacles.filter(o=>o.kind==='wind-pod');
 const totals=new Map<string,number>();
 for(const pod of pods){
  if(!pod.link||!windmills.has(pod.link))return ['WIND_LINK'];
  totals.set(pod.link,(totals.get(pod.link)??0)+1);
 }
 if([...windmills.values()].some(windmill=>totals.get(windmill.id)!==windmill.hp))return ['WIND_LINK'];
 return [];
}

export function revealedObstacles(obstacle:Obstacle):Obstacle[]{
 const contents=obstacle.contents;
 if(obstacle.kind!=='supply-crate'||!contents)return [];
 const multi=obstacle.footprint.length>1;
 const {innerCrateHp,kind,hp}=contents;
 return obstacle.footprint.map(anchor=>{
  const id=multi?`${obstacle.id}/${anchor}`:obstacle.id;
  return innerCrateHp===undefined?{id,anchor,footprint:[anchor],kind,hp,maxHp:hp}:
   {id,anchor,footprint:[anchor],kind:'supply-crate',hp:innerCrateHp,maxHp:innerCrateHp,contents:{kind,hp}};
 });
}

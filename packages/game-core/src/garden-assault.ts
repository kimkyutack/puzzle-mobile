import {supportsGardenAssault,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {isAssaultObstacle} from '../../contracts/src/garden-assault';

export function validateAssaultPiece(level:LevelDefinition,o:Obstacle):string[]{
 if(!supportsGardenAssault(level.engineVersion))return ['ASSAULT_ENGINE'];
 if(o.color||o.rule||o.chapter||o.cover||o.seeds||o.endOnly||o.storedRocket||o.siege||o.path||o.link||o.charge!==undefined)return ['ASSAULT_FIELDS'];
 if(o.maxHp>(o.kind==='dandelion-turret'?6:3))return ['ASSAULT_FIELDS'];
 if(o.kind==='pottery-nest'){
  const first=Math.min(...o.footprint),w=level.width;
  if(first%w>=w-1||o.footprint.length!==4||![first,first+1,first+w,first+w+1].every(at=>o.footprint.includes(at)))return ['ASSAULT_FOOTPRINT'];
  if(o.contents?.kind!=='ceramic-pot'||!Number.isInteger(o.contents.hp)||o.contents.hp<1||o.contents.hp>3||o.contents.innerCrateHp!==undefined)return ['ASSAULT_CONTENTS'];
 }else if(o.footprint.length!==1||o.contents)return ['ASSAULT_FIELDS'];
 return [];
}
export function validateAssaultBoard(level:LevelDefinition):string[]{
 if(!supportsGardenAssault(level.engineVersion))return ['ASSAULT_ENGINE'];
 const errors:string[]=[],mode=level.siege?.kind,bank=level.siege?.bank??[];
 const allowed=mode==='dandelion'?['seed-cocoon','dandelion-turret']:mode==='pottery'?['pottery-nest','ceramic-pot']:[];
 if(!allowed.length||level.obstacles.some(o=>!allowed.includes(o.kind)||!isAssaultObstacle(o.kind)))errors.push('ASSAULT_FIELDS');
 const targets=level.obstacles.filter(o=>o.kind==='seed-cocoon');
 const expected=mode==='dandelion'?targets.flatMap(o=>o.footprint):[];
 if(bank.length!==expected.length||new Set(bank).size!==bank.length||expected.some(at=>!bank.includes(at))||bank.some(at=>!level.shape[at]||level.initial?.[at]||level.frost?.[at]||level.exits?.includes(at)))errors.push('ASSAULT_BANK');
 if(mode==='dandelion'&&level.obstacles.filter(o=>o.kind==='dandelion-turret').reduce((n,o)=>n+o.hp,0)!==targets.reduce((n,o)=>n+o.hp,0))errors.push('ASSAULT_AMMUNITION');
 return errors;
}

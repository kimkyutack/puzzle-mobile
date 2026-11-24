import {isCircuitObstacle} from '../../contracts/src/garden-circuit';
import {validateCircuitPiece,validateCircuitBoard} from './garden-circuit';
import {isFrontierObstacle} from '../../contracts/src/garden-frontier';
import {validateFrontierPiece,validateFrontierBoard} from './garden-frontier';
import {isAssaultObstacle} from '../../contracts/src/garden-assault';
import {validateAssaultPiece,validateAssaultBoard} from './garden-assault';
import {supportsGardenSiege,type LevelDefinition,type Obstacle,type GameState} from '@garden/contracts';
import {isSiegeObstacle} from '../../contracts/src/garden-siege';

/** Public powers and ordinary triples share the same visible lock state. */
export function siegeCanHit(o:Obstacle,kind=''):boolean{
 if(o.kind==='boomerang-bell')return kind==='petal-return-impact';
 if(o.frontier?.locked)return false;
 if(o.kind==='seed-cocoon')return kind==='dandelion-seed-impact';
 if(o.kind==='thorn-barricade'&&o.siege?.guard)return kind==='beacon-pulse';
 if(o.kind==='garden-roller')return kind==='roller-release';
 if(o.kind==='garden-beacon')return (o.charge??0)>=(o.siege?.capacity??Infinity);
 return o.kind!=='bloom-bud'||!o.siege?.shielded;
}
/** Target the available release/charge mechanism before spending guided attacks on its remote bank. */
export function siegePriority(s:GameState,o:Obstacle):number{
 if(!s.siege||!s.goals.some(g=>g.remaining>0))return 0;
 return o.kind==='garden-beacon'?3:o.kind==='roller-pin'||o.kind==='dew-cache'||o.kind==='dandelion-turret'||o.kind==='awning-crank'||o.kind==='boomerang-pod'?2:0;
}
export function validateSiegePiece(level:LevelDefinition,o:Obstacle):string[]{
 if(isCircuitObstacle(o.kind))return validateCircuitPiece(level,o);
 if(isFrontierObstacle(o.kind))return validateFrontierPiece(level,o);
 if(isAssaultObstacle(o.kind))return validateAssaultPiece(level,o);
 if(!isSiegeObstacle(o.kind))return o.siege?['SIEGE_FIELDS']:[];
 if(!supportsGardenSiege(level.engineVersion))return ['SIEGE_ENGINE'];
 if(o.color||o.rule||o.chapter||o.contents||o.cover||o.seeds||o.endOnly||o.storedRocket||o.maxHp>3)return ['SIEGE_FIELDS'];
 const big=o.kind==='garden-roller'||o.kind==='garden-beacon';
 const first=Math.min(...o.footprint),w=level.width;
 if(big?o.footprint.length!==4||first%w>=w-1||![first,first+1,first+w,first+w+1].every(at=>o.footprint.includes(at)):o.footprint.length!==1)return ['SIEGE_FOOTPRINT'];
 if(o.kind==='garden-beacon'){
  if(o.siege?.capacity!==4||!Number.isInteger(o.charge)||o.charge!<0||o.charge!>o.siege!.capacity!)return ['SIEGE_CHARGE'];
 }else if(o.charge!==undefined||o.siege?.capacity!==undefined)return ['SIEGE_FIELDS'];
 if(o.kind!=='bloom-bud'&&o.siege?.shielded)return ['SIEGE_FIELDS'];
 if(o.siege?.guard&&(o.kind!=='thorn-barricade'||o.siege.guard!=='beacon'))return ['SIEGE_FIELDS'];
 if(o.kind==='garden-roller'){
  if(!o.path?.length||new Set(o.path).size!==o.path.length||o.path.some(at=>!level.shape[at]||o.footprint.includes(at)))return ['SIEGE_ROLL_PATH'];
 }else if(o.path)return ['SIEGE_FIELDS'];
 if(!['roller-pin','dew-cache','bloom-bud'].includes(o.kind)&&o.link)return ['SIEGE_LINK'];
 return [];
}
export function validateGardenSiege(level:LevelDefinition):string[]{
 const pieces=level.obstacles.filter(o=>isSiegeObstacle(o.kind));
 if(!pieces.length&&!level.siege)return [];
 if(level.siege?.kind==='rail'||level.siege?.kind==='boomerang'||level.siege?.kind==='crystal')return validateCircuitBoard(level);
 if(level.siege?.kind==='shelf'||level.siege?.kind==='shade'||level.siege?.kind==='expedition')return validateFrontierBoard(level);
 if(level.siege?.kind==='dandelion'||level.siege?.kind==='pottery')return validateAssaultBoard(level);
 if(!supportsGardenSiege(level.engineVersion)||!level.siege)return ['SIEGE_ENGINE'];
 const {bank}=level.siege,byId=new Map(level.obstacles.map(o=>[o.id,o]));
 const errors:string[]=[];
 if(!['roller','beacon','bloom'].includes(level.siege.kind)||new Set(bank).size!==bank.length||bank.some(at=>!level.shape[at]||!pieces.some(o=>o.footprint.includes(at))||level.initial?.[at]||level.frost?.[at]||level.exits?.includes(at)))errors.push('SIEGE_BANK');
 const expectedBank=level.siege.kind==='bloom'?[]:pieces.filter(o=>o.kind==='thorn-barricade'||o.kind==='garden-roller'||o.kind==='garden-beacon').flatMap(o=>o.footprint);
 if(expectedBank.length!==bank.length||expectedBank.some(at=>!bank.includes(at)))errors.push('SIEGE_BANK');
 const allowed=level.siege.kind==='roller'?['thorn-barricade','roller-pin','garden-roller']:level.siege.kind==='beacon'?['thorn-barricade','dew-cache','garden-beacon']:['bloom-bud'];
 if(pieces.some(o=>!allowed.includes(o.kind)||level.siege!.kind==='roller'&&o.siege?.guard))errors.push('SIEGE_FIELDS');
 if(level.siege.kind==='roller'&&pieces.some(t=>t.kind==='thorn-barricade'&&!pieces.some(r=>r.kind==='garden-roller'&&r.path?.includes(t.anchor))))errors.push('SIEGE_AMMUNITION');
 if(level.siege.kind==='beacon'&&pieces.some(t=>t.kind==='thorn-barricade'&&(t.siege?.guard!=='beacon'||t.hp>pieces.filter(b=>b.kind==='garden-beacon').length)))errors.push('SIEGE_AMMUNITION');
 for(const o of pieces){
  if(o.kind==='roller-pin'||o.kind==='dew-cache'){
   const host=byId.get(o.link??'');
   if(host?.kind!==(o.kind==='roller-pin'?'garden-roller':'garden-beacon'))errors.push('SIEGE_LINK');
  }
  if(o.kind==='garden-roller'){
   const pins=pieces.filter(p=>p.kind==='roller-pin'&&p.link===o.id);
   if(pins.length!==o.hp||o.path?.some(at=>!pieces.some(t=>t.kind==='thorn-barricade'&&t.anchor===at&&t.hp<=pins.length)))errors.push('SIEGE_AMMUNITION');
  }
  if(o.kind==='garden-beacon'&&pieces.filter(p=>p.kind==='dew-cache'&&p.link===o.id).length+(o.charge??0)!==o.siege?.capacity)errors.push('SIEGE_CHARGE');
  if(o.kind==='bloom-bud'){
   if(o.link&&byId.get(o.link)?.kind!=='bloom-bud')errors.push('SIEGE_LINK');
   const seen=new Set([o.id]);let next=o.link;
   while(next){if(seen.has(next)){errors.push('SIEGE_CYCLE');break;}seen.add(next);next=byId.get(next)?.link;}
   const parents=pieces.filter(p=>p.kind==='bloom-bud'&&p.link===o.id);
   if(parents.length>1||Boolean(o.siege?.shielded)!==Boolean(parents.length))errors.push('SIEGE_BLOOM_ROOT');
  }
 }
 return errors;
}

import {supportsGardenFrontier,type LevelDefinition,type Obstacle,type GameState,type GameEvent} from '@garden/contracts';
import {isFrontierObstacle} from '../../contracts/src/garden-frontier';

export function validateFrontierPiece(level:LevelDefinition,o:Obstacle):string[]{
 if(!isFrontierObstacle(o.kind))return ['FRONTIER_FIELDS'];
 if(!supportsGardenFrontier(level.engineVersion))return ['FRONTIER_ENGINE'];
 if(o.footprint.length!==1||o.maxHp>3||o.color||o.rule||o.chapter||o.cover||o.seeds||o.endOnly||o.storedRocket||o.siege||o.path||o.link||o.charge!==undefined||o.contents)return ['FRONTIER_FIELDS'];
 if((o.kind==='shelf-vase'||o.kind==='canopy-orchid'||o.kind==='awning-crank')!==!!o.frontier?.group)return ['FRONTIER_GROUP'];
 if(o.frontier?.locked&&o.kind!=='canopy-orchid')return ['FRONTIER_FIELDS'];
 return [];
}
export function validateFrontierBoard(level:LevelDefinition):string[]{
 if(!supportsGardenFrontier(level.engineVersion)||!level.frontier||level.frontier.kind!==level.siege?.kind)return ['FRONTIER_ENGINE'];
 const {kind,groups}=level.frontier,errors:string[]=[],occupied=new Set<number>(),ids=new Set<string>();
 const allowed=kind==='shelf'?['shelf-vase']:kind==='shade'?['canopy-orchid','awning-crank']:['journey-vine','journey-relic'];
 if(level.obstacles.some(o=>!allowed.includes(o.kind)||!isFrontierObstacle(o.kind)))errors.push('FRONTIER_FIELDS');
 for(const group of groups){
  const first=Math.min(...group.cells),w=level.width;
  if(ids.has(group.id)||!group.cells.length||group.cells.some(at=>!Number.isInteger(at)||!level.shape[at]||occupied.has(at)))errors.push('FRONTIER_GROUP');
  ids.add(group.id);group.cells.forEach(at=>occupied.add(at));
  if(kind==='shelf'){
   if(group.cells.length!==8||first%w+3>=w||![0,1,2,3,w,w+1,w+2,w+3].every(offset=>group.cells.includes(first+offset))||group.source)errors.push('FRONTIER_GROUP');
  }else if(kind==='shade'){
   if(group.cells.length!==3||first%w+2>=w||![first,first+1,first+2].every(at=>group.cells.includes(at)))errors.push('FRONTIER_GROUP');
   const source=level.obstacles.find(o=>o.id===group.source);
   if(source?.kind!=='awning-crank'||source.frontier?.group!==group.id)errors.push('FRONTIER_SOURCE');
  }
  const target=kind==='shelf'?'shelf-vase':'canopy-orchid';
  if(group.cells.some(at=>!level.obstacles.some(o=>o.kind===target&&o.anchor===at&&o.frontier?.group===group.id&&(kind!=='shade'||o.frontier.locked))))errors.push('FRONTIER_GROUP');
 }
 if(level.obstacles.some(o=>o.frontier?.group&&(!ids.has(o.frontier.group)||(o.kind!=='awning-crank'&&!occupied.has(o.anchor))))||kind==='shade'&&level.obstacles.filter(o=>o.kind==='awning-crank').length!==groups.length)errors.push('FRONTIER_GROUP');
 const bank=level.siege!.bank,expected=kind==='shelf'?[...occupied]:[];
 if(bank.length!==expected.length||new Set(bank).size!==bank.length||expected.some(at=>!bank.includes(at))||bank.some(at=>level.initial?.[at]||level.frost?.[at]||level.exits?.includes(at)))errors.push('FRONTIER_BANK');
 if(kind!=='expedition'&&(!groups.length||level.journey))errors.push('FRONTIER_JOURNEY');
 if(kind==='expedition'){
  const j=level.journey;
  if(groups.length||!j||j.stage!==1&&j.stage!==2||j.stage===1&&(!j.next||j.next.journey?.stage!==2||j.next.journey.next||j.next.engineVersion!==level.engineVersion||j.next.id!==level.id||j.next.frontier?.kind!=='expedition')||j.stage===2&&j.next)errors.push('FRONTIER_JOURNEY');
  if(level.obstacles.some(o=>o.kind!==(j?.stage===1?'journey-vine':'journey-relic')))errors.push('FRONTIER_JOURNEY');
 }
 return errors;
}
/** Group completion releases its entire bank; individual empty slots never spawn hidden tiles. */
export function frontierAfterBreak(s:GameState,o:Obstacle,events:GameEvent[],effectId:number):void{
 const group=s.frontier?.groups.find(g=>g.id===o.frontier?.group);if(!group)return;
 if(o.kind==='shelf-vase'&&!Object.values(s.obstacles).some(p=>p.kind==='shelf-vase'&&p.frontier?.group===group.id)){
  s.siege!.bank=s.siege!.bank.filter(at=>!group.cells.includes(at));
  events.push({type:'mechanic',kind:'shelf-collapse',from:o.anchor,cells:[...group.cells],effectId});
 }
 if(o.kind==='awning-crank'){
  events.push({type:'mechanic',kind:'canopy-open',from:o.anchor,cells:[...group.cells],effectId});
  for(const at of group.cells){const target=s.obstacles[s.cells[at]!.obstacleId??''];if(!target?.frontier)continue;
   delete target.frontier.locked;
   events.push({type:'mechanic',kind:'canopy-unlock',from:o.anchor,cells:[at],obstacleId:target.id,obstacleAfter:structuredClone(target),effectId});
  }
 }
}

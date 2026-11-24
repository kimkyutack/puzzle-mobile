import {supportsGardenCircuit,type LevelDefinition,type GameState,type GameEvent,type Obstacle} from '@garden/contracts';
import {isCircuitObstacle} from '../../contracts/src/garden-circuit';
export function validateCircuitPiece(level:LevelDefinition,o:Obstacle):string[]{
 if(!isCircuitObstacle(o.kind))return ['CIRCUIT_FIELDS'];
 if(!supportsGardenCircuit(level.engineVersion))return ['CIRCUIT_ENGINE'];
 if(o.footprint.length!==1||o.maxHp>(o.kind==='rail-pot'?4:3)||o.color||o.rule||o.chapter||o.cover||o.seeds||o.endOnly||o.storedRocket||o.siege||o.frontier||o.path||o.link||o.charge!==undefined||o.contents)return ['CIRCUIT_FIELDS'];
 if(o.kind==='rail-pot'?(!o.circuit?.track||o.circuit.group):o.circuit?.track)return ['CIRCUIT_TRACK'];
 if(o.kind==='linked-crystal'?!o.circuit?.group:o.circuit?.group)return ['CIRCUIT_GROUP'];
 return [];
}
export function validateCircuitBoard(level:LevelDefinition):string[]{
 if(!supportsGardenCircuit(level.engineVersion)||!level.circuit||level.siege?.kind!==level.circuit.kind)return ['CIRCUIT_ENGINE'];
 const {kind,tracks,groups}=level.circuit,errors:string[]=[],claimed=new Set<number>(),ids=new Set<string>();
 const allowed=kind==='rail'?['rail-pot']:kind==='boomerang'?['boomerang-pod','boomerang-bell']:kind==='crystal'?['linked-crystal']:[];
 if(!allowed.length||level.frontier||level.journey||level.obstacles.some(o=>!allowed.includes(o.kind)))errors.push('CIRCUIT_FIELDS');
 if(kind==='rail'){
  if(!tracks.length||groups.length)errors.push('CIRCUIT_TRACK');
  for(const track of tracks){
   if(ids.has(track.id)||track.cells.length<4||new Set(track.cells).size!==track.cells.length)errors.push('CIRCUIT_TRACK');ids.add(track.id);
   for(const [i,at]of track.cells.entries()){
    const next=track.cells[(i+1)%track.cells.length]!;
    if(!Number.isInteger(at)||!level.shape[at]||claimed.has(at)||Math.abs(at%level.width-next%level.width)+Math.abs(Math.floor(at/level.width)-Math.floor(next/level.width))!==1||!level.obstacles.some(o=>o.anchor===at&&o.circuit?.track===track.id))errors.push('CIRCUIT_TRACK');claimed.add(at);
   }
  }
  if(level.obstacles.some(o=>!ids.has(o.circuit?.track??'')||!claimed.has(o.anchor)))errors.push('CIRCUIT_TRACK');
 }else if(kind==='crystal'){
  if(tracks.length||!groups.length)errors.push('CIRCUIT_GROUP');
  for(const group of groups){
   if(ids.has(group.id)||group.cells.length<2||group.cells.length>6||new Set(group.cells).size!==group.cells.length)errors.push('CIRCUIT_GROUP');ids.add(group.id);
   const reached=new Set<number>(),todo=[group.cells[0]!];while(todo.length){const at=todo.pop()!;if(reached.has(at))continue;reached.add(at);for(const to of group.cells)if(!reached.has(to)&&Math.abs(to%level.width-at%level.width)+Math.abs(Math.floor(to/level.width)-Math.floor(at/level.width))===1)todo.push(to);}
   if(reached.size!==group.cells.length)errors.push('CIRCUIT_GROUP');
   for(const at of group.cells){if(!Number.isInteger(at)||!level.shape[at]||claimed.has(at)||!level.obstacles.some(o=>o.anchor===at&&o.circuit?.group===group.id))errors.push('CIRCUIT_GROUP');claimed.add(at);}
  }
  if(level.obstacles.some(o=>!ids.has(o.circuit?.group??'')||!claimed.has(o.anchor)))errors.push('CIRCUIT_GROUP');
 }else if(tracks.length||groups.length)errors.push('CIRCUIT_FIELDS');
 const expected=kind==='rail'?[...claimed]:kind==='boomerang'?level.obstacles.filter(o=>o.kind==='boomerang-bell').map(o=>o.anchor):[],bank=level.siege!.bank;
 if(bank.length!==expected.length||new Set(bank).size!==bank.length||expected.some(at=>!bank.includes(at))||bank.some(at=>level.initial?.[at]||level.frost?.[at]||level.exits?.includes(at)))errors.push('CIRCUIT_BANK');
 if(kind==='boomerang'&&(!level.obstacles.some(o=>o.kind==='boomerang-bell')||!level.obstacles.some(o=>o.kind==='boomerang-pod')||level.obstacles.filter(o=>o.kind==='boomerang-pod').length*3!==level.obstacles.filter(o=>o.kind==='boomerang-bell').reduce((n,o)=>n+o.hp,0)))errors.push('CIRCUIT_AMMUNITION');
 return errors;
}
export function releaseRail(s:GameState,o:Obstacle,events:GameEvent[],effectId:number):void{
 if(o.kind!=='rail-pot'||!o.circuit?.track)return;
 const track=s.circuit?.tracks.find(t=>t.id===o.circuit!.track);
 if(track&&!Object.values(s.obstacles).some(p=>p.kind==='rail-pot'&&p.circuit?.track===track.id)){
  s.siege!.bank=s.siege!.bank.filter(at=>!track.cells.includes(at));events.push({type:'mechanic',kind:'rail-clear',from:o.anchor,cells:[...track.cells],effectId});
 }
}
/** Only obstacle carriers move. Ordinary tiles are never shifted by this rail. */
export function advanceObstacleRails(s:GameState,events:GameEvent[]):void{
 if(s.circuit?.kind!=='rail')return;
 for(const track of s.circuit.tracks){
  const pieces=Object.values(s.obstacles).filter(o=>o.kind==='rail-pot'&&o.circuit?.track===track.id);
  for(const piece of pieces)delete s.cells[piece.anchor]!.obstacleId;
  for(const piece of pieces){const from=piece.anchor,to=track.cells[(track.cells.indexOf(from)+1)%track.cells.length]!;piece.anchor=to;piece.footprint=[to];s.cells[to]!.obstacleId=piece.id;
   events.push({type:'mechanic',kind:'rail-move',from,to,cells:[to],obstacleId:piece.id,obstacleAfter:structuredClone(piece)});
  }
 }
}

import {supportsChapterObstacles,type Action,type Color,type GameEvent,type GameState,type LevelDefinition,type Obstacle,type Special} from '@garden/contracts';
import {CHAPTER_OBSTACLES} from '../../contracts/src/chapter-obstacles';

export interface ChapterImpact {
 kind:string;
 cells:number[];
 color?:Color;
 matchPower?:Special;
 cascadeMatch?:true;
}

export interface ChapterTurn {
 fusion?:true;
 colors?:Map<string,Set<Color>>;
}

export function validateChapterObstacle(level:LevelDefinition,obstacle:Obstacle):string[]{
 const rule=obstacle.chapter!;
 if(!supportsChapterObstacles(level.engineVersion))return ['CHAPTER_OBSTACLE_ENGINE'];
 if(level.gardenStage||obstacle.rule||obstacle.cover||obstacle.contents||obstacle.footprint.length!==1||
  !['urn','flower-seal','starlight-lantern'].includes(obstacle.kind)||!CHAPTER_OBSTACLES.includes(rule.kind))return ['CHAPTER_OBSTACLE'];
 if(rule.kind==='axis'&&!['row','column'].includes(rule.axis)||rule.kind==='slide'&&!['left','right'].includes(rule.side))return ['CHAPTER_OBSTACLE'];
 if((rule.kind==='window'||rule.kind==='cooldown')&&(rule.turn!==undefined||obstacle.hp!==2))return ['CHAPTER_OBSTACLE'];
 return [];
}

export function adjacentChapterCells(board:Pick<GameState,'cells'|'width'>,at:number,diagonal=false):number[]{
 const x=at%board.width,y=Math.floor(at/board.width);
 const offsets=diagonal?[[-1,-1],[1,-1],[-1,1],[1,1]]:[[0,-1],[-1,0],[1,0],[0,1]];
 return offsets.flatMap(([dx,dy])=>{
  const column=x+dx!,cell=(y+dy!)*board.width+column;
  return column>=0&&column<board.width&&board.cells[cell]?.exists?[cell]:[];
 });
}

export function chapterGuarded(state:GameState,obstacle:Obstacle):boolean{
 const rule=obstacle.chapter;
 if(rule?.kind==='guard')return adjacentChapterCells(state,obstacle.anchor).some(at=>state.obstacles[state.cells[at]!.obstacleId??'']?.kind==='crate');
 if(rule?.kind==='thaw')return adjacentChapterCells(state,obstacle.anchor).some(at=>state.cells[at]!.frost>0);
 return rule?.kind==='cooldown'&&rule.turn===state.turn;
}

export function chapterCanTarget(state:GameState,obstacle:Obstacle,fusion=false):boolean{
 const kind=obstacle.chapter?.kind;
 if(kind==='fusion')return fusion;
 return kind!=='guard'&&kind!=='thaw'||!chapterGuarded(state,obstacle);
}

function containsRun(cells:number[],width:number,axis:'row'|'column'):boolean{
 const step=axis==='row'?1:width;
 return cells.some(at=>(axis==='column'||at%width<=width-3)&&cells.includes(at+step)&&cells.includes(at+step*2));
}

export function chapterCanTakeHit(state:GameState,obstacle:Obstacle,impact:ChapterImpact,turn:ChapterTurn):boolean{
 if(chapterGuarded(state,obstacle))return false;
 const rule=obstacle.chapter!;
 if(rule.kind==='fusion'){
  return impact.kind!=='match'&&(turn.fusion===true||impact.kind==='world-bomb'||impact.kind==='cross-firework');
 }
 if(impact.kind!=='match')return true;
 switch(rule.kind){
  case 'long-match': return impact.cells.length>=4;
  case 'cascade': return impact.cascadeMatch===true;
  case 'axis': return containsRun(impact.cells,state.width,rule.axis);
  case 'diagonal': return adjacentChapterCells(state,obstacle.anchor,true).some(at=>impact.cells.includes(at));
  case 'junction': return impact.matchPower==='bomb';
  case 'landing':
  case 'swap': return false;
  case 'two-colors': {
   if(!impact.color)return false;
   const seen=turn.colors??=new Map();
   let colors=seen.get(obstacle.id);
   if(!colors){colors=new Set();seen.set(obstacle.id,colors);}
   const newColor=!colors.has(impact.color);
   colors.add(impact.color);
   return newColor&&colors.size===2;
  }
  default: return true;
 }
}

export function chapterAfterHit(state:GameState,obstacle:Obstacle,events:GameEvent[],protectedCells:Set<number>):void{
 const rule=obstacle.chapter!;
 if(rule.kind==='axis')rule.axis=rule.axis==='row'?'column':'row';
 if(rule.kind==='cooldown')rule.turn=state.turn;
 if(rule.kind==='window')rule.turn=state.turn+2;
 if(rule.kind!=='slide')return;
 const from=obstacle.anchor,candidates=adjacentChapterCells(state,from).filter(at=>Math.floor(at/state.width)===Math.floor(from/state.width));
 if(rule.side==='right')candidates.reverse();
 const to=candidates.find(at=>{
  const cell=state.cells[at]!;
  return !protectedCells.has(at)&&!cell.obstacleId&&!cell.exit&&!cell.frost&&(!cell.tile||cell.tile.kind==='normal');
 });
 if(to===undefined)return;
 const previous=state.cells[from]!,destination=state.cells[to]!;
 previous.tile=destination.tile;
 destination.tile=null;
 delete previous.obstacleId;
 destination.obstacleId=obstacle.id;
 obstacle.anchor=to;
 obstacle.footprint=[to];
 if(previous.tile)events.push({type:'fall',cells:[from],from:to,to:from});
}

export function advanceChapterWindows(state:GameState,events:GameEvent[]):void{
 for(const obstacle of Object.values(state.obstacles)){
  const rule=obstacle.chapter;
  if(rule?.kind!=='window'||rule.turn===undefined||state.turn<=rule.turn)continue;
  delete rule.turn;
  obstacle.hp=obstacle.maxHp;
  events.push({type:'mechanic',kind:'chapter-reseal',cells:[obstacle.anchor],obstacleId:obstacle.id,obstacleAfter:structuredClone(obstacle)});
 }
}

export function chapterMoveTargets(state:GameState,action:Action,events:readonly GameEvent[]):Obstacle[]{
 const landed=new Set(events.flatMap(event=>event.type==='fall'&&event.to!==undefined&&event.from!==undefined&&event.from+state.width<=event.to?[event.to]:[]));
 const swapped=action.type==='swap'?[action.from,action.to]:[];
 return Object.values(state.obstacles).filter(obstacle=>{
  if(obstacle.chapter?.kind==='landing')return landed.has(obstacle.anchor-state.width);
  return obstacle.chapter?.kind==='swap'&&adjacentChapterCells(state,obstacle.anchor).some(at=>swapped.includes(at));
 });
}

export function chapterBreakReaction(state:GameState,obstacle:Obstacle,color:Color|undefined):
 {kind:'chapter-relay'|'chapter-color-wave';cells:number[];targetId?:string}|undefined{
 const rule=obstacle.chapter!.kind;
 if(rule==='relay'){
  const at=obstacle.anchor;
  const distance=(cell:number)=>Math.abs(cell%state.width-at%state.width)+Math.abs(Math.floor(cell/state.width)-Math.floor(at/state.width));
  const target=Object.values(state.obstacles).filter(piece=>piece.chapter?.kind==='relay'&&distance(piece.anchor)<=3)
   .sort((a,b)=>distance(a.anchor)-distance(b.anchor)||a.anchor-b.anchor)[0];
  if(target)return {kind:'chapter-relay',cells:[target.anchor],targetId:target.id};
 }
 if(rule==='color-wave'){
  const selected=color??'sprout';
  const cells=state.cells.flatMap(({tile},at)=>tile?.kind==='normal'&&tile.color===selected?[at]:[]);
  if(cells.length)return {kind:'chapter-color-wave',cells};
 }
}

export function applyChapterCompost(state:GameState,from:number,color:Color|undefined,events:GameEvent[],protectedCells:Set<number>):void{
 const cells=adjacentChapterCells(state,from);
 const selected=color??'sprout';
 const changed:number[]=[];
 for(const at of cells){
  const tile=state.cells[at]!.tile;
  if(protectedCells.has(at)||tile?.kind!=='normal'||tile.color===selected)continue;
  tile.color=selected;
  changed.push(at);
 }
 if(changed.length)events.push({type:'mechanic',kind:'chapter-compost',cells:changed,from});
}

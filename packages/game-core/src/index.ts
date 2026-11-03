import { COLORS, ENGINE_VERSION, LEGACY_ENGINE_VERSION, supportsEngine, type Action, type ActionResult, type Color, type GameEvent, type GameState, type Goal, type LevelDefinition, type PreBooster, type Special, type Tile } from '@garden/contracts';
import {perimeterCells} from './perimeter';
export {perimeterCells} from './perimeter';

export const MAX_CASCADES = 128;
const MAX_EFFECTS = 2048;
const specialKinds: readonly string[] = ['wind-row','wind-column','bomb','glider','rainbow'];
export const isSpecial = (tile: Tile | null | undefined): tile is Tile & {kind: Special} => !!tile && specialKinds.includes(tile.kind);
const copy = <T>(value:T):T => structuredClone(value);
const ascending = (a:number,b:number) => a-b;
const unique = (cells:number[]) => [...new Set(cells)].sort(ascending);
const valid = (s:GameState, at:number):boolean => Number.isInteger(at) && at>=0 && at<s.cells.length && s.cells[at]!.exists;
const neighbors = (s:GameState,at:number):number[] => [at-s.width,at-1,at+1,at+s.width].filter(i=>valid(s,i) && Math.abs(i%s.width-at%s.width)+Math.abs(Math.floor(i/s.width)-Math.floor(at/s.width))===1).sort(ascending);
const obstacleAt = (s:GameState,i:number) => s.cells[i]?.obstacleId ? s.obstacles[s.cells[i]!.obstacleId!] : undefined;
const blocked = (s:GameState,i:number) => {const o=obstacleAt(s,i);return !!o && o.kind!=='vine';};
const movable = (s:GameState,i:number) => valid(s,i) && !!s.cells[i]!.tile && !obstacleAt(s,i);
function next(s:GameState):number {let x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng;}
function tile(s:GameState):Tile {return {id:s.nextTileId++,kind:'normal',color:s.colors[next(s)%s.colors.length]!};}
const colorAt = (s:GameState,i:number):Color|undefined => {const t=s.cells[i]?.tile;return valid(s,i)&&!blocked(s,i)&&t?.kind==='normal'?t.color:undefined;};
function goal(s:GameState,kind:Goal['kind'],amount=1):void {for(const g of s.goals)if(g.kind===kind)g.remaining=Math.max(0,g.remaining-amount);}
function lanesFor(level:LevelDefinition):number[][] {
 if(level.gravity)return copy(level.gravity);
 const lanes:number[][]=[];
 for(let x=0;x<level.width;x++){let lane:number[]=[];for(let y=0;y<level.height;y++){const i=y*level.width+x;if(level.shape[i])lane.push(i);else if(lane.length){lanes.push(lane);lane=[];}}if(lane.length)lanes.push(lane);}
 return lanes;
}
export function validateLevel(level:LevelDefinition):string[] {
 const errors:string[]=[]; const n=level.width*level.height;
 if(!supportsEngine(level.engineVersion))errors.push('ENGINE_VERSION');
 if(!Number.isInteger(level.width)||!Number.isInteger(level.height)||level.width<3||level.width>9||level.height<3||level.height>10||level.shape.length!==n)errors.push('BOARD_SHAPE');
 if(level.colors.length<3||level.colors.length>6||new Set(level.colors).size!==level.colors.length||level.colors.some(c=>!COLORS.includes(c)))errors.push('COLORS');
 if(!Number.isInteger(level.moves)||level.moves<1||level.moves>100)errors.push('MOVES');
 if(!Number.isSafeInteger(level.seed)||level.seed<=0)errors.push('SEED');
 if(level.initial&&level.initial.length!==n)errors.push('INITIAL_LENGTH');
 if(level.initial){const ids=new Set<number>();for(const [i,t] of level.initial.entries()){if(!t)continue;if(!level.shape[i]||!Number.isSafeInteger(t.id)||t.id<1||ids.has(t.id))errors.push('INITIAL_TILE');ids.add(t.id);if(t.kind==='normal'&&!level.colors.includes(t.color))errors.push('INITIAL_COLOR');if(t.kind!=='normal'&&t.kind!=='seed'&&!specialKinds.includes(t.kind))errors.push('INITIAL_KIND');}}
 for(const [i,layers] of Object.entries(level.frost??{}))if(!level.shape[Number(i)]||!Number.isInteger(layers)||layers<1)errors.push('FROST_LAYER');
 if(new Set(level.obstacles.map(o=>o.id)).size!==level.obstacles.length)errors.push('OBSTACLE_ID');
 const occupied=new Set<number>();
 for(const o of level.obstacles){if(!Number.isInteger(o.hp)||!Number.isInteger(o.maxHp)||o.hp<1||o.hp>o.maxHp||!o.footprint.includes(o.anchor))errors.push('OBSTACLE_HP');for(const i of o.footprint){if(!level.shape[i]||occupied.has(i))errors.push('OBSTACLE_FOOTPRINT');occupied.add(i);}}
 const lanes=lanesFor(level),seen=new Set<number>();
 for(const lane of lanes){if(!lane.length)errors.push('EMPTY_GRAVITY');if(level.inlets&&!level.inlets.includes(lane[0]!))errors.push('MISSING_INLET');for(const i of lane){if(!Number.isInteger(i)||!level.shape[i]||seen.has(i))errors.push('GRAVITY_GRAPH');seen.add(i);}}
 if(seen.size!==level.shape.filter(Boolean).length)errors.push('GRAVITY_COVERAGE');
 for(const i of level.exits??[])if(!level.shape[i]||!lanes.some(l=>l[l.length-1]===i))errors.push('EXIT_UNREACHABLE');
 if(!level.goals.length||new Set(level.goals.map(g=>g.kind)).size!==level.goals.length||level.goals.some(g=>!Number.isInteger(g.count)||g.count<=0||g.remaining!==g.count))errors.push('GOALS');
 for(const g of level.goals){if(COLORS.includes(g.kind as Color)){if(!level.colors.includes(g.kind as Color))errors.push('GOAL_COLOR');continue;}if(g.kind==='combo'||g.kind==='special')continue;else if(g.kind==='frost'){if(g.count!==Object.values(level.frost??{}).reduce((a,b)=>a+b,0))errors.push('GOAL_FROST');}else if(g.kind==='seed'){const seeds=(level.initial??[]).filter(t=>t?.kind==='seed').length+level.obstacles.reduce((a,o)=>a+(o.seeds??0),0);if(g.count!==seeds||!level.exits?.length)errors.push('GOAL_SEED');}else if(g.count!==level.obstacles.filter(o=>o.kind===g.kind).length)errors.push('GOAL_OBSTACLE');}
 return uniqueStrings(errors);
}
const uniqueStrings=(xs:string[])=>[...new Set(xs)];
export interface Match {cells:number[];kind?:Special;anchor:number;color:Color}
interface Pattern {cells:number[];kind?:Special;priority:number;color:Color}
/** Stable row-major pattern union. Intersecting patterns of the same color form one match group. */
export function findMatches(s:GameState,preferred:number[]=[]):Match[] {
 const patterns:Pattern[]=[];
 for(let y=0;y<s.height;y++)for(let x=0;x<s.width;){const start=y*s.width+x,c=colorAt(s,start);let end=x+1;while(c&&end<s.width&&colorAt(s,y*s.width+end)===c)end++;const length=end-x;if(c&&length>=3)patterns.push({cells:Array.from({length},(_,k)=>start+k),kind:length>=5?'rainbow':length===4?'wind-row':undefined,priority:length>=5?4:length===4?1:0,color:c});x=end;}
 for(let x=0;x<s.width;x++)for(let y=0;y<s.height;){const start=y*s.width+x,c=colorAt(s,start);let end=y+1;while(c&&end<s.height&&colorAt(s,end*s.width+x)===c)end++;const length=end-y;if(c&&length>=3)patterns.push({cells:Array.from({length},(_,k)=>start+k*s.width),kind:length>=5?'rainbow':length===4?'wind-column':undefined,priority:length>=5?4:length===4?1:0,color:c});y=end;}
 for(let y=0;y<s.height-1;y++)for(let x=0;x<s.width-1;x++){const i=y*s.width+x,c=colorAt(s,i),cells=[i,i+1,i+s.width,i+s.width+1];if(c&&cells.every(j=>colorAt(s,j)===c))patterns.push({cells,kind:'glider',priority:2,color:c});}
 const groups:Pattern[][]=[];
 for(const p of patterns){const touching=groups.filter(g=>g.some(q=>q.color===p.color&&q.cells.some(i=>p.cells.includes(i))));if(!touching.length)groups.push([p]);else{const target=touching[0]!;target.push(p);for(const other of touching.slice(1)){target.push(...other);groups.splice(groups.indexOf(other),1);}}}
 return groups.map(group=>{const cells=unique(group.flatMap(p=>p.cells));let best=[...group].sort((a,b)=>b.priority-a.priority||a.cells[0]!-b.cells[0]!)[0]!;
  // L/T is an intersecting horizontal/vertical run, not arbitrary connected triples.
  const runs=group.filter(p=>p.priority!==2);const cross=runs.some(a=>runs.some(b=>a!==b&&a.cells.some(i=>b.cells.includes(i))&&((a.cells[1]!-a.cells[0]!)===1)!==((b.cells[1]!-b.cells[0]!)===1)));
  if(cross&&cells.length>=5&&best.priority<4)best={...best,kind:'bomb',priority:3};
  const anchor=preferred.find(i=>cells.includes(i))??cells[0]!;return {cells,kind:best.kind,anchor,color:best.color};
 }).sort((a,b)=>a.cells[0]!-b.cells[0]!);
}

export function createGame(level:LevelDefinition,preBoosters:PreBooster[]=[]):GameState {
 const errors=validateLevel(level);if(errors.length)throw new Error(`INVALID_LEVEL:${errors.join(',')}`);
 if(new Set(preBoosters).size!==preBoosters.length||preBoosters.some(b=>!['wind-row','bomb','rainbow'].includes(b)))throw new Error('INVALID_PREBOOSTERS');
 const s:GameState={engineVersion:level.engineVersion,levelId:level.id,width:level.width,height:level.height,cells:level.shape.map((exists,i)=>({exists,tile:null,frost:level.frost?.[i]??0,...(level.exits?.includes(i)?{exit:true}:{})})),obstacles:Object.fromEntries(level.obstacles.map(o=>[o.id,copy(o)])),goals:copy(level.goals),moves:level.moves,turn:0,rng:level.seed>>>0,nextTileId:1,effectSequence:0,status:'playing',colors:[...level.colors],gravity:lanesFor(level)};
 for(const o of Object.values(s.obstacles))for(const i of o.footprint)s.cells[i]!.obstacleId=o.id;
 if(level.initial){s.cells.forEach((c,i)=>{if(c.exists&&!blocked(s,i))c.tile=copy(level.initial![i]??null);});s.nextTileId=1+Math.max(0,...s.cells.map(c=>c.tile?.id??0));}
 else for(let i=0;i<s.cells.length;i++){if(!s.cells[i]!.exists||blocked(s,i))continue;let choices=[...s.colors];while(choices.length){const at=next(s)%choices.length,color=choices.splice(at,1)[0]!;s.cells[i]!.tile={id:s.nextTileId,kind:'normal',color};if(!findMatches(s).length)break;}s.nextTileId++;}
 if(findMatches(s).length)throw new Error('INITIAL_AUTO_MATCH');
 if(!legalActions(s).length&&!reshuffle(s,[]))throw new Error('INITIAL_DEADLOCK');
 const eligible=s.cells.flatMap((c,i)=>c.exists&&c.tile?.kind==='normal'&&!c.obstacleId&&!c.frost&&!c.exit&&!level.protectedCells?.includes(i)&&!s.goals.some(g=>g.kind===c.tile?.kind||(c.tile?.kind==='normal'&&g.kind===c.tile.color))?[i]:[]);
 if(eligible.length<preBoosters.length)throw new Error('PREBOOSTER_PLACEMENT_UNAVAILABLE');
 // First available row-major cells. No random draw, fixed tutorial/target/floor cells protected.
 preBoosters.forEach((b,k)=>{const at=eligible[k]!;s.cells[at]!.tile={id:s.nextTileId++,kind:b};});
 return s;
}

function mostColor(s:GameState):Color {return [...s.colors].sort((a,b)=>s.cells.filter(c=>c.tile?.kind==='normal'&&c.tile.color===b).length-s.cells.filter(c=>c.tile?.kind==='normal'&&c.tile.color===a).length||COLORS.indexOf(a)-COLORS.indexOf(b))[0]!;}
function area(s:GameState,at:number,radius:number):number[]{const x=at%s.width,y=Math.floor(at/s.width);return s.cells.flatMap((c,i)=>c.exists&&Math.abs(i%s.width-x)<=radius&&Math.abs(Math.floor(i/s.width)-y)<=radius?[i]:[]);}
function line(s:GameState,at:number,row:boolean,span=0):number[]{const axis=row?Math.floor(at/s.width):at%s.width;return s.cells.flatMap((c,i)=>c.exists&&Math.abs((row?Math.floor(i/s.width):i%s.width)-axis)<=span?[i]:[]);}
export function targetCells(s:GameState,excluded:Set<number>=new Set()):number[]{
 const active=new Set(s.goals.filter(g=>g.remaining>0).map(g=>g.kind));
 const score=(i:number)=>{const c=s.cells[i]!,o=obstacleAt(s,i),t=c.tile;if(t?.kind==='seed'||(o&&(o.kind==='pot'||(o.kind==='cabinet'&&o.color))))return -1;if(o&&active.has(o.kind))return 500+o.hp;if(c.frost&&t&&active.has('frost'))return 400+c.frost;if(t?.kind==='normal'&&active.has(t.color))return 300;if(o)return 200;if(isSpecial(t))return 100;return t?50:0;};
 return s.cells.flatMap((c,i)=>c.exists&&!excluded.has(i)&&score(i)>0?[i]:[]).sort((a,b)=>score(b)-score(a)||a-b);
}
interface Effect {id:number;cells:number[];kind:string;color?:Color;adjacent?:boolean;allowPot?:boolean}
interface Context {s:GameState;events:GameEvent[];queue:Effect[];protected:Set<number>;triggered:Set<number>;mossHit:boolean;effects:number}
function enqueue(ctx:Context,cells:number[],kind:string,color?:Color,adjacent=false,allowPot=false):void {ctx.queue.push({id:++ctx.s.effectSequence,cells:unique(cells.filter(i=>valid(ctx.s,i))),kind,color,adjacent,allowPot});}
function activate(ctx:Context,at:number,kind:Special,color?:Color):void {
 const s=ctx.s;goal(s,'special');ctx.events.push({type:'special',cells:[at],kind});
 if(kind==='wind-row'||kind==='wind-column')enqueue(ctx,line(s,at,kind==='wind-row'),kind);
 else if(kind==='bomb')enqueue(ctx,area(s,at,2),kind);
 else if(kind==='glider'){const origin=unique([at,...neighbors(s,at)]),target=targetCells(s,new Set(origin))[0]??targetCells(s)[0]??at;enqueue(ctx,origin,kind);ctx.events.push({type:'special',kind:'glider-flight',cells:[at,target],from:at,to:target});enqueue(ctx,[target],'glider-impact');}
 else {const chosen=color??mostColor(s);enqueue(ctx,s.cells.flatMap((c,i)=>c.tile?.kind==='normal'&&c.tile.color===chosen?[i]:[]),'rainbow',chosen);}
}
function combine(ctx:Context,at:number,a:Special,b:Special,other:number):void {
 const s=ctx.s;goal(s,'combo');goal(s,'special');ctx.events.push({type:'special',cells:[other,at],kind:`${a}+${b}`});
 // Consumed combination components never trigger a second independent effect.
 for(const i of [at,other]){const t=s.cells[i]!.tile;if(t){ctx.triggered.add(t.id);s.cells[i]!.tile=null;ctx.events.push({type:'remove',cells:[i],kind:t.kind});if(s.cells[i]!.frost){s.cells[i]!.frost--;goal(s,'frost');}}}
 const wind=(k:Special)=>k==='wind-row'||k==='wind-column';
 if(a==='rainbow'&&b==='rainbow'){enqueue(ctx,s.cells.flatMap((c,i)=>c.exists?[i]:[]),'rainbow+rainbow',undefined,false,true);return;}
 if(a==='rainbow'||b==='rainbow'){
  const replacement=a==='rainbow'?b:a,chosen=mostColor(s),targets=s.cells.flatMap((c,i)=>c.tile?.kind==='normal'&&c.tile.color===chosen&&!blocked(s,i)?[i]:[]);
  for(const i of targets){goal(s,chosen);s.cells[i]!.tile={id:s.nextTileId++,kind:replacement};}
  enqueue(ctx,targets,`rainbow+${replacement}`);return;
 }
 if(a==='glider'&&b==='glider'){
  enqueue(ctx,unique([at,...neighbors(s,at)]),'glider-launch');const selected=new Set<number>();for(let k=0;k<3;k++){const target=targetCells(s,selected)[0]??targetCells(s)[0]??at;selected.add(target);ctx.events.push({type:'special',kind:'glider-flight',cells:[at,target],from:at,to:target});enqueue(ctx,[target],'glider-impact');}return;
 }
 if(a==='glider'||b==='glider'){const payload=a==='glider'?b:a,target=targetCells(s,new Set([at,other]))[0]??at;enqueue(ctx,[at,...neighbors(s,at)],'glider-launch');ctx.events.push({type:'special',kind:'glider-flight',cells:[at,target],from:at,to:target});activate(ctx,target,payload);return;}
 if(wind(a)&&wind(b))enqueue(ctx,[...line(s,at,true),...line(s,at,false)],'wind+wind');
 else if(a==='bomb'&&b==='bomb')enqueue(ctx,area(s,at,4),'bomb+bomb');
 else enqueue(ctx,[...line(s,at,true,1),...line(s,at,false,1)],'wind+bomb');
}
function damageObstacle(ctx:Context,id:string,effect:Effect,touched:Set<string>):boolean {
 const s=ctx.s,o=s.obstacles[id];if(!o||touched.has(id))return false;
 if(o.kind==='pot'&&!effect.allowPot&&effect.color!==o.color)return false;
 if(o.kind==='cabinet'&&o.color&&!effect.allowPot&&effect.color!==o.color)return false;
 touched.add(id);o.hp--;if(o.kind==='moss')ctx.mossHit=true;
 ctx.events.push({type:'hit',cells:[...o.footprint],kind:o.kind,effectId:effect.id});
 if(o.hp<=0){goal(s,o.kind);for(const i of o.footprint)delete s.cells[i]!.obstacleId;delete s.obstacles[id];
  if(o.kind==='cabinet'&&(o.seeds??0)>0){const positions=unique([...o.footprint,...o.footprint.flatMap(i=>neighbors(s,i))]).filter(i=>!blocked(s,i));const count=o.seeds??0;if(positions.length<count)throw new Error('SEED_EMISSION_BLOCKED');for(const i of positions.slice(0,count)){s.cells[i]!.tile={id:s.nextTileId++,kind:'seed'};ctx.events.push({type:'spawn',cells:[i],kind:'seed'});}}
 }
 return true;
}
function processEffects(ctx:Context):void {
 const s=ctx.s;
 while(ctx.queue.length){if(++ctx.effects>MAX_EFFECTS)throw new Error('EFFECT_LIMIT');const effect=ctx.queue.shift()!,touched=new Set<string>();
  // Snapshot obstacle membership so one destroyed multi-cell instance cannot expose a second hit in this effect.
  const obstacleIds=new Map(effect.cells.map(i=>[i,s.cells[i]!.obstacleId]));
  const adjacentIds=effect.adjacent?uniqueStrings(effect.cells.flatMap(i=>neighbors(s,i).map(j=>s.cells[j]!.obstacleId).filter((id):id is string=>!!id))):[];
  for(const i of effect.cells){if(ctx.protected.has(i))continue;const cell=s.cells[i]!,oldId=obstacleIds.get(i),oldObstacle=oldId?s.obstacles[oldId]:undefined;
   if(oldId){const existed=!!oldObstacle;damageObstacle(ctx,oldId,effect,touched);if(existed||touched.has(oldId))continue;}
   const t=cell.tile;if(!t||t.kind==='seed'||(effect.kind==='rainbow+rainbow'&&t.kind!=='normal'))continue;
   if(isSpecial(t)&&!ctx.triggered.has(t.id)){ctx.triggered.add(t.id);cell.tile=null;ctx.events.push({type:'remove',cells:[i],kind:t.kind,effectId:effect.id});activate(ctx,i,t.kind);}
   else if(t.kind==='normal'){cell.tile=null;goal(s,t.color);ctx.events.push({type:'remove',cells:[i],kind:t.color,effectId:effect.id});}
   if(cell.frost){cell.frost--;goal(s,'frost');ctx.events.push({type:'hit',cells:[i],kind:'frost',effectId:effect.id});}
  }
  for(const id of adjacentIds){const o=s.obstacles[id];if(o&&(o.kind==='crate'||o.kind==='pot'||o.kind==='cabinet'||o.kind==='moss'))damageObstacle(ctx,id,effect,touched);}
  // Pots collect a color charge from each matching-color natural match anywhere on the board.
  if(effect.kind==='match')for(const o of Object.values(s.obstacles).sort((a,b)=>a.anchor-b.anchor))if(o.kind==='pot'&&o.color===effect.color)damageObstacle(ctx,o.id,effect,touched);
 }
}
function resolveMatches(ctx:Context,matches:Match[]):void {
 const s=ctx.s;ctx.protected=new Set(matches.filter(m=>m.kind&&!obstacleAt(s,m.anchor)).map(m=>m.anchor));
 // Every group is one effect. Creation cells are immune to all removals in this whole match phase.
 for(const m of matches)enqueue(ctx,m.cells,'match',m.color,true);
 processEffects(ctx);
 for(const m of matches)if(m.kind&&ctx.protected.has(m.anchor)){const old=s.cells[m.anchor]!.tile;if(old?.kind==='normal')goal(s,old.color);s.cells[m.anchor]!.tile={id:s.nextTileId++,kind:m.kind};if(s.cells[m.anchor]!.frost){s.cells[m.anchor]!.frost--;goal(s,'frost');}ctx.events.push({type:'spawn',cells:[m.anchor],kind:m.kind});}
 ctx.protected.clear();
}
function gravity(ctx:Context):void {
 const s=ctx.s;
 // Paths are explicit top-to-bottom DAG lanes. Every lane head is a declared supply inlet.
 for(const lane of s.gravity){let segment:number[]=[];let refill=true;
  const settle=()=>{if(!segment.length)return;let again=true,round=0;while(again){if(++round>lane.length+2)throw new Error('GRAVITY_LIMIT');again=false;const present=segment.flatMap(i=>s.cells[i]!.tile?[{tile:s.cells[i]!.tile!,from:i}]:[]);for(const i of segment)s.cells[i]!.tile=null;for(let k=present.length-1,at=segment.length-1;k>=0;k--,at--){const p=present[k]!,dest=segment[at]!;s.cells[dest]!.tile=p.tile;if(dest!==p.from)ctx.events.push({type:'fall',cells:[dest],from:p.from,to:dest});}
    for(const i of segment){if(s.cells[i]!.exit&&s.cells[i]!.tile?.kind==='seed'){s.cells[i]!.tile=null;goal(s,'seed');ctx.events.push({type:'remove',cells:[i],kind:'seed'});again=true;}}
   }
   if(refill)for(const i of segment)if(!s.cells[i]!.tile){s.cells[i]!.tile=tile(s);ctx.events.push({type:'spawn',cells:[i],kind:'normal'});}segment=[];
  };
  for(const i of lane){if(obstacleAt(s,i)){settle();refill=false;}else segment.push(i);}settle();
 }
}
function cascades(ctx:Context,initial?:Match[]):void {
 let matches=initial??[];for(let round=0;round<MAX_CASCADES;round++){if(matches.length)resolveMatches(ctx,matches);else processEffects(ctx);gravity(ctx);matches=findMatches(ctx.s);if(!matches.length)return;}throw new Error('CASCADE_LIMIT');
}
function growMoss(ctx:Context):void {
 if(ctx.mossHit)return;const s=ctx.s,moss=Object.values(s.obstacles).filter(o=>o.kind==='moss').sort((a,b)=>a.anchor-b.anchor);
 for(const o of moss){const target=neighbors(s,o.anchor).find(i=>!obstacleAt(s,i)&&!s.cells[i]!.frost&&!s.cells[i]!.exit&&s.cells[i]!.tile?.kind==='normal');if(target===undefined)continue;const id=`moss-${s.turn}-${target}`;s.obstacles[id]={id,kind:'moss',hp:1,maxHp:1,anchor:target,footprint:[target]};s.cells[target]!.obstacleId=id;s.cells[target]!.tile=null;for(const g of s.goals)if(g.kind==='moss'){g.count++;g.remaining++;}ctx.events.push({type:'moss',cells:[target],kind:'moss'});return;}
}
function canSwap(s:GameState,a:number,b:number):boolean {
 if(!movable(s,a)||!movable(s,b)||!neighbors(s,a).includes(b))return false;
 const t=s.cells[a]!.tile!,u=s.cells[b]!.tile!;if(t.kind==='seed'||u.kind==='seed')return false;
 if(isSpecial(t)||isSpecial(u))return true;
 s.cells[a]!.tile=u;s.cells[b]!.tile=t;const found=findMatches(s).some(m=>m.cells.includes(a)||m.cells.includes(b));s.cells[a]!.tile=t;s.cells[b]!.tile=u;return found;
}
export function legalActions(s:GameState):Action[] {
 if(s.status!=='playing'||s.moves<=0)return [];const actions:Action[]=[];
 for(let i=0;i<s.cells.length;i++){if(movable(s,i)&&isSpecial(s.cells[i]!.tile))actions.push({type:'tap',at:i});for(const j of neighbors(s,i))if(j>i&&canSwap(s,i,j))actions.push({type:'swap',from:i,to:j});}
 return actions;
}
function reshuffle(s:GameState,events:GameEvent[]):boolean {
 const indices=s.cells.flatMap((c,i)=>movable(s,i)&&c.tile?.kind!=='seed'?[i]:[]),original=indices.map(i=>s.cells[i]!.tile!);const originalRng=s.rng;
 // Version 1.0 replays retain their exact first-valid permutation and RNG consumption.
 const minimum=s.engineVersion===LEGACY_ENGINE_VERSION?1:3;
 let best:{tiles:Tile[];rng:number;choices:number}|undefined;
 for(let attempt=0;attempt<256;attempt++){
  const shuffled=[...original];for(let i=shuffled.length-1;i>0;i--){const j=next(s)%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j]!,shuffled[i]!];}
  indices.forEach((i,k)=>{s.cells[i]!.tile=shuffled[k]!;});if(findMatches(s).length)continue;
  const choices=legalActions(s).length;
  if(choices>=minimum){events.push({type:'shuffle',cells:indices});return true;}
  if(choices>0&&(!best||choices>best.choices))best={tiles:shuffled,rng:s.rng,choices};
 }
 // Near-complete constrained boards may not support three choices; keep the best playable
 // permutation rather than turn a solvable board into an engine error.
 if(best){indices.forEach((i,k)=>{s.cells[i]!.tile=best!.tiles[k]!;});s.rng=best.rng;events.push({type:'shuffle',cells:indices});return true;}
 indices.forEach((i,k)=>{s.cells[i]!.tile=original[k]!;});s.rng=originalRng;return false;
}
export function applyAction(input:GameState,action:Action):ActionResult {
 const invalid=(reason:string):ActionResult=>({state:input,events:[{type:'invalid',cells:[]}],accepted:false,reason});
 if(!supportsEngine(input.engineVersion))return invalid('ENGINE_VERSION');
 if(action.type==='continue'){if(input.status!=='lost'||action.moves!==5)return invalid('CONTINUE_NOT_ALLOWED');const state=copy(input);state.moves+=5;state.status='playing';return {state,events:[],accepted:true};}
 if(input.status!=='playing'||input.moves<=0)return invalid('RUN_NOT_PLAYING');
 const s=copy(input),events:GameEvent[]=[];const ctx:Context={s,events,queue:[],protected:new Set(),triggered:new Set(),mossHit:false,effects:0};let usesMove=false,initial:Match[]|undefined;
 try {
  if(action.type==='swap'){
   const {from,to}=action;if(!canSwap(s,from,to))return invalid('INVALID_SWAP');
   const a=s.cells[from]!.tile!,b=s.cells[to]!.tile!;s.cells[from]!.tile=b;s.cells[to]!.tile=a;events.push({type:'swap',cells:[from,to],from,to});usesMove=true;
   if(isSpecial(a)&&isSpecial(b))combine(ctx,to,a.kind,b.kind,from);
   else if(isSpecial(a)||isSpecial(b)){const power=isSpecial(a)?a:b,at=isSpecial(a)?to:from,normal=isSpecial(a)?b:a;
    // Capture ordinary matches before the power's effects and gravity break their shape.
    // Resolving them in the same phase also protects their new special's creation cell.
    if(s.engineVersion!==LEGACY_ENGINE_VERSION)initial=findMatches(s,[to,from]);
    ctx.triggered.add(power.id);s.cells[at]!.tile=null;events.push({type:'remove',cells:[at],kind:power.kind});if(s.cells[at]!.frost){s.cells[at]!.frost--;goal(s,'frost');}activate(ctx,at,power.kind as Special,normal.kind==='normal'?normal.color:undefined);
   }else initial=findMatches(s,[to,from]);
  }else if(action.type==='tap'){
   if(!movable(s,action.at)||!isSpecial(s.cells[action.at]!.tile))return invalid('INVALID_TAP');usesMove=true;enqueue(ctx,[action.at],'tap');
  }else if(action.type==='booster'){
   if(action.item==='move-hourglass'){if(s.moves>96)return invalid('MOVES_FULL');s.moves+=3;events.push({type:'special',kind:'move-hourglass',cells:[]});return {state:s,events,accepted:true};}
   if(action.item==='world-bomb'){enqueue(ctx,s.cells.flatMap((cell,index)=>cell.exists?[index]:[]),action.item,undefined,false,true);}
   else if(action.item==='cross-firework'||action.item==='color-magnet'){
    const at=action.at;if(at===undefined||!valid(s,at))return invalid('INVALID_BOOSTER_TARGET');
    if(action.item==='cross-firework')enqueue(ctx,[...line(s,at,true),...line(s,at,false)],action.item,undefined,false,true);
    else{const tile=s.cells[at]!.tile;if(tile?.kind!=='normal')return invalid('COLOR_TARGET_REQUIRED');enqueue(ctx,s.cells.flatMap((cell,index)=>cell.tile?.kind==='normal'&&cell.tile.color===tile.color?[index]:[]),action.item,tile.color);}
   }
   else if(action.item==='shuffle'){if(!reshuffle(s,events))return invalid('SHUFFLE_UNAVAILABLE');return {state:s,events,accepted:true};}
   else if(action.item==='sweep-border'){
    const targets=perimeterCells(s);
    if(!targets.some(i=>s.cells[i]!.tile||s.cells[i]!.obstacleId||s.cells[i]!.frost))return invalid('NO_EFFECTIVE_TARGET');
    enqueue(ctx,targets,action.item,undefined,false,true);
   }else{
   if(!['hammer','sweep-row','sweep-column'].includes(action.item)||action.at===undefined||!valid(s,action.at))return invalid('INVALID_BOOSTER_TARGET');
   const at=action.at;if(!s.cells[at]!.tile&&!obstacleAt(s,at)&&!s.cells[at]!.frost)return invalid('EMPTY_BOOSTER_TARGET');if(s.cells[at]!.tile?.kind==='seed'&&action.item==='hammer')return invalid('SEED_NOT_REMOVABLE');const obstacle=obstacleAt(s,at);if(action.item==='hammer'&&obstacle&&(obstacle.kind==='pot'||(obstacle.kind==='cabinet'&&obstacle.color)))return invalid('COLOR_CHARGE_REQUIRED');
   const targets=action.item==='hammer'?[at]:line(s,at,action.item==='sweep-row');const effective=targets.some(i=>{const o=obstacleAt(s,i),t=s.cells[i]!.tile;return o?o.kind!=='pot'&&!(o.kind==='cabinet'&&o.color):!!t&&t.kind!=='seed';});if(!effective)return invalid('NO_EFFECTIVE_TARGET');enqueue(ctx,targets,action.item);
   }
  }else return invalid('UNKNOWN_ACTION');
  if(usesMove){s.moves--;s.turn++;}
  cascades(ctx,initial);
  if(s.goals.every(g=>g.remaining===0)){s.status='won';events.push({type:'win',cells:[]});}
  else {if(usesMove)growMoss(ctx);if(s.goals.every(g=>g.remaining===0)){s.status='won';events.push({type:'win',cells:[]});}else if(s.moves===0){s.status='lost';events.push({type:'lose',cells:[]});}else if(!legalActions(s).length&&!reshuffle(s,events))throw new Error('UNRECOVERABLE_DEADLOCK');}
  return {state:s,events,accepted:true};
 }catch(error){s.status='error';s.error=error instanceof Error?error.message:'ENGINE_FAILURE';events.push({type:'error',cells:[],kind:s.error});return {state:s,events,accepted:true,reason:s.error};}
}
export function replay(level:LevelDefinition,actions:Action[],preBoosters:PreBooster[]=[]):ActionResult {
 if(actions.length>1024)throw new Error('ACTION_LIMIT');let state=createGame(level,preBoosters);const events:GameEvent[]=[];
 for(const action of actions){const result=applyAction(state,action);if(!result.accepted)return {...result,events:[...events,...result.events]};state=result.state;events.push(...result.events);if(state.status==='error')return {state,events,accepted:false,reason:state.error};}
 return {state,events,accepted:true};
}
/** Stable FNV-1a diagnostic fingerprint; not a security proof. Server replay is authoritative. */
export function stateHash(s:GameState):string {const value=JSON.stringify(s);let hash=0x811c9dc5;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,0x01000193);}return (hash>>>0).toString(16).padStart(8,'0');}

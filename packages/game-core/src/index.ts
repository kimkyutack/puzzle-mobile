import {coveredGravityInlets,gravityFlow,gravityLanes as lanesFor} from './gravity-flow';
import {validateGardenStage,createGardenStage,advanceGardenStage} from './garden-stages';
export {connectedGardenCells,gardenStageGoal} from './garden-stages';
import { COLORS, LEGACY_ENGINE_VERSION, supportsEngine, supportsPowerRainbow, supportsGardenMechanics, supportsBeehive, supportsOpenGardenStages, supportsImmediateGardenStages, supportsFlowGravity, supportsSeedDelivery, supportsGliderSwarm, supportsVisibleTargets, supportsObjectivePowers, supportsMatchFirst, supportsChapterObstacles, supportsContinuousRefill, perpendicularRockets, type Action, type ActionResult, type Color, type GameEvent, type GameState, type Goal, type LevelDefinition, type Obstacle, type PreBooster, type Special, type Tile } from '@garden/contracts';
import {perimeterCells} from './perimeter';
import {endpointPipe,pipeEnd,struckPipeEnd} from './endpoint-pipe';
import {beeObstacle,type BeeFocus} from './beehive';
import {missingSeedCount,seedDropTargets,seedExitLanes} from './seed-delivery';
import {advanceConveyor,advanceDevice,deviceGates,isDeviceGate,validateDevices,type DeviceMatch} from './campaign-devices';
import {initializeGreenhouseStep,reflectedRocket,rotateTurntable,turntableCells} from './greenhouse-devices';
import {currentDevice,mirrorTargets,paintTiles,pairedPlates,portalTransfer} from './workshop-devices';
import {isBreakableObstacle,isGardenOpener} from '../../contracts/src/breakable-obstacles';
import {revealedObstacles,validateBreakable,validateWindLinks} from './breakable-obstacles';
import {advanceObstacleRules,canHitObstacleRule,matchCanHitRule,updateRuleAfterHit,validateObstacleRule,validateTwinPairs} from './obstacle-rules';
import {adjacentChapterCells,advanceChapterWindows,applyChapterCompost,chapterAfterHit,chapterBreakReaction,chapterCanTakeHit,chapterCanTarget,chapterGuarded,chapterMoveTargets,validateChapterObstacle,type ChapterImpact,type ChapterTurn} from './chapter-obstacles';
import {revealPlanters,validatePlanterGarden} from './planter-garden';
import {isGardenPuzzleObstacle} from '../../contracts/src/garden-puzzles';
import {canHitPuzzleObstacle,canPushHarvestCart,dominoTarget,finishPuzzleImpact,lightRay,pushHarvestCart,puzzleDamage,validateGardenPuzzle,type PuzzleImpact} from './garden-puzzles';
export {perimeterCells} from './perimeter';

export const MAX_CASCADES = 128;
const MAX_EFFECTS = 2048;
const specialKinds: readonly string[] = ['wind-row','wind-column','bomb','glider','rainbow','beehive'];
const goldGardenPowers:readonly Special[]=['wind-row','wind-row','wind-column','bomb','glider','beehive'];
export const isSpecial = (tile: Tile | null | undefined): tile is Tile & {kind: Special} => !!tile && specialKinds.includes(tile.kind);
const copy = <T>(value:T):T => structuredClone(value);
const ascending = (a:number,b:number) => a-b;
const unique = (cells:number[]) => [...new Set(cells)].sort(ascending);
const valid = (s:GameState, at:number):boolean => Number.isInteger(at) && at>=0 && at<s.cells.length && s.cells[at]!.exists;
const neighbors = (s:GameState,at:number):number[] => [at-s.width,at-1,at+1,at+s.width].filter(i=>valid(s,i) && Math.abs(i%s.width-at%s.width)+Math.abs(Math.floor(i/s.width)-Math.floor(at/s.width))===1).sort(ascending);
const obstacleAt = (s:GameState,i:number) => s.cells[i]?.obstacleId ? s.obstacles[s.cells[i]!.obstacleId!] : undefined;
const blocked = (s:GameState,i:number) => {const o=obstacleAt(s,i);return !!o && o.kind!=='vine'||supportsOpenGardenStages(s.engineVersion)&&!!s.gardenStage?.connected.includes(i);};
const movable = (s:GameState,i:number) => valid(s,i) && !!s.cells[i]!.tile && !obstacleAt(s,i);
function next(s:GameState):number {let x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng;}
function tile(s:GameState):Tile {
 const id=s.nextTileId++;
 if(s.goldGarden)return {id,kind:goldGardenPowers[next(s)%goldGardenPowers.length]!};
 return {id,kind:'normal',color:s.colors[next(s)%s.colors.length]!};
}
const colorAt = (s:GameState,i:number):Color|undefined => {const t=s.cells[i]?.tile;return valid(s,i)&&!blocked(s,i)&&t?.kind==='normal'?t.color:undefined;};
function goal(s:GameState,kind:Goal['kind'],amount=1):void {for(const g of s.goals)if(g.kind===kind)g.remaining=Math.max(0,g.remaining-amount);}
function hitFrost(ctx:Context,at:number,effectId?:number):void{
 const {s}=ctx,cell=s.cells[at]!;
 if(!cell.frost)return;
 cell.frost--;goal(s,'frost');
 if(effectId!==undefined||supportsVisibleTargets(s.engineVersion))ctx.events.push({type:'hit',cells:[at],kind:'frost',effectId});
}
export function validateLevel(level:LevelDefinition):string[] {
 const errors=[...validateGardenStage(level),...validateDevices(level),...validatePlanterGarden(level),...validateGardenPuzzle(level)]; const n=level.width*level.height;
 if(!supportsEngine(level.engineVersion))errors.push('ENGINE_VERSION');
 if(level.powerRainbow&&!supportsPowerRainbow(level.engineVersion))errors.push('POWER_RAINBOW_ENGINE');
 if(!Number.isInteger(level.width)||!Number.isInteger(level.height)||level.width<3||level.width>9||level.height<3||level.height>10||level.shape.length!==n)errors.push('BOARD_SHAPE');
 if(level.colors.length<3||level.colors.length>6||new Set(level.colors).size!==level.colors.length||level.colors.some(c=>!COLORS.includes(c)))errors.push('COLORS');
 if(!Number.isInteger(level.moves)||level.moves<1||level.moves>100)errors.push('MOVES');
 if(!Number.isSafeInteger(level.seed)||level.seed<=0)errors.push('SEED');
 if(level.initial&&level.initial.length!==n)errors.push('INITIAL_LENGTH');
 if(level.initial){const ids=new Set<number>();for(const [i,t] of level.initial.entries()){if(!t)continue;if(!level.shape[i]||!Number.isSafeInteger(t.id)||t.id<1||ids.has(t.id))errors.push('INITIAL_TILE');ids.add(t.id);if(t.kind==='normal'&&!level.colors.includes(t.color))errors.push('INITIAL_COLOR');if(t.kind!=='normal'&&t.kind!=='seed'&&!specialKinds.includes(t.kind))errors.push('INITIAL_KIND');}}
 if(!supportsBeehive(level.engineVersion)&&level.initial?.some(t=>t?.kind==='beehive'))errors.push('BEEHIVE_ENGINE');
 for(const [i,layers] of Object.entries(level.frost??{}))if(!level.shape[Number(i)]||!Number.isInteger(layers)||layers<1)errors.push('FROST_LAYER');
 if(new Set(level.obstacles.map(o=>o.id)).size!==level.obstacles.length)errors.push('OBSTACLE_ID');
 const occupied=new Set<number>();
 for(const o of level.obstacles){
  if(o.chapter)errors.push(...validateChapterObstacle(level,o));
  if(o.rule!==undefined||o.pair!==undefined||o.lastHitColor!==undefined||o.detonateAt!==undefined||o.strikeSide!==undefined)errors.push(...validateObstacleRule(level,o));
  if(isBreakableObstacle(o.kind)||o.contents||o.link!==undefined)errors.push(...validateBreakable(level,o));
  if(['pipe','bud','carousel','curtain'].includes(o.kind)&&!supportsGardenMechanics(level.engineVersion))errors.push('MECHANIC_ENGINE');
  if(o.endOnly&&!endpointPipe(o,level.engineVersion))errors.push('ENDPOINT_PIPE_ENGINE');
  if(o.kind==='pipe'&&(o.hp!==o.footprint.length||o.footprint.some((i,k)=>k>0&&Math.abs(i%level.width-o.footprint[k-1]!%level.width)+Math.abs(Math.floor(i/level.width)-Math.floor(o.footprint[k-1]!/level.width))!==1)))errors.push('PIPE_LENGTH');
  if((o.kind==='bud'||o.kind==='curtain')&&(!o.color||!level.colors.includes(o.color)))errors.push('MECHANIC_COLOR');
  if(o.kind==='carousel'){
   const path=o.path??[];
   if(path.length<4||new Set(path).size!==path.length||!path.includes(o.anchor)||o.footprint.length!==1||path.some((i,k)=>!level.shape[i]||Math.abs(i%level.width-path[(k+1)%path.length]!%level.width)+Math.abs(Math.floor(i/level.width)-Math.floor(path[(k+1)%path.length]!/level.width))!==1))errors.push('CAROUSEL_PATH');
  }
  if(!Number.isInteger(o.hp)||!Number.isInteger(o.maxHp)||o.hp<1||o.hp>o.maxHp||!o.footprint.includes(o.anchor))errors.push('OBSTACLE_HP');
  for(const i of o.footprint){if(!level.shape[i]||occupied.has(i))errors.push('OBSTACLE_FOOTPRINT');occupied.add(i);}
 }
 if(level.obstacles.some(o=>o.kind==='windmill'||o.kind==='wind-pod'))errors.push(...validateWindLinks(level.obstacles));
 if(level.goldGarden&&(!level.obstacles.length||level.obstacles.some(o=>o.kind!=='crate'||o.hp!==1||o.maxHp!==1||o.footprint.length!==1)||
  !level.shape.some((exists,at)=>exists&&!occupied.has(at))||level.initial?.some(t=>t&&!goldGardenPowers.some(kind=>kind===t.kind))))errors.push('GOLD_GARDEN_LAYOUT');
 if(level.obstacles.some(o=>o.rule==='twin'))errors.push(...validateTwinPairs(level.obstacles));
 const guide=level.startBoosterGuide;
 if(guide&&(!['wind-row','bomb'].includes(guide.item)||!Number.isInteger(guide.cell)||!level.shape[guide.cell]||
  occupied.has(guide.cell)||level.frost?.[guide.cell]||level.exits?.includes(guide.cell)||level.protectedCells?.includes(guide.cell)||
  (level.initial&&level.initial[guide.cell]?.kind!=='normal')))errors.push('START_BOOSTER_GUIDE');
 const lanes=lanesFor(level),seen=new Set<number>();
 for(const lane of lanes){if(!lane.length)errors.push('EMPTY_GRAVITY');if(level.inlets&&!level.inlets.includes(lane[0]!))errors.push('MISSING_INLET');for(const i of lane){if(!Number.isInteger(i)||!level.shape[i]||seen.has(i))errors.push('GRAVITY_GRAPH');seen.add(i);}}
 if(seen.size!==level.shape.filter(Boolean).length)errors.push('GRAVITY_COVERAGE');
 for(const i of level.exits??[])if(!level.shape[i]||!lanes.some(l=>l[l.length-1]===i))errors.push('EXIT_UNREACHABLE');
 if(!level.goals.length||new Set(level.goals.map(g=>g.kind)).size!==level.goals.length||level.goals.some(g=>!Number.isInteger(g.count)||g.count<=0||g.remaining!==g.count))errors.push('GOALS');
 const gates=deviceGates(level);
 for(const g of level.goals){if(COLORS.includes(g.kind as Color)){if(!level.colors.includes(g.kind as Color))errors.push('GOAL_COLOR');continue;}if(g.kind==='combo'||g.kind==='special'||g.kind==='garden-water'||g.kind==='garden-route'||g.kind==='device')continue;else if(g.kind==='frost'){if(g.count!==Object.values(level.frost??{}).reduce((a,b)=>a+b,0))errors.push('GOAL_FROST');}else if(g.kind==='seed'){const seeds=(level.initial??[]).filter(t=>t?.kind==='seed').length+level.obstacles.reduce((a,o)=>a+(o.seeds??0),0);if(g.count!==seeds||!level.exits?.length)errors.push('GOAL_SEED');}
  else{
   const count=level.obstacles.reduce((sum,o)=>{
    if(o.contents?.kind===g.kind)return sum+o.footprint.length;
    if(o.kind===g.kind&&!gates.has(o.anchor))return sum+1;
    return sum+(g.kind==='soil-chip'&&o.kind==='soil-clod'?2:0);
   },0);
   const expected=level.goldGarden&&g.kind==='crate'?count*level.moves:count;
   if(g.count!==expected)errors.push('GOAL_OBSTACLE');
  }
 }
 return uniqueStrings(errors);
}
const uniqueStrings=(xs:string[])=>[...new Set(xs)];
export interface Match {cells:number[];kind?:Special;anchor:number;color:Color}
interface Pattern {cells:number[];kind?:Special;priority:number;color:Color}
/** Stable row-major pattern union. Intersecting patterns of the same color form one match group. */
export function findMatches(s:GameState,preferred:number[]=[]):Match[] {
 const patterns:Pattern[]=[];
 for(let y=0;y<s.height;y++)for(let x=0;x<s.width;){const start=y*s.width+x,c=colorAt(s,start);let end=x+1;while(c&&end<s.width&&colorAt(s,y*s.width+end)===c)end++;const length=end-x;if(c&&length>=3)patterns.push({cells:Array.from({length},(_,k)=>start+k),kind:length>=5?'rainbow':length===4?(perpendicularRockets(s.engineVersion)?'wind-column':'wind-row'):undefined,priority:length>=5?4:length===4?1:0,color:c});x=end;}
 for(let x=0;x<s.width;x++)for(let y=0;y<s.height;){const start=y*s.width+x,c=colorAt(s,start);let end=y+1;while(c&&end<s.height&&colorAt(s,end*s.width+x)===c)end++;const length=end-y;if(c&&length>=3)patterns.push({cells:Array.from({length},(_,k)=>start+k*s.width),kind:length>=5?'rainbow':length===4?(perpendicularRockets(s.engineVersion)?'wind-row':'wind-column'):undefined,priority:length>=5?4:length===4?1:0,color:c});y=end;}
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
 if(level.powerRainbow)s.powerRainbow=true;
 if(level.goldGarden)s.goldGarden={coinCells:level.obstacles.map(coin=>coin.anchor)};
 if(level.gardenStage)s.gardenStage=createGardenStage(level.gardenStage,level.width);
 if(level.gardenPuzzle)s.gardenPuzzle=copy(level.gardenPuzzle);
 if(level.devices)s.devices={steps:copy(level.devices),index:0,progress:0};
 for(const o of Object.values(s.obstacles))for(const i of o.footprint)s.cells[i]!.obstacleId=o.id;
 if(level.initial){s.cells.forEach((c,i)=>{if(c.exists&&!blocked(s,i))c.tile=copy(level.initial![i]??null);});s.nextTileId=1+Math.max(0,...s.cells.map(c=>c.tile?.id??0));}
 if(!level.initial||supportsContinuousRefill(s.engineVersion))for(const [at,cell] of s.cells.entries()){
  if(!cell.exists||cell.tile||blocked(s,at))continue;
  if(s.goldGarden){cell.tile=tile(s);continue;}
  const choices=[...s.colors];
  while(choices.length){
   const pick=next(s)%choices.length,color=choices.splice(pick,1)[0]!;
   cell.tile={id:s.nextTileId,kind:'normal',color};
   if(!findMatches(s).length)break;
  }
  s.nextTileId++;
 }
 if(findMatches(s).length)throw new Error('INITIAL_AUTO_MATCH');
 if(!legalActions(s).length&&!reshuffle(s,[]))throw new Error('INITIAL_DEADLOCK');
 const guide=level.startBoosterGuide;
 const selectedGuide=guide&&preBoosters.includes(guide.item)?guide:undefined;
 const eligible=s.cells.flatMap((c,i)=>i!==selectedGuide?.cell&&c.exists&&c.tile?.kind==='normal'&&!c.obstacleId&&!c.frost&&!c.exit&&!level.protectedCells?.includes(i)&&!s.goals.some(g=>g.kind===c.tile?.kind||(c.tile?.kind==='normal'&&g.kind===c.tile.color))?[i]:[]);
 if(eligible.length<preBoosters.length-Number(!!selectedGuide))throw new Error('PREBOOSTER_PLACEMENT_UNAVAILABLE');
 // Start boosters land scattered across the board (Royal Match style): the first near a level-specific spot,
 // each next one as far as possible from those already placed. Deterministic, so it consumes no RNG.
 const placed:number[]=selectedGuide?[selectedGuide.cell]:[];
 const distance=(a:number,b:number)=>Math.hypot(a%s.width-b%s.width,Math.floor(a/s.width)-Math.floor(b/s.width));
 const seedSpot=((level.id*2654435761)>>>0)%s.cells.length;
 for(const item of preBoosters){
  if(item===selectedGuide?.item){s.cells[selectedGuide.cell]!.tile={id:s.nextTileId++,kind:item};continue;}
  const options=eligible.filter(at=>!placed.includes(at));
  const score=(at:number)=>placed.length?Math.min(...placed.map(p=>distance(at,p))):-distance(at,seedSpot);
  const at=options.reduce((best,at)=>score(at)>score(best)?at:best,options[0]!);
  placed.push(at);s.cells[at]!.tile={id:s.nextTileId++,kind:item};
 }
 initializeGreenhouseStep(s);
 return s;
}

function rankedColors(s:GameState):Color[]{
 const prioritize=supportsObjectivePowers(s.engineVersion);
 const goals=new Map(s.goals.map(({kind,remaining})=>[kind,remaining]));
 const frostGoal=(goals.get('frost')??0)>0;
 const routes=new Set(prioritize?[...(s.gardenStage?.blocked??[]),...seedDropTargets(s)]:[]);
 const counts=new Map(s.colors.map(color=>[color,{tiles:0,collected:0,obstructions:0}]));
 for(const [at,{tile,frost,obstacleId}] of s.cells.entries()){
  if(tile?.kind!=='normal'||prioritize&&!colorAt(s,at))continue;
  const tally=counts.get(tile.color);
  if(!tally)continue;
  tally.tiles++;
  if(!prioritize)continue;
  const obstacle=obstacleId?s.obstacles[obstacleId]:undefined;
  if(!obstacle)tally.collected++;
  const hitsGoalObstacle=obstacle&&(goals.get(obstacle.kind)??0)>0;
  if(routes.has(at)||frostGoal&&frost||hitsGoalObstacle)tally.obstructions++;
 }
 const benefit=(color:Color)=>{
  const {collected,obstructions}=counts.get(color)!;
  return obstructions+Math.min(collected,goals.get(color)??0);
 };
 return [...s.colors].sort((a,b)=>(prioritize?benefit(b)-benefit(a):0)||counts.get(b)!.tiles-counts.get(a)!.tiles||COLORS.indexOf(a)-COLORS.indexOf(b));
}
function rainbowColors(s:GameState,selected?:Color):Color[]{
 const ranked=rankedColors(s),first=selected??ranked[0]!;
 const extra=s.powerRainbow?ranked.find(color=>color!==first):undefined;
 return extra?[first,extra]:[first];
}
function area(s:GameState,at:number,radius:number):number[]{const x=at%s.width,y=Math.floor(at/s.width);return s.cells.flatMap((c,i)=>c.exists&&Math.abs(i%s.width-x)<=radius&&Math.abs(Math.floor(i/s.width)-y)<=radius?[i]:[]);}
function line(s:GameState,at:number,row:boolean,span=0):number[]{const axis=row?Math.floor(at/s.width):at%s.width;return s.cells.flatMap((c,i)=>c.exists&&Math.abs((row?Math.floor(i/s.width):i%s.width)-axis)<=span?[i]:[]);}
export function targetCells(s:GameState,excluded:Set<number>=new Set(),fusion=false):number[]{
 const active=new Set(s.goals.filter(g=>g.remaining>0).map(g=>g.kind));
 const lit=s.gardenPuzzle?.kind==='shadow'?new Set(lightRay(s)):undefined;
 const directFrost=supportsVisibleTargets(s.engineVersion);
 const prioritizeFrost=supportsObjectivePowers(s.engineVersion);
 const score=(i:number)=>{
  const c=s.cells[i]!,o=obstacleAt(s,i),t=c.tile;
  const ice=c.frost&&active.has('frost')?400+c.frost:0;
  // The glider can chip the ice even under a piece it normally cannot remove.
  if(t?.kind==='seed'||(o&&(o.cover||!chapterCanTarget(s,o,fusion)||!canHitObstacleRule(o,'glider-impact')||o.kind==='pot'||o.kind==='bud'||o.kind==='curtain'||o.kind==='windmill'||(o.kind==='cabinet'&&o.color)||endpointPipe(o,s.engineVersion)&&!pipeEnd(o,i)||s.gardenPuzzle&&!canHitPuzzleObstacle(s,o,'glider-impact',lit))))return prioritizeFrost&&ice?ice:-1;
  if(s.gardenStage?.blocked.includes(i))return 480;
  if(o&&(active.has(o.kind)||(o.contents&&active.has(o.contents.kind))))return 500+o.hp;
  if(ice&&(t||directFrost))return ice;
  if(t?.kind==='normal'&&active.has(t.color))return 300;
  if(o&&(isGardenOpener(o.kind)||o.kind==='soil-clod'||o.kind==='garden-light'&&s.gardenPuzzle?.lightAt!==i))return 450;
  if(o)return 200;
  if(isSpecial(t))return 100;
  return t?50:0;
 };
 return s.cells.flatMap((c,i)=>c.exists&&!excluded.has(i)&&score(i)>0?[i]:[]).sort((a,b)=>score(b)-score(a)||a-b);
}
interface GliderFlight {from:number;exclude:number[]}
interface Swarm {cells:Set<number>;obstacles:Set<string>;flights:GliderFlight[]}
interface Effect extends ChapterImpact {id:number;frostHandled?:readonly number[];delivery?:{from:number;targetId:string};adjacent?:boolean;allowPot?:boolean;bee?:{from:number;focus:BeeFocus;payload?:Special};glider?:GliderFlight&{swarm?:Swarm};power?:Special;openedPlanters?:Obstacle[];puzzle?:PuzzleImpact;dominoFrom?:number;obstacleTargetId?:string;family?:Set<string>}
type CascadeCapture=(state:GameState,events:GameEvent[])=>void;
interface Context extends ChapterTurn {family?:Set<string>;familyTiles?:Map<number,Set<string>>;s:GameState;events:GameEvent[];queue:Effect[];protected:Set<number>;triggered:Set<number>;mossHit:boolean;effects:number;capture?:CascadeCapture;updraft?:boolean;directMatches?:ReadonlySet<number>;twinHits?:Set<string>;chapterRules?:Set<string>}
function excludeStruckTwins(ctx:Context,excluded:Set<number>):void{
 for(const id of ctx.twinHits??[]){const obstacle=ctx.s.obstacles[id];if(obstacle)excluded.add(obstacle.anchor);}
}
function gliderTarget(ctx:Context,excluded:Set<number>,origin:number,allowRepeat=false):number {
 const {s}=ctx;
 excludeStruckTwins(ctx,excluded);
 const targets=targetCells(s,excluded,ctx.fusion);
 if(supportsSeedDelivery(s.engineVersion)){
  const route=seedDropTargets(s);
  if(route.length){
   const eligible=new Set(targets);
   const pending=new Set(ctx.queue.filter(effect=>effect.kind==='glider-impact').flatMap(effect=>effect.cells));
   const preferred=route.find(at=>eligible.has(at)&&!ctx.protected.has(at)&&!pending.has(at));
   if(preferred!==undefined)return preferred;
  }
 }
 return targets[0]??(allowRepeat?targetCells(s,undefined,ctx.fusion)[0]:undefined)??origin;
}
function swarmTarget(ctx:Context,exclude:number[],swarm:Swarm):number|undefined {
 const {s}=ctx,excluded=new Set([...exclude,...ctx.protected]);
 excludeStruckTwins(ctx,excluded);
 const gates=deviceGates(s.devices?{devices:s.devices.steps}:{}),paths=s.gardenStage?.connected;
 const frostGoal=supportsObjectivePowers(s.engineVersion)&&s.goals.some(goal=>goal.kind==='frost'&&goal.remaining>0);
 const candidates=targetCells(s,excluded,ctx.fusion).filter(at=>{
  const cell=s.cells[at]!;
  if(frostGoal&&cell.frost)return true;
  return !(cell.obstacleId&&gates.has(at))&&!paths?.includes(at);
 });
 const fresh=candidates.filter(at=>{
  const id=s.cells[at]!.obstacleId;
  return !swarm.cells.has(at)&&(!id||!swarm.obstacles.has(id));
 });
 const eligible=new Set(fresh);
 return seedDropTargets(s).find(at=>eligible.has(at))??fresh[0]??candidates[0];
}
function swarmLanding(s:GameState,from:number,exclude:number[],used:Set<number>):number {
 // Even after the last target is gone, the converted glider finishes its flight.
 let nearest=from,distance=Infinity;
 for(const [at,cell] of s.cells.entries()){
  if(!cell.exists||cell.tile||cell.obstacleId||used.has(at)||exclude.includes(at))continue;
  const step=Math.abs(at%s.width-from%s.width)+Math.abs(Math.floor(at/s.width)-Math.floor(from/s.width));
  if(step<distance){nearest=at;distance=step;}
 }
 return nearest;
}
function placeSeed(ctx:Context,at:number):void {
 const {s}=ctx;
 s.cells[at]!.tile={id:s.nextTileId++,kind:'seed'};
 ctx.events.push({type:'spawn',cells:[at],kind:'seed'});
}
function seedReleaseCells(ctx:Context,footprint:number[]):number[] {
 const {s}=ctx;
 const nearby=unique([...footprint,...footprint.flatMap(at=>neighbors(s,at))]);
 if(!supportsSeedDelivery(s.engineVersion))return nearby.filter(at=>!blocked(s,at));
 const lanes=seedExitLanes(s);
 const sourceRoute=new Set(lanes.filter(lane=>lane.some(at=>footprint.includes(at))).flat());
 const exitRoutes=new Set(lanes.flat());
 const available=(at:number)=>!s.cells[at]!.obstacleId&&!ctx.protected.has(at)&&s.cells[at]!.tile?.kind!=='seed'&&!s.gardenStage?.channels.includes(at);
 const priority=(at:number)=>sourceRoute.has(at)?0:exitRoutes.has(at)?1:2;
 return nearby.filter(available).sort((a,b)=>priority(a)-priority(b)||a-b);
}
function restoreMissingSeeds(ctx:Context,count:number):void {
 const {s}=ctx;
 if(!count)return;
 const positions=seedExitLanes(s).flatMap(lane=>lane.slice(0,-1).reverse())
  .filter(at=>!s.cells[at]!.obstacleId&&!s.gardenStage?.channels.includes(at)&&(!s.cells[at]!.tile||s.cells[at]!.tile?.kind==='normal'));
 for(const at of positions.slice(0,count))placeSeed(ctx,at);
}
function enqueue(ctx:Context,cells:number[],kind:string,color?:Color,adjacent=false,allowPot=false):Effect {
 const effect:Effect={id:++ctx.s.effectSequence,cells:unique(cells.filter(i=>valid(ctx.s,i))),kind,color,adjacent,allowPot,...(ctx.family?{family:ctx.family}:{})};
 ctx.queue.push(effect);return effect;
}
function releaseBees(ctx:Context,from:number,count:number,payload?:Special):void {const focus:BeeFocus={};for(let strike=0;strike<count;strike++)ctx.queue.push({id:++ctx.s.effectSequence,cells:[],kind:'bee-impact',bee:{from,focus,payload},...(ctx.family?{family:ctx.family}:{})});}
function activate(ctx:Context,at:number,kind:Special,color?:Color,swarm?:Swarm,sourceHandled=false):void {
 const s=ctx.s;goal(s,'special');const activation:GameEvent={type:'special',cells:[at],kind,...(kind==='rainbow'&&s.powerRainbow?{powered:true as const}:{})};ctx.events.push(activation);
 const blast=(cells:number[],kind:string)=>{
  const effect=enqueue(ctx,cells,kind);
  if(sourceHandled)effect.frostHandled=[at];
  return effect;
 };
 if(kind==='wind-row'||kind==='wind-column'){
  const route=reflectedRocket(s,at,kind==='wind-row');
  if(route){
   activation.routes=route.routes;
   ctx.events.push({type:'mechanic',kind:'rocket-reflect',cells:[route.mirror],from:at,to:route.mirror});
  }
  blast(route?route.routes.flat():line(s,at,kind==='wind-row'),kind);
  activation.effectId=s.effectSequence;
 }
 else if(kind==='bomb'){
  const effect=blast(area(s,at,2),kind);
  if(supportsVisibleTargets(s.engineVersion))activation.effectId=effect.id;
 }
 else if(kind==='glider'){
  const origin=unique([at,...neighbors(s,at)]);
  if(swarm){
   blast(origin,kind);
   activation.effectId=ctx.queue.at(-1)!.id;
   swarm.flights.push({from:at,exclude:origin});
  }else if(ctx.directMatches){
   activation.effectId=blast(origin,kind).id;
   const impact=enqueue(ctx,[],'glider-impact');
   impact.glider={from:at,exclude:[...origin,...ctx.directMatches]};
  }else{
   const target=gliderTarget(ctx,new Set(origin),at,true);blast(origin,kind);
   const impact=enqueue(ctx,[target],'glider-impact');
   ctx.events.push({type:'special',kind:'glider-flight',cells:[at,target],from:at,to:target,
    ...(supportsObjectivePowers(s.engineVersion)?{effectId:impact.id}:{})});
  }
 }
 else if(kind==='beehive')releaseBees(ctx,at,3);
 else {
  const colors=rainbowColors(s,color);
  enqueue(ctx,s.cells.flatMap((c,i)=>c.tile?.kind==='normal'&&colors.includes(c.tile.color)?[i]:[]),'rainbow',colors[0]);
  activation.effectId=s.effectSequence;
 }
}
/** Bomb and rocket combinations (with each other or with a rainbow) strike each obstacle once, however many blasts they make.
 * Bee and glider combinations keep hitting per strike. */
const blastCombo=(a:Special,b:Special)=>[a,b].every(k=>k==='bomb'||k==='rainbow'||k.startsWith('wind-'))&&!(a==='rainbow'&&b==='rainbow');
function combine(ctx:Context,at:number,a:Special,b:Special,other:number):void {
 const outer=ctx.family;ctx.family=blastCombo(a,b)?new Set<string>():undefined;
 try{combineInto(ctx,at,a,b,other);}finally{ctx.family=outer;}
}
function combineInto(ctx:Context,at:number,a:Special,b:Special,other:number):void {
 const s=ctx.s;goal(s,'combo');goal(s,'special');
 const activation:GameEvent={type:'special',cells:[other,at],kind:`${a}+${b}`,
  ...(s.powerRainbow&&(a==='rainbow'||b==='rainbow')?{powered:true as const}:{})};
 ctx.events.push(activation);
 // Consumed combination components never trigger a second independent effect.
 for(const i of [at,other]){const t=s.cells[i]!.tile;if(t){ctx.triggered.add(t.id);s.cells[i]!.tile=null;ctx.events.push({type:'remove',cells:[i],kind:t.kind});hitFrost(ctx,i);}}
 const blast=(cells:number[],kind:string,allowPot=false)=>{enqueue(ctx,cells,kind,undefined,false,allowPot).frostHandled=[at,other];};
 const wind=(k:Special)=>k==='wind-row'||k==='wind-column';
 if(a==='rainbow'&&b==='rainbow'){
  const cells=s.cells.flatMap((c,i)=>c.exists?[i]:[]);
  blast(cells,'rainbow+rainbow',true);
  activation.effectId=s.effectSequence;
  if(activation.powered){
   enqueue(ctx,cells,'power-rainbow-aftershock',undefined,false,true);
   ctx.events.push({type:'mechanic',kind:'power-rainbow-aftershock',cells:[at],from:at,effectId:s.effectSequence});
  }
  return;
 }
 if(a==='rainbow'||b==='rainbow'){
  const replacement=a==='rainbow'?b:a,colors=rainbowColors(s);
  const targets=s.cells.flatMap((c,i)=>c.tile?.kind==='normal'&&colors.includes(c.tile.color)&&!blocked(s,i)?[i]:[]);
  for(const i of targets){
   const tile=s.cells[i]!.tile;
   if(tile?.kind==='normal')goal(s,tile.color);
   s.cells[i]!.tile={id:s.nextTileId++,kind:replacement};
   if(ctx.family)(ctx.familyTiles??=new Map()).set(s.cells[i]!.tile!.id,ctx.family);
  }
  enqueue(ctx,targets,`rainbow+${replacement}`);
  activation.effectId=s.effectSequence;
  return;
 }
 if(a==='beehive'||b==='beehive'){const partner=a==='beehive'?b:a;releaseBees(ctx,at,partner==='beehive'?6:partner==='glider'?5:3,partner==='bomb'||wind(partner)?partner:undefined);return;}
 if(a==='glider'&&b==='glider'){
  const launch=unique([at,...neighbors(s,at)]);
  const frostGoal=supportsObjectivePowers(s.engineVersion)&&s.goals.some(goal=>goal.kind==='frost'&&goal.remaining>0);
  const selected=new Set<number>(frostGoal?[other,...launch]:[]);
  blast(launch,'glider-launch');
  for(let k=0;k<3;k++){
   const target=gliderTarget(ctx,selected,at,true);
   selected.add(target);
   ctx.events.push({type:'special',kind:'glider-flight',cells:[at,target],from:at,to:target});
   enqueue(ctx,[target],'glider-impact');
  }
  return;
 }
 if(a==='glider'||b==='glider'){const payload=a==='glider'?b:a,target=gliderTarget(ctx,new Set([at,other]),at);blast([at,...neighbors(s,at)],'glider-launch');ctx.events.push({type:'special',kind:'glider-flight',cells:[at,target],from:at,to:target});activate(ctx,target,payload);return;}
 if(wind(a)&&wind(b)){
  blast([...line(s,at,true),...line(s,at,false)],'wind+wind');
  activation.effectId=s.effectSequence;
 }
 else if(a==='bomb'&&b==='bomb')blast(area(s,at,4),'bomb+bomb');
 else blast([...line(s,at,true,1),...line(s,at,false,1)],'wind+bomb');
}
function damageObstacle(ctx:Context,id:string,effect:Effect,touched:Set<string>):boolean {
 const s=ctx.s,o=s.obstacles[id];if(!o||touched.has(id))return false;
 if(isDeviceGate(s.devices?.steps,o.anchor))return false;
 if(!canHitObstacleRule(o,effect.kind))return false;
 if(effect.kind==='match'&&!matchCanHitRule(s,o,effect.cells,effect.color))return false;
 if(o.chapter&&!chapterCanTakeHit(s,o,effect,ctx))return false;
 if(o.cover||effect.kind==='match'&&isGardenOpener(o.kind))return false;
 if(o.kind==='crystal'&&effect.kind==='match')return false;
 if(o.kind==='windmill'&&effect.delivery?.targetId!==id)return false;
 if((o.kind==='pot'||o.kind==='bud'||o.kind==='curtain')&&!effect.allowPot&&effect.color!==o.color)return false;
 if(o.kind==='cabinet'&&o.color&&!effect.allowPot&&effect.color!==o.color)return false;
 const end=endpointPipe(o,s.engineVersion)?struckPipeEnd(o,effect.cells,s.width,effect.adjacent):undefined;
 if(endpointPipe(o,s.engineVersion)&&!end)return false;
 const damage=isGardenPuzzleObstacle(o.kind)?puzzleDamage(s,o,effect.kind,effect.puzzle??={}):o.kind==='curtain'&&effect.kind==='match'?effect.cells.length:1;
 if(!damage)return false;
 if(o.rule==='twin'&&effect.kind!=='twin-release'){
  const seen=ctx.twinHits??=new Set();
  const other=Object.values(s.obstacles).find(piece=>piece.rule==='twin'&&piece.pair===o.pair&&piece.id!==id);
  if(!other||!seen.has(other.id)){
   if(!seen.has(id))ctx.events.push({type:'mechanic',kind:'twin-prime',cells:[o.anchor],effectId:effect.id});
   seen.add(id);
   return false;
  }
  ctx.events.push({type:'mechanic',kind:'twin-release',cells:[other.anchor,o.anchor],from:other.anchor,to:o.anchor,effectId:effect.id});
  damageObstacle(ctx,other.id,{...effect,kind:'twin-release'},touched);
 }
 touched.add(id);const hitCells=end?[end==='start'?o.footprint[0]!:o.footprint.at(-1)!]:[...o.footprint];o.hp=Math.max(0,o.hp-damage);if(o.kind==='moss')ctx.mossHit=true;
 if(o.rule!==undefined)updateRuleAfterHit(s,o,effect.kind,effect.color);
 if(o.chapter&&o.hp>0)chapterAfterHit(s,o,ctx.events,ctx.protected);
 if(o.kind==='pipe'&&o.hp>0){const freed=end==='end'?o.footprint.pop()!:o.footprint.shift()!;delete s.cells[freed]!.obstacleId;o.anchor=o.footprint[0]!;}
 const authored=isBreakableObstacle(o.kind)||['pipe','bud','carousel','curtain'].includes(o.kind)||supportsContinuousRefill(s.engineVersion)&&o.kind==='crate';
 const revealed=o.hp===0&&o.contents?revealedObstacles(o):[];
 const slid=o.chapter?.kind==='slide'&&o.anchor!==hitCells[0];
 ctx.events.push({type:'hit',cells:hitCells,kind:o.kind,effectId:effect.id,
  ...(slid?{from:hitCells[0],to:o.anchor}:{}),...(authored?{obstacleId:id,obstacleAfter:o.hp>0?copy(o):revealed.length===1?revealed[0]!:null}:{})});
 if(o.kind==='soil-chip')goal(s,'soil-chip',damage);
 if(o.hp<=0){if(o.kind!=='soil-chip')goal(s,o.kind);
  if(revealed.length===1){s.obstacles[id]=revealed[0]!;return true;}
  if(revealed.length>1){
   delete s.obstacles[id];
   for(const piece of revealed){
    s.obstacles[piece.id]=piece;
    s.cells[piece.anchor]!.obstacleId=piece.id;
    ctx.events.push({type:'mechanic',kind:'crate-pieces-reveal',cells:[piece.anchor],obstacleId:piece.id,obstacleAfter:copy(piece),effectId:effect.id});
   }
   return true;
  }
  for(const i of o.footprint)delete s.cells[i]!.obstacleId;delete s.obstacles[id];
  if(o.chapter){
   const matchColor=effect.kind==='match'?effect.color:undefined;
   if(o.chapter.kind==='compost')enqueue(ctx,[o.anchor],'chapter-compost',matchColor);
   const reaction=chapterBreakReaction(s,o,matchColor);
   if(reaction){
    const followUp=enqueue(ctx,reaction.cells,reaction.kind,matchColor);
    followUp.obstacleTargetId=reaction.targetId;
    ctx.events.push({type:'mechanic',kind:reaction.kind,from:o.anchor,cells:reaction.cells,effectId:followUp.id});
   }
  }
  if(o.rule==='fuse'){
   const blast=enqueue(ctx,area(s,o.anchor,1).filter(at=>at!==o.anchor),'fuse-blast');
   ctx.events.push({type:'mechanic',kind:'fuse-blast',from:o.anchor,cells:blast.cells,effectId:blast.id});
  }
  if(isGardenOpener(o.kind))(effect.openedPlanters??=[]).push(o);
  if(o.kind==='domino-slat'){
   const to=dominoTarget(s,o);
   if(to!==undefined)ctx.queue.push({id:++s.effectSequence,cells:[to],kind:'domino-chain',dominoFrom:o.anchor});
  }
  if(o.kind==='wind-pod'&&o.link){
   const windmill=s.obstacles[o.link];
   if(windmill)ctx.queue.push({id:++s.effectSequence,cells:[windmill.anchor],kind:'wind-seed-impact',delivery:{from:o.anchor,targetId:o.link}});
  }
  if((o.kind==='cabinet'||o.kind==='bud')&&(o.seeds??0)>0){const positions=seedReleaseCells(ctx,o.footprint);const count=o.seeds??0;if(positions.length<count)throw new Error('SEED_EMISSION_BLOCKED');for(const i of positions.slice(0,count))placeSeed(ctx,i);}
 }
 return true;
}
function processEffects(ctx:Context):void {
 const s=ctx.s,baseFamily=ctx.family;
 try{processQueue(ctx,s);}finally{ctx.family=baseFamily;}
}
function processQueue(ctx:Context,s:GameState):void {
 while(ctx.queue.length){if(++ctx.effects>MAX_EFFECTS)throw new Error('EFFECT_LIMIT');const effect=ctx.queue.shift()!,touched=effect.family??new Set<string>();ctx.family=effect.family;
  if(effect.power){
   activate(ctx,effect.cells[0]!,effect.power,effect.color,undefined,true);
   continue;
  }
  if(effect.kind==='match'&&ctx.directMatches)
   ctx.events.push({type:'mechanic',kind:'direct-match',cells:effect.cells,effectId:effect.id});
  if(effect.dominoFrom!==undefined){
   const to=effect.cells[0]!,slat=obstacleAt(s,to);
   if(slat?.kind==='domino-slat'){
    ctx.events.push({type:'mechanic',kind:'domino-chain',from:effect.dominoFrom,to,cells:[to],effectId:effect.id});
    damageObstacle(ctx,slat.id,effect,touched);
   }
   continue;
  }
  if(effect.delivery){
   const {from,targetId}=effect.delivery,windmill=s.obstacles[targetId];
   if(windmill){
    ctx.events.push({type:'mechanic',kind:'wind-seed-flight',cells:[from,windmill.anchor],from,to:windmill.anchor,effectId:effect.id});
    damageObstacle(ctx,targetId,effect,touched);
   }
   continue;
  }
  if(effect.obstacleTargetId!==undefined){
   damageObstacle(ctx,effect.obstacleTargetId,effect,touched);
   continue;
  }
  if(effect.kind==='chapter-compost'){
   applyChapterCompost(s,effect.cells[0]!,effect.color,ctx.events,ctx.protected);
   continue;
  }
  const swarm:Swarm|undefined=effect.kind==='rainbow+glider'&&supportsGliderSwarm(s.engineVersion)?{cells:new Set(),obstacles:new Set(),flights:[]}:undefined;
  if(effect.glider){
   const {from,exclude,swarm}=effect.glider;
   const target=swarm?swarmTarget(ctx,exclude,swarm):gliderTarget(ctx,new Set([...exclude,...ctx.protected]),from);
   const to=target??(swarm?swarmLanding(s,from,exclude,swarm.cells):from);
   swarm?.cells.add(to);
   ctx.events.push({type:'special',kind:'glider-flight',cells:[from,to],from,to,effectId:effect.id});
   if(target===undefined||!swarm&&target===from)continue;
   const id=s.cells[target]!.obstacleId;if(id)swarm?.obstacles.add(id);
   effect.cells=[target];
  }
  if(effect.bee){
   const {from,focus,payload}=effect.bee,excluded=new Set([from,...ctx.protected]);
   excludeStruckTwins(ctx,excluded);
   const target=beeObstacle(s,focus,ctx.twinHits,ctx.fusion)??targetCells(s,excluded,ctx.fusion)[0];if(target===undefined)continue;
   effect.cells=[target];ctx.events.push({type:'special',kind:'bee-flight',cells:[from,target],from,to:target,effectId:effect.id,...(payload?{payload}:{})});
   // Resolve this delivery before choosing the next bee's target. A destroyed
   // obstacle must not absorb the remaining rockets or bombs as wasted hits.
   if(payload){const waiting=ctx.queue;ctx.queue=[];activate(ctx,target,payload);ctx.queue.push(...waiting);continue;}
  }
  if(s.gardenPuzzle?.kind==='shadow')effect.puzzle={lit:new Set(lightRay(s))};
  // Snapshot obstacle membership so one destroyed multi-cell instance cannot expose a second hit in this effect.
  const obstacleIds=new Map(effect.cells.map(i=>[i,s.cells[i]!.obstacleId]));
  const adjacentIds=effect.adjacent?uniqueStrings(effect.cells.flatMap(i=>{
   const side=neighbors(s,i).map(at=>s.cells[at]!.obstacleId);
   if(ctx.chapterRules?.has('diagonal')){
    for(const at of adjacentChapterCells(s,i,true)){
     const obstacle=obstacleAt(s,at);
     if(obstacle?.chapter?.kind==='diagonal')side.push(obstacle.id);
    }
   }
   return side.filter((id):id is string=>!!id);
  })):[];
  const directFrost=supportsVisibleTargets(s.engineVersion)&&effect.kind!=='match';
  for(const i of effect.cells){
   if(directFrost&&!effect.frostHandled?.includes(i))hitFrost(ctx,i,effect.id);
   if(ctx.protected.has(i))continue;const cell=s.cells[i]!,oldId=obstacleIds.get(i),oldObstacle=oldId?s.obstacles[oldId]:undefined;
   if(oldId){const existed=!!oldObstacle;damageObstacle(ctx,oldId,effect,touched);if(existed||touched.has(oldId))continue;}
   const t=cell.tile;if(!t||t.kind==='seed'||(effect.kind==='rainbow+rainbow'||effect.kind==='power-rainbow-aftershock')&&t.kind!=='normal')continue;
   if(isSpecial(t)&&!ctx.triggered.has(t.id)){ctx.triggered.add(t.id);cell.tile=null;ctx.events.push({type:'remove',cells:[i],kind:t.kind,effectId:effect.id});const own=ctx.family;ctx.family=ctx.familyTiles?.get(t.id);activate(ctx,i,t.kind,undefined,swarm,true);ctx.family=own;}
   else if(t.kind==='normal'){cell.tile=null;goal(s,t.color);ctx.events.push({type:'remove',cells:[i],kind:t.color,effectId:effect.id});}
   if(!directFrost)hitFrost(ctx,i,effect.id);
  }
  for(const id of adjacentIds){const o=s.obstacles[id];if(o&&(o.kind==='crate'||o.kind==='pot'||o.kind==='cabinet'||o.kind==='moss'||o.kind==='pipe'||o.kind==='bud'||o.kind==='carousel'||isBreakableObstacle(o.kind)))damageObstacle(ctx,id,effect,touched);}
  // Clear all launch neighborhoods first; each delivery then sees live obstacles.
  if(swarm)for(const flight of swarm.flights)ctx.queue.push({id:++s.effectSequence,cells:[],kind:'glider-impact',glider:{...flight,swarm},...(effect.family?{family:effect.family}:{})});
  // Pots collect a color charge from each matching-color natural match anywhere on the board.
  if(effect.kind==='match')for(const o of Object.values(s.obstacles).sort((a,b)=>a.anchor-b.anchor))if((o.kind==='pot'||o.kind==='curtain')&&o.color===effect.color)damageObstacle(ctx,o.id,effect,touched);
  effect.openedPlanters?.forEach(opener=>revealPlanters(s,opener,ctx.events));
  if(s.gardenPuzzle&&(effect.puzzle||s.gardenPuzzle.kind==='fence'))finishPuzzleImpact(s,effect.puzzle??{},effect.cells,effect.id,ctx.events);
  }
}
function matchCreationCells(s:GameState,matches:Match[]):Set<number> {
 return new Set(matches.filter(match=>match.kind&&!obstacleAt(s,match.anchor)).map(match=>match.anchor));
}
function resolveMatches(ctx:Context,matches:Match[],cascade:boolean):void {
 const s=ctx.s;ctx.protected=matchCreationCells(s,matches);
 const pending=ctx.directMatches?ctx.queue.splice(0):[];
 // Every group is one effect. Creation cells are immune to all removals in this whole match phase.
 for(const m of matches){
  const impact=enqueue(ctx,m.cells,'match',m.color,true);
  impact.matchPower=m.kind;
  if(cascade)impact.cascadeMatch=true;
 }
 ctx.queue.push(...pending);
 processEffects(ctx);
 for(const m of matches)if(m.kind&&ctx.protected.has(m.anchor)){const old=s.cells[m.anchor]!.tile;if(old?.kind==='normal')goal(s,old.color);s.cells[m.anchor]!.tile={id:s.nextTileId++,kind:m.kind};hitFrost(ctx,m.anchor);ctx.events.push({type:'spawn',cells:[m.anchor],kind:m.kind});}
 ctx.protected.clear();
 ctx.directMatches=undefined;
}
function laneGravity(ctx:Context,covered:ReadonlySet<number>):void {
 const s=ctx.s;
 // Paths are explicit top-to-bottom DAG lanes. Every lane head is a declared supply inlet.
 for(const lane of s.gravity){let segment:number[]=[];let refill=!covered.has(lane[0]!);
  const settle=()=>{if(!segment.length)return;let again=true,round=0;while(again){if(++round>lane.length+2)throw new Error('GRAVITY_LIMIT');again=false;const present=segment.flatMap(i=>s.cells[i]!.tile?[{tile:s.cells[i]!.tile!,from:i}]:[]);for(const i of segment)s.cells[i]!.tile=null;for(let k=present.length-1,at=segment.length-1;k>=0;k--,at--){const p=present[k]!,dest=segment[at]!;s.cells[dest]!.tile=p.tile;if(dest!==p.from)ctx.events.push({type:'fall',cells:[dest],from:p.from,to:dest});}
    for(const i of segment){if(s.cells[i]!.exit&&s.cells[i]!.tile?.kind==='seed'){s.cells[i]!.tile=null;goal(s,'seed');ctx.events.push({type:'remove',cells:[i],kind:'seed'});again=true;}}
   }
   if(refill)for(const i of segment)if(!s.cells[i]!.tile){
    const supplied=tile(s);
    s.cells[i]!.tile=supplied;
    ctx.events.push({type:'spawn',cells:[i],kind:supplied.kind,...(ctx.updraft||s.goldGarden?{inlet:lane[0]}:{})});
   }
   segment=[];
  };
  for(const i of lane){if(supportsOpenGardenStages(s.engineVersion)&&s.gardenStage?.connected.includes(i))continue;if(obstacleAt(s,i)){settle();refill=false;}else segment.push(i);}settle();
 }
}
/** Unanchored boxes occupy the vacancy before pieces can refill it. Move
 * from the bottom upwards, preserving box identity, HP and contents. */
function settleCrates(ctx:Context):void {
 const {s}=ctx;
 if(ctx.updraft||s.devices||s.gardenPuzzle)return;
 const crates=Object.values(s.obstacles).filter(o=>(o.kind==='crate'||o.kind==='supply-crate')&&
  !o.rule&&!o.chapter&&!o.cover&&!o.link&&!o.path&&!o.color&&!o.seeds&&!o.storedRocket);
 if(!crates.length)return;
 const reserved=new Set([...seedExitLanes(s).flat(),...(s.gardenStage?.channels??[])]);
 const vertical=new Set(s.gravity.flatMap(lane=>lane.slice(0,-1).filter((at,i)=>lane[i+1]===at+s.width)));
 crates.sort((a,b)=>Math.max(...b.footprint)-Math.max(...a.footprint)||a.anchor-b.anchor);
 for(const crate of crates){
  const from=crate.anchor;
  while(crate.footprint.every(at=>{
   const dest=at+s.width,cell=s.cells[dest];
   return vertical.has(at)&&cell?.exists&&!reserved.has(dest)&&!cell.tile&&!cell.frost&&
    (!cell.obstacleId||cell.obstacleId===crate.id);
  })){
   for(const at of crate.footprint)delete s.cells[at]!.obstacleId;
   crate.anchor+=s.width;crate.footprint=crate.footprint.map(at=>at+s.width);
   for(const at of crate.footprint)s.cells[at]!.obstacleId=crate.id;
  }
  if(crate.anchor!==from)ctx.events.push({type:'mechanic',kind:'crate-fall',cells:[...crate.footprint],
   from,to:crate.anchor,obstacleId:crate.id,obstacleAfter:copy(crate)});
 }
}
function gravity(ctx:Context):void {
 const s=ctx.s;
 if(s.goldGarden&&s.moves===0)return;
 const direction=ctx.updraft?-1:1,covered=coveredGravityInlets(s,direction);
 const continuous=supportsContinuousRefill(s.engineVersion);
 if(continuous)settleCrates(ctx);
 // Restore the coin lanes after all queued hits have settled. New coins can only be hit next turn.
 if(s.goldGarden)for(const at of s.goldGarden.coinCells){
  const cell=s.cells[at]!;
  if(cell.obstacleId)continue;
  const id=`gold-${s.turn}-${at}`;
  s.obstacles[id]={id,kind:'crate',anchor:at,footprint:[at],hp:1,maxHp:1};
  cell.obstacleId=id;
 }
 laneGravity(ctx,covered);
 if(s.goldGarden||!supportsFlowGravity(s.engineVersion))return;
 const flow=gravityFlow(s,direction,covered),limit=s.cells.length*s.cells.length;
 // Straight settling wins every time. A side feed is one recorded cell step,
 // followed by another straight settle/refill, so presentation sees the route.
 for(let round=0;round<limit;round++){
  const move=flow.next();if(!move){
   // A new wall can temporarily cut off an otherwise valid route. Refill the
   // isolated playable cells in place once all possible falling/side feed ends.
   if(continuous)for(const [at,cell] of s.cells.entries())if(cell.exists&&!cell.tile&&!blocked(s,at)){
    cell.tile=tile(s);
    ctx.events.push({type:'spawn',cells:[at],kind:'normal',localRefill:true});
   }
   return;
  }
  s.cells[move.to]!.tile=s.cells[move.from]!.tile;s.cells[move.from]!.tile=null;
  ctx.events.push({type:'fall',cells:[move.to],from:move.from,to:move.to});laneGravity(ctx,covered);
 }
 throw new Error('GRAVITY_FLOW_LIMIT');
}
// New floor rules advance after each damage phase, before any refill or next
// match. Earlier published rules keep their end-of-action replay order.
function cascades(ctx:Context,initial?:Match[],deviceMatches?:DeviceMatch[],afterShift=false):void {
 let matches=initial??[];
 for(let round=0;round<MAX_CASCADES;round++){
  if(matches.length){
   if(deviceMatches)for(const group of matches)deviceMatches.push({cells:group.cells,color:group.color,wave:afterShift?-1-round:round});
   resolveMatches(ctx,matches,round>0||afterShift);
  }else processEffects(ctx);
  if(supportsImmediateGardenStages(ctx.s.engineVersion))advanceGardenStage(ctx.s,ctx.events);
  gravity(ctx);ctx.capture?.(ctx.s,ctx.events);matches=findMatches(ctx.s);if(!matches.length)return;
 }
 throw new Error('CASCADE_LIMIT');
}
function growMoss(ctx:Context):void {
 if(ctx.mossHit)return;const s=ctx.s,moss=Object.values(s.obstacles).filter(o=>o.kind==='moss').sort((a,b)=>a.anchor-b.anchor);
 for(const o of moss){const target=neighbors(s,o.anchor).find(i=>!obstacleAt(s,i)&&!s.cells[i]!.frost&&!s.cells[i]!.exit&&s.cells[i]!.tile?.kind==='normal');if(target===undefined)continue;const id=`moss-${s.turn}-${target}`;s.obstacles[id]={id,kind:'moss',hp:1,maxHp:1,anchor:target,footprint:[target]};s.cells[target]!.obstacleId=id;s.cells[target]!.tile=null;for(const g of s.goals)if(g.kind==='moss'){g.count++;g.remaining++;}ctx.events.push({type:'moss',cells:[target],kind:'moss'});return;}
}
/** One deterministic step per paid move; inventory tools do not advance the carousel. */
function rotatePlanters(ctx:Context):void {
 const s=ctx.s;
 for(const o of Object.values(s.obstacles).filter(o=>o.kind==='carousel').sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
  const path=o.path??[],from=o.anchor,to=path[(path.indexOf(from)+1)%path.length];
  if(to===undefined||s.cells[to]!.obstacleId||s.cells[to]!.frost||s.cells[to]!.exit||s.cells[to]!.tile?.kind==='seed')continue;
  const displaced=s.cells[to]!.tile;delete s.cells[from]!.obstacleId;s.cells[from]!.tile=displaced;s.cells[to]!.tile=null;s.cells[to]!.obstacleId=o.id;o.anchor=to;o.footprint=[to];
  if(displaced)ctx.events.push({type:'fall',cells:[from],from:to,to:from});
  ctx.events.push({type:'mechanic',kind:'carousel',cells:[from,to],from,to,obstacleId:o.id,obstacleAfter:copy(o)});
 }
}
function canSwap(s:GameState,a:number,b:number):boolean {
 if(!movable(s,a)||!movable(s,b)||!neighbors(s,a).includes(b))return false;
 const t=s.cells[a]!.tile!,u=s.cells[b]!.tile!;if(t.kind==='seed'||u.kind==='seed')return false;
 if(isSpecial(t)||isSpecial(u))return true;
 const portal=portalTransfer(s,a,b);
 s.cells[a]!.tile=u;s.cells[b]!.tile=t;
 if(portal){
  const [entry,exit]=portal;
  [s.cells[entry]!.tile,s.cells[exit]!.tile]=[s.cells[exit]!.tile,s.cells[entry]!.tile];
 }
 const found=(t.color!==u.color&&pairedPlates(s,a,b).length>0)||
  findMatches(s).some(m=>m.cells.includes(a)||m.cells.includes(b)||!!portal&&m.cells.includes(portal[1]));
 if(portal){
  const [entry,exit]=portal;
  [s.cells[entry]!.tile,s.cells[exit]!.tile]=[s.cells[exit]!.tile,s.cells[entry]!.tile];
 }
 s.cells[a]!.tile=t;s.cells[b]!.tile=u;return found;
}
export function legalActions(s:GameState):Action[] {
 if(s.status!=='playing'||s.moves<=0)return [];const actions:Action[]=[];
 for(let i=0;i<s.cells.length;i++){if(movable(s,i)&&isSpecial(s.cells[i]!.tile))actions.push({type:'tap',at:i});for(const j of neighbors(s,i))if(j>i&&canSwap(s,i,j)||s.gardenPuzzle?.kind==='cart'&&canPushHarvestCart(s,i,j))actions.push({type:'swap',from:i,to:j});}
 const ring=turntableCells(s);
 const turntable=ring?.find(at=>!isSpecial(s.cells[at]!.tile));
 if(turntable!==undefined)actions.push({type:'tap',at:turntable});
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
function resolveAction(input:GameState,action:Action,capture?:CascadeCapture):ActionResult {
 const invalid=(reason:string):ActionResult=>({state:input,events:[{type:'invalid',cells:[]}],accepted:false,reason});
 if(!supportsEngine(input.engineVersion))return invalid('ENGINE_VERSION');
 if(input.goldGarden&&(action.type==='booster'||action.type==='continue'))return invalid('GOLD_GARDEN_POWER_ONLY');
 if(action.type==='continue'){if(input.status!=='lost'||action.moves!==5)return invalid('CONTINUE_NOT_ALLOWED');const state=copy(input);state.moves+=5;state.status='playing';return {state,events:[],accepted:true};}
 if(input.status!=='playing'||input.moves<=0)return invalid('RUN_NOT_PLAYING');
 const repairSeeds=supportsSeedDelivery(input.engineVersion)||supportsFlowGravity(input.engineVersion)&&missingSeedCount(input)>0;
 const s=copy(input),events:GameEvent[]=[];const ctx:Context={s,events,queue:[],protected:new Set(),triggered:new Set(),mossHit:false,effects:0,capture};let usesMove=false,initial:Match[]|undefined;
 if(supportsChapterObstacles(s.engineVersion)){
  const kinds=Object.values(s.obstacles).flatMap(obstacle=>obstacle.chapter?[obstacle.chapter.kind]:[]);
  if(kinds.length)ctx.chapterRules=new Set(kinds);
 }
 try {
  const active=currentDevice(s);
  if(action.type==='swap'&&canPushHarvestCart(s,action.from,action.to)){
   pushHarvestCart(s,action.from,action.to,events);usesMove=true;initial=findMatches(s,[action.from]);
  }else if(action.type==='swap'){
   const {from,to}=action;if(!canSwap(s,from,to))return invalid('INVALID_SWAP');
   const a=s.cells[from]!.tile!,b=s.cells[to]!.tile!;s.cells[from]!.tile=b;s.cells[to]!.tile=a;events.push({type:'swap',cells:[from,to],from,to});usesMove=true;
   if(isSpecial(a)&&isSpecial(b)){ctx.fusion=true;combine(ctx,to,a.kind,b.kind,from);}
   else if(isSpecial(a)||isSpecial(b)){
    // Resolve ordinary matches in the same phase to protect new power-ups.
    if(s.engineVersion!==LEGACY_ENGINE_VERSION)initial=findMatches(s,[to,from]);
    const power=isSpecial(a)?a:isSpecial(b)?b:null;
    if(active?.kind!=='carrier'&&power){
     const at=power===a?to:from,normal=power===a?b:a;
     const color=normal.kind==='normal'?normal.color:undefined;
     ctx.triggered.add(power.id);s.cells[at]!.tile=null;events.push({type:'remove',cells:[at],kind:power.kind});
     hitFrost(ctx,at);
     if(supportsMatchFirst(s.engineVersion)&&initial?.length){
      ctx.directMatches=new Set(initial.flatMap(match=>match.cells));
      enqueue(ctx,[at],'activate-power',color).power=power.kind;
     }else{
      if(power.kind==='glider'&&supportsSeedDelivery(s.engineVersion)&&initial)ctx.protected=matchCreationCells(s,initial);
      activate(ctx,at,power.kind,color,undefined,true);
     }
    }
   }else{
    const portal=portalTransfer(s,from,to);
    if(portal){
     const [entry,exit]=portal;
     [s.cells[entry]!.tile,s.cells[exit]!.tile]=[s.cells[exit]!.tile,s.cells[entry]!.tile];
     events.push({type:'mechanic',kind:'portal-transfer',cells:portal,from:entry,to:exit});
    }
    if(a.kind==='normal'&&b.kind==='normal'&&a.color!==b.color){
     const charged=pairedPlates(s,from,to);
     if(charged.length)s.devices!.chargedPlates=[...(s.devices!.chargedPlates??[]),...charged];
    }
    initial=findMatches(s,portal?[portal[1],to,from]:[to,from]);
    // Only the immediate, deliberate two-color double match earns a hive.
    // Cascades, power swaps, squares and existing four/five matches keep their rules.
    if(supportsBeehive(s.engineVersion)&&a.kind==='normal'&&b.kind==='normal'&&a.color!==b.color){
     const source=initial.find(m=>m.cells.includes(from)),destination=initial.find(m=>m.cells.includes(to));
     if(source&&destination&&source!==destination&&source.cells.length===3&&destination.cells.length===3&&!source.kind&&!destination.kind){destination.kind='beehive';destination.anchor=to;}
    }
   }
  }else if(action.type==='tap'){
   const {at}=action,ring=turntableCells(s);
   if(!movable(s,at))return invalid('INVALID_TAP');
   if(isSpecial(s.cells[at]!.tile)){
    if(active?.kind==='carrier'&&active.zones[0]!.includes(at))events.push({type:'mechanic',kind:'carrier-launch',cells:[at]});
    enqueue(ctx,[at],'tap');
   }else if(ring?.includes(at)){
    rotateTurntable(s,ring,events);
    initial=findMatches(s,ring);
   }else return invalid('INVALID_TAP');
   usesMove=true;
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
   const at=action.at,cell=s.cells[at]!,obstacle=obstacleAt(s,at);
   const strikeFrost=supportsVisibleTargets(s.engineVersion);
   if(!cell.tile&&!obstacle&&!cell.frost)return invalid('EMPTY_BOOSTER_TARGET');
   if(action.item==='hammer'&&!(strikeFrost&&cell.frost)){
    if(cell.tile?.kind==='seed')return invalid('SEED_NOT_REMOVABLE');
    if(obstacle&&endpointPipe(obstacle,s.engineVersion)&&!pipeEnd(obstacle,at))return invalid('PIPE_END_REQUIRED');
    if(obstacle&&(obstacle.kind==='pot'||obstacle.kind==='bud'||obstacle.kind==='curtain'||(obstacle.kind==='cabinet'&&obstacle.color)))return invalid('COLOR_CHARGE_REQUIRED');
    if(obstacle?.kind==='windmill')return invalid('WIND_SEED_REQUIRED');
    if(obstacle?.cover)return invalid('PLANTER_COVERED');
    if(obstacle?.chapter&&(chapterGuarded(s,obstacle)||obstacle.chapter.kind==='fusion'))return invalid('NO_EFFECTIVE_TARGET');
    if(isDeviceGate(s.devices?.steps,at))return invalid('DEVICE_GATE_REQUIRED');
   }
   const targets=action.item==='hammer'?[at]:line(s,at,action.item==='sweep-row');
   const effective=targets.some(i=>{
    if(strikeFrost&&s.cells[i]!.frost)return true;
    const o=obstacleAt(s,i),t=s.cells[i]!.tile;
    return o?!o.cover&&canHitObstacleRule(o,action.item)&&o.kind!=='pot'&&o.kind!=='bud'&&o.kind!=='curtain'&&o.kind!=='windmill'&&!(o.kind==='cabinet'&&o.color)&&(!s.gardenPuzzle||canHitPuzzleObstacle(s,o,action.item)):!!t&&t.kind!=='seed';
   });
   if(!effective)return invalid('NO_EFFECTIVE_TARGET');
   enqueue(ctx,targets,action.item);
   }
  }else return invalid('UNKNOWN_ACTION');
  if(usesMove){
   s.moves--;s.turn++;
   if(ctx.chapterRules?.has('window'))advanceChapterWindows(s,events);
  }
  const deviceMatches=active&&(usesMove||active.kind==='keys'||active.kind==='pollen')?[] as DeviceMatch[]:undefined;
  if(events.some(event=>event.kind==='portal-transfer'||event.kind==='turntable-spin'))ctx.capture?.(s,events);
  const echoAt=s.devices?.echoAt;
  if(usesMove&&active?.kind==='echo'&&echoAt!==undefined){
   delete s.devices!.echoAt;
   const cells=area(s,echoAt,1);
   events.push({type:'mechanic',kind:'echo-pulse',cells,from:echoAt});
   enqueue(ctx,cells,'echo-pulse');
  }
  const gravityLanes=s.gravity;
  if(currentDevice(s)?.kind==='updraft'){
   ctx.updraft=true;
   s.gravity=gravityLanes.map(lane=>[...lane].reverse());
  }
  try{cascades(ctx,initial,deviceMatches);}
  finally{s.gravity=gravityLanes;ctx.updraft=false;}
  if(deviceMatches){
   const rotated=advanceConveyor(s,events);
   if(rotated)cascades(ctx,findMatches(s),deviceMatches,true);
   if(paintTiles(s,deviceMatches,events))cascades(ctx,findMatches(s),deviceMatches,true);
   const reflected=mirrorTargets(s,deviceMatches);
   if(reflected.length){
    events.push({type:'mechanic',kind:'mirror-pulse',cells:reflected});
    enqueue(ctx,reflected,'mirror-pulse');
    cascades(ctx,undefined,deviceMatches,true);
   }
   if(advanceDevice(s,events,deviceMatches,rotated,usesMove))cascades(ctx);
  }
  if(usesMove&&Object.values(s.obstacles).some(o=>o.kind==='carousel')&&!s.goals.every(g=>g.remaining===0)){rotatePlanters(ctx);cascades(ctx);}
  if(usesMove){
   for(const obstacle of Object.values(s.obstacles)){
    if(obstacle.detonateAt!==undefined&&obstacle.detonateAt<=s.turn)enqueue(ctx,[obstacle.anchor],'fuse-timer').obstacleTargetId=obstacle.id;
   }
   if(ctx.chapterRules?.has('landing')||ctx.chapterRules?.has('swap')){
    for(const obstacle of chapterMoveTargets(s,action,events)){
     enqueue(ctx,[obstacle.anchor],'chapter-move-hit').obstacleTargetId=obstacle.id;
    }
   }
   if(ctx.queue.length)cascades(ctx);
  }
  if(!supportsImmediateGardenStages(s.engineVersion))advanceGardenStage(s,events);
  // Restore missing pouches in an already-stalled save while keeping its rules and goal count.
  // Newly created runs also recover a pouch if any other board mechanic removes it.
  if(repairSeeds)restoreMissingSeeds(ctx,missingSeedCount(s));
  if(usesMove&&!s.goals.every(g=>g.remaining===0)&&Object.values(s.obstacles).some(o=>o.rule!==undefined))advanceObstacleRules(s,events);
  if(s.goals.every(g=>g.remaining===0)||s.goldGarden&&s.moves===0){s.status='won';events.push({type:'win',cells:[]});}
  else {if(usesMove)growMoss(ctx);if(s.goals.every(g=>g.remaining===0)){s.status='won';events.push({type:'win',cells:[]});}else if(s.moves===0){s.status='lost';events.push({type:'lose',cells:[]});}else if(!legalActions(s).length&&!reshuffle(s,events))throw new Error('UNRECOVERABLE_DEADLOCK');}
  return {state:s,events,accepted:true};
 }catch(error){s.status='error';s.error=error instanceof Error?error.message:'ENGINE_FAILURE';events.push({type:'error',cells:[],kind:s.error});return {state:s,events,accepted:true,reason:s.error};}
}
/** Server/replay path: no presentation snapshots or additional random draws. */
export function applyAction(input:GameState,action:Action):ActionResult{return resolveAction(input,action);}
export interface CascadeFrame {state:GameState;events:GameEvent[]}
/** Local presentation only. Real post-refill states keep intermediate pieces
 * visible until their own next match. They never enter saved runs or the API. */
export function actionWithFrames(input:GameState,action:Action):ActionResult&{frames:CascadeFrame[]}{
 const frames:CascadeFrame[]=[];let cursor=0;
 const result=resolveAction(input,action,(state,events)=>{
  if(frames.length>=12||events.length===cursor)return;
  frames.push({state:copy(state),events:copy(events.slice(cursor))});cursor=events.length;
 });
 if(!result.accepted||result.state.status==='error')return {...result,frames:[]};
 if(!frames.length)frames.push({state:result.state,events:result.events});
 else{const last=frames.at(-1)!;last.state=result.state;last.events.push(...copy(result.events.slice(cursor)));}
 return {...result,frames};
}
export function replay(level:LevelDefinition,actions:Action[],preBoosters:PreBooster[]=[]):ActionResult {
 if(actions.length>1024)throw new Error('ACTION_LIMIT');let state=createGame(level,preBoosters);const events:GameEvent[]=[];
 for(const action of actions){const result=applyAction(state,action);if(!result.accepted)return {...result,events:[...events,...result.events]};state=result.state;events.push(...result.events);if(state.status==='error')return {state,events,accepted:false,reason:state.error};}
 return {state,events,accepted:true};
}
/** Stable FNV-1a diagnostic fingerprint; not a security proof. Server replay is authoritative. */
export function stateHash(s:GameState):string {const value=JSON.stringify(s);let hash=0x811c9dc5;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,0x01000193);}return (hash>>>0).toString(16).padStart(8,'0');}

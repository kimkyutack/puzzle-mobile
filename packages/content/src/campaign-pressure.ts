import {COLORS,supportsContinuousRefill,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {unsuppliedTileCells} from './refill-corridors';

/** Content-only revision: saved Run.level and the simulation rules are unchanged. */
export const CAMPAIGN_PRESSURE_VERSION='campaign-pressure-v90';
const rank={normal:0,hard:1,super:2} as const;
const denseKinds=new Set<Obstacle['kind']>(['crate','urn','supply-crate','tea-caddy','honeycomb','acorn-nest','cloud-pillow','mushroom-cluster','crystal-geode']);
// Remote targets have exact ammunition/link invariants. Increase the effort at
// their sources, never silently add HP to an unreachable door or roller.
const layerCaps:Partial<Record<Obstacle['kind'],number>>={
 crate:3,urn:3,'supply-crate':3,'flower-seal':3,statue:6,cabinet:3,
 'tea-caddy':3,honeycomb:3,'acorn-nest':3,'cloud-pillow':3,'mushroom-cluster':3,
 'crystal-geode':3,'star-core':3,'wind-pod':2,'petal-launcher':3,
 'roller-pin':3,'dew-cache':3,'bloom-bud':3,'shelf-vase':3,
 'canopy-orchid':3,'awning-crank':3,'journey-vine':3,'journey-relic':3,
 'rail-pot':4,'boomerang-pod':3,'linked-crystal':3,
};

export function campaignPressureProfile(id:number,difficulty:LevelDefinition['difficulty']){
 const challenge=rank[difficulty];
 // A continuous curve between 100-level checkpoints avoids the old 401–2000
 // plateau. The visible amount/layers and move pressure share this progression.
 const growth=Math.log2(1+Math.max(0,id-50)/100);
 const ramp=id<50?Math.max(0,(id-30)/20):1;
 return {
  growth,ramp,challenge,
  moveRatio:id<50?1-.07*ramp:Math.max(.55,.84-challenge*.065-growth*.025),
  layerShare:Math.min(1,ramp*(.28+challenge*.18+growth*.1)),
  extraPieces:id<50?0:3+Math.floor(growth*1.2)+challenge*2,
  bankShare:id<50?0:Math.min(.48,.27+challenge*.06+growth*.025),
  extraGates:id<50?0:3+Math.floor(growth*.9)+challenge,
 };
}

function teaching(level:LevelDefinition){
 return !!level.tutorial||level.campaign?.beat==='introduction';
}

function thicken(level:LevelDefinition,share:number):Obstacle[]{
 const eligible=level.obstacles.filter(o=>layerCaps[o.kind]&&!o.rule&&!o.chapter&&!o.cover&&!o.color&&!o.endOnly);
 // Spread layers through the bank instead of protecting just its first corner.
 const selected=new Set(eligible.filter((_,i)=>Math.floor((i+1)*share)>Math.floor(i*share)).map(o=>o.id));
 const obstacles=level.obstacles.map(o=>{
  if(!selected.has(o.id))return o;
  const hp=Math.max(o.hp,Math.min(layerCaps[o.kind]!,o.hp+1)),contents=o.contents&&{
   ...o.contents,hp:Math.min(3,o.contents.hp+1),
   ...(o.contents.innerCrateHp!==undefined?{innerCrateHp:Math.min(3,o.contents.innerCrateHp+1)}:{}),
  };
  return {...o,hp,maxHp:Math.max(o.maxHp,hp),...(contents?{contents}:{})};
 });
 return obstacles.map(o=>{
  if(o.kind!=='sun-gate')return o;
  const hp=obstacles.filter(p=>p.kind==='petal-launcher'&&p.link===o.id).reduce((n,p)=>n+p.hp,0);
  return {...o,hp,maxHp:hp};
 });
}

/** Grow the existing bank with the same artwork and rules. Keep authored
 * routes, special placements, goals, spawn lanes and all open refill cells. */
function expandBank(level:LevelDefinition,extra:number,bankShare:number):LevelDefinition{
 if(!extra||level.gardenStage||level.gardenPuzzle||level.devices?.length||level.siege||level.exits?.length||
  level.strategy?.id.startsWith('chain-campaign/')||level.strategy?.id.startsWith('split-wind/'))return level;
 const eligible=level.obstacles.filter(o=>denseKinds.has(o.kind)&&o.footprint.length===1&&
  !o.rule&&!o.chapter&&!o.cover&&!o.color&&!o.link&&!o.path&&!o.seeds);
 if(eligible.length<3)return level;
 const counts=new Map<string,number>();for(const o of eligible)counts.set(o.kind,(counts.get(o.kind)??0)+1);
 const kind=[...counts].sort((a,b)=>b[1]-a[1])[0]![0];
 const template=eligible.find(o=>o.kind===kind)!;
 const goalKind=template.contents?.kind??template.kind;
 if(!level.goals.some(g=>g.kind===goalKind))return level;
 const protectedCells=new Set([...(level.protectedCells??[]),...(level.inlets??[]),
  level.startBoosterGuide?.cell,...level.obstacles.flatMap(o=>o.path??[])]);
 const occupied=new Set(level.obstacles.flatMap(o=>o.footprint));
 const adjacent=(at:number)=>[at-level.width,at+level.width,...(at%level.width?[at-1]:[]),...(at%level.width<level.width-1?[at+1]:[])];
 let current=level,added=0;
 // Never exceed half the board: there must be room to form triples and powers.
 const size=level.shape.filter(Boolean).length;
 const cap=Math.min(Math.max(extra,Math.ceil(size*bankShare)-occupied.size),Math.max(0,Math.floor(size*.48)-occupied.size));
 const previouslyUnsupplied=new Set(unsuppliedTileCells(level));
 for(let i=0;i<cap;i++){
  const candidates=level.shape.flatMap((exists,at)=>exists&&Math.floor(at/level.width)>=2&&!occupied.has(at)&&
   !protectedCells.has(at)&&!level.frost?.[at]&&(!level.initial||level.initial[at]?.kind==='normal')&&
   adjacent(at).some(next=>occupied.has(next))?[at]:[])
   .sort((a,b)=>{
    const score=(at:number)=>adjacent(at).filter(next=>occupied.has(next)).length*8+Math.floor(at/level.width)*2;
    return score(b)-score(a)||a-b;
   });
  let next:LevelDefinition|undefined;
  for(const at of candidates){
   const piece:Obstacle={...structuredClone(template),id:`pressure-${at}`,anchor:at,footprint:[at]};
   const trial={...current,obstacles:[...current.obstacles,piece],
    ...(current.initial?{initial:current.initial.map((tile,index)=>index===at?null:tile)}:{})};
   if(unsuppliedTileCells(trial).some(cell=>!previouslyUnsupplied.has(cell)))continue;
   next=trial;occupied.add(at);break;
  }
  if(!next)break;
  current=next;added++;
 }
 if(!added)return level;
 return {...current,goals:current.goals.map(g=>g.kind===goalKind?{...g,count:g.count+added,remaining:g.remaining+added}:g)};
}

export function campaignPressureLevel(source:LevelDefinition):LevelDefinition{
 if(source.id<=30||!supportsContinuousRefill(source.engineVersion)||teaching(source)||source.goldGarden||
  source.version.includes(CAMPAIGN_PRESSURE_VERSION))return source;
 const profile=campaignPressureProfile(source.id,source.difficulty);
 let level=expandBank(source,profile.extraPieces,profile.bankShare);
 level={...level,obstacles:thicken(level,profile.layerShare)};
 if(level.frost){
  const frost=Object.fromEntries(Object.entries(level.frost).map(([at,hp],i)=>[at,
   Math.max(hp,Math.min(3,hp+Number(Math.floor((i+1)*profile.layerShare)>Math.floor(i*profile.layerShare))))]));
  const count=Object.values(frost).reduce((a,b)=>a+b,0);
  level={...level,frost,goals:level.goals.map(g=>g.kind==='frost'?{...g,count,remaining:count}:g)};
 }
 if(level.gardenStage){
  let stage=level.gardenStage;
  if(source.id>=50&&level.width===9&&level.height===9&&!level.obstacles.length){
   // Longer, multi-row paths cannot all be opened by one horizontal rocket.
   // Reuse the existing route rules/art, with four alternating garden lanes.
   const channels:number[]=[];
   for(let lane=0;lane<4;lane++){
    const y=1+lane*2,columns=lane%2===0?[1,2,3,4,5,6,7]:[7,6,5,4,3,2,1];
    for(const x of columns)channels.push(y*9+x);
    if(lane<3)channels.push((y+1)*9+columns.at(-1)!);
   }
   const destinations=stage.destinations.length===1?[channels.at(-1)!]:
    stage.destinations.map((_,i)=>channels[Math.floor((i+1)*(channels.length-1)/stage.destinations.length)]!);
   stage={...stage,channels,source:channels[0]!,destinations,gates:[]};
  }
  const blocked=new Set(stage.gates);
  const eligible=stage.channels.filter(at=>at!==stage.source&&!stage.destinations.includes(at)&&!blocked.has(at));
  // Deterministic distributed gates; every one is visible under a real tile.
  const target=Math.min(eligible.length,source.id>=50?18+profile.extraGates:profile.extraGates);
  for(let i=0;i<target;i++)blocked.add(eligible[Math.floor(i*eligible.length/target)]!);
  const colorCount=source.id>=200?6:source.id>=50?5:level.colors.length;
  const colors=[...level.colors,...COLORS.filter(color=>!level.colors.includes(color))].slice(0,colorCount);
  level={...level,colors,gardenStage:{...stage,gates:stage.channels.filter(at=>blocked.has(at))}};
 }
 const chain=source.strategy?.id.startsWith('chain-campaign/');
 const floor=chain?5:source.id<50?12:source.gardenStage?8:12-profile.challenge;
 // Remove inherited generosity rather than keeping Math.max(oldMoves, floor).
 const baseMoves=source.gardenStage&&source.id>=50?Math.min(source.moves,12):source.moves;
 const moves=Math.max(floor,Math.floor(baseMoves*profile.moveRatio));
 return {...level,moves:Math.min(source.moves,moves),version:source.version+':'+CAMPAIGN_PRESSURE_VERSION,
  ...(level.journey?.next?{journey:{...level.journey,next:campaignPressureLevel(level.journey.next)}}:{}),
 };
}

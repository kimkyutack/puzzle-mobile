import {COLORS,ENGINE_VERSION,type Action,type LevelDefinition,type Color,type Goal,type Obstacle} from '@garden/contracts';
import {BULK_CONTENT_VERSION,type BulkBeat} from '../../packages/content/src/bulk';

export const challenge=(beat:BulkBeat)=>({easy:0,normal:1,hard:2,super:3,celebration:0})[beat];
export function varyTemplate(source:LevelDefinition,tier:number,beat:BulkBeat,variant:number,attempt:number){
 const level=structuredClone(source),n=level.shape.length,w=level.width,strength=tier+challenge(beat),delta=Math.min(3,Math.floor(strength/2));
 delete level.tutorial;delete level.protectedCells;delete level.campaign;
 level.version=BULK_CONTENT_VERSION;level.engineVersion=ENGINE_VERSION;level.moves=80;level.approved=false;
 level.seed=source.seed+(tier*3+variant+attempt)*104729;
 const offset=(tier+variant+attempt)%COLORS.length,rename=(color:Color)=>COLORS[(COLORS.indexOf(color)+offset)%COLORS.length]!;
 level.colors=level.colors.map(rename);for(const tile of level.initial??[])if(tile?.kind==='normal')tile.color=rename(tile.color);
 for(const o of level.obstacles)if(o.color)o.color=rename(o.color);
 for(const g of level.goals)if(COLORS.includes(g.kind as Color))g.kind=rename(g.kind as Color);
 const occupied=new Set(level.obstacles.flatMap(o=>[...o.footprint,...(o.path??[])]));
 for(const o of level.obstacles){
  if(o.kind==='curtain')o.hp=Math.min(32,o.hp+strength*2);
  else if(o.kind==='pipe'){
   const extra=Math.min(2,Math.floor(strength/2));
   for(let k=0;k<extra;k++){const at=o.footprint.at(-1)!+w;if(at>=n||!level.shape[at]||occupied.has(at)||level.exits?.includes(at)||level.initial?.[at]?.kind==='seed')break;o.footprint.push(at);occupied.add(at);if(level.initial)level.initial[at]=null;}
   o.hp=o.footprint.length;
  }else if(o.kind!=='moss')o.hp=Math.min(o.kind==='crate'?5:8,o.hp+delta);
  o.maxHp=o.hp;
 }
 // Add quantity where space is available, preserving all seed-delivery columns.
 const seedColumns=new Set((level.exits??[]).map(i=>i%w)),available=(at:number)=>level.shape[at]&&!occupied.has(at)&&!seedColumns.has(at%w)&&!level.frost?.[at]&&level.initial?.[at]?.kind==='normal';
 if(strength>=2&&level.obstacles.some(o=>o.kind==='crate')){
  const count=Math.min(2,1+Math.floor(tier/3));let added=0;
  for(let at=n-w;at<n&&added<count;at++)if(available(at)){const hp=1+Math.min(2,delta);level.obstacles.push({id:`bulk-crate-${at}`,kind:'crate',hp,maxHp:hp,anchor:at,footprint:[at]});occupied.add(at);level.initial![at]=null;added++;}
 }
 const planter=level.obstacles.find(o=>o.kind==='carousel');
 if(strength>=4&&planter&&level.obstacles.filter(o=>o.kind==='carousel').length===1){
  const path=planter.path!,at=path[(path.indexOf(planter.anchor)+Math.floor(path.length/2))%path.length]!;
  if(!level.obstacles.some(o=>o.footprint.includes(at))&&level.initial?.[at]?.kind==='normal'){
   level.obstacles.push({...structuredClone(planter),id:`bulk-carousel-${at}`,anchor:at,footprint:[at]});level.initial[at]=null;
  }
 }
 if(level.frost)for(const key of Object.keys(level.frost))level.frost[Number(key)]=Math.min(3,level.frost[Number(key)]!+Math.floor(tier/2));
 const goals:Goal[]=level.goals.filter(g=>COLORS.includes(g.kind as Color)||g.kind==='combo'||g.kind==='special').map(g=>{
  const add=g.kind==='combo'?Math.min(1,Math.floor(strength/4)):g.kind==='special'?Math.min(3,Math.floor(strength/3)):Math.floor(g.count*(tier*.07+challenge(beat)*.035))+variant;
  return {...g,count:Math.min(80,g.count+add),remaining:Math.min(80,g.count+add)};
 });
 for(const kind of [...new Set(level.obstacles.map(o=>o.kind))]){const count=level.obstacles.filter(o=>o.kind===kind).length;goals.push({kind,count,remaining:count});}
 const frost=Object.values(level.frost??{}).reduce((sum,v)=>sum+v,0);if(frost)goals.push({kind:'frost',count:frost,remaining:frost});
 const seeds=(level.initial??[]).filter(t=>t?.kind==='seed').length+level.obstacles.reduce((sum,o)=>sum+(o.seeds??0),0);if(seeds)goals.push({kind:'seed',count:seeds,remaining:seeds});
 level.goals=goals;
 const mirror=variant===1,at=(i:number)=>Math.floor(i/w)*w+w-1-i%w;
 if(mirror){
  level.shape=level.shape.map((_,i)=>level.shape[at(i)]!);level.initial=level.initial?.map((_,i)=>level.initial![at(i)]!);
  if(level.frost)level.frost=Object.fromEntries(Object.entries(level.frost).map(([i,v])=>[at(Number(i)),v]));
  level.obstacles=level.obstacles.map(o=>({...o,anchor:at(o.anchor),footprint:o.footprint.map(at),...(o.path?{path:o.path.map(at)}:{})}));
  level.gravity=level.gravity?.map(lane=>lane.map(at));level.inlets=level.inlets?.map(at);level.exits=level.exits?.map(at);
 }
 if(beat==='celebration'){
  const forbidden=new Set(level.obstacles.flatMap(o=>[...o.footprint,...(o.path??[])])),cells=level.initial!.flatMap((t,i)=>t?.kind==='normal'&&!forbidden.has(i)&&!level.frost?.[i]?[i]:[]);
  for(const [k,i]of cells.slice(0,3).entries())level.initial![i]={id:30_000+k,kind:k%2?'bomb':'wind-row'};
 }
 const mapAction=(a:Action):Action=>!mirror?a:a.type==='swap'?{...a,from:at(a.from),to:at(a.to)}:a.type==='tap'?{...a,at:at(a.at)}:a;
 return {level,mapAction};
}

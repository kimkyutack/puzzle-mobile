import {GARDEN_WORLD,type GardenDefinition,type GridRect} from './catalog';
import type {GardenWorldState} from './model';

export const GARDEN_EXPANSION_COST=1000;
export const GARDEN_EXPANSION_TILES=20;
export interface GardenExpansionPlot extends GridRect {id:string}
type LandState=Pick<GardenWorldState,'unlockedRegions'|'expansions'>;
const contains=(r:GridRect,x:number,y:number)=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height;
export function gardenExpansionPlot(id:string,map:GardenDefinition=GARDEN_WORLD):GardenExpansionPlot|null{
 const match=/^land-(\d+)-(\d+)$/.exec(id);if(!match)return null;
 const x=Number(match[1]),y=Number(match[2]);
 if(id!==`land-${x}-${y}`||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||x+5>(map.maxWidth??map.width)||y+4>(map.maxHeight??map.height))return null;
 return {id,x,y,width:5,height:4};
}
export function gardenPlotCells(plot:GridRect){
 return Array.from({length:plot.width*plot.height},(_,i)=>({x:plot.x+i%plot.width,y:plot.y+Math.floor(i/plot.width)}));
}
export function isGardenCellUnlocked(world:LandState,x:number,y:number,map:GardenDefinition=GARDEN_WORLD):boolean{
 return map.regions.some(r=>world.unlockedRegions.includes(r.id)&&contains(r,x,y))||(world.expansions??[]).some(id=>{const plot=gardenExpansionPlot(id,map);return !!plot&&contains(plot,x,y);});
}
export function gardenLandCells(world:LandState,map:GardenDefinition=GARDEN_WORLD){
 const cells=new Map<string,{x:number;y:number}>();
 for(const region of map.regions)if(world.unlockedRegions.includes(region.id))for(const cell of gardenPlotCells(region))cells.set(cell.x+','+cell.y,cell);
 for(const id of world.expansions??[]){const plot=gardenExpansionPlot(id,map);if(plot)for(const cell of gardenPlotCells(plot))cells.set(cell.x+','+cell.y,cell);}
 return cells;
}
export function gardenBounds(world:Pick<GardenWorldState,'expansions'>&Partial<Pick<GardenWorldState,'unlockedRegions'>>,map:GardenDefinition=GARDEN_WORLD,preview?:GardenExpansionPlot|null){
 let width=map.width,height=map.height;
 for(const region of map.regions)if(world.unlockedRegions?.includes(region.id)){width=Math.max(width,region.x+region.width);height=Math.max(height,region.y+region.height);}
 for(const plot of [...(world.expansions??[]).map(id=>gardenExpansionPlot(id,map)),preview])if(plot){width=Math.max(width,plot.x+plot.width);height=Math.max(height,plot.y+plot.height);}
 return {width,height};
}
/** Exactly twenty new cells, connected to owned land; story land keeps its original unlock. */
export function canExpandGarden(world:LandState,plot:GardenExpansionPlot,map:GardenDefinition=GARDEN_WORLD):boolean{
 const parsed=gardenExpansionPlot(plot.id,map);if(!parsed||parsed.x!==plot.x||parsed.y!==plot.y||parsed.width!==plot.width||parsed.height!==plot.height)return false;
 const cells=gardenPlotCells(plot),reserved=map.regions.filter(r=>(r.storyLocked||r.id==='workshop'||r.id==='terrace')&&!world.unlockedRegions.includes(r.id));
 if(cells.some(c=>isGardenCellUnlocked(world,c.x,c.y,map)||reserved.some(r=>contains(r,c.x,c.y))))return false;
 return cells.some(c=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>isGardenCellUnlocked(world,c.x+dx!,c.y+dy!,map)));
}
/** A small, non-overlapping selection around the current boundary, recomputed after each purchase. */
export function gardenExpansionOptions(world:LandState,map:GardenDefinition=GARDEN_WORLD):GardenExpansionPlot[]{
 const open=gardenLandCells(world,map);if(!open.size)return [];
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,sumX=0,sumY=0;
 for(const c of open.values()){minX=Math.min(minX,c.x);minY=Math.min(minY,c.y);maxX=Math.max(maxX,c.x);maxY=Math.max(maxY,c.y);sumX+=c.x;sumY+=c.y;}
 const center={x:sumX/open.size,y:sumY/open.size},candidates:GardenExpansionPlot[]=[],reserved=new Set<string>();
 for(const region of map.regions)if((region.storyLocked||region.id==='workshop'||region.id==='terrace')&&!world.unlockedRegions.includes(region.id))for(const cell of gardenPlotCells(region))reserved.add(cell.x+','+cell.y);
 for(let y=Math.max(0,minY-4);y<=Math.min(map.maxHeight??map.height,maxY+5)-4;y++)for(let x=Math.max(0,minX-5);x<=Math.min(map.maxWidth??map.width,maxX+6)-5;x++){
  const plot={id:`land-${x}-${y}`,x,y,width:5,height:4},cells=gardenPlotCells(plot);
  if(cells.some(c=>open.has(c.x+','+c.y)||reserved.has(c.x+','+c.y)))continue;
  if(cells.some(c=>open.has((c.x-1)+','+c.y)||open.has((c.x+1)+','+c.y)||open.has(c.x+','+(c.y-1))||open.has(c.x+','+(c.y+1))))candidates.push(plot);
 }
 const distance=(p:GardenExpansionPlot)=>(p.x+2-center.x)**2+(p.y+1.5-center.y)**2;
 candidates.sort((a,b)=>distance(a)-distance(b)||a.y-b.y||a.x-b.x);
 const selected:GardenExpansionPlot[]=[];
 for(const plot of candidates)if(!selected.some(p=>plot.x<p.x+p.width&&plot.x+plot.width>p.x&&plot.y<p.y+p.height&&plot.y+plot.height>p.y)){selected.push(plot);if(selected.length===8)break;}
 return selected;
}

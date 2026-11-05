import {DECORATIONS,gardenLandCells,placementCells,type GardenPoint,type GardenWorldState,type GardenRotation} from '../../../../packages/garden-world/src';

export type ResidentPose='idle'|'walk'|'yawn'|'sleep'|'stretch';
export interface GardenResident {
 id:string;art:string;animal:boolean;x:number;y:number;home:GardenPoint;pose:ResidentPose;
 facing:1|-1;rear:boolean;placementRotation:GardenRotation;frame:number;walkDistance:number;phase:number;until:number;route:GardenPoint[];target?:GardenPoint;seed:number;
}
/** Grid X points down-right and grid Y down-left in the isometric projection. */
export function residentHeading(dx:number,dy:number):{rear:boolean;facing:1|-1}{
 return {rear:dx+dy<0,facing:dx-dy<0?-1:1};
}
/** Four authored leg poses, advanced by travel rather than a global animation clock. */
export function residentWalkFrame(distance:number,animal:boolean){return Math.floor(Math.max(0,distance)/(animal?.78:.62)*4)%4;}
const key=(p:GardenPoint)=>p.x+','+p.y;
const offsets=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
const hash=(id:string)=>{let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export const VISITOR_ART=['visitor_a','visitor_b','visitor_c','visitor_d'] as const;
function random(actor:GardenResident){actor.seed=(Math.imul(actor.seed,1664525)+1013904223)>>>0;return actor.seed/4294967296;}
function visitorSpawn(spots:GardenPoint[],reserved:Set<string>,seed:number):GardenPoint|undefined{
 const occupied=[...reserved].map(id=>{const [x,y]=id.split(',').map(Number);return {x:x!,y:y!};});
 const center=spots.reduce((sum,p)=>({x:sum.x+p.x/spots.length,y:sum.y+p.y/spots.length}),{x:0,y:0});
 let best:GardenPoint|undefined,bestScore=-Infinity;
 for(const spot of spots){
  if(reserved.has(key(spot)))continue;
  const distance=occupied.length?Math.min(...occupied.map(p=>(spot.x-p.x)**2+(spot.y-p.y)**2)):1;
  // Scatter without putting every newcomer at a remote corner of the map.
  const variety=hash(seed+':'+key(spot))/4294967296,centrality=1/(1+((spot.x-center.x)**2+(spot.y-center.y)**2)/64),score=Math.min(distance,36)*(.85+variety*.3)*(.35+.65*centrality);
  if(score>bestScore){best=spot;bestScore=score;}
 }
 return best;
}
function startVisitor(actor:GardenResident,walkable:Map<string,GardenPoint>,reserved:Set<string>,now:number){
 // Begin in different phases of a visit instead of a shared line of idle actors.
 actor.phase=Math.floor(random(actor)*9);actor.walkDistance=random(actor)*.62;
 const from={x:Math.round(actor.x),y:Math.round(actor.y)},options=[...walkable.values()].filter(p=>!reserved.has(key(p))&&Math.abs(p.x-from.x)+Math.abs(p.y-from.y)>=2&&Math.abs(p.x-from.x)+Math.abs(p.y-from.y)<=6);
 for(let attempt=0;attempt<12&&options.length;attempt++){
  const destination=options.splice(Math.floor(random(actor)*options.length),1)[0]!,route=residentRoute(from,destination,walkable);
  if(!route.length||reserved.has(key(route[0]!)))continue;
  actor.target=route.shift();actor.route=route;actor.pose='walk';actor.frame=residentWalkFrame(actor.walkDistance,false);
  Object.assign(actor,residentHeading(actor.target!.x-actor.x,actor.target!.y-actor.y));reserved.add(key(actor.target!));return;
 }
 actor.until=now+.2+random(actor)*3.8;
}
export function gardenWalkable(world:GardenWorldState):Map<string,GardenPoint>{
 const cells=gardenLandCells(world);
 for(const placed of Object.values(world.placements)){
  const item=DECORATIONS.find(d=>d.id===world.owned[placed.instanceId]?.itemId);
  if(item?.layer==='object'&&item.category!=='animal')for(const cell of placementCells(item,placed))cells.delete(key(cell));
 }
 return cells;
}
export function gardenVisitorCount(world:GardenWorldState):number {
 const area=gardenLandCells(world).size;
 return area?Math.min(10,Math.ceil(area/72)):0;
}
/** Breadth-first routes use four neighboring tiles, never building footprints or locked land. */
export function residentRoute(from:GardenPoint,to:GardenPoint,walkable:Map<string,GardenPoint>):GardenPoint[]{
 const start={x:Math.round(from.x),y:Math.round(from.y)},goal=key(to);if(!walkable.has(goal))return [];
 const queue=[start],parents=new Map<string,GardenPoint|null>([[key(start),null]]);
 for(let i=0;i<queue.length;i++){
  const current=queue[i]!;if(key(current)===goal){const path:GardenPoint[]=[];let at:GardenPoint|null=current;while(at&&key(at)!==key(start)){path.unshift(at);at=parents.get(key(at))??null;}return path;}
  for(const d of offsets){const next={x:current.x+d.x,y:current.y+d.y},id=key(next);if(walkable.has(id)&&!parents.has(id)){parents.set(id,current);queue.push(next);}}
 }
 return [];
}

/** Visual-only local residents. Saved animal placements remain their home and editing anchor. */
export class GardenResidents {
 actors:GardenResident[]=[];time=0;walkable=new Map<string,GardenPoint>();private revision='';
 sync(world:GardenWorldState){
  const signature=JSON.stringify([world.ownerId,world.revision,world.unlockedRegions,world.expansions,world.placements]);if(signature===this.revision)return;
  this.revision=signature;this.walkable=gardenWalkable(world);
  const previous=new Map(this.actors.map(actor=>[actor.id,actor])),actors:GardenResident[]=[],reserved=new Set<string>();
  const make=(id:string,art:string,animal:boolean,home:GardenPoint,rotation:GardenRotation=0):GardenResident=>({id,art,animal,home:{...home},x:home.x,y:home.y,pose:'idle',facing:rotation===90||rotation===270?-1:1,rear:rotation===180||rotation===270,placementRotation:rotation,frame:0,walkDistance:0,phase:hash(id)%5,until:this.time+.6+(hash(id)%25)/10,route:[],seed:hash(id)});
  for(const placed of Object.values(world.placements)){
   const item=DECORATIONS.find(d=>d.id===world.owned[placed.instanceId]?.itemId);if(item?.category!=='animal')continue;
   const old=previous.get(placed.instanceId),home={x:placed.x,y:placed.y};
   const actor=old&&key(old.home)===key(home)&&old.placementRotation===placed.rotation?old:make(placed.instanceId,item.id,true,home,placed.rotation);
   if(!this.walkable.has(key({x:Math.round(actor.x),y:Math.round(actor.y)})))Object.assign(actor,{x:home.x,y:home.y,target:undefined,route:[],pose:'idle'});
   actors.push(actor);reserved.add(key({x:Math.round(actor.x),y:Math.round(actor.y)}));if(actor.target)reserved.add(key(actor.target));
  }
  const spots=[...this.walkable.values()];
  for(let i=0;i<gardenVisitorCount(world);i++){
   const id='visitor-'+i,old=previous.get(id);let spot=old?{x:Math.round(old.x),y:Math.round(old.y)}:undefined;
   if(!spot||!this.walkable.has(key(spot))||reserved.has(key(spot)))spot=visitorSpawn(spots,reserved,hash(world.ownerId+':'+id));
   if(!spot)break;const retained=old&&Math.abs(old.x-spot.x)<1&&Math.abs(old.y-spot.y)<1,actor=retained?old:make(id,VISITOR_ART[i%VISITOR_ART.length]!,false,spot);
   actor.art=VISITOR_ART[i%VISITOR_ART.length]!;
   if(!retained){actor.seed=hash(world.ownerId+':'+id);reserved.add(key(spot));startVisitor(actor,this.walkable,reserved,this.time);}
   actors.push(actor);reserved.add(key(spot));if(actor.target)reserved.add(key(actor.target));
  }
  // New buildings may invalidate an old route; recompute from the last legal tile.
  for(const actor of actors)if(actor.target&&!this.walkable.has(key(actor.target))){actor.x=Math.round(actor.x);actor.y=Math.round(actor.y);actor.target=undefined;actor.route=[];actor.pose='idle';actor.until=this.time+1;}
  this.actors=actors;
 }
 step(delta:number,paused=false){
  if(paused)return;const dt=Math.min(Math.max(0,delta),.15);this.time+=dt;
  const reserved=new Set(this.actors.flatMap(a=>[key({x:Math.round(a.x),y:Math.round(a.y)}),...(a.target?[key(a.target)]:[])]));
  for(const actor of this.actors){
   if(actor.target){
    const dx=actor.target.x-actor.x,dy=actor.target.y-actor.y,distance=Math.hypot(dx,dy),step=Math.min(distance,dt*(actor.animal?.48:.36));
    if(distance>0)Object.assign(actor,residentHeading(dx,dy));
    actor.walkDistance+=step;actor.pose='walk';actor.frame=residentWalkFrame(actor.walkDistance,actor.animal);
    if(distance<=step){actor.x=actor.target.x;actor.y=actor.target.y;actor.target=undefined;actor.until=this.time;if(!actor.route.length){actor.pose='idle';actor.frame=0;if(!actor.animal)actor.rear=false;}}
    else {actor.x+=dx/distance*step;actor.y+=dy/distance*step;}continue;
   }
   if(this.time<actor.until)continue;
   if(actor.route.length){const next=actor.route[0]!;if(reserved.has(key(next))||!this.walkable.has(key(next))){actor.route=[];actor.pose='idle';actor.frame=0;if(!actor.animal)actor.rear=false;actor.until=this.time+1+random(actor);continue;}actor.target=actor.route.shift();reserved.add(key(next));continue;}
   if(actor.pose==='walk'||actor.pose==='idle'){
    actor.phase++;
    if(actor.phase%3===0){actor.rear=false;actor.pose='yawn';actor.frame=3;actor.until=this.time+2.4;continue;}
    const from={x:Math.round(actor.x),y:Math.round(actor.y)},options=[...this.walkable.values()].filter(p=>!reserved.has(key(p))&&Math.abs(p.x-from.x)+Math.abs(p.y-from.y)>=2&&Math.abs(p.x-from.x)+Math.abs(p.y-from.y)<=6&&(!actor.animal||Math.abs(p.x-actor.home.x)+Math.abs(p.y-actor.home.y)<=7));
    for(let attempt=0;attempt<8&&options.length;attempt++){const destination=options.splice(Math.floor(random(actor)*options.length),1)[0]!,route=residentRoute(from,destination,this.walkable);if(route.length){actor.route=route;break;}}
    actor.pose='idle';actor.frame=0;actor.until=this.time+.4+random(actor)*1.8;
   }else if(actor.pose==='yawn'){actor.pose=actor.animal?'sleep':'stretch';actor.frame=4;actor.until=this.time+(actor.animal?10+random(actor)*9:4);}
   else if(actor.pose==='sleep'){actor.pose='stretch';actor.frame=5;actor.until=this.time+2.4;}
   else {actor.pose='idle';actor.frame=0;actor.until=this.time+1.2;}
  }
 }
}

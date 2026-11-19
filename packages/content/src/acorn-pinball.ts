import {PINBALL_PHYSICS_VERSION,type PinballPhysics} from '../../contracts/src/garden-games';

export const PINBALL_WIDTH=280;
export const PINBALL_HEIGHT=320;
export const PINBALL_LAUNCHES=[21,60,101,140,179,220,259] as const;
export const PINBALL_POCKETS=5;
export const PINBALL_BALLS=3;
const radius=7;
const landingY=304;
const quantize=(value:number)=>Math.round(value*1024)/1024;

export interface PinballPeg {x:number;y:number;r:number}
export interface PinballBoard {pegs:PinballPeg[];targets:number[];seed:number;pinballPhysics?:PinballPhysics}
export interface PinballShot {path:Array<{x:number;y:number}>;hits:Array<{peg:number;tick:number}>;pocket:number}
type PinballLayout=Omit<PinballBoard,'targets'>;

function seededFraction(seed:number){
 let mixed=Math.imul(seed^(seed>>>16),0x45d9f3b);
 mixed=Math.imul(mixed^(mixed>>>16),0x45d9f3b);
 return ((mixed^(mixed>>>16))>>>0)/0x100000000;
}

function ricochetDrift(seed:number,slot:number){
 const variation=seededFraction(seed+Math.imul(slot,0x9e3779b9));
 if(slot===0||slot===PINBALL_LAUNCHES.length-1)return (slot===0?1:-1)*(2.15+variation*1.65);
 return (variation>=.5?1:-1)*(.7+Math.abs(variation-.5)*3.3);
}

/** Fixed simulation steps run on both the device and the reward endpoint. */
export function launchAcorn(board:PinballLayout,slot:number):PinballShot{
 const ricochet=board.pinballPhysics===PINBALL_PHYSICS_VERSION;
 const gravity=ricochet?.30:.26,bounce=ricochet?1.47:1.55,maxFall=ricochet?8.5:8;
 let x:number=PINBALL_LAUNCHES[slot]!,y=13,dx=ricochet?ricochetDrift(board.seed,slot):((slot*13+board.seed%11)%9-4)*.29,dy=1;
 let lowest=y,stall=0;
 const path:PinballShot['path']=[{x,y}],hits:PinballShot['hits']=[],hitPegs=new Set<number>();
 for(let step=0;step<380&&y<landingY;step++){
  dy=Math.min(maxFall,dy+gravity);x+=dx;y+=dy;
  if(x<radius||x>PINBALL_WIDTH-radius){x=Math.max(radius,Math.min(PINBALL_WIDTH-radius,x));dx*=-.83;}
  if(y<radius){y=radius;dy=Math.abs(dy)*.7;}
  for(const [peg,{x:px,y:py,r}] of board.pegs.entries()){
   const horizontal=x-px,vertical=y-py,distance=Math.sqrt(horizontal*horizontal+vertical*vertical),contact=r+radius;
   if(distance>=contact)continue;
   const nx=distance?horizontal/distance:1,ny=distance?vertical/distance:0;
   x=px+nx*contact;y=py+ny*contact;
   const normal=dx*nx+dy*ny;
   if(normal>=0)continue;
   dx=Math.max(-6,Math.min(6,dx-bounce*normal*nx));dy-=bounce*normal*ny;
   if(ricochet&&Math.abs(dx)<.95){
    const direction=Math.abs(nx)>.12?Math.sign(nx):seededFraction(board.seed+peg*113+step*37)>=.5?1:-1;
    dx=direction*.95;
   }else if(Math.abs(dx)<.23)dx=slot%2===0?-.36:.36;
   if(!hitPegs.has(peg)){hits.push({peg,tick:path.length});hitPegs.add(peg);}
  }
  if(y>lowest+3){lowest=y;stall=0;}
  else if(++stall===30){dx=(x<PINBALL_WIDTH/2?1:-1)*3.6;dy=-2;stall=0;}
  if(ricochet){
   if(x<radius){x=radius;dx=Math.max(1,Math.abs(dx)*.83);}
   if(x>PINBALL_WIDTH-radius){x=PINBALL_WIDTH-radius;dx=-Math.max(1,Math.abs(dx)*.83);}
  }
  x=quantize(x);y=quantize(y);dx=quantize(dx);dy=quantize(dy);
  path.push({x,y});
 }
 const pocket=Math.max(0,Math.min(PINBALL_POCKETS-1,Math.floor(x*PINBALL_POCKETS/PINBALL_WIDTH)));
 return {path,hits,pocket};
}

const ricochetRows=[
 {y:62,x:[25,70,116,164,210,255],r:9.5},
 {y:111,x:[44,92,140,188,236],r:10},
 {y:159,x:[25,70,116,164,210,255],r:9.5},
 {y:210,x:[44,92,140,188,236],r:10.5},
 {y:260,x:[25,70,116,164,210,255],r:9},
];

function ricochetLayout(stage:number,seed:number):PinballLayout{
 const wobble=stage===1?2:3;
 const pegs=ricochetRows.flatMap(({y,x,r},row)=>x.map((at,column)=>{
  const key=seed+631*row+191*column;
  return {x:at+Math.round((seededFraction(key)*2-1)*wobble),y:y+(column%2===0?-3:3)+Math.round((seededFraction(key+173)*2-1)*2),r};
 }));
 return {pegs,seed,pinballPhysics:PINBALL_PHYSICS_VERSION};
}

function legacyLayout(stage:number,seed:number):PinballLayout{
 const pegs=[
  ...[43,106,173,236].map((x,i)=>({x,y:71+(i%2)*9,r:10})),
  ...[24,80,140,200,254].map((x,i)=>({x,y:127+(i%2)*10,r:i===2?15:9})),
  ...[47,110,168,232].map((x,i)=>({x,y:194+(i%2)*13,r:11})),
  ...[73,140,207].map((x,i)=>({x,y:250+(i%2)*9,r:9})),
 ].map((peg,index)=>({...peg,x:peg.x+((seed+index*7)%9-4)*(stage===1?1:2)}));
 return {pegs,seed};
}

function withTargets(layout:PinballLayout,stage:number,seed:number,shots:PinballShot[]):PinballBoard{
 const reached=[...new Set(shots.map(shot=>shot.pocket))].sort((a,b)=>a-b);
 const start=(seed+stage)%reached.length;
 const targets=[reached[start]!];
 if(stage>2&&reached.length>1)targets.push(reached[(start+1)%reached.length]!);
 return {...layout,targets};
}

function viableShot({path,hits}:PinballShot){
 if(path.at(-1)!.y<landingY||path.length>235||hits.length<2)return false;
 let left=PINBALL_WIDTH,right=0,previous=path[0]!.x,direction=0,turns=0;
 for(const {x} of path){
  left=Math.min(left,x);right=Math.max(right,x);
  const drift=x-previous;
  if(Math.abs(drift)>.6){
   const next=Math.sign(drift);
   if(direction&&next!==direction)turns++;
   direction=next;
  }
  previous=x;
 }
 return right-left>=42&&turns>=2;
}

export function pinballBoard(stage:number,seed:number,pinballPhysics?:PinballPhysics):PinballBoard{
 const shotsFor=(layout:PinballLayout)=>PINBALL_LAUNCHES.map((_,slot)=>launchAcorn(layout,slot));
 if(pinballPhysics!==PINBALL_PHYSICS_VERSION){
  const layout=legacyLayout(stage,seed);
  return withTargets(layout,stage,seed,shotsFor(layout));
 }
 // Check every launch position so a peg layout never leaves a straight lane or a stuck ball.
 for(let variant=0;variant<8;variant++){
  const layout=ricochetLayout(stage,(seed+Math.imul(variant,0x9e3779b9))>>>0);
  const shots=shotsFor(layout);
  if(shots.every(viableShot)&&new Set(shots.map(shot=>shot.pocket)).size>=3)return withTargets(layout,stage,seed,shots);
 }
 const layout=ricochetLayout(stage,71289);
 return withTargets(layout,stage,seed,shotsFor(layout));
}

export function replayPinball(board:PinballBoard,actions:readonly number[]){
 const reached=new Set<number>();let score=0;
 if(actions.length>PINBALL_BALLS||actions.some(slot=>!Number.isInteger(slot)||slot<0||slot>=PINBALL_LAUNCHES.length))return {status:'invalid' as const,reached,score};
 for(const [index,slot]of actions.entries()){
  const shot=launchAcorn(board,slot);score+=shot.hits.length*10+(board.targets.includes(shot.pocket)?50:5);reached.add(shot.pocket);
  if(board.targets.every(pocket=>reached.has(pocket)))return {status:index+1===actions.length?'won' as const:'invalid' as const,reached,score};
 }
 return {status:actions.length===PINBALL_BALLS?'lost' as const:'playing' as const,reached,score};
}

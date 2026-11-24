import {mobileObstacleArt} from './mobile-obstacle-art';
import {Container,Graphics,Sprite} from 'pixi.js';
import type {GameState,Obstacle} from '@garden/contracts';
import {lightRay} from '../../../packages/game-core/src/garden-puzzles';
import {texture,hasArt} from './assets';

type Position=(index:number)=>{x:number;y:number};
const arrows={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2};

export function gardenPuzzleObstacleArt(o:Obstacle,state:GameState):string|undefined{
 if(o.kind==='shadow-bud'&&!lightRay(state).includes(o.anchor))return 'shadow-bud-covered';
 if(o.kind==='wire-planter'&&!o.wire)return 'garden-planter';
}

export function drawGardenPuzzleObstacle(layer:Container,o:Obstacle,s:GameState,cell:number,position:Position):void{
 const {x,y}=position(o.anchor),r=cell*.2;
 if(o.direction){
  const arrow=new Graphics().poly([-r*.86,-r*.23,0,-r*.23,0,-r*.68,r*.9,0,0,r*.68,0,r*.23,-r*.86,r*.23]);
  arrow.fill(o.kind==='garden-light'?0xfff0a0:0xffe5ac).stroke({color:0x50331c,width:Math.max(1,cell*.025),join:'round'});
  arrow.position.set(x,y+cell*.15);arrow.rotation=arrows[o.direction];layer.addChild(arrow);
 }
 if(o.kind==='garden-light'&&s.gardenPuzzle?.lightAt===o.anchor){
  layer.addChild(new Graphics().circle(x,y,cell*.43).stroke({color:0xffefa0,width:Math.max(1.5,cell*.046)}));
 }
 if(o.kind==='wire-planter'&&o.wire&&!hasArt(mobileObstacleArt(o)??'')){
  const pot=new Sprite(texture('garden-planter'));pot.anchor.set(.5);pot.position.set(x,y);pot.width=pot.height=cell*.67;layer.addChild(pot);
  const frame=new Graphics(),half=cell*.38;
  for(const offset of [-cell*.16,cell*.16]){
   if(o.wire&1)frame.moveTo(x-half,y+offset).lineTo(x+half,y+offset);
   if(o.wire&2)frame.moveTo(x+offset,y-half).lineTo(x+offset,y+half);
  }
  frame.stroke({color:0x503327,width:cell*.11,cap:'round'});
  for(const offset of [-cell*.16,cell*.16]){
   if(o.wire&1)frame.moveTo(x-half,y+offset).lineTo(x+half,y+offset);
   if(o.wire&2)frame.moveTo(x+offset,y-half).lineTo(x+offset,y+half);
  }
  frame.stroke({color:0xe1c27b,width:cell*.055,cap:'round'});layer.addChild(frame);
 }
}

export function drawGardenPuzzleFloor(layer:Container,s:GameState,cell:number,position:Position):void{
 const puzzle=s.gardenPuzzle;
 if(!puzzle)return;
 if(puzzle.kind==='shadow'){
  for(const at of lightRay(s)){
   const {x,y}=position(at);
   layer.addChild(new Graphics().roundRect(x-cell*.47,y-cell*.47,cell*.94,cell*.94,cell*.12)
    .stroke({color:0xffed9c,width:Math.max(1.4,cell*.056),alpha:.92}));
  }
  return;
 }
 if(puzzle.kind!=='cart'&&puzzle.kind!=='fence')return;
 const built=new Set(puzzle.posts),dock=puzzle.kind==='cart';
 for(const at of puzzle.cells??[]){
  const {x,y}=position(at),half=cell*.46;
  const marker=new Graphics();
  if(dock){
   marker.roundRect(x-half,y-half,half*2,half*2,cell*.1).stroke({color:0x704d26,width:cell*.13});
   marker.roundRect(x-half,y-half,half*2,half*2,cell*.1).stroke({color:0xfee299,width:cell*.055});
   marker.circle(x+cell*.31,y-cell*.29,cell*.09).fill(0xfff1b9);
  }else if(built.has(at)){
   marker.roundRect(x-half,y-half,half*2,half*2,cell*.1).stroke({color:0x654526,width:cell*.12});
   marker.roundRect(x-half,y-half,half*2,half*2,cell*.1).stroke({color:0xf4bc67,width:cell*.058});
  }else{
   for(const dx of [-half,half])for(const dy of [-half,half])marker.circle(x+dx,y+dy,cell*.054).fill(0xb9f4b6);
  }
  layer.addChild(marker);
 }
}

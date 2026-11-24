import {pipeRibbon} from './pipe-ribbon';
import {mobileObstacleArt} from './mobile-obstacle-art';
import {Container,Graphics,Mesh,MeshGeometry,NineSliceSprite,Rectangle,Sprite,Texture} from 'pixi.js';
import type {Obstacle} from '@garden/contracts';
import {texture,tileArt,hasArt} from './assets';
import {boardSpriteSize,boardTexture} from './board-sprite-art';

import {mechanicArtId} from './mechanic-ids';
import {magnetRailPath} from './magnet-rail-visual';

function drawPipe(layer:Container,o:Obstacle,cell:number,position:(i:number)=>{x:number;y:number}){
 const rail=magnetRailPath(o,position,cell);if(!rail)return;
 const magnet=!!o.endOnly,g=new Graphics();g.label=magnet?'magnet-rail':'pipe';
 const [front,back]=rail.ends;
 // Trace the full footprint for each finish; even the highlights have no seams.
 const stroke=(width:number,color:number,dx=0,dy=0)=>{
  const x=(v:number)=>v+dx*cell,y=(v:number)=>v+dy*cell;
  g.moveTo(x(front.tip.x),y(front.tip.y));
  for(const {enter,center,leave} of rail.corners)g.lineTo(x(enter.x),y(enter.y)).quadraticCurveTo(x(center.x),y(center.y),x(leave.x),y(leave.y));
  g.lineTo(x(back.tip.x),y(back.tip.y)).stroke({width:cell*width,color,cap:'butt',join:'round'});
 };
 stroke(.975,magnet?0x142b55:0x493224);
 stroke(.93,magnet?0xe7a63d:0xb9753d);
 stroke(.83,magnet?0xffdd83:0xf1be74,0,-.019);
 stroke(.75,magnet?0x133b84:0x325d59);
 stroke(.64,magnet?0x235bc1:0x42847d,-.012,-.041);
 stroke(.51,magnet?0x377dd9:0x60aa99,-.016,-.065);
 stroke(.25,magnet?0x57a1f4:0x90d4bc,-.021,-.12);
 layer.addChild(g);
 const raster=hasArt('mobile-pipe-0');
 if(raster){
  const body=boardTexture('mobile-pipe-0',true),f=body.frame;
  const middle=new Texture({source:body.source,frame:new Rectangle(f.x+f.width*.35,f.y,f.width*.30,f.height)});
  const data=pipeRibbon(rail,cell),geometry=new MeshGeometry(data),mesh=new Mesh({geometry,texture:middle});mesh.label='mobile-pipe-ribbon';layer.addChild(mesh);
  mesh.on('destroyed',()=>{middle.destroy(false);geometry.destroy(true);});
 }
 for(const {tip,out} of rail.ends){
  if(raster){const cap=new Sprite(boardTexture('mobile-pipe-2',true));cap.anchor.set(.80,.5);cap.position.set(tip.x,tip.y);cap.rotation=Math.atan2(out.y,out.x);cap.width=cell*.72;cap.height=cell*.97;cap.label='mobile-pipe-cap';layer.addChild(cap);continue;}

  const cap=new Graphics();cap.label=magnet?'magnet-rail-tip':'pipe-cap';
  cap.position.set(tip.x,tip.y);cap.rotation=Math.atan2(out.y,out.x);
  cap.roundRect(-.165*cell,-.482*cell,.348*cell,.964*cell,.075*cell).fill(magnet?0x142b55:0x493224);
  cap.roundRect(-.148*cell,-.45*cell,.305*cell,.88*cell,.067*cell).fill(magnet?0xd28332:0xbc7c49);
  cap.roundRect(-.125*cell,-.437*cell,.258*cell,.775*cell,.047*cell).fill(0xffcc64);
  cap.roundRect(-.1*cell,-.403*cell,.087*cell,.69*cell,.025*cell).fill(0xffeea2);
  cap.roundRect(.025*cell,-.286*cell,.117*cell,.545*cell,.028*cell).fill(0x97542b);
  layer.addChild(cap);
 }
}
/** Endpoint pipes follow one continuous path through their occupied cells. */
export function drawMechanicArt(layer:Container,o:Obstacle,cell:number,position:(i:number)=>{x:number;y:number}):boolean {
 const id=mechanicArtId(o.kind);if(!id)return false;
 const mobile=mobileObstacleArt(o);if(o.kind!=='pipe'&&mobile&&hasArt(mobile))return false;
 if(o.kind==='pipe'){drawPipe(layer,o,cell,position);return true;}
 const points=o.footprint.map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 const face=boardTexture(id),width=Math.max(...xs)-Math.min(...xs)+cell,height=Math.max(...ys)-Math.min(...ys)+cell;
 if(o.kind==='curtain'){
  const shade=new NineSliceSprite({texture:face,leftWidth:face.width*.21,rightWidth:face.width*.21,topHeight:face.height*.22,bottomHeight:face.height*.22});
  shade.label=id;
  // Nine-slice borders use texture units. Size in that coordinate space first,
  // then scale together so a one-row shade still has a visible fabric center.
  const scale=cell/Math.max(face.width,face.height);shade.scale.set(scale);
  shade.width=width/scale;shade.height=height/scale;
  shade.position.set(Math.min(...xs)-cell/2,Math.min(...ys)-cell/2);layer.addChild(shade);
 }else{
  const sprite=new Sprite(face),size=boardSpriteSize(face,width,height);
  sprite.label=id;sprite.anchor.set(.5);sprite.position.set(cx,cy);sprite.width=size.width;sprite.height=size.height;layer.addChild(sprite);
 }
 if(o.color){const chip=new Sprite(texture(tileArt('normal',o.color)));chip.anchor.set(.5);chip.width=cell*.36;chip.height=cell*.36;chip.position.set(cx-cell*.27,cy+cell*.24);layer.addChild(chip);}
 return true;
}

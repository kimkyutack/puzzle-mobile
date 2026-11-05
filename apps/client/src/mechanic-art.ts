import {Container,NineSliceSprite,Sprite} from 'pixi.js';
import type {Obstacle} from '@garden/contracts';
import {texture,tileArt} from './assets';

import {mechanicArtId} from './mechanic-ids';
/** Each pipe section occupies one cell; remaining length is never stretched across a footprint. */
export function drawMechanicArt(layer:Container,o:Obstacle,cell:number,position:(i:number)=>{x:number;y:number}):boolean {
 const id=mechanicArtId(o.kind);if(!id)return false;
 const points=o.footprint.map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 if(o.kind==='pipe')for(const p of points){const sprite=new Sprite(texture(id));sprite.anchor.set(.5);sprite.position.set(p.x,p.y);sprite.width=cell*1.28;sprite.height=cell*1.01;layer.addChild(sprite);}
 else if(o.kind==='curtain'){
  const shade=new NineSliceSprite({texture:texture(id),leftWidth:52,rightWidth:52,topHeight:60,bottomHeight:60});
  // Nine-slice borders use texture units. Size in that coordinate space first,
  // then scale together so a one-row shade still has a visible fabric center.
  const scale=cell/256;shade.scale.set(scale);
  shade.width=(Math.max(...xs)-Math.min(...xs)+cell)/scale;shade.height=(Math.max(...ys)-Math.min(...ys)+cell)/scale;
  shade.position.set(Math.min(...xs)-cell/2,Math.min(...ys)-cell/2);layer.addChild(shade);
 }else{const sprite=new Sprite(texture(id));sprite.anchor.set(.5);sprite.position.set(cx,cy);sprite.width=cell*.97;sprite.height=cell*.97;layer.addChild(sprite);}
 if(o.color){const chip=new Sprite(texture(tileArt('normal',o.color)));chip.anchor.set(.5);chip.width=cell*.36;chip.height=cell*.36;chip.position.set(cx-cell*.27,cy+cell*.24);layer.addChild(chip);}
 return true;
}

import {Graphics,Text,type Container} from 'pixi.js';
import type {Color,Obstacle,ObstacleRule} from '@garden/contracts';

export const obstacleRuleLabel:Record<ObstacleRule,string>={
 'shutter-open':'열린 덮개','shutter-closed':'닫힌 덮개',regrow:'새순 재생',
 'match-shell':'옆에서 매치','power-shell':'특수 블록 타격',
 twin:'쌍울림 석판',pigment:'채색 항아리',directional:'해바라기 방패',fuse:'꽃가루 도화선',
};

const pigments:Record<Color,number>={berry:0xff6565,drop:0x64acff,sun:0xffdc66,sprout:0x80eb71,flower:0xd38dff,acorn:0xffb46a};
const pairColors=[0xffd381,0x98e7ef,0xb9ec84,0xf0afe8,0xffa797,0xadadfb];
const arrowAngle={up:0,right:Math.PI/2,down:Math.PI,left:Math.PI*1.5};
const arrowText={up:'↑',right:'→',down:'↓',left:'←'};

export function obstacleRuleDetail(obstacle:Obstacle,turn:number):string|undefined{
 if(obstacle.rule==='twin')return String(obstacle.pair);
 if(obstacle.rule==='directional'&&obstacle.strikeSide)return arrowText[obstacle.strikeSide];
 if(obstacle.rule==='fuse'&&obstacle.detonateAt!==undefined)return String(Math.max(0,obstacle.detonateAt-turn));
}

export function drawObstacleRule(layer:Container,obstacle:Obstacle,at:{x:number;y:number},cell:number,turn:number):void{
 const rule=obstacle.rule;
 if(!rule)return;
 const badge=new Graphics();
 const x=at.x-cell*.29,y=at.y-cell*.29,r=cell*.135;
 const color=rule==='shutter-open'?0x8ce7ff:rule==='shutter-closed'?0xc1bdc8:
  rule==='regrow'?0xaff080:rule==='match-shell'?0x91d5ff:
  rule==='pigment'&&obstacle.lastHitColor?pigments[obstacle.lastHitColor]:
  rule==='twin'?pairColors[(obstacle.pair!-1)%pairColors.length]!:rule==='fuse'&&obstacle.detonateAt!==undefined?0xffa268:0xffd278;
 badge.label=rule;
 badge.circle(x,y,r).fill(0x253243).stroke({color,width:Math.max(1,cell*.023)});
 layer.addChild(badge);
 if(rule==='twin'||rule==='fuse'&&obstacle.detonateAt!==undefined){
  const label=new Text({text:obstacleRuleDetail(obstacle,turn),style:{fontFamily:'Jua',fontSize:Math.max(9,cell*.22),fill:color}});
  label.anchor.set(.5);label.position.set(x,y);layer.addChild(label);
  return;
 }
 if(rule==='directional'){
  const arrow=new Graphics().poly([0,-r*.67,r*.6,r*.27,r*.21,r*.27,r*.21,r*.57,-r*.21,r*.57,-r*.21,r*.27,-r*.6,r*.27]).fill(color);
  arrow.position.set(x,y);arrow.rotation=arrowAngle[obstacle.strikeSide!];layer.addChild(arrow);
  return;
 }
 if(rule==='shutter-open')badge.circle(x,y,r*.45).fill(color);
 else if(rule==='shutter-closed')badge.roundRect(x-r*.55,y-r*.16,r*1.1,r*.32,r*.16).fill(color);
 else if(rule==='regrow'){
  badge.moveTo(x-r*.58,y+r*.55).quadraticCurveTo(x-r*.52,y-r*.56,x+r*.55,y-r*.55)
   .quadraticCurveTo(x+r*.55,y+r*.4,x-r*.58,y+r*.55).fill(color);
 }else if(rule==='pigment'){
  badge.roundRect(x-r*.43,y-r*.43,r*.86,r*.86,r*.15);
  if(obstacle.lastHitColor)badge.fill(color);else badge.stroke({color,width:Math.max(1,cell*.019)});
 }else{
  const inner=rule==='power-shell'||rule==='fuse'?r*.22:r*.45;
  badge.poly([x,y-r*.72,x+inner,y-inner,x+r*.72,y,x+inner,y+inner,x,y+r*.72,x-inner,y+inner,x-r*.72,y,x-inner,y-inner]).fill(color);
 }
}

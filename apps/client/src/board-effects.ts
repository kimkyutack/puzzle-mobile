import {AnimatedSprite,type Application,type Container,type Texture} from 'pixi.js';
import type {Action,GameEvent,GameState,Special} from '@garden/contracts';
import {perimeterCells} from '@garden/core';
import {hasArt,texture,tileArt} from './assets';
import {effectTiming,VISUAL_BEATS,specialCharge,type VisualTiming} from './visual-timing';
import {hammerPose,rakePose,curvedPoint,fusionPose,rainbowHeroPose} from './effect-motion';
import {combinationParts} from './special-combination';
import {powerArtScale} from './tile-visuals';
export {effectTiming} from './visual-timing';
type Point={x:number;y:number};
export interface BoardEffectsLayout {cellSize:()=>number;position:(index:number)=>Point;bounds?:()=>{x:number;y:number;width:number;height:number};frames?:(id:string)=>Texture[];impulse?:(strength:number,duration:number)=>void}
interface Slot {sprite:AnimatedSprite;active:boolean;start:number;duration:number;frames:number;update:(progress:number)=>void}
const MAX_PARTICLES=180;
const fragmentColors:Record<string,string>={berry:'red',drop:'blue',sun:'yellow',sprout:'green',flower:'purple',acorn:'orange'};
const spectrum=[0xff729e,0x65d9ff,0xffdf73,0x91ee8b,0xd4a0ff,0xffb35f];
const easeOut=(t:number)=>1-(1-t)**3,smooth=(t:number)=>t*t*(3-2*t),lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Approved raster sprites only. Scheduled particles retain their complete lifetime and recycle on completion. */
export function createBoardEffects(app:Application,layer:Container,layout:BoardEffectsLayout){
 const pool:Slot[]=[];layer.sortableChildren=true;let disposed=false,longest=0,epoch=0;const impulses:Array<{at:number;strength:number;duration:number}>=[];
 const bounds=(state:GameState)=>layout.bounds?.()??{x:0,y:0,width:state.width*layout.cellSize(),height:state.height*layout.cellSize()};
 function images(ids:string[],animation?:string|string[]):Texture[]{for(const id of typeof animation==='string'?[animation]:animation??[]){const frames=layout.frames?.(id);if(frames?.length)return frames;}const id=ids.find(hasArt);return id?[texture(id)]:[];}
 function emit(frames:Texture[],delay:number,duration:number,size:number,origin:Point,animate:(sprite:AnimatedSprite,t:number,scale:number)=>void,glow=false,tint=0xffffff,depth=0){
  if(disposed||!frames.length||size<=0)return;let slot=pool.find(item=>!item.active);
  if(!slot){if(pool.length>=MAX_PARTICLES)return;const sprite=new AnimatedSprite(frames,false);sprite.eventMode='none';sprite.visible=false;layer.addChild(sprite);slot={sprite,active:false,start:0,duration:0,frames:1,update:()=>{}};pool.push(slot);}
  const sprite=slot.sprite;sprite.textures=frames;sprite.gotoAndStop(0);sprite.loop=false;sprite.anchor.set(.5);sprite.rotation=0;sprite.alpha=1;sprite.tint=tint;sprite.blendMode=glow?'add':'normal';sprite.zIndex=depth;
  const scale=size/Math.max(frames[0]!.orig.width,frames[0]!.orig.height);sprite.scale.set(scale);sprite.position.set(origin.x,origin.y);sprite.visible=false;
  slot.active=true;slot.start=epoch+Math.max(0,delay);slot.duration=Math.max(1,duration);slot.frames=frames.length;slot.update=t=>animate(sprite,t,scale);longest=Math.max(longest,delay+duration);
 }
 function impulse(delay:number,strength:number,duration=140){if(impulses.length<8)impulses.push({at:epoch+delay,strength,duration});longest=Math.max(longest,delay+duration);}
 function chargeRing(origin:Point,size:number,delay:number,duration:number,tint:number,flat=false){emit(images(['fx_ring','halo']),delay,duration,size,origin,(sprite,t,base)=>{const scale=base*(1-.54*easeOut(t));sprite.scale.set(scale,scale*(flat ? .48 : 1));sprite.rotation=(flat?-.5:.2)+t*(flat?2.1:-1.1);sprite.alpha=Math.sin(Math.PI*t)*.8;},true,tint);}
 function orbit(origin:Point,size:number,delay:number,duration:number,count:number,palette:number[],collapse=true){const cell=layout.cellSize();for(let i=0;i<count;i++)emit(images(['fx_starburst','sparkle']),delay+i*15,duration-i*15,cell*.38,origin,(sprite,t,base)=>{const angle=i/count*Math.PI*2+t*Math.PI*2.2,radius=size*(collapse?1-.8*easeOut(t):.8+.2*Math.sin(Math.PI*t));sprite.position.set(origin.x+Math.cos(angle)*radius,origin.y+Math.sin(angle)*radius*.65);sprite.scale.set(base*(.7+.4*Math.sin(Math.PI*t)));sprite.rotation=-angle;sprite.alpha=Math.sin(Math.PI*t);},true,palette[i%palette.length]);}
 function impactRays(origin:Point,delay:number,size:number,tint:number){const cell=layout.cellSize();for(let i=0;i<4;i++)emit(images(['fx_ray','trail']),delay,290,cell,origin,(sprite,t)=>{sprite.anchor.set(0,.5);sprite.rotation=i*Math.PI/2+Math.PI/4;sprite.width=size*(.2+.8*easeOut(t));sprite.height=cell*.13*(1-t);sprite.alpha=Math.sin(Math.PI*t);},true,tint);}
 function pulse(ids:string[],origin:Point,size:number,delay=0,duration=360,animation?:string|string[],glow=false){emit(images(ids,animation),delay,duration,size,origin,(sprite,t,base)=>{sprite.scale.set(base*(.35+.85*easeOut(t)));sprite.alpha=Math.min(1,t*12)*Math.min(1,(1-t)*3);sprite.rotation=.12*Math.sin(t*Math.PI);},glow);}
 function flash(origin:Point,size:number,delay:number){pulse(['fx_flash','sparkle','burst'],origin,size,delay,230,undefined,true);}
 function ring(origin:Point,size:number,delay:number,duration=530){emit(images(['fx_ring','burst','sparkle']),delay,duration,size,origin,(sprite,t,base)=>{sprite.scale.set(base*(.12+easeOut(t)));sprite.alpha=Math.min(1,t*12)*(1-t)*.85;},true);}
 function fragments(kind:string,origin:Point,count:number,delay=0,spread=1,duration=390){
  const cell=layout.cellSize(),color=fragmentColors[kind],frames=images([...(color?[`fragment_${color}`]:[]),'fx_starburst','sparkle']);
  for(let i=0;i<count;i++){const angle=(i/count)*Math.PI*2-.65,reach=cell*(.5+((i*7)%5)*.14)*spread,dx=Math.cos(angle)*reach,dy=Math.sin(angle)*reach-cell*.22;
   emit(frames,delay,duration+(i%3)*30,cell*(.21+(i%3)*.055),origin,(sprite,t,base)=>{const u=easeOut(t);sprite.position.set(origin.x+dx*u,origin.y+dy*u+cell*.95*t*t);sprite.rotation=angle+t*(i%2?4.6:-3.8);sprite.scale.set(base*(1-.65*t));sprite.alpha=Math.min(1,(1-t)*3);});}
 }
 function lift(origin:Point,kind:string,delay:number,art?:string){
  const cell=layout.cellSize(),id=kind.includes('rainbow')?'rainbow':kind.includes('bomb')?'bomb':kind.includes('glider')?'glider':kind==='wind-column'?'wind-column':'wind-row',wind=kind.includes('wind'),bomb=kind.includes('bomb'),rainbow=kind.includes('rainbow');
  emit(images([art??tileArt(id),'sparkle']),delay,VISUAL_BEATS.charge+100,cell*.96*powerArtScale,origin,(sprite,t,base)=>{const ms=t*(VISUAL_BEATS.charge+100),u=Math.min(1,ms/VISUAL_BEATS.charge),release=Math.max(0,(ms-VISUAL_BEATS.charge)/100),lift=(bomb ? .18 : rainbow ? .34 : .25)*cell;
   sprite.position.set(origin.x,origin.y-lift*smooth(u)*(1-release));
   const scale=1+(rainbow ? .3 : .22)*smooth(u),squash=bomb?Math.sin(u*Math.PI*2)*.15:wind?Math.sin(u*Math.PI)*.12:0;sprite.scale.set(base*(scale+squash)*(1-.2*release),base*(scale-squash)*(1-.2*release));
   sprite.rotation=wind?Math.sin(u*Math.PI*3)*.08:bomb?Math.sin(u*22)*.1*u:rainbow?Math.sin(u*Math.PI*2)*.12:Math.sin(u*Math.PI)*-.2;sprite.alpha=1-release;
  });
  const tint=bomb?0xffc967:rainbow?0xd6a0ff:0x7deaf0;chargeRing(origin,cell*(rainbow?2.3:2),delay+35,VISUAL_BEATS.charge,tint,rainbow);
  if(wind)orbit(origin,cell*.8,delay+20,340,3,[0x91f5ff,0xffeaa0]);
 }
 function fusion(event:GameEvent,parts:[Special,Special],delay:number,sources?:ReadonlyMap<number,Point>){
  const cell=layout.cellSize(),origin=layout.position(event.cells[1]!),tint=parts.includes('rainbow')?0xd4a0ff:parts.includes('bomb')?0xffc66c:0x8eeaff;
  chargeRing(origin,cell*2.9,delay,VISUAL_BEATS.fusion,tint);orbit(origin,cell*.95,delay+70,VISUAL_BEATS.fusion-70,4,[tint,0xffe7a4]);
  parts.forEach((part,index)=>{
   const from=sources?.get(event.cells[index]!)??layout.position(event.cells[index]!),side=index===0?-1:1;
   emit(images([tileArt(part)]),delay,VISUAL_BEATS.fusion,cell*.96*powerArtScale,from,(sprite,t,base)=>{const pose=fusionPose(t,from,origin,side,cell);sprite.position.set(pose.x,pose.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scale);sprite.alpha=pose.alpha;});
   // The fused charge keeps both ingredients visible, instead of replaying one ordinary item lift.
   emit(images([tileArt(part)]),delay+VISUAL_BEATS.fusion,specialCharge(event.kind??''),cell*.82*powerArtScale,origin,(sprite,t,base)=>{const angle=side*(.8+t*Math.PI*1.2),radius=cell*.25*(1-smooth(t));sprite.position.set(origin.x+Math.cos(angle)*radius*side,origin.y+Math.sin(angle)*radius-cell*.15*Math.sin(Math.PI*t));sprite.rotation=side*t*.4;sprite.scale.set(base*(1+.3*Math.sin(Math.PI*t))*(1-.25*smooth(t)));sprite.alpha=1-Math.max(0,(t-.8)/.2);});
  });
  flash(origin,cell*2.6,delay+VISUAL_BEATS.fusion*.64);ring(origin,cell*3.2,delay+VISUAL_BEATS.fusion,440);chargeRing(origin,cell*3.4,delay+VISUAL_BEATS.fusion,VISUAL_BEATS.charge,tint,true);
 }
 function beam(origin:Point,target:Point,delay:number,duration=700,thickness=.28,tint=0xffffff){const cell=layout.cellSize(),dx=target.x-origin.x,dy=target.y-origin.y,length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);emit(images(['fx_ray','trail','sparkle']),delay,duration,cell,origin,(sprite,t)=>{sprite.anchor.set(0,.5);sprite.rotation=angle;sprite.width=length*smooth(Math.min(1,t/.72));sprite.height=cell*thickness*(.7+.45*Math.sin(Math.PI*t));sprite.alpha=Math.min(1,t*12)*Math.min(1,(1-t)*5);},true,tint);}
 function lineSweep(origin:Point,horizontal:boolean,after:GameState,delay:number,prepare=true){
  const cell=layout.cellSize(),face=bounds(after),launch=delay+VISUAL_BEATS.charge;if(prepare)lift(origin,horizontal?'wind-row':'wind-column',delay);
  flash(origin,cell*2.2,launch);pulse(['fx_flash','burst'],origin,cell*2.3,launch,420);
  if(prepare)impulse(launch,1.25,110);
  for(const direction of [-1,1]){const target=horizontal?{x:face.x+(direction<0?0:face.width),y:origin.y}:{x:origin.x,y:face.y+(direction<0?0:face.height)};beam(origin,target,launch,800,.35,0xa7f6ed);
   emit(images([horizontal?'wind-row':'wind-column','wind_open']),launch,VISUAL_BEATS.windTravel,cell*1.25*powerArtScale,origin,(sprite,t,base)=>{const u=smooth(t);sprite.position.set(lerp(origin.x,target.x,u),lerp(origin.y,target.y,u));sprite.rotation=Math.sin(t*Math.PI)*direction*.06;sprite.scale.set(base*(.85+.18*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*15)*Math.min(1,(1-t)*12);});
   if(prepare)for(const side of [-1,1])emit(images(['trail','fx_ray']),launch+40,VISUAL_BEATS.windTravel,cell,origin,(sprite,t)=>{const u=smooth(t),offset=Math.sin(Math.PI*u)*cell*.26*side;sprite.position.set(lerp(origin.x,target.x,u)+(horizontal?0:offset),lerp(origin.y,target.y,u)+(horizontal?offset:0));sprite.rotation=(horizontal?0:Math.PI/2)+side*Math.cos(Math.PI*u)*.12;sprite.width=cell*(1.1+Math.sin(Math.PI*t));sprite.height=cell*.13;sprite.alpha=Math.sin(Math.PI*t)*.65;},true,0xa7f6ed);
   for(let i=1;i<=3;i++){const at={x:lerp(origin.x,target.x,i/4),y:lerp(origin.y,target.y,i/4)};pulse(['fx_starburst','sparkle'],at,cell*.9,launch+120+i*120,300,undefined,true);}}
 }
 function bomb(origin:Point,large:boolean,delay:number,prepare=true){
  const cell=layout.cellSize(),size=cell*(large?7.7:4.7),impact=delay+VISUAL_BEATS.charge+90;if(prepare)lift(origin,'bomb',delay);
  orbit(origin,cell*.95,delay+50,360,4,[0xffcd70,0xff8a92,0xb6ec8a]);impulse(impact,large?3.2:2.4,170);
  flash(origin,cell*3.1,impact);ring(origin,size,impact,760);ring(origin,size*.76,impact+140,650);
  pulse(['bomb_open','burst','bomb'],origin,cell*(large?6.1:4),impact,650,'bomb_open');
  for(let i=0;i<3;i++){const angle=i*Math.PI*2/3,at={x:origin.x+Math.cos(angle)*cell*.5,y:origin.y+Math.sin(angle)*cell*.5};emit(images(['fx_smoke','burst']),impact+70+i*25,650,cell*2.2,at,(sprite,t,base)=>{sprite.position.set(at.x+Math.cos(angle)*cell*t,at.y+Math.sin(angle)*cell*t-cell*.35*t);sprite.rotation=angle+t*.35;sprite.scale.set(base*(.4+1.2*t));sprite.alpha=Math.sin(Math.PI*t)*.42;},false,[0xffd9a7,0xffb8ca,0xd6efbc][i]);}
  for(let i=0;i<10;i++){const angle=i/10*Math.PI*2,reach=cell*(large?3.4:2.2)*(1+(i%3)*.12),color=['orange','red','green'][i%3]!;
   emit(images([`fragment_${color}`,'fx_starburst']),impact+20,600,cell*(.3+(i%2)*.13),origin,(sprite,t,base)=>{const radius=reach*easeOut(t),a=angle+Math.sin(Math.PI*t)*.55;sprite.position.set(origin.x+Math.cos(a)*radius,origin.y+Math.sin(a)*radius+cell*.35*t*t);sprite.rotation=angle+t*(i%2?3:-3);sprite.scale.set(base*(1-.55*t),base*(.65+.35*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,(1-t)*4);});}
 }
 function flight(from:number,to:number,delay:number,payload?:Special){
  const origin=layout.position(from),target=layout.position(to),cell=layout.cellSize(),dx=target.x-origin.x,dy=target.y-origin.y,distance=Math.hypot(dx,dy)||1,bend=Math.min(cell*1.4,distance*.3+cell*.35),launch=delay+VISUAL_BEATS.charge;
  const path=(u:number)=>({x:lerp(origin.x,target.x,u)-dy/distance*Math.sin(Math.PI*u)*bend,y:lerp(origin.y-cell*.28,target.y,u)+dx/distance*Math.sin(Math.PI*u)*bend});
  for(let i=1;i<=7;i++)pulse(['fx_starburst','sparkle'],path(i/8),cell*(.35+(i%2)*.12),launch+i*85,330,undefined,true);
  emit(images(['glider_flight','glider'],'glider_flight'),launch,VISUAL_BEATS.gliderFlight,cell*1.4*powerArtScale,path(0),(sprite,t,base)=>{const u=smooth(t),at=path(u),next=path(Math.min(1,u+.01));sprite.position.set(at.x,at.y);sprite.rotation=Math.atan2(next.y-at.y,next.x-at.x)+Math.PI;sprite.scale.set(base*(1+.15*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*20)*Math.min(1,(1-t)*20);});
  if(payload)emit(images([tileArt(payload)]),launch,VISUAL_BEATS.gliderFlight,cell*.72*powerArtScale,path(0),(sprite,t,base)=>{const at=path(smooth(t));sprite.position.set(at.x,at.y+cell*.22);sprite.rotation=Math.sin(t*Math.PI*3)*.14;sprite.scale.set(base*(1+.15*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*15)*Math.min(1,(1-t)*15);});
  const impact=launch+VISUAL_BEATS.gliderFlight;impulse(impact,1.1,110);flash(target,cell*2.2,impact);ring(target,cell*2.8,impact,500);pulse(['burst','sparkle'],target,cell*2,impact,400,'glider_impact');fragments('sprout',target,5,impact+20,1.2);
 }
 function rainbow(origin:Point,index:number,events:readonly GameEvent[],delay:number,after:GameState){
  const cell=layout.cellSize(),charge=VISUAL_BEATS.rainbowCharge,travel=VISUAL_BEATS.rainbowTravel,launch=delay+charge,impact=launch+travel,face=bounds(after);
  const hero=rainbowHeroPose(charge,origin,cell,face,charge,travel),anchor={x:hero.x,y:hero.y};
  // Keep the actual lantern identity in front through the full charge and target release.
  const duration=charge+travel+260;
  for(const charged of [false,true])emit(images([charged?'rainbow_charge_v25':'rainbow']),delay,duration,cell*.99*powerArtScale,origin,(sprite,t,base)=>{
   const ms=t*duration,pose=rainbowHeroPose(ms,origin,cell,face,charge,travel),blend=smooth(Math.min(1,Math.max(0,(ms-300)/400)));
   sprite.position.set(pose.x,pose.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scale);sprite.alpha=pose.alpha*(charged?blend:1-blend);
  },false,0xffffff,20);
  chargeRing(anchor,cell*3.5,delay+60,charge,0x9bdaff,true);chargeRing(anchor,cell*3.1,delay+170,charge-100,0xffd67f);
  orbit(anchor,cell*1.45,delay+70,charge-70,8,spectrum);orbit(anchor,cell*1.15,delay+160,charge+travel-160,5,spectrum,false);
  ring(anchor,cell*4.5,launch,800);ring(anchor,cell*3.2,impact,540);impulse(impact,2.1,170);
  const gravity=events.findIndex((event,at)=>at>index&&(event.type==='fall'||event.type==='spawn'&&event.kind==='normal'));
  const targets=[...new Set(events.slice(index+1,gravity<0?undefined:gravity).filter(e=>(e.type==='remove'||e.type==='hit')&&e.effectId!==undefined).flatMap(e=>e.cells))],count=Math.min(24,targets.length);
  for(let i=0;i<count;i++){
   const target=layout.position(targets[Math.floor(i*targets.length/count)]!),tint=spectrum[i%spectrum.length]!,dx=target.x-anchor.x,dy=target.y-anchor.y;
   // The full connection is visible before all targets pop at the shared impact time.
   emit(images(['fx_ring','halo']),delay+charge*.65,charge*.35+travel,cell*1.05,target,(sprite,t,base)=>{sprite.scale.set(base*(.85+.12*Math.sin(t*Math.PI*4)));sprite.alpha=Math.min(1,t*8)*.65;},true,tint);
   for(const core of [false,true])emit(images(['fx_ray','trail']),launch,travel+180,cell,anchor,(sprite,t)=>{
    sprite.anchor.set(0,.5);sprite.rotation=Math.atan2(dy,dx);sprite.width=Math.hypot(dx,dy)*smooth(Math.min(1,t/.7));sprite.height=cell*(core?.065:.21)*(1+.14*Math.sin(t*25+i));sprite.alpha=Math.min(1,t*10)*Math.min(1,(1-t)*5)*(core?.95:.7);
   },true,core?0xffffff:tint);
   emit(images(['fx_starburst','sparkle']),launch,travel,cell*.48,anchor,(sprite,t,base)=>{const at=curvedPoint(anchor,target,smooth(t),cell*.28*(i%2?1:-1));sprite.position.set(at.x,at.y);sprite.scale.set(base*(.75+.35*Math.sin(Math.PI*t)));sprite.rotation=t*Math.PI*2;sprite.alpha=Math.min(1,t*15);},true,tint);
   flash(target,cell*1.5,impact);
  }
 }
 function tool(action:Action|undefined,after:GameState,before?:GameState){if(action?.type!=='booster')return;
  if(action.item==='world-bomb'){
   const cell=layout.cellSize(),face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};
   chargeRing(origin,cell*4.3,0,1250,0xffd761);orbit(origin,cell*1.9,100,1200,8,[0xffd761,0x71caff]);
   emit(images(['world-bomb']),0,1480,cell*3.1,origin,(sprite,t,base)=>{const charge=Math.min(1,t/.9),release=Math.max(0,(t-.9)/.1);sprite.position.set(origin.x+Math.sin(t*45)*cell*.035*charge,origin.y-cell*.45*Math.sin(charge*Math.PI/2));sprite.scale.set(base*(.55+.7*easeOut(charge))*(1+.6*release));sprite.rotation=Math.sin(t*17)*.08*charge;sprite.alpha=1-release;});
   impulse(1400,3.8,230);flash(origin,cell*4.7,1400);ring(origin,Math.max(face.width,face.height)*1.4,1400,850);ring(origin,Math.max(face.width,face.height)*1.1,1550,700);impactRays(origin,1400,Math.max(face.width,face.height),0xffcf73);
   for(let i=0;i<8;i++){const angle=i/8*Math.PI*2,at={x:origin.x+Math.cos(angle)*face.width*.3,y:origin.y+Math.sin(angle)*face.height*.3};pulse(['fx_starburst','sparkle'],at,cell*1.8,1400+i*20,450,undefined,true);fragments(i%2?'sun':'drop',at,3,1430+i*20,1.4,550);}return;
  }
  if(action.item==='move-hourglass'){
   const cell=layout.cellSize(),face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};
   chargeRing(origin,cell*3,0,900,0x8de8ff);orbit(origin,cell*1.4,150,850,5,[0xffe78b,0x83e9ff]);
   emit(images(['move-hourglass']),0,1200,cell*2.6,origin,(sprite,t,base)=>{sprite.rotation=Math.PI*smooth(Math.min(1,t/.7));sprite.position.set(origin.x,origin.y-cell*.6*Math.sin(Math.PI*t));sprite.scale.set(base*(.5+.6*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*8)*Math.min(1,(1-t)*5);});flash(origin,cell*2.2,900);ring(origin,cell*4,900,450);return;
  }
  if(action.item==='cross-firework'&&action.at!==undefined){
   const cell=layout.cellSize(),face=bounds(after),origin=layout.position(action.at);
   emit(images(['cross-firework']),0,950,cell*1.9,origin,(sprite,t,base)=>{sprite.scale.set(base*(.7+.45*Math.sin(Math.PI*t)));sprite.position.set(origin.x,origin.y-cell*.3*Math.sin(Math.PI*t));sprite.rotation=Math.sin(Math.PI*t)*.2;sprite.alpha=Math.min(1,t*10)*Math.min(1,(1-t)*12);});chargeRing(origin,cell*2.5,0,850,0xffcc74);
   for(const target of [{x:face.x,y:origin.y},{x:face.x+face.width,y:origin.y},{x:origin.x,y:face.y},{x:origin.x,y:face.y+face.height}]){beam(origin,target,500,900,.4,0xffd78d);flash(target,cell*2,900);}
   impulse(900,2.2,160);flash(origin,cell*3,900);ring(origin,cell*4.2,900,650);return;
  }
  if(action.item==='color-magnet'&&action.at!==undefined&&before){
   const cell=layout.cellSize(),origin=layout.position(action.at),selected=before.cells[action.at]?.tile,color=selected?.kind==='normal'?selected.color:null;
   chargeRing(origin,cell*3,0,1000,0xd798ff);
   emit(images(['color-magnet']),0,1220,cell*1.9,origin,(sprite,t,base)=>{sprite.rotation=Math.sin(t*Math.PI*3)*.13;sprite.position.set(origin.x,origin.y-cell*.4*Math.sin(Math.PI*t));sprite.scale.set(base*(.8+.3*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*10)*Math.min(1,(1-t)*8);});
   for(const [index,source]of before.cells.entries()){if(source.tile?.kind!=='normal'||source.tile.color!==color)continue;const from=layout.position(index);beam(from,origin,300,800,.09,0xdaa8ff);emit(images([tileArt('normal',color!)]),350,650,cell*.92,from,(sprite,t,base)=>{const p=curvedPoint(from,origin,t,cell*.65);sprite.position.set(p.x,p.y);sprite.rotation=t*Math.PI;sprite.scale.set(base*(1-.75*t));sprite.alpha=1-t*.7;});}
   flash(origin,cell*3.1,1000);ring(origin,cell*4,1000,550);impulse(1000,1.4,140);return;
  }
  if(action.item==='sweep-border'){
   const cell=layout.cellSize(),face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};
   const outline=perimeterCells(after).sort((a,b)=>{const p=layout.position(a),q=layout.position(b);return Math.atan2(p.y-origin.y,p.x-origin.x)-Math.atan2(q.y-origin.y,q.x-origin.x);});
   chargeRing(origin,cell*3.8,0,700,0xffd36d);orbit(origin,cell*1.6,100,700,6,[0xffd36d,0xff8c75,0x8bcbff]);
   emit(images(['sweep-border','fx_ring']),0,850,cell*2.8,origin,(sprite,t,base)=>{sprite.scale.set(base*(.55+.65*easeOut(t)));sprite.position.set(origin.x,origin.y-cell*.4*Math.sin(Math.PI*t));sprite.rotation=Math.sin(Math.PI*t)*.15;sprite.alpha=Math.min(1,t*8)*Math.min(1,(1-t)*6);});
   for(const [index,at]of outline.entries()){
    const p=layout.position(at),delay=450+index/Math.max(1,outline.length-1)*530;
    chargeRing(p,cell*1.2,delay,1150-delay,0xffd36d);
    pulse(['fx_starburst','sparkle'],p,cell*.6,delay,420,undefined,true);
    flash(p,cell*1.6,1150);fragments('sun',p,2,1170,1.1,420);
   }
   impulse(1150,2.8,180);ring(origin,Math.max(face.width,face.height)*1.05,1150,650);flash(origin,cell*3,1150);
   return;
  }
  if(action.at===undefined)return;
  const origin=layout.position(action.at),cell=layout.cellSize(),face=bounds(after);
  if(action.item==='hammer'){
   chargeRing(origin,cell*2.2,100,660,0xffd881);orbit(origin,cell*.7,270,490,3,[0xffdb80]);
   emit(images(['hammer','bomb']),0,1120,cell*1.65,origin,(sprite,t,base)=>{const pose=hammerPose(t*1120,{x:origin.x-face.x,y:origin.y-face.y},cell,face.width,face.height);sprite.anchor.set(.42,.35);sprite.position.set(pose.x+face.x,pose.y+face.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scaleX,base*pose.scaleY);sprite.alpha=pose.alpha;});
   impulse(760,2.3,150);flash(origin,cell*2.8,760);impactRays(origin,760,cell*2.1,0xffd482);ring(origin,cell*3.5,760,540);ring(origin,cell*2.3,840,360);fragments('acorn',origin,5,790,1.5,420);fragments('sun',origin,4,800,1.8,440);
   emit(images(['fx_smoke','burst']),800,450,cell*1.9,origin,(sprite,t,base)=>{sprite.position.set(origin.x,origin.y-cell*.2*t);sprite.scale.set(base*(.3+1.1*t),base*(.2+.55*t));sprite.alpha=Math.sin(Math.PI*t)*.3;},false,0xffdcaf);
  }else if(action.item==='sweep-row'||action.item==='sweep-column'){
   const horizontal=action.item==='sweep-row',start=340,travel=590,impact=930;
   emit(images([action.item]),0,430,cell*1.5,origin,(sprite,t,base)=>{sprite.position.set(origin.x,origin.y-cell*.22*Math.sin(Math.PI*t));sprite.rotation=Math.sin(Math.PI*t)*-.23;sprite.scale.set(base*(.8+.35*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*10)*Math.min(1,(1-t)*7);});chargeRing(origin,cell*2,30,340,0x98eddf);
   for(const direction of [-1,1]){
    const target=horizontal?{x:face.x+(direction<0?cell*.25:face.width-cell*.25),y:origin.y}:{x:origin.x,y:face.y+(direction<0?cell*.25:face.height-cell*.25)};
    emit(images([action.item]),start,travel,cell*1.42,origin,(sprite,t,base)=>{const pose=rakePose(t,origin,target,horizontal,direction,cell);sprite.position.set(pose.x,pose.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scale,base*pose.scale*(horizontal?direction:-direction));sprite.alpha=Math.min(1,t*12)*Math.min(1,(1-t)*12);});
    for(const tooth of [-1,0,1]){const offset=tooth*cell*.16,a={x:origin.x+(horizontal?0:offset),y:origin.y+(horizontal?offset:0)},b={x:target.x+(horizontal?0:offset),y:target.y+(horizontal?offset:0)};beam(a,b,start,820,tooth===0 ? .11 : .065,tooth===0?0xffe197:0x8cebdd);}
    for(let i=1;i<=3;i++){const at={x:lerp(origin.x,target.x,i/4),y:lerp(origin.y,target.y,i/4)};emit(images(['fx_starburst','sparkle']),start+i*110,impact-(start+i*110)+180,cell*.42,at,(sprite,t,base)=>{sprite.scale.set(base*(.7+.3*Math.sin(t*Math.PI*3)));sprite.rotation=t*Math.PI;sprite.alpha=Math.sin(Math.PI*t)*.85;},true,0xffe0a0);}
    flash(target,cell*1.8,impact);fragments('sprout',target,3,impact+20,1.2,350);
   }
   impulse(impact,1.5,130);flash(origin,cell*2.2,impact);ring(origin,cell*2.8,impact,430);
  }
 }
 function celebrate(after:GameState,delay:number){const cell=layout.cellSize(),keys=Object.values(fragmentColors),face=bounds(after);for(let i=0;i<14;i++){const origin={x:face.x+face.width*(.1+((i*7)%17)/21),y:face.y+cell*(.5+(i%3)*.2)},drift=((i%5)-2)*cell*.6;emit(images([`fragment_${keys[i%keys.length]}`,'fx_starburst','sparkle']),delay+(i%4)*25,760,cell*(.2+(i%3)*.055),origin,(sprite,t,base)=>{sprite.position.set(origin.x+drift*t+Math.sin(t*6+i)*cell*.15,origin.y+cell*(after.height*.65)*t*t-cell*.7*Math.sin(Math.PI*t));sprite.rotation=i*.7+t*(i%2?5:-5);sprite.scale.set(base*(1-.25*t));sprite.alpha=Math.min(1,(1-t)*4);});}}
 function clear(){for(const slot of pool){slot.active=false;slot.sprite.visible=false;slot.sprite.stop();}impulses.length=0;layout.impulse?.(0,0);longest=0;}
 function tick(){if(disposed)return;const now=performance.now();for(let i=impulses.length-1;i>=0;i--)if(now>=impulses[i]!.at){const impact=impulses.splice(i,1)[0]!,remaining=impact.at+impact.duration-now;if(remaining>0)layout.impulse?.(impact.strength*(remaining/impact.duration)**2,remaining);}for(const slot of pool){if(!slot.active)continue;const elapsed=now-slot.start;if(elapsed<0)continue;if(elapsed>=slot.duration){slot.active=false;slot.sprite.visible=false;continue;}slot.sprite.visible=true;if(slot.frames>1)slot.sprite.gotoAndStop(Math.min(slot.frames-1,Math.floor(elapsed/slot.duration*slot.frames)));slot.update(elapsed/slot.duration);}}
 app.ticker.add(tick);
 return {
  play(events:readonly GameEvent[],before:GameState|undefined,after:GameState,reduced:boolean,action?:Action,plan?:VisualTiming,fusionSources?:ReadonlyMap<number,Point>):number{
   if(disposed)return 0;clear();epoch=performance.now();const cell=layout.cellSize();if(!cell||!events.length)return 0;
   if(reduced){for(const at of [...new Set(events.filter(e=>e.type==='remove'||e.type==='hit').flatMap(e=>e.cells))].slice(0,5))pulse(['sparkle','burst'],layout.position(at),cell*.6,0,110);return longest;}
   const timing=plan??effectTiming(events,after,action);for(const [index,delay]of timing.fusionAt){const event=events[index]!,parts=combinationParts(event.kind??'');if(parts)fusion(event,parts,delay,fusionSources);}tool(action,after,before);if(events.some(event=>event.type==='shuffle')){const face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};emit(images(['shuffle','fx_ring']),0,740,cell*2.5,origin,(sprite,t,base)=>{sprite.rotation=t*Math.PI*2;sprite.scale.set(base*(.6+.4*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*7)*Math.min(1,(1-t)*4);});}let specials=0;
   events.forEach((event,index)=>{if(event.type!=='special'||specials++>=12)return;const at=event.cells.at(-1);if(at===undefined)return;const origin=layout.position(at),kind=event.kind??'',delay=timing.delays[index]!;
    const combined=timing.fusionAt.has(index);
    if(kind==='glider-flight'&&event.from!==undefined&&event.to!==undefined){const parent=events.slice(0,index).find(item=>item.type==='special'&&item.cells.length===2&&item.cells[1]===event.from&&combinationParts(item.kind??'')?.includes('glider')),parts=parent?combinationParts(parent.kind??''):null,payload=parts?.find(part=>part!=='glider');flight(event.from,event.to,delay,payload);return;}
    if(kind.includes('rainbow')){rainbow(origin,index,events,delay,after);if(kind==='rainbow+rainbow'){const impact=delay+VISUAL_BEATS.rainbowCharge+VISUAL_BEATS.rainbowTravel;ring(origin,cell*Math.max(after.width,after.height)*1.6,impact,850);impactRays(origin,impact,cell*4,0xd4b0ff);}}
    else if(kind.includes('bomb')&&!kind.includes('glider')){bomb(origin,kind==='bomb+bomb',delay,!combined);if(kind.includes('wind'))for(const offset of [-1,0,1]){lineSweep({x:origin.x,y:origin.y+offset*cell},true,after,delay,false);lineSweep({x:origin.x+offset*cell,y:origin.y},false,after,delay,false);}}
    else if(kind.includes('wind')&&!kind.includes('glider')){lineSweep(origin,kind!=='wind-column',after,delay,!combined);if(kind.includes('+'))lineSweep(origin,false,after,delay,false);}
    else if(kind.includes('glider')&&!combined)lift(origin,'glider',delay);
   });
   // Reserve the completion accent before optional per-tile debris fills the bounded pool.
   if(events.some(e=>e.type==='win'))celebrate(after,Math.min(1800,timing.settleAt));
   let pops=0,hits=0;
   events.forEach((event,index)=>{const delay=timing.delays[index]!;
    if(event.type==='remove')for(const at of event.cells){if(pops++>=26)break;if(timing.activationAt.has(at))continue;const previous=before?.cells[at]?.tile,kind=event.kind??(previous?.kind==='normal'?previous.color:previous?.kind??''),origin=layout.position(at);pulse(['burst','sparkle'],origin,cell*1.4,delay,260,[`pop_tile_${kind}`,'pop_burst']);flash(origin,cell*.9,delay+10);fragments(kind,origin,3,delay+25,1,300);}
    if(event.type==='hit'&&hits++<7){const at=event.cells[0];if(at!==undefined){const origin=layout.position(at);pulse(['burst','sparkle'],origin,cell*1.4,delay,300,'obstacle_hit');fragments(event.kind==='frost'?'drop':'acorn',origin,4,delay+25,1.2,340);}}
    if(event.type==='spawn'&&event.kind!=='normal'&&event.kind!=='seed'){const at=event.cells[0];if(at!==undefined)pulse(['fx_starburst','sparkle'],layout.position(at),cell*1.7,timing.settleAt,300,undefined,true);}
   });
   return longest;
  },clear,
  destroy(){if(disposed)return;clear();disposed=true;app.ticker.remove(tick);for(const slot of pool)slot.sprite.destroy();pool.length=0;},
  get activeCount(){return pool.reduce((count,slot)=>count+Number(slot.active),0);},
 };
}

import {CIRCUIT_BEATS} from '../../../packages/contracts/src/garden-circuit';
import {FRONTIER_BEATS} from '../../../packages/contracts/src/garden-frontier';
import {ASSAULT_BEATS} from '../../../packages/contracts/src/garden-assault';
import {SIEGE_BEATS} from '../../../packages/contracts/src/garden-siege';
import {AnimatedSprite,type Application,type Container,type Texture} from 'pixi.js';
import type {Action,GameEvent,GameState,Special,Tile} from '@garden/contracts';
import {perimeterCells} from '@garden/core';
import {hasArt,texture,tileArt} from './assets';
import {BOMB_BEATS,CROSS_ROCKET_BEATS,DOMINO_BEAT,effectTiming,isCrossRocket,PLANTER_REVEAL_TRAVEL,REFLECTED_ROCKET_STEP,SOIL_SPLIT_TRAVEL,VISUAL_BEATS,WIND_SEED_FLIGHT,rainbowTravelTime,specialCharge,windArrival,type VisualTiming} from './visual-timing';
import {hammerPose,rakePose,curvedPoint,comboOrbitPose,itemWindupPose,rainbowHeroPose,smoothStep,type WindupItem} from './effect-motion';
import {combinationParts} from './special-combination';
import {impactOverlays,type ObstacleImpact} from './impact-overlays';
import {createObstacleDebris,type DebrisSurface} from './obstacle-debris';
import {isMatchImpact,tileGathering} from './tile-impact';
import {powerArtScale,tileVisualSize} from './tile-visuals';
import {RAINBOW_FLIGHT,rainbowSelections,rainbowArrival,type RainbowSelection} from './rainbow-selection';
import {BEE_BEATS,beePoint} from './bee-motion';
export {effectTiming} from './visual-timing';
type Point={x:number;y:number};
export interface BoardEffectsLayout {cellSize:()=>number;position:(index:number)=>Point;bounds?:()=>{x:number;y:number;width:number;height:number};frames?:(id:string)=>Texture[];impulse?:(strength:number,duration:number)=>void;shade?:(alpha:number)=>void;woodenCrates?:()=>boolean;pieceTexture?:(id:string)=>Texture;debris?:DebrisSurface;shards?:(art:string)=>ReadonlyArray<{texture:Texture;anchor:Point}>|undefined;fxArt?:(id:string)=>Texture|undefined;ripple?:(origin:Point,reach:number,duration:number,strength:number)=>void}
interface Slot {sprite:AnimatedSprite;active:boolean;start:number;duration:number;frames:number;priority:number;afterglow:boolean;update:(progress:number)=>void}
interface ParticleJob {frames:Texture[];start:number;duration:number;size:number;origin:Point;animate:(sprite:AnimatedSprite,t:number,scale:number)=>void;glow:boolean;tint:number;depth:number;afterglow:boolean}
const MAX_PARTICLES=180;
const LIGHT_MATERIALS:Record<string,string>={fx_flash:'fx_glow',halo:'fx_glow',burst:'fx_puff',fx_smoke:'fx_puff',fx_starburst:'fx_star',sparkle:'fx_star',fx_ray:'fx_streak',trail:'fx_trail',fx_ring:'fx_rays'};
const fragmentColors:Record<string,string>={berry:'red',drop:'blue',sun:'yellow',sprout:'green',flower:'purple',acorn:'orange'};
// Saturated tile colours for the rainbow's beams, so each beam reads as the colour it is collecting.
const beamColors:Record<string,number>={berry:0xff2f45,drop:0x2d8cff,sun:0xffcc14,sprout:0x2fdc3c,flower:0xb24dff,acorn:0xff8418};
const jewelLights:Record<string,number>={berry:0xff697e,drop:0x79ceff,sun:0xffe385,sprout:0xabff9d,flower:0xdca5ff,acorn:0xffb46f};
const spectrum=[0xff729e,0x65d9ff,0xffdf73,0x91ee8b,0xd4a0ff,0xffb35f];
const easeOut=(t:number)=>1-(1-t)**3,smooth=(t:number)=>t*t*(3-2*t),lerp=(a:number,b:number,t:number)=>a+(b-a)*t,backOut=(t:number,s=1.7)=>1+(s+1)*(t-1)**3+s*(t-1)**2;
/** Approved raster sprites only. Scheduled particles retain their complete lifetime and recycle on completion. */
export function createBoardEffects(app:Application,layer:Container,layout:BoardEffectsLayout){
 const pool:Slot[]=[],pending:ParticleJob[]=[];layer.sortableChildren=true;let disposed=false,longest=0,epoch=0;const impulses:Array<{at:number;strength:number;duration:number}>=[];
 const ripples:Array<{at:number;origin:Point;reach:number;duration:number;strength:number}>=[];
 const shading:Array<{start:number;peak:number;release:number;end:number;alpha:number}>=[];
 const debris=layout.debris&&createObstacleDebris(layout.debris);
 let shadeAlpha=0;
 const bounds=(state:GameState)=>layout.bounds?.()??{x:0,y:0,width:state.width*layout.cellSize(),height:state.height*layout.cellSize()};
 /** Older light sprites map onto the imagegen light materials whenever those are loaded. */
 function images(ids:string[],animation?:string|string[]):Texture[]{
  const light=LIGHT_MATERIALS[ids[0]??''],material=light?layout.fxArt?.(light):undefined;
  if(material)return [material];
  for(const id of typeof animation==='string'?[animation]:animation??[]){const frames=layout.frames?.(id);if(frames?.length)return frames;}
  for(const id of ids){const mapped=LIGHT_MATERIALS[id],art=mapped?layout.fxArt?.(mapped):undefined;if(art)return [art];if(hasArt(id))return [(layout.pieceTexture??texture)(id)];}
  return [];
 }
 function emit(frames:Texture[],delay:number,duration:number,size:number,origin:Point,animate:(sprite:AnimatedSprite,t:number,scale:number)=>void,glow=false,tint=0xffffff,depth=0,afterglow=false){
  if(disposed||!frames.length||size<=0)return;
  pending.push({frames,start:epoch+Math.max(0,delay),duration:Math.max(1,duration),size,origin,animate,glow,tint,depth,afterglow});longest=Math.max(longest,delay+duration);
 }
 /** Bends the board outwards like a pressure wave instead of drawing a ring. */
 function ripple(origin:Point,delay:number,reach:number,duration:number,strength:number){if(layout.ripple&&ripples.length<4){ripples.push({at:epoch+delay,origin,reach,duration,strength});longest=Math.max(longest,delay+duration);}}
 function impulse(delay:number,strength:number,duration=140){if(impulses.length<8)impulses.push({at:epoch+delay,strength,duration});longest=Math.max(longest,delay+duration);}
 function focus(delay:number,inTime:number,hold:number,fade:number,alpha:number){
  if(!layout.shade)return;
  const start=epoch+delay,peak=start+inTime,release=peak+hold;
  shading.push({start,peak,release,end:release+fade,alpha});
 }
 function stageShade(alpha:number){if(alpha!==shadeAlpha){shadeAlpha=alpha;layout.shade?.(alpha);}}
 function chargeRing(origin:Point,size:number,delay:number,duration:number,tint:number,flat=false){emit(images(['fx_ring','halo']),delay,duration,size,origin,(sprite,t,base)=>{const scale=base*(1-.54*easeOut(t));sprite.scale.set(scale,scale*(flat ? .48 : 1));sprite.rotation=(flat?-.5:.2)+t*(flat?2.1:-1.1);sprite.alpha=Math.sin(Math.PI*t)*.8;},true,tint);}
 function orbit(origin:Point,size:number,delay:number,duration:number,count:number,palette:number[],collapse=true){const cell=layout.cellSize();for(let i=0;i<count;i++)emit(images(['fx_starburst','sparkle']),delay+i*15,duration-i*15,cell*.38,origin,(sprite,t,base)=>{const angle=i/count*Math.PI*2+t*Math.PI*2.2,radius=size*(collapse?1-.8*easeOut(t):.8+.2*Math.sin(Math.PI*t));sprite.position.set(origin.x+Math.cos(angle)*radius,origin.y+Math.sin(angle)*radius*.65);sprite.scale.set(base*(.7+.4*Math.sin(Math.PI*t)));sprite.rotation=-angle;sprite.alpha=Math.sin(Math.PI*t);},true,palette[i%palette.length]);}
 function impactRays(origin:Point,delay:number,size:number,tint:number){const cell=layout.cellSize();for(let i=0;i<4;i++)emit(images(['fx_ray','trail']),delay,290,cell,origin,(sprite,t)=>{sprite.anchor.set(0,.5);sprite.rotation=i*Math.PI/2+Math.PI/4;sprite.width=size*(.2+.8*easeOut(t));sprite.height=cell*.13*(1-t);sprite.alpha=Math.sin(Math.PI*t);},true,tint);}
 function pulse(ids:string[],origin:Point,size:number,delay=0,duration=360,animation?:string|string[],glow=false){emit(images(ids,animation),delay,duration,size,origin,(sprite,t,base)=>{sprite.scale.set(base*(.35+.85*easeOut(t)));sprite.alpha=Math.min(1,t*12)*Math.min(1,(1-t)*3);sprite.rotation=.12*Math.sin(t*Math.PI);},glow);}
 function contactFlash(origin:Point,delay:number,size=1){
  const cell=layout.cellSize();
  emit(images(['fx_flash']),delay,135,cell*size,origin,(sprite,t,base)=>{
   sprite.scale.set(base*(.58+.55*easeOut(t)));
   sprite.alpha=smoothStep(t/.10)*(1-smoothStep((t-.10)/.9))*.93;
  },true,0xfff0c4,3);
 }
 function flash(origin:Point,size:number,delay:number){pulse(['fx_flash','sparkle','burst'],origin,size,delay,230,undefined,true);}
 function ring(origin:Point,size:number,delay:number,duration=530){emit(images(['fx_ring','burst','sparkle']),delay,duration,size,origin,(sprite,t,base)=>{sprite.scale.set(base*(.12+easeOut(t)));sprite.alpha=Math.min(1,t*12)*(1-t)*.85;},true);}
 function bloom(origin:Point,delay:number,size:number,tint:number,duration=300,afterglow=false){
  emit(images(['fx_flash','burst']),delay,duration,size,origin,(sprite,t,base)=>{
   sprite.scale.set(base*(.38+easeOut(t)*.74));
   sprite.alpha=Math.min(1,.35+t*7)*(1-t)**2*.95;
  },true,tint,4,afterglow);
 }
 function emberFan(origin:Point,delay:number,seed:number,tint:number,count:number,spread=1){
  const cell=layout.cellSize(),frames=images(['fx_starburst','sparkle']);
  for(let i=0;i<count;i++){
   const angle=seed*2.399+i*2.399,reach=cell*spread*(.48+(i%4)*.19),dx=Math.cos(angle)*reach,dy=Math.sin(angle)*reach;
   emit(frames,delay+(i%3)*19,290+(i%4)*56,cell*(.15+(i%3)*.065),origin,(sprite,t,base)=>{
    const distance=easeOut(t);
    sprite.position.set(origin.x+dx*distance,origin.y+dy*distance+cell*t*t*.72);
    sprite.rotation=angle+t*2.2;sprite.scale.set(base*(1-.7*t));sprite.alpha=(1-t)**1.4;
   },true,tint,1,true);
  }
 }
 function powerShatter(kind:string,at:number,delay:number){
  const origin=layout.position(at),cell=layout.cellSize(),material=fragmentColors[kind];
  const frames=images([...(material?[`fragment_${material}`]:[]),'fx_starburst','sparkle']);
  contactFlash(origin,delay,1.45);
  for(let i=0;i<3;i++){
   const angle=(i+at*1.3)*2.399,reach=cell*(.72+i*.23),dx=Math.cos(angle)*reach,dy=Math.sin(angle)*reach-cell*.36;
   emit(frames,delay+i*17,360+i*62,cell*(.25+i*.10),origin,(sprite,t,base)=>{
    const distance=1-(1-t)**2.6;
    sprite.position.set(origin.x+dx*distance,origin.y+dy*distance+cell*1.35*t*t);
    sprite.rotation=angle+t*(i%2?5:-4);
    sprite.scale.set(base*(1-.65*t),base*(1-.65*t)*(.85+.15*Math.cos(t*9+i)));
    sprite.alpha=Math.min(1,(1-t)*3.5);
   },false,0xffffff,2,true);
  }
 }
 function materialImpacts(events:readonly GameEvent[],before:GameState|undefined,after:GameState,timing:VisualTiming,action?:Action,provided?:readonly ObstacleImpact[]){
  const handled=new Set<number>();
  if(!debris)return handled;
  const impacts=provided?[...provided]:[];
  if(before&&!provided)impactOverlays(before,after,events,timing,impact=>impacts.push(impact));
  const contacts=new Map<number,number[]>();
  events.forEach((event,eventIndex)=>{
   if(event.type==='hit'&&event.kind==='garden-gate'&&event.cells[0]!==undefined)
    impacts.push({eventIndex,delay:timing.delays[eventIndex]!,at:event.cells[0],kind:'garden-gate',broken:true});
   if(event.effectId===undefined)return;
   const cells=event.type==='remove'?event.cells:event.to!==undefined?[event.to]:[];
   if(!cells.length)return;
   const targets=contacts.get(event.effectId)??[];
   targets.push(...cells);contacts.set(event.effectId,targets);
  });
  const toolAt=action?.type==='booster'&&action.item==='hammer'?action.at:undefined;
  let flashes=0;
  for(const {eventIndex,delay,at,kind,broken}of impacts.sort((a,b)=>a.delay-b.delay)){
   if(kind==='crate'&&layout.woodenCrates?.()===false)continue;
   const event=events[eventIndex]!,targets=event.effectId===undefined?undefined:contacts.get(event.effectId);
   const hammerContact=toolAt!==undefined&&timing.delays[eventIndex]===timing.toolImpact&&event.cells.includes(toolAt)?toolAt:undefined;
   const exactContact=timing.rocketContacts.get(eventIndex)??event.to??hammerContact;
   let contact=exactContact??at;
   if(exactContact===undefined&&event.cells.length>1&&targets?.length){
    let nearest=Infinity;
    for(const cellAt of event.cells)for(const target of targets){
     const distance=Math.abs(cellAt%after.width-target%after.width)+Math.abs(Math.floor(cellAt/after.width)-Math.floor(target/after.width));
     if(distance<nearest){nearest=distance;contact=cellAt;}
    }
   }
   const origin=layout.position(contact),cell=layout.cellSize();
   debris.burst(kind,origin,cell,epoch+delay,epoch+timing.settleAt,broken,contact+eventIndex);
   if(!isMatchImpact(event,timing)&&flashes++<15){
    contactFlash(origin,delay,broken?1.75:1.05);
    if(broken){
     ring(origin,cell*1.52,delay,255);
     emberFan(origin,delay,contact,0xffdc9f,3,.76);
    }
   }
   handled.add(eventIndex);
  }
  return handled;
 }
 function fragments(kind:string,origin:Point,count:number,delay=0,spread=1,duration=390,angleOffset=0,scale=1){
  const cell=layout.cellSize(),color=fragmentColors[kind],frames=images([...(color?[`fragment_${color}`]:[]),'fx_starburst','sparkle']);
  for(let i=0;i<count;i++){const angle=(i/count)*Math.PI*2-.65+angleOffset,reach=cell*(.5+((i*7)%5)*.14)*spread,dx=Math.cos(angle)*reach,dy=Math.sin(angle)*reach-cell*.22;
   emit(frames,delay,duration+(i%3)*30,cell*scale*(.21+(i%3)*.055),origin,(sprite,t,base)=>{const u=easeOut(t);sprite.position.set(origin.x+dx*u,origin.y+dy*u+cell*.95*t*t);sprite.rotation=angle+t*(i%2?4.6:-3.8);sprite.scale.set(base*(1-.65*t));sprite.alpha=Math.min(1,(1-t)*3);});}
 }
 function itemWindup(origin:Point,kind:WindupItem,delay:number,charge:number,fade:number,direction=0){
  const cell=layout.cellSize(),duration=charge+fade;
  emit(images([tileArt(kind)]),delay,duration,cell*.96*powerArtScale,origin,(sprite,t,base)=>{
   const elapsed=t*duration,pose=itemWindupPose(kind,elapsed/charge,direction);
   const release=fade?smoothStep((elapsed-charge)/fade):0;
   sprite.position.set(origin.x,origin.y-cell*pose.lift);
   sprite.scale.set(base*lerp(pose.scaleX,.9,release),base*lerp(pose.scaleY,.9,release));
   sprite.rotation=pose.rotation;sprite.alpha=1-release;
  },false,0xffffff,kind==='beehive'?15:10);
 }
 function rocketWindup(origin:Point,horizontal:boolean,delay:number){
  const cell=layout.cellSize();
  itemWindup(origin,horizontal?'wind-row':'wind-column',delay,VISUAL_BEATS.charge,90);
  chargeRing(origin,cell*2,delay+35,VISUAL_BEATS.charge,0x7deaf0);
  orbit(origin,cell*.8,delay+20,340,3,[0x91f5ff,0xffeaa0]);
 }
 function bombLift(origin:Point,delay:number){
  const cell=layout.cellSize(),charge=VISUAL_BEATS.charge,duration=charge+100;
  emit(images([tileArt('bomb'),'sparkle']),delay,duration,cell*.96*powerArtScale,origin,(sprite,t,base)=>{
   const elapsed=t*duration,progress=Math.min(1,elapsed/charge),release=Math.max(0,(elapsed-charge)/100);
   const scale=1+.22*smooth(progress),squash=Math.sin(progress*Math.PI*2)*.15,tail=1-.2*release;
   sprite.position.set(origin.x,origin.y-cell*.18*smooth(progress)*(1-release));
   sprite.scale.set(base*(scale+squash)*tail,base*(scale-squash)*tail);
   sprite.rotation=Math.sin(progress*22)*.1*progress;sprite.alpha=1-release;
  });
  chargeRing(origin,cell*2,delay+35,charge,0xffc967);
 }
 /** Combining two items: they swing onto a ring around the anchor and circle each other faster and tighter until they merge. */
 function fusion(event:GameEvent,parts:[Special,Special],delay:number,sources?:ReadonlyMap<number,Point>){
  const cell=layout.cellSize(),origin=layout.position(event.cells[1]!),tint=parts.includes('rainbow')?0xd4a0ff:parts.includes('bomb')?0xffc66c:0x8eeaff;
  const cross=isCrossRocket(event.kind??''),window=cross?CROSS_ROCKET_BEATS.fusion:VISUAL_BEATS.fusion;
  // Rainbow pairs hand over to the rainbow after the fusion window and a bomb pair to its swelling charge; the rest keep circling through the charge.
  const circling=cross||parts.includes('rainbow')||event.kind==='bomb+bomb'?0:specialCharge(event.kind??'');
  const total=window+circling,first=layout.position(event.cells[0]!),axis=Math.atan2(origin.y-first.y,origin.x-first.x);
  emit(images(['fx_flash']),delay,total,cell*3.6,origin,(sprite,t,base)=>{const u=smoothStep(t/.9);sprite.scale.set(base*(.3+.7*u));sprite.alpha=.55*u*(1-smoothStep((t-.9)/.1));},true,tint,3);
  if(!cross)orbit(origin,cell*.95,delay+70,total-70,4,[tint,0xffe7a4]);
  parts.forEach((part,index)=>{
   const from=sources?.get(event.cells[index]!)??layout.position(event.cells[index]!),frames=images([tileArt(part,undefined,event.powered)]),size=cell*.96*powerArtScale;
   const pose=(ms:number)=>comboOrbitPose(ms,total,from,origin,index,axis,cell,cross?100:150);
   const piece=(offset:number,length:number)=>emit(frames,delay+offset,length,size,from,(sprite,t,base)=>{
    const ms=offset+t*length,p=pose(ms);
    sprite.position.set(p.x,p.y);sprite.rotation=p.rotation;sprite.scale.set(base*p.scale);sprite.alpha=ms>total-50?(total-ms)/50:1;
   },false,0xffffff,10);
   // A faint copy trailing each piece reads as speed as the circle tightens.
   const trail=(offset:number,length:number)=>emit(frames,delay+offset,length,size,from,(sprite,t,base)=>{
    const ms=offset+t*length,p=pose(Math.max(0,ms-45));
    sprite.position.set(p.x,p.y);sprite.rotation=p.rotation;sprite.scale.set(base*p.scale*.92);sprite.alpha=ms>total-50?0:.35*smoothStep((ms-150)/150);
   },true,tint,9);
   piece(0,window);trail(0,window);
   if(circling){piece(window,circling);trail(window,circling);}
  });
  if(!cross)chargeRing(origin,cell*3.4,delay+Math.max(0,total-VISUAL_BEATS.charge),Math.min(total,VISUAL_BEATS.charge),tint,true);
 }
 function beam(origin:Point,target:Point,delay:number,duration=700,thickness=.28,tint=0xffffff,travel=duration*.72){const cell=layout.cellSize(),dx=target.x-origin.x,dy=target.y-origin.y,length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);emit(images(['fx_ray','trail','sparkle']),delay,duration,cell,origin,(sprite,t)=>{sprite.anchor.set(0,.5);sprite.rotation=angle;sprite.width=length*smooth(Math.min(1,t*duration/travel));sprite.height=cell*thickness*(.7+.45*Math.sin(Math.PI*t));sprite.alpha=Math.min(1,t*12)*Math.min(1,(1-t)*5);},true,tint);}
 function crossRocket(origin:Point,kind:string,after:GameState,start:number,launch:number){
  const cross=isCrossRocket(kind),cell=layout.cellSize();
  contactFlash(origin,launch,cross?4.6:2.35);
  if(cross){
   focus(launch-90,90,45,280,.16);
   bloom(origin,launch,cell*5.8,0xffad60,375,true);
   ring(origin,cell*5.1,launch,315);emberFan(origin,launch,5,0xffe69c,8,2);
   impulse(launch,2.45,145);
  }
  else itemWindup(origin,kind==='wind-column'?'wind-column':'wind-row',start,launch-start,0);
  for(const horizontal of cross?[true,false]:[kind==='wind-row'])rocketSweep(origin,horizontal,after,launch,cross?1:.8);
 }
 function rocketSweep(origin:Point,horizontal:boolean,after:GameState,launch:number,size:number,compact=false){
  const cell=layout.cellSize(),face=bounds(after),{travel,afterglow}=CROSS_ROCKET_BEATS;
  const ray=images(['fx_ray','trail']),headArt=images([horizontal?'wind-row':'wind-column']);
  const core={width:2.7,height:compact?.88:.68,alpha:1,tint:0xfff0b5};
  const streaks=compact?[core]:[{width:3.9,height:1.38,alpha:.85,tint:0xff8e35},core];
  for(const direction of [-1,1]){
   const dx=horizontal?direction:0,dy=horizontal?0:direction;
   const length=horizontal?(dx<0?origin.x-face.x:face.x+face.width-origin.x):(dy<0?origin.y-face.y:face.y+face.height-origin.y);
   const angle=Math.atan2(dy,dx);
   for(const streak of streaks)emit(ray,launch,travel+65,cell,origin,(sprite,t)=>{
    const ms=t*(travel+65),head=length*smooth(Math.min(1,ms/travel)),tail=Math.min(head,cell*streak.width);
    sprite.position.set(origin.x+dx*(head-tail/2),origin.y+dy*(head-tail/2));sprite.rotation=angle;
    const flicker=.87+.13*Math.cos(ms/26+direction);
    sprite.width=Math.max(1,tail);sprite.height=cell*size*streak.height*(1-.22*t)*flicker;
    sprite.alpha=smoothStep(ms/38)*smoothStep((travel+65-ms)/65)*streak.alpha;
   },true,streak.tint,6);
   // A broad soft light column stays lit along the swept line, as in Royal Match.
   const column=compact?undefined:layout.fxArt?.('fx_glow');
   if(column)emit([column],launch,travel+afterglow+120,cell,origin,(sprite,t)=>{
    const ms=t*(travel+afterglow+120),lit=length*smooth(Math.min(1,ms/travel));
    sprite.position.set(origin.x+dx*lit/2,origin.y+dy*lit/2);sprite.rotation=angle;
    sprite.width=Math.max(1,lit*1.15);sprite.height=cell*size*1.9*(1-.35*t);
    sprite.alpha=Math.min(1,ms/40)*(1-Math.max(0,ms-travel)/(afterglow+120))**1.5*.7;
   },true,0xfff0b8,2,true);
   if(!compact)emit(ray,launch,travel+afterglow,cell,origin,(sprite,t)=>{
    const ms=t*(travel+afterglow),lit=length*smooth(Math.min(1,ms/travel));
    sprite.position.set(origin.x+dx*lit/2,origin.y+dy*lit/2);sprite.rotation=angle;
    sprite.width=Math.max(1,lit);sprite.height=cell*size*(1.04-.61*t);
    sprite.alpha=Math.min(1,ms/36)*(1-Math.max(0,ms-travel)/afterglow)**2*.56;
   },true,0xffc66f,2,true);
   if(!compact)for(const t of [.37,.61,.81]){
    const head=length*smooth(t),p={x:origin.x+dx*head,y:origin.y+dy*head};
    emberFan(p,launch+t*travel,head,0xffd175,2,1.2);
   }
   // The rocket splits: each half flies its own way nose-first, flame trailing from the cut end.
   const half=layout.fxArt?.('rocket_half');
   if(half)emit([half],launch,travel,cell*1.05*size*powerArtScale,origin,(sprite,t,base)=>{
    const head=length*smooth(t),wobble=Math.sin(t*Math.PI*6)*.05*(1-t),grow=.8+.2*Math.sin(t*Math.PI);
    sprite.position.set(origin.x+dx*head,origin.y+dy*head);
    sprite.rotation=(horizontal?0:dy*Math.PI/2)+wobble;sprite.scale.set(base*grow*(horizontal&&dx<0?-1:1),base*grow);
    sprite.alpha=smoothStep(t/.06)*smoothStep((1-t)/.12);
   },false,0xffffff,10);
   else emit(headArt,launch,travel,cell*(1.17*size)*powerArtScale,origin,(sprite,t,base)=>{
    const head=length*smooth(t);
    sprite.position.set(origin.x+dx*head,origin.y+dy*head);
    sprite.rotation=Math.sin(t*Math.PI)*direction*.045;sprite.scale.set(base*(.78+.22*Math.sin(t*Math.PI)));
    sprite.alpha=smoothStep(t/.08)*smoothStep((1-t)/.15);
   },false,0xffffff,10);
  }
 }
 function lineSweep(origin:Point,horizontal:boolean,after:GameState,delay:number,prepare=true,compact=false){
  const launch=delay+VISUAL_BEATS.charge;
  if(prepare){
   const cell=layout.cellSize(),face=bounds(after);
   const reach=horizontal?Math.max(origin.x-face.x,face.x+face.width-origin.x):Math.max(origin.y-face.y,face.y+face.height-origin.y);
   rocketWindup(origin,horizontal,delay);
   contactFlash(origin,launch,3);
   bloom(origin,launch,cell*4.1,0xffc371,295,true);
   emberFan(origin,launch,3,0xffdfa0,4,1.3);
   impulse(launch+windArrival(cell/reach),1.6,110);
  }
  rocketSweep(origin,horizontal,after,launch,compact?.7:.88,compact);
 }
 /** A fused bomb pair squashes, swells and trembles while pollen is drawn in, then blazes white through the hit-stop. */
 function heroLift(origin:Point,delay:number,large=false){
  const cell=layout.cellSize(),charge=BOMB_BEATS.charge,hold=BOMB_BEATS.ignition,squash=110,total=charge+hold+70,frames=images([tileArt('bomb')]),size=cell*.96*powerArtScale*(large?1.3:1);
  const pose=(ms:number)=>{
   let sx=1,sy=1,x=origin.x,y=origin.y,rotation=0,alpha=1;
   if(ms<squash){const e=1-(1-ms/squash)**2;sx=1+.2*e;sy=1-.24*e;y+=cell*.08*e;}
   else if(ms<charge){
    const u=(ms-squash)/(charge-squash),swell=lerp(1,1.75,backOut(u,1.4)),recover=1-easeOut(Math.min(1,(ms-squash)/120)),breath=Math.sin(u*u*34)*.07*u;
    sx=swell*(1+.2*recover)*(1+breath);sy=swell*(1-.24*recover)*(1-breath);
    x+=Math.sin(ms*.95)*cell*.06*u*u;y+=-cell*.16*easeOut(u)+Math.cos(ms*1.27)*cell*.05*u*u;rotation=Math.sin(ms*.71)*.14*u*u;
   }else if(ms<charge+hold){sx=sy=1.78;y-=cell*.16;}
   else{const r=Math.min(1,(ms-charge-hold)/70);sx=sy=1.78+.8*r;y-=cell*.16;alpha=1-r;}
   return {sx,sy,x,y,rotation,alpha};
  };
  emit(frames,delay,total,size,origin,(sprite,t,base)=>{const p=pose(t*total);sprite.position.set(p.x,p.y);sprite.scale.set(base*p.sx,base*p.sy);sprite.rotation=p.rotation;sprite.alpha=p.alpha;},false,0xffffff,10);
  // An additive copy warms the swelling bomb and turns it white for the hit-stop.
  emit(frames,delay+squash,total-squash,size,origin,(sprite,t,base)=>{const ms=squash+t*(total-squash),p=pose(ms),heat=ms<charge?.35*(ms-squash)/(charge-squash):ms<charge+hold?.95:0;sprite.position.set(p.x,p.y);sprite.scale.set(base*p.sx*1.04,base*p.sy*1.04);sprite.rotation=p.rotation;sprite.alpha=heat*p.alpha;},true,0xffffff,11);
  emit(images(['fx_flash']),delay+squash,charge+hold-squash,cell*4.2,origin,(sprite,t,base)=>{const u=Math.min(1,t*(charge+hold-squash)/(charge-squash));sprite.scale.set(base*(.35+.65*u));sprite.alpha=.62*u;},true,0xffa24a,3);
  const sparks=images(['sparkle','fx_starburst']);
  for(let i=0;i<12;i++){
   const angle=i/12*Math.PI*2+i*.37,from=cell*(2.2+(i%3)*.35);
   emit(sparks,delay+squash+i*22,260,cell*.34,origin,(sprite,t,base)=>{const k=1-(1-t)**2,a=angle+k*1.6,r=from*(1-k);sprite.position.set(origin.x+Math.cos(a)*r,origin.y-cell*.16*k+Math.sin(a)*r);sprite.scale.set(base*(1-.4*k));sprite.alpha=Math.min(1,t*6);},true,i%3?0xffe066:0xffffff,9);
  }
  focus(delay+squash,charge-squash,hold,260,.3);
 }
 /** Pieces use the tile's own texture and keep their shape as they fall. */
 function tileShatter(art:string,at:number,delay:number,{from,push=.6,count=4,matched=false}:{
  from?:Point;push?:number;count?:number;matched?:boolean;
 }={}){
  const all=layout.shards?.(art);if(!all?.length)return false;
  // Big clears split into fewer, opposite pieces so every struck tile still breaks within the sprite pool.
  const pieces=count>=all.length?all:all.filter((_,i)=>Math.floor(i*count/all.length)!==Math.floor((i-1)*count/all.length));
  const origin=layout.position(at),cell=layout.cellSize(),size=cell*tileVisualSize('normal')*(matched?.42:1);
  let dx=0,dy=-1;
  if(from){const vx=origin.x-from.x,vy=origin.y-from.y,length=Math.hypot(vx,vy);if(length>1){dx=vx/length;dy=vy/length;}}
  pieces.forEach((piece,i)=>{
   const ox=(piece.anchor.x-.5)*size,oy=(piece.anchor.y-.5)*size,ol=Math.hypot(ox,oy)||1;
   let ux=ox/ol*.9+dx*push,uy=oy/ol*.9+dy*push;const ul=Math.hypot(ux,uy)||1;ux/=ul;uy/=ul;
   const seed=((at*7+i*13)%17)/17;
   const speed=cell*(matched?.95+seed*.5:1.7+seed*1.3);
   const rise=cell*(matched?.33:1.7+((at+i)%5)*.25);
   const spin=(i%2?1:-1)*(matched?1.7+seed*2:4+seed*6);
   const life=matched?140+seed*40:520+seed*160;
   emit([piece.texture],delay+(matched?0:25),life,size,origin,(sprite,t,base)=>{
    const s=t*life/1000;
    sprite.anchor.set(piece.anchor.x,piece.anchor.y);
    sprite.position.set(origin.x+ox+ux*speed*s,origin.y+oy+(uy*speed-rise)*s+cell*(matched?9:16)*s*s);
    sprite.rotation=spin*s;
    sprite.scale.set(base*(matched?1-.32*t:1.1-.45*t));
    sprite.alpha=matched?1-smoothStep((t-.35)/.65):t<.5?1:1-(t-.5)/.5;
   },false,0xffffff,2);
  });
  return true;
 }
 function bomb(origin:Point,large:boolean,delay:number,prepare=true,compact=false,hero=false){
  const cell=layout.cellSize(),radius=large?4:2,size=cell*(large?8.2:5.2),impact=delay+(hero?BOMB_BEATS.charge:VISUAL_BEATS.charge)+BOMB_BEATS.ignition;
  const travel=radius*BOMB_BEATS.step,fade=compact?135:240;
  if(hero)heroLift(origin,delay,large);else if(prepare)bombLift(origin,delay);
  if(compact){
   emit(images(['fx_ring','halo']),impact,travel+fade,cell,origin,(sprite,t,base)=>{
    const elapsed=t*(travel+fade),reach=.46+Math.min(travel,elapsed)/BOMB_BEATS.step;
    sprite.scale.set(base*reach*2);
    sprite.alpha=Math.min(1,.65+elapsed/45)*(1-Math.max(0,elapsed-travel)/fade)**2*.63;
   },true,0xffce74,4);
   emit(images(['bomb_open','burst']),impact,440,size,origin,(sprite,t,base)=>{sprite.scale.set(base*(.25+.75*easeOut(t)));sprite.alpha=Math.min(1,t*10)*(1-t);},false,0xffffff,8);
   bloom(origin,impact,cell*3.25,0xff9c51,215,true);
   return;
  }
  if(!hero)focus(delay+180,impact-delay-180,60,345,large?.32:.17);
  // Explosion: layered light materials (billowing puff, hot core, ray burst, sparks) and a pressure wave; struck tiles shatter on their own.
  const reach=cell*(large?6.5:4.4),puff=layout.fxArt?.('fx_puff'),core=layout.fxArt?.('fx_glow'),rays=layout.fxArt?.('fx_rays'),sparks=layout.fxArt?.('fx_sparks');
  if(puff&&core&&rays){
   emit([puff],impact,380,reach,origin,(sprite,t,base)=>{const grow=easeOut(Math.min(1,t*380/130));sprite.scale.set(base*(.35+.75*grow));sprite.rotation=t*.35;sprite.alpha=t<.25?1:1-(t-.25)/.75;},true,0xffe0a0,9);
   emit([core],impact,260,reach*1.05,origin,(sprite,t,base)=>{sprite.scale.set(base*(.45+.65*easeOut(t)));sprite.alpha=1-t;},true,0xffffff,9);
   emit([rays],impact,340,reach*1.3,origin,(sprite,t,base)=>{sprite.scale.set(base*(.3+.95*easeOut(t)));sprite.rotation=.2+t*.25;sprite.alpha=t<.15?1:(1-t)/.85;},true,0xfff1c8,9);
   if(sparks)emit([sparks],impact+20,540,reach*1.15,origin,(sprite,t,base)=>{sprite.scale.set(base*(.4+.9*easeOut(t)));sprite.rotation=t*.3;sprite.alpha=1-t*t;},true,0xffd27a,8);
  }else emit(images(['fx_flash']),impact,300,reach,origin,(sprite,t,base)=>{const k=easeOut(Math.min(1,t*300/90));sprite.scale.set(base*(.3+.9*backOut(k,1.6)));sprite.alpha=t<.3?1:1-(t-.3)/.7;},true,0xffc46a,9);
  contactFlash(origin,impact,large?3.2:2.2);
  ripple(origin,impact,cell*(large?7.5:4.7),440,cell*(large?.55:.42));
  impulse(impact,large?12:10,380);
 }
 function flightTrail(point:(t:number)=>Point,launch:number,travel:number,tint:number){
  const cell=layout.cellSize(),fade=135,duration=travel+fade;
  emit(images(['fx_ray','trail']),launch,duration,cell,point(0),(sprite,t)=>{
   const progress=t*duration/travel,tail=point(Math.min(1,Math.max(0,progress-.22))),head=point(Math.min(1,progress)),dx=head.x-tail.x,dy=head.y-tail.y;
   sprite.position.set((tail.x+head.x)/2,(tail.y+head.y)/2);sprite.rotation=Math.atan2(dy,dx);
   sprite.width=Math.max(1,Math.hypot(dx,dy));sprite.height=cell*.7;
   sprite.alpha=Math.min(1,progress*10)*Math.max(0,1-Math.max(0,(t*duration-travel)/fade))*.75;
  },true,tint,4);
 }
 function flight(from:number,to:number,delay:number,payload?:Special,compact=false){
  const origin=layout.position(from),target=layout.position(to),cell=layout.cellSize(),dx=target.x-origin.x,dy=target.y-origin.y,distance=Math.hypot(dx,dy)||1,bend=Math.min(cell*1.4,distance*.3+cell*.35),launch=delay+VISUAL_BEATS.charge;
  const takeoff=origin.y-cell*itemWindupPose('glider',1).lift;
  const path=(u:number)=>({x:lerp(origin.x,target.x,u)-dy/distance*Math.sin(Math.PI*u)*bend*.45,y:lerp(takeoff,target.y,u)-Math.sin(Math.PI*u)*bend});
  const travel=VISUAL_BEATS.gliderFlight,point=(t:number)=>path(smooth(t));
  if(!compact){
   flightTrail(point,launch,travel,0x8df0d9);
   bloom(origin,launch,cell*2.75,0x85e7ff,220);
   emberFan(path(0),launch,from,0xaaf4dc,4);
   for(const t of [.28,.46,.64,.82])pulse(['fx_starburst','sparkle'],point(t),cell*.55,launch+t*travel,260,undefined,true);
  }
  emit(images(['glider_flight','glider'],'glider_flight'),launch,travel,cell*(compact?1.06:1.48)*powerArtScale,path(0),(sprite,t,base)=>{
   const u=smooth(t),at=path(u),before=path(Math.max(0,u-.015)),after=path(Math.min(1,u+.015));
   sprite.position.set(at.x,at.y);sprite.rotation=Math.atan2(after.y-before.y,after.x-before.x)+Math.PI;
   sprite.scale.set(base*(1+.08*Math.sin(Math.PI*t)));sprite.alpha=smoothStep(t/.10)*smoothStep((1-t)/.15);
  },false,0xffffff,10);
  if(payload)emit(images([tileArt(payload)]),launch,travel,cell*.80*powerArtScale,path(0),(sprite,t,base)=>{const at=point(t);sprite.position.set(at.x,at.y+cell*.3);sprite.rotation=Math.sin(t*Math.PI*3)*.14;sprite.scale.set(base*(1+.08*Math.sin(Math.PI*t)));sprite.alpha=smoothStep(t/.10)*smoothStep((1-t)/.15);});
  const impact=launch+travel;
  if(!compact){
   impulse(impact,1.72,130);contactFlash(target,impact,3.45);
   bloom(target,impact,cell*4.4,0x83f1d6,285,true);emberFan(target,impact,to,0xc1fff0,6,1.75);
  }else bloom(target,impact,cell*2.35,0xafeedc,200);
  ring(target,cell*(compact?2:3.6),impact,360);pulse(['burst','sparkle'],target,cell*(compact?1.55:2.7),impact,320,'glider_impact');
 }
 function hiveCharge(origin:Point,delay:number){
  const cell=layout.cellSize();chargeRing(origin,cell*3.1,delay,BEE_BEATS.charge,0xffc54f);orbit(origin,cell*1.05,delay+40,BEE_BEATS.charge-40,4,[0xffcb61,0xffedac,0xace5ff]);
  bloom(origin,delay+BEE_BEATS.charge,cell*3.25,0xffbe56,265);emberFan(origin,delay+BEE_BEATS.charge,5,0xffdf8a,5,1.15);
  itemWindup(origin,'beehive',delay,BEE_BEATS.charge,140);
 }
 function windSeed(from:Point,to:Point,launch:number,petal=false){
  const cell=layout.cellSize(),point=(t:number)=>{
   const u=easeOut(t);
   return {x:lerp(from.x,to.x,u),y:lerp(from.y,to.y,u)-cell*Math.sin(Math.PI*u)*1.1};
  };
  for(const [i,lag]of [28,52,76].entries())emit(images(['fx_starburst','sparkle']),launch+lag,WIND_SEED_FLIGHT-lag,cell*(.23-i*.04),from,(sprite,t,base)=>{
   const at=point(t);sprite.position.set(at.x,at.y);sprite.scale.set(base);
   sprite.alpha=Math.sin(Math.PI*t)*.8;
  },true,0xffdd81,5);
  emit(images([petal?'petal-disc':'wind-seed-projectile','sparkle']),launch,WIND_SEED_FLIGHT,cell*.72,from,(sprite,t,base)=>{
   const at=point(t);sprite.position.set(at.x,at.y);
   sprite.scale.set(base*(.8+.22*Math.sin(Math.PI*t)));
   sprite.rotation=(to.x<from.x?-1:1)*(petal?Math.PI*4:.8)*t;
   sprite.alpha=Math.min(1,2*(1-t)+.25);
  },false,0xffffff,16);
  const arrival=launch+WIND_SEED_FLIGHT;
  contactFlash(to,arrival,1.8);ring(to,cell*1.85,arrival,250);impulse(arrival,1.25,100);
 }
 function beeFlight(from:number,to:number,delay:number,payload?:Special){
  const cell=layout.cellSize(),source=layout.position(from),target=layout.position(to);
  const origin={x:source.x,y:source.y-cell*itemWindupPose('beehive',1).lift};
  const direction=target.x<origin.x?-1:1,path=(t:number)=>beePoint(origin,target,t,cell);
  const travel=BEE_BEATS.flight;
  flightTrail(path,delay,travel,0xffc458);
  emit(images(['bee_flight']),delay,travel,cell*1.22,origin,(sprite,t,base)=>{
   const at=path(t),before=path(Math.max(0,t-.015)),after=path(Math.min(1,t+.015));
   sprite.position.set(at.x,at.y);sprite.rotation=Math.atan2(after.y-before.y,Math.abs(after.x-before.x)+.01)*direction;
   sprite.scale.set(base*direction*(1+.025*Math.sin(t*90)),base*(1+.045*Math.sin(t*110)));
   sprite.alpha=smoothStep(t/.10)*smoothStep((1-t)/.14);
  },false,0xffffff,18);
  if(payload)emit(images([tileArt(payload)]),delay,travel,cell*.77*powerArtScale,origin,(sprite,t,base)=>{const at=path(t);sprite.position.set(at.x,at.y+cell*.35);sprite.scale.set(base);sprite.rotation=Math.sin(Math.PI*t)*.14;sprite.alpha=smoothStep(t/.10)*smoothStep((1-t)/.14);},false,0xffffff,17);
  for(const u of [.3,.6])pulse(['sparkle'],path(u),cell*.48,delay+travel*u,230,undefined,true);
  const impact=delay+travel;contactFlash(target,impact,2.6);ring(target,cell*2.55,impact,300);impulse(impact,1.15,105);
  bloom(target,impact,cell*3.4,0xffc462,270,true);emberFan(target,impact,to,0xffe49a,4,1.3);
 }
 function convertedPower(kind:Special,at:number,arrival:number,ignite:number,release:number){
  const target=layout.position(at),cell=layout.cellSize(),duration=release-arrival;
  emit(images([tileArt(kind)]),arrival,duration,cell*tileVisualSize(kind),target,(sprite,t,base)=>{
   const elapsed=t*duration,form=Math.min(1,elapsed/155),heat=smooth(Math.max(0,(arrival+elapsed-ignite)/(release-ignite)));
   const pop=.59+.41*easeOut(form)+.26*Math.sin(Math.PI*form);
   const recoil=Math.sin(elapsed/28+at)*heat;
   sprite.position.set(target.x+cell*.023*recoil,target.y-cell*(.20*Math.sin(Math.PI*form)+.05*heat));
   sprite.scale.set(base*pop*(1+.095*heat),base*pop*(1-.045*heat));
   sprite.rotation=recoil*.048;sprite.alpha=Math.min(1,elapsed/48);
  },false,0xffffff,12);
  const fuse={x:target.x+cell*(kind==='bomb'?.15:kind==='wind-row'?.31:0),y:target.y-cell*(kind==='wind-row'?.04:.36)};
  const burn=release-ignite;
  const flameTint=kind==='glider'?0xadffee:0xffbf55;
  for(const [id,size,tint] of [['fx_flash',.78,flameTint],['fx_starburst',.38,0xfff7d6]] as const){
   emit(images([id]),ignite,burn,cell*size,fuse,(sprite,t,base)=>{
    const flicker=.84+.16*Math.cos(t*burn/29+at);
    sprite.position.set(fuse.x+Math.sin(t*18+at)*cell*.042,fuse.y-cell*.072*t);
    sprite.scale.set(base*(.64+.54*t)*flicker);
    sprite.rotation=t*2.4;sprite.alpha=Math.min(1,t*7)*flicker;
   },true,tint,5);
  }
 }
 function rainbow(origin:Point,selection:RainbowSelection,delay:number,after:GameState,timing:VisualTiming,oldTile:(at:number)=>Tile|undefined,before?:GameState){
  const cell=layout.cellSize(),charge=VISUAL_BEATS.rainbowCharge,travel=rainbowTravelTime(delay),impact=delay+charge+travel,face=bounds(after),powered=selection.powered;
  const double=selection.replacement===undefined&&selection.targets.length>0&&timing.fusionAt.has(selection.index);
  const release=impact+(selection.replacement?VISUAL_BEATS.rainbowHold:0),duration=charge+travel+260;
  const pose=rainbowHeroPose(charge,origin,cell,face,charge,travel),anchor={x:pose.x,y:pose.y};
  const palette=[0xffdd74,0x94e9ff,0xfda5e5,0xa8ffbe,0xb9a4ff];
  const tint=selection.replacement==='bomb'||selection.replacement==='beehive'?0xffbf6c:selection.replacement==='glider'?0x8fffd6:0xb2eaff;
  focus(delay+120,360,release-delay-390,330,double?.42:powered?.36:.3);
  const lanternFrames=images([tileArt('rainbow',undefined,powered)]);
  // The lantern spins so fast its glass smears into stripes (imagegen motion-blur sheet, ~90 ms per frame), like a disco ball.
  const sheet=powered?'power_rainbow_spin_blur_sheet':'rainbow_spin_blur_sheet';
  const turn=[0,1,2,3].map(i=>layout.fxArt?.(`${sheet}_${i}`)).filter((frame):frame is Texture=>!!frame);
  if(turn.length===4){const spin=Array.from({length:Math.max(1,Math.ceil(duration/360))},()=>turn).flat();
   emit(spin,delay,duration,cell*1.15*1.22*powerArtScale,origin,(sprite,t,base)=>{const pose=rainbowHeroPose(t*duration,origin,cell,face,charge,travel);sprite.position.set(pose.x,pose.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scale);sprite.alpha=pose.alpha;},false,0xffffff,20);}
  else for(const charged of [false,true])emit(lanternFrames,delay,duration,cell*1.15*powerArtScale,origin,(sprite,t,base)=>{
   const ms=t*duration,pose=rainbowHeroPose(ms,origin,cell,face,charge,travel),blend=smooth(Math.min(1,Math.max(0,(ms-220)/350)));
   sprite.position.set(pose.x,pose.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scale);sprite.alpha=pose.alpha*(charged?blend:1-blend);
  },false,0xffffff,20);
  emit(images(['fx_flash','halo']),delay+85,charge+travel-85,cell*4.8,anchor,(sprite,t,base)=>{
   sprite.scale.set(base*(.65+.35*smooth(t)+.08*Math.sin(t*15)));sprite.alpha=Math.min(1,t*5)*Math.min(1,(1-t)*12)*.55;
  },true,0xffe2ac,14);
  chargeRing(anchor,cell*(powered?5.3:4.5),delay+80,charge,0xffdb94,true);
  chargeRing(anchor,cell*3.1,delay+210,charge-100,0xc4caff);
  orbit(anchor,cell*1.3,delay+100,charge-100,powered?12:8,palette);
  contactFlash(anchor,delay+charge,4.15);ring(anchor,cell*4.7,delay+charge,385);
  const targets=selection.targets.map((at,i)=>{
   const arrival=delay+rainbowArrival(i,selection.targets.length,charge,travel);
   return {at,i,arrival,contact:arrival-115};
  });
  for(const {at,i,arrival,contact} of targets){
   const tile=oldTile(at);
   if(tile?.kind!=='normal')continue;
   const show=contact-8,end=selection.replacement?arrival+30:impact+60,hold=end-show;
   const waterScale=before?.gardenStage?.kind==='water'&&before.gardenStage.channels.includes(at)?.82:1;
   emit(images([`${tileArt('normal',tile.color)}-glow`]),show,hold,cell*tileVisualSize('normal')*waterScale,layout.position(at),(sprite,t)=>{
    const elapsed=t*hold;
    const pulse=.9+.1*Math.cos(elapsed/68+i*.42);
    sprite.alpha=Math.min(1,elapsed/54,(hold-elapsed)/48)*pulse;
   },true,jewelLights[tile.color]??tint,5);
  }
  if(double){
   contactFlash(anchor,impact,7.1);
   bloom(anchor,impact,Math.max(face.width,face.height)*1.24,0xb9d8ff,410,true);
   for(const [offset,color]of [[0,0xa3e0ff],[125,0xffdda1],[245,0xe2b5ff]] as const)emit(images(['fx_ring','halo']),impact+offset,560,Math.max(face.width,face.height)*1.65,anchor,(sprite,t,base)=>{
    sprite.scale.set(base*(.13+.87*easeOut(t)));sprite.alpha=Math.sin(Math.PI*t)*.82;
   },true,color,6,true);
   emberFan(anchor,impact,8,0xffedbe,15,3.8);
   impulse(impact,3.15,215);return;
  }
  const childAt=new Map([...selection.children].map(([index,at])=>[at,index]));
  for(const {at,i,arrival,contact} of targets){
   const target=layout.position(at);
   const flight=Math.min(RAINBOW_FLIGHT,travel),launch=contact-flight,dx=target.x-anchor.x,dy=target.y-anchor.y,length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
   const tile=oldTile(at),color=tile?.kind==='normal'?jewelLights[tile.color]??tint:tint,linger=120;
   // A thick, soft beam in the target tile's own colour (broad glow, coloured body, white-hot core), as in Royal Match.
   const width=powered?1.25:1,glowBeam=layout.fxArt?.('fx_glow'),beam=tile?.kind==='normal'?beamColors[tile.color]??color:color;
   // Body layers blend normally so the colour stays saturated on a bright board; only the thin core adds light.
   const streak=images(['fx_ray','trail']),trail=images(['trail']);
   // The trail material is thickest and brightest at its head, so the beam swells into the target cell and ends exactly on it;
   // a wider, fainter copy gives the soft halo and a thin streak the hot core.
   // Beams stay connected to every struck tile until they all break together (a conversion holds only until its tile turns).
   const hold=Math.max(flight+linger,(selection.replacement?contact+linger:impact)-launch),fade=90;
   const layers=[{frames:trail,height:2.6,alpha:.5,tint:beam,depth:2,add:false,until:flight+linger},{frames:trail,height:1.6,alpha:.95,tint:beam,depth:3,add:false,until:hold},{frames:streak,height:.26,alpha:.85,tint:0xffffff,depth:6,add:true,until:hold}];
   for(const layer of layers)emit(layer.frames,launch,layer.until+fade,cell,anchor,(sprite,t)=>{
    const ms=t*(layer.until+fade),head=length*smooth(Math.min(1,ms/flight)),reach=head;
    sprite.position.set(anchor.x+Math.cos(angle)*head/2,anchor.y+Math.sin(angle)*head/2);sprite.rotation=angle;
    sprite.width=Math.max(1,reach);sprite.height=cell*layer.height*width*(.9+.1*Math.cos(ms/37+i));
    sprite.alpha=Math.min(1,ms/40)*(1-Math.max(0,ms-layer.until)/fade)**2*layer.alpha;
   },layer.add,layer.tint,layer.depth);
   // The struck cell glows in the beam's colour for as long as the beam holds it.
   if(glowBeam)emit([glowBeam],contact,hold-(contact-launch)+fade,cell*1.8*width,target,(sprite,t,base)=>{sprite.scale.set(base*(.55+.5*easeOut(Math.min(1,t*6))));sprite.alpha=Math.min(1,t*20)*.8*(t>.9?(1-t)/.1:1);},false,beam,5);
   emit(images(['fx_starburst','sparkle']),launch,flight,cell*.68,anchor,(sprite,t,base)=>{
    const u=smooth(t);sprite.position.set(lerp(anchor.x,target.x,u),lerp(anchor.y,target.y,u));
    sprite.scale.set(base*(.72+.28*Math.sin(Math.PI*t)));sprite.rotation=t*1.8;sprite.alpha=Math.min(1,t*10);
   },true,0xfff8df,7);
   if(selection.replacement){
    contactFlash(target,arrival,powered?1.62:1.36);
    const replacement=selection.replacements.get(at)??selection.replacement;
    const child=childAt.get(at),readyAt=child===undefined?release:timing.delays[child]!;
    const ignition=Math.max(arrival+155,readyAt-120+i%6*19);
    const launchAt=readyAt+specialCharge(replacement)+(replacement==='bomb'?BOMB_BEATS.ignition:0);
    convertedPower(replacement,at,arrival,ignition,launchAt);
   }else contactFlash(target,arrival,1.05);
  }
  bloom(anchor,impact,cell*(powered?6.3:5.1),0xffdd8b,375,true);
  // The spent lantern vanishes in a white flash rather than just fading.
  const flashPuff=layout.fxArt?.('fx_puff'),flashRays=layout.fxArt?.('fx_rays');
  if(flashPuff)emit([flashPuff],impact-30,300,cell*(powered?3.6:3),anchor,(sprite,t,base)=>{sprite.scale.set(base*(.4+.8*easeOut(Math.min(1,t*2.5))));sprite.alpha=t<.2?1:1-(t-.2)/.8;},true,0xffffff,21);
  if(flashRays)emit([flashRays],impact-30,320,cell*(powered?5:4),anchor,(sprite,t,base)=>{sprite.scale.set(base*(.3+.9*easeOut(t)));sprite.rotation=t*.3;sprite.alpha=t<.15?1:(1-t)/.85;},true,powered?0xf2c8ff:0xfff6d8,21);
  emberFan(anchor,impact,6,0xffeabe,8,2.3);
  ring(anchor,cell*(powered?6.1:4.9),impact,420);
  if(selection.replacement)impulse(release+specialCharge(selection.replacement)+(selection.replacement==='beehive'?BEE_BEATS.flight:selection.replacement==='bomb'?BOMB_BEATS.ignition:selection.replacement==='glider'?VISUAL_BEATS.gliderFlight:0),2.3,175);
  else impulse(impact,powered?3:2.35,175);
 }
 function tool(action:Action|undefined,after:GameState,before?:GameState){if(action?.type!=='booster')return;
  if(action.item==='world-bomb'){
   const cell=layout.cellSize(),face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};
   focus(620,680,170,350,.34);
   chargeRing(origin,cell*4.3,0,1250,0xffd761);orbit(origin,cell*1.9,100,1200,8,[0xffd761,0x71caff]);
   emit(images(['world-bomb']),0,1480,cell*3.1,origin,(sprite,t,base)=>{const charge=Math.min(1,t/.9),release=Math.max(0,(t-.9)/.1);sprite.position.set(origin.x+Math.sin(t*45)*cell*.035*charge,origin.y-cell*.45*Math.sin(charge*Math.PI/2));sprite.scale.set(base*(.55+.7*easeOut(charge))*(1+.6*release));sprite.rotation=Math.sin(t*17)*.08*charge;sprite.alpha=1-release;});
   impulse(1400,3.8,230);contactFlash(origin,1400,7);bloom(origin,1400,face.width*1.38,0xffad55,395,true);ring(origin,Math.max(face.width,face.height)*1.4,1400,850);ring(origin,Math.max(face.width,face.height)*1.1,1550,700);impactRays(origin,1400,Math.max(face.width,face.height),0xffcf73);
   for(let i=0;i<8;i++){const angle=i/8*Math.PI*2,at={x:origin.x+Math.cos(angle)*face.width*.3,y:origin.y+Math.sin(angle)*face.height*.3};pulse(['fx_starburst','sparkle'],at,cell*1.8,1400+i*20,450,undefined,true);fragments(i%2?'sun':'drop',at,3,1430+i*20,1.4,550);}return;
  }
  if(action.item==='move-hourglass'){
   const cell=layout.cellSize(),face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};
   chargeRing(origin,cell*3.7,0,900,0x8de8ff);orbit(origin,cell*1.4,150,850,8,[0xffe78b,0x83e9ff]);bloom(origin,900,cell*4.5,0x91eaff,310);
   emit(images(['move-hourglass']),0,1200,cell*2.6,origin,(sprite,t,base)=>{sprite.rotation=Math.PI*smooth(Math.min(1,t/.7));sprite.position.set(origin.x,origin.y-cell*.6*Math.sin(Math.PI*t));sprite.scale.set(base*(.5+.6*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*8)*Math.min(1,(1-t)*5);});flash(origin,cell*2.2,900);ring(origin,cell*4,900,450);return;
  }
  if(action.item==='cross-firework'&&action.at!==undefined){
   const cell=layout.cellSize(),face=bounds(after),origin=layout.position(action.at);
   focus(620,210,105,320,.22);
   emit(images(['cross-firework']),0,950,cell*1.9,origin,(sprite,t,base)=>{sprite.scale.set(base*(.7+.45*Math.sin(Math.PI*t)));sprite.position.set(origin.x,origin.y-cell*.3*Math.sin(Math.PI*t));sprite.rotation=Math.sin(Math.PI*t)*.2;sprite.alpha=Math.min(1,t*10)*Math.min(1,(1-t)*12);});chargeRing(origin,cell*2.5,0,850,0xffcc74);
   for(const target of [{x:face.x,y:origin.y},{x:face.x+face.width,y:origin.y},{x:origin.x,y:face.y},{x:origin.x,y:face.y+face.height}]){
    beam(origin,target,620,555,1.38,0xffb659,280);beam(origin,target,620,480,.48,0xfff5bf,280);
    bloom(target,900,cell*3,0xffcb78,290,true);
   }
   impulse(900,2.7,165);contactFlash(origin,900,4.6);ring(origin,cell*4.7,900,465);emberFan(origin,900,action.at,0xffdb89,10,2.2);return;
  }
  if(action.item==='color-magnet'&&action.at!==undefined&&before){
   const cell=layout.cellSize(),origin=layout.position(action.at),selected=before.cells[action.at]?.tile,color=selected?.kind==='normal'?selected.color:null;
   chargeRing(origin,cell*3.8,0,1000,0xd798ff);focus(200,440,385,280,.21);
   emit(images(['color-magnet']),0,1220,cell*1.9,origin,(sprite,t,base)=>{sprite.rotation=Math.sin(t*Math.PI*3)*.13;sprite.position.set(origin.x,origin.y-cell*.4*Math.sin(Math.PI*t));sprite.scale.set(base*(.8+.3*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*10)*Math.min(1,(1-t)*8);});
   for(const [index,source]of before.cells.entries()){if(source.tile?.kind!=='normal'||source.tile.color!==color)continue;const from=layout.position(index);beam(from,origin,300,800,.32,0xdaa8ff);emit(images([tileArt('normal',color!)]),350,650,cell*.92,from,(sprite,t,base)=>{const p=curvedPoint(from,origin,t,cell*.65);sprite.position.set(p.x,p.y);sprite.rotation=t*Math.PI;sprite.scale.set(base*(1-.75*t));sprite.alpha=1-t*.7;});}
   contactFlash(origin,1000,4.6);bloom(origin,1000,cell*5.7,0xd6abff,360,true);ring(origin,cell*5.2,1000,500);impulse(1000,2.1,155);
   // The gathered tiles crack apart on arrival at the magnet.
   if(color)for(let i=0;i<3;i++)tileShatter(tileArt('normal',color),action.at,1000-25+i*45,{push:.9});
   return;
  }
  if(action.item==='sweep-border'){
   const cell=layout.cellSize(),face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};
   const outline=perimeterCells(after).sort((a,b)=>{const p=layout.position(a),q=layout.position(b);return Math.atan2(p.y-origin.y,p.x-origin.x)-Math.atan2(q.y-origin.y,q.x-origin.x);});
   focus(405,530,245,305,.19);
   chargeRing(origin,cell*3.8,0,700,0xffd36d);orbit(origin,cell*1.6,100,700,6,[0xffd36d,0xff8c75,0x8bcbff]);
   emit(images(['sweep-border','fx_ring']),0,850,cell*2.8,origin,(sprite,t,base)=>{sprite.scale.set(base*(.55+.65*easeOut(t)));sprite.position.set(origin.x,origin.y-cell*.4*Math.sin(Math.PI*t));sprite.rotation=Math.sin(Math.PI*t)*.15;sprite.alpha=Math.min(1,t*8)*Math.min(1,(1-t)*6);});
   for(const [index,at]of outline.entries()){
    const p=layout.position(at),delay=450+index/Math.max(1,outline.length-1)*530;
    chargeRing(p,cell*1.2,delay,1150-delay,0xffd36d);
    pulse(['fx_starburst','sparkle'],p,cell*.6,delay,420,undefined,true);
    contactFlash(p,1150,2.2);emberFan(p,1165,at,0xffdc80,2,1.65);
   }
   impulse(1150,2.8,180);ring(origin,Math.max(face.width,face.height)*1.05,1150,650);flash(origin,cell*3,1150);
   return;
  }
  if(action.at===undefined)return;
  const origin=layout.position(action.at),cell=layout.cellSize(),face=bounds(after);
  if(action.item==='hammer'){
   chargeRing(origin,cell*2.2,100,660,0xffd881);orbit(origin,cell*.7,270,490,3,[0xffdb80]);
   emit(images(['hammer','bomb']),0,1120,cell*1.65,origin,(sprite,t,base)=>{const pose=hammerPose(t*1120,{x:origin.x-face.x,y:origin.y-face.y},cell,face.width,face.height);sprite.anchor.set(.42,.35);sprite.position.set(pose.x+face.x,pose.y+face.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scaleX,base*pose.scaleY);sprite.alpha=pose.alpha;});
   impulse(760,2.3,150);contactFlash(origin,760,3.6);bloom(origin,760,cell*4.5,0xffcb70,330,true);impactRays(origin,760,cell*2.4,0xffd482);ring(origin,cell*3.5,760,540);ring(origin,cell*2.3,840,360);fragments('acorn',origin,5,790,1.5,420);fragments('sun',origin,4,800,1.8,440);
   emit(images(['fx_smoke','burst']),800,450,cell*1.9,origin,(sprite,t,base)=>{sprite.position.set(origin.x,origin.y-cell*.2*t);sprite.scale.set(base*(.3+1.1*t),base*(.2+.55*t));sprite.alpha=Math.sin(Math.PI*t)*.3;},false,0xffdcaf);
  }else if(action.item==='sweep-row'||action.item==='sweep-column'){
   const horizontal=action.item==='sweep-row',start=340,travel=590,impact=930;
   emit(images([action.item]),0,430,cell*1.5,origin,(sprite,t,base)=>{sprite.position.set(origin.x,origin.y-cell*.22*Math.sin(Math.PI*t));sprite.rotation=Math.sin(Math.PI*t)*-.23;sprite.scale.set(base*(.8+.35*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*10)*Math.min(1,(1-t)*7);});chargeRing(origin,cell*2,30,340,0x98eddf);
   for(const direction of [-1,1]){
    const target=horizontal?{x:face.x+(direction<0?cell*.25:face.width-cell*.25),y:origin.y}:{x:origin.x,y:face.y+(direction<0?cell*.25:face.height-cell*.25)};
    emit(images([action.item]),start,travel,cell*1.42,origin,(sprite,t,base)=>{const pose=rakePose(t,origin,target,horizontal,direction,cell);sprite.position.set(pose.x,pose.y);sprite.rotation=pose.rotation;sprite.scale.set(base*pose.scale,base*pose.scale*(horizontal?direction:-direction));sprite.alpha=Math.min(1,t*12)*Math.min(1,(1-t)*12);});
    for(const tooth of [-1,0,1]){const offset=tooth*cell*.19,a={x:origin.x+(horizontal?0:offset),y:origin.y+(horizontal?offset:0)},b={x:target.x+(horizontal?0:offset),y:target.y+(horizontal?offset:0)};beam(a,b,start,820,tooth===0 ? .39 : .18,tooth===0?0xffe197:0x8cebdd,travel);}
    for(let i=1;i<=3;i++){const at={x:lerp(origin.x,target.x,i/4),y:lerp(origin.y,target.y,i/4)};emit(images(['fx_starburst','sparkle']),start+i*110,impact-(start+i*110)+180,cell*.42,at,(sprite,t,base)=>{sprite.scale.set(base*(.7+.3*Math.sin(t*Math.PI*3)));sprite.rotation=t*Math.PI;sprite.alpha=Math.sin(Math.PI*t)*.85;},true,0xffe0a0);}
    flash(target,cell*1.8,impact);fragments('sprout',target,3,impact+20,1.2,350);
   }
   impulse(impact,1.65,130);contactFlash(origin,impact,3.25);bloom(origin,impact,cell*4,0xadc9fb,315,true);ring(origin,cell*3.6,impact,430);
  }
 }
 function circuitEffect(event:GameEvent,delay:number,state:GameState){
  const cell=layout.cellSize();
  if((event.kind==='petal-boomerang-flight'||event.kind==='petal-boomerang-return')&&event.from!==undefined&&event.to!==undefined){
   const from=layout.position(event.from),to=layout.position(event.to),returning=event.kind==='petal-boomerang-return';
   const flight=returning?CIRCUIT_BEATS.returnFlight:event.step===0?CIRCUIT_BEATS.firstFlight:CIRCUIT_BEATS.nextFlight,total=flight+(returning?0:CIRCUIT_BEATS.pause);
   emit(images(['siege-petal-boomerang']),delay,total,cell*.86,from,(sprite,t,base)=>{
    const u=Math.min(1,t*total/flight),p=curvedPoint(from,to,smooth(u),cell*(event.step===0?.85:.45));sprite.position.set(p.x,p.y);sprite.rotation=u*Math.PI*5;
    sprite.scale.set(base*(.92+.12*Math.sin(Math.PI*u)));sprite.alpha=returning?Math.min(1,(1-t)*5):1;
   },false,0xffffff,17);
   if(!returning){pulse(['siege-garden-pulse'],to,cell*1.65,delay+flight,280);impulse(delay+flight,1.7,110);}
  }
  if(event.kind==='crystal-chain'&&event.from!==undefined){
   const from=layout.position(event.from);
   for(const at of event.cells){const to=layout.position(at),steps=Math.abs(at%state.width-event.from%state.width)+Math.abs(Math.floor(at/state.width)-Math.floor(event.from/state.width)),travel=steps*CIRCUIT_BEATS.crystalStep;
    beam(from,to,delay,travel+150,.15,0xffa1e9,travel);pulse(['siege-garden-pulse'],to,cell*1.55,delay+travel,270);
   }
  }
  if(event.kind==='rail-clear')for(const [i,at]of event.cells.entries())if(i%3===0)pulse(['siege-garden-pulse'],layout.position(at),cell*1.7,delay+i*9,340);
 }
 function siegeEffect(event:GameEvent,delay:number){
  if(event.from===undefined)return;
  const cell=layout.cellSize(),from=layout.position(event.from);
  const center=(cells:readonly number[])=>cells.map(layout.position).reduce((p,c)=>({x:p.x+c.x/cells.length,y:p.y+c.y/cells.length}),{x:0,y:0});
  const transfer=(art:string,to:Point,start:number,duration:number,size:number)=>{
   emit(images([art]),start,duration,cell*size,from,(sprite,t,base)=>{
    const p=curvedPoint(from,to,smooth(t),cell*.7);sprite.position.set(p.x,p.y);sprite.rotation=Math.sin(t*Math.PI)*.5;
    sprite.scale.set(base*(.8+.28*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*12)*Math.min(1,(1-t)*10);
   },false,0xffffff,15);
  };
  if(event.kind==='dandelion-seed-flight'&&event.to!==undefined){
   const to=layout.position(event.to);
   transfer('siege-dandelion-seed',to,delay,ASSAULT_BEATS.seedFlight,.63);
   pulse(['siege-garden-pulse'],to,cell*1.5,delay+ASSAULT_BEATS.seedFlight,280);
   impulse(delay+ASSAULT_BEATS.seedFlight,1.45,100);
  }
  if(event.kind==='roller-pin-flight'&&event.to!==undefined){
   const to=center(event.cells);
   transfer('siege-roller-pin-2',to,delay,SIEGE_BEATS.collect,.64);
  }
  if(event.kind==='roller-roll'&&event.obstacleAfter){
   const host=event.obstacleAfter,origin=center(host.footprint),target=center(event.cells);
   const direction=Math.sign(target.x-origin.x),edge={x:target.x+direction*cell*1.45,y:origin.y};
   emit(images(['siege-garden-roller-2']),delay,SIEGE_BEATS.roll,cell*1.94,origin,(sprite,t,base)=>{
    const forward=Math.min(1,t/.68),back=Math.max(0,(t-.68)/.32),returning=host.hp>1;
    const distance=returning?smooth(forward)*(1-smooth(back)):smooth(t);
    sprite.position.set(lerp(origin.x,edge.x,distance),origin.y-cell*.065*Math.sin(forward*Math.PI*7));
    sprite.scale.set(base,base*(1-.045*Math.sin(forward*Math.PI*8)));sprite.rotation=direction*.035*Math.sin(forward*Math.PI*6);
    sprite.alpha=returning?1:Math.min(1,(1-t)*7);
   },false,0xffffff,18);
   event.cells.forEach((at,i)=>{const p=layout.position(at),hit=delay+140+Math.floor(i/2)*140;
    pulse(['siege-garden-pulse'],p,cell*1.15,hit,260);if(i%2===0)impulse(hit,1.8,90);
   });
  }
  if(event.kind==='beacon-charge'){
   const target=center(event.cells),launch=delay-SIEGE_BEATS.collect;
   transfer('siege-dew-orb',target,launch,SIEGE_BEATS.collect,.58);
   pulse(['siege-garden-pulse'],target,cell*1.45,delay,260);
  }
  if(event.kind==='bloom-unlock'){
   const target=center(event.cells);
   transfer('siege-bloom-bud-2',target,delay-SIEGE_BEATS.unlock,SIEGE_BEATS.unlock,.43);
   pulse(['siege-garden-pulse'],target,cell*1.8,delay,360);
  }
  if(event.kind==='beacon-pulse'){
   const origin={x:from.x+cell*.5,y:from.y+cell*.5};
   pulse(['siege-garden-pulse'],origin,cell*8.4,delay,SIEGE_BEATS.pulse);
   impulse(delay+160,3.4,210);ripple(origin,delay+140,cell*7,420,.5);
   for(const at of event.cells){const target=layout.position(at),travel=160+Math.hypot(target.x-from.x,target.y-from.y)/cell*24;
    beam(origin,target,delay,travel+140,.12,0xa4f6ed,travel);
    pulse(['siege-garden-pulse'],target,cell*1.2,delay+travel,220);
   }
  }
 }
 function celebrate(after:GameState,delay:number){const cell=layout.cellSize(),keys=Object.values(fragmentColors),face=bounds(after);for(let i=0;i<14;i++){const origin={x:face.x+face.width*(.1+((i*7)%17)/21),y:face.y+cell*(.5+(i%3)*.2)},drift=((i%5)-2)*cell*.6;emit(images([`fragment_${keys[i%keys.length]}`,'fx_starburst','sparkle']),delay+(i%4)*25,760,cell*(.2+(i%3)*.055),origin,(sprite,t,base)=>{sprite.position.set(origin.x+drift*t+Math.sin(t*6+i)*cell*.15,origin.y+cell*(after.height*.65)*t*t-cell*.7*Math.sin(Math.PI*t));sprite.rotation=i*.7+t*(i%2?5:-5);sprite.scale.set(base*(1-.25*t));sprite.alpha=Math.min(1,(1-t)*4);});}}
 function clear(keepAfterglow=false,keepDebris=false){
  if(!keepDebris)debris?.clear();
  if(keepAfterglow){for(let i=pending.length-1;i>=0;i--)if(!pending[i]!.afterglow)pending.splice(i,1);}
  else pending.length=0;
  if(keepAfterglow){const now=performance.now();for(let i=shading.length-1;i>=0;i--)if(shading[i]!.start>now)shading.splice(i,1);}
  else{shading.length=0;stageShade(0);}
  for(const slot of pool){if(keepAfterglow&&slot.afterglow)continue;slot.active=false;slot.sprite.visible=false;slot.sprite.stop();}
  impulses.length=0;layout.impulse?.(0,0);ripples.length=0;layout.ripple?.({x:0,y:0},0,0,0);longest=0;
 }
 function tick(){
  if(disposed)return;const now=performance.now(),released=new Set<Slot>();
  debris?.update(now);
  let shade=0;
  for(let i=shading.length-1;i>=0;i--){
   const job=shading[i]!;
   if(now>=job.end){shading.splice(i,1);continue;}
   if(now<job.start)continue;
   const onset=smooth(Math.min(1,(now-job.start)/(job.peak-job.start)));
   const tail=1-smooth(Math.max(0,(now-job.release)/(job.end-job.release)));
   shade=Math.max(shade,job.alpha*onset*tail);
  }
  stageShade(shade);
  for(const slot of pool)if(slot.active&&now>=slot.start+slot.duration){slot.active=false;slot.sprite.visible=false;released.add(slot);}
  for(let i=0;i<pending.length;){const job=pending[i]!;if(job.start>now){i++;continue;}pending.splice(i,1);if(now>=job.start+job.duration)continue;
   let slot=pool.find(item=>!item.active&&!released.has(item));
   if(!slot&&pool.length<MAX_PARTICLES){const sprite=new AnimatedSprite(job.frames,false);sprite.eventMode='none';sprite.visible=false;layer.addChild(sprite);slot={sprite,active:false,start:0,duration:0,frames:1,priority:0,afterglow:false,update:()=>{}};pool.push(slot);}
   slot??=pool.find(item=>!item.active);
   // Give visible items room to launch even when their rays fill the pool.
   if(!slot&&job.depth>=5)slot=pool.find(item=>item.priority<5);
   if(!slot&&job.depth>=8)slot=pool.find(item=>item.priority<8);
   if(!slot)continue;
   const sprite=slot.sprite;sprite.textures=job.frames;sprite.gotoAndStop(0);sprite.loop=false;sprite.anchor.set(.5);sprite.rotation=0;sprite.alpha=1;sprite.tint=job.tint;sprite.blendMode=job.glow?'add':'normal';sprite.zIndex=job.depth;
   const scale=job.size/Math.max(job.frames[0]!.orig.width,job.frames[0]!.orig.height);sprite.scale.set(scale);sprite.position.set(job.origin.x,job.origin.y);
   slot.active=true;slot.start=job.start;slot.duration=job.duration;slot.frames=job.frames.length;slot.priority=job.depth;slot.afterglow=job.afterglow;slot.update=t=>job.animate(sprite,t,scale);
  }
  for(let i=ripples.length-1;i>=0;i--)if(now>=ripples[i]!.at){const wave=ripples.splice(i,1)[0]!;if(now-wave.at<150)layout.ripple?.(wave.origin,wave.reach,wave.duration,wave.strength);}
  for(let i=impulses.length-1;i>=0;i--)if(now>=impulses[i]!.at){const impact=impulses.splice(i,1)[0]!,remaining=impact.at+impact.duration-now;if(remaining>0)layout.impulse?.(impact.strength*(remaining/impact.duration)**2,remaining);}
  for(const slot of pool){if(!slot.active)continue;const elapsed=now-slot.start;slot.sprite.visible=true;if(slot.frames>1)slot.sprite.gotoAndStop(Math.min(slot.frames-1,Math.floor(elapsed/slot.duration*slot.frames)));slot.update(elapsed/slot.duration);}
 }
 app.ticker.add(tick);
 return {
  play(events:readonly GameEvent[],before:GameState|undefined,after:GameState,reduced:boolean,action?:Action,plan?:VisualTiming,fusionSources?:ReadonlyMap<number,Point>,continuingCascade=false,obstacleImpacts?:readonly ObstacleImpact[]):number{
   if(disposed)return 0;clear(continuingCascade&&!reduced,!reduced);epoch=performance.now();const cell=layout.cellSize();if(!cell||!events.length)return 0;
   const timing=plan??effectTiming(events,after,action);
   if(reduced){for(const at of [...new Set(events.filter(e=>(e.type==='remove'||e.type==='hit')&&!isMatchImpact(e,timing)).flatMap(e=>e.cells))].slice(0,5))pulse(['sparkle','burst'],layout.position(at),cell*.6,0,110);return longest;}
   const gathering=before?tileGathering(before,events):new Map<number,{anchor:number;at:number}>(),gatherCells=new Set([...gathering.values()].map(value=>value.at));
   const selections=rainbowSelections(events),converted=new Set<number>(),convertedCells=new Set<number>();for(const selection of selections.values())for(const [index,at]of selection.children){converted.add(index);convertedCells.add(at);}
   const swap=events.find(event=>event.type==='swap');
   const oldTile=(at:number)=>before?.cells[(swap&&(at===swap.from?swap.to:at===swap.to?swap.from:undefined))??at]?.tile??undefined;
   const materialHits=materialImpacts(events,before,after,timing,action,obstacleImpacts);
   for(const [index,delay]of timing.fusionAt){const event=events[index]!,parts=combinationParts(event.kind??'');if(parts)fusion(event,parts,delay,fusionSources);}tool(action,after,before);if(events.some(event=>event.type==='shuffle')){const face=bounds(after),origin={x:face.x+face.width/2,y:face.y+face.height/2};emit(images(['shuffle','fx_ring']),0,740,cell*2.5,origin,(sprite,t,base)=>{sprite.rotation=t*Math.PI*2;sprite.scale.set(base*(.6+.4*Math.sin(Math.PI*t)));sprite.alpha=Math.min(1,t*7)*Math.min(1,(1-t)*4);});}
   events.forEach((event,index)=>{if(event.type!=='special')return;const at=event.cells.at(-1);if(at===undefined)return;const origin=layout.position(at),kind=event.kind??'',delay=timing.delays[index]!,compact=converted.has(index);
    const combined=timing.fusionAt.has(index);
    const rocketLaunch=timing.rocketLaunches.get(index);
    if(rocketLaunch!==undefined){crossRocket(origin,kind,after,delay,rocketLaunch);return;}
    if(kind==='bee-flight'&&event.from!==undefined&&event.to!==undefined){beeFlight(event.from,event.to,delay,event.payload);return;}
    if(kind==='glider-flight'&&event.from!==undefined&&event.to!==undefined){const parent=events.slice(0,index).find(item=>item.type==='special'&&item.cells.length===2&&item.cells[1]===event.from&&combinationParts(item.kind??'')?.includes('glider')),parts=parent?combinationParts(parent.kind??''):null,payload=parts?.find(part=>part!=='glider');flight(event.from,event.to,delay,payload,convertedCells.has(event.from));return;}
    if(event.routes){
     if(!compact)rocketWindup(origin,kind==='wind-row',delay);
     const launch=delay+VISUAL_BEATS.charge;
     if(!compact)contactFlash(origin,launch,2.7);
     for(const route of event.routes)for(let i=1;i<route.length;i++){
      const from=layout.position(route[i-1]!),to=layout.position(route[i]!);
      const step=REFLECTED_ROCKET_STEP;
      beam(from,to,launch+(i-1)*step,step+115,compact?.48:1.02,0xffbd6d,step);
      const next=route[i+1]===undefined?null:layout.position(route[i+1]!);
      if(next&&(from.x===to.x)!==(next.x===to.x)){
       const arrival=launch+i*REFLECTED_ROCKET_STEP;
       ring(to,cell*2.35,arrival,250);
       contactFlash(to,arrival,2.55);
      }
     }
    }
    else if(kind.includes('rainbow'))rainbow(origin,selections.get(index)!,delay,after,timing,oldTile,before);
    else if(kind.includes('beehive')){if(!compact)hiveCharge(origin,delay);}
    else if(kind.includes('wind')&&kind.includes('bomb')){
     const launch=delay+VISUAL_BEATS.charge;
     focus(launch-135,135,65,320,.25);
     contactFlash(origin,launch,5.1);ring(origin,cell*5.4,launch,355);impulse(launch,2.85,170);
     bloom(origin,launch,cell*7,0xffa653,330,true);emberFan(origin,launch,at,0xffdc96,10,1.9);
     const row=Math.floor(at/after.width),column=at%after.width;
     for(const offset of [-1,0,1]){
      if(row+offset>=0&&row+offset<after.height)rocketSweep({x:origin.x,y:origin.y+offset*cell},true,after,launch,.78);
      if(column+offset>=0&&column+offset<after.width)rocketSweep({x:origin.x+offset*cell,y:origin.y},false,after,launch,.78);
     }
    }
    else if(kind.includes('bomb')&&!kind.includes('glider'))bomb(origin,kind==='bomb+bomb',delay,!combined&&!compact,compact,timing.heroBombs.has(index));
    else if(kind.includes('wind')&&!kind.includes('glider')){lineSweep(origin,kind!=='wind-column',after,delay,!combined&&!compact,compact);if(kind.includes('+'))lineSweep(origin,false,after,delay,false);}
    else if(kind==='glider'&&!combined&&!compact){
     const target=events.slice(index+1).find(next=>next.kind==='glider-flight'&&next.from===at)?.to;
     const direction=target===undefined?0:Math.sign(layout.position(target).x-origin.x);
     itemWindup(origin,'glider',delay,VISUAL_BEATS.charge,100,direction);
     chargeRing(origin,cell*2,delay+35,VISUAL_BEATS.charge,0x7deaf0);
    }
   });
   // Reserve the completion accent before optional per-tile debris fills the bounded pool.
   if(events.some(e=>e.type==='win'))celebrate(after,Math.min(1800,timing.settleAt));
   let pops=0,hits=0;
   // Shards fly away from the nearest blast (or the booster's target) that broke them.
   const blasts=[...events.flatMap(event=>event.type==='special'&&(event.kind??'').includes('bomb')&&event.cells.at(-1)!==undefined?[layout.position(event.cells.at(-1)!)]:[]),...(action?.type==='booster'?[action.at!==undefined?layout.position(action.at):(()=>{const face=bounds(after);return {x:face.x+face.width/2,y:face.y+face.height/2};})()]:[])];
   // A removal carries its effect id, so shards can follow the very rocket or bomb that broke them.
   const sources=new Map(events.flatMap(event=>{const at=event.from??event.cells.at(-1);return event.type==='special'&&event.effectId!==undefined&&at!==undefined?[[event.effectId,{origin:layout.position(at),rocket:(event.kind??'').includes('wind')}] as const]:[];}));
   const nearestBlast=(point:Point)=>blasts.reduce<Point|undefined>((best,at)=>!best||Math.hypot(at.x-point.x,at.y-point.y)<Math.hypot(best.x-point.x,best.y-point.y)?at:best,undefined);
   const windTargets=new Map(events.flatMap(event=>event.type==='hit'&&(event.kind==='windmill'||event.kind==='sun-gate')&&event.effectId!==undefined?
    [[event.effectId,event.cells] as const]:[]));
   let refilled=false;
   const magnetPull=action?.type==='booster'&&action.item==='color-magnet';
   // Count the tiles that will crack so a board-wide clear shares the pool instead of dropping the tail.
   let firstWave=0;{let seen=false;for(const event of events){if(event.type==='fall'||event.type==='spawn'&&event.kind==='normal')seen=true;if(!seen&&event.type==='remove')firstWave+=event.cells.filter(at=>before?.cells[at]?.tile?.kind==='normal'&&!timing.activationAt.has(at)&&!gatherCells.has(at)).length;}}
   const piecesPerTile=Math.max(3,Math.min(8,Math.floor(140/Math.max(1,firstWave))));
   events.forEach((event,index)=>{const delay=timing.delays[index]!;
    // Cascade removals are scheduled before their refilled tiles land, so only the first wave cracks visibly.
    if(event.type==='fall'||event.type==='spawn'&&event.kind==='normal')refilled=true;
    if(event.kind==='twin-prime')for(const at of event.cells)flash(layout.position(at),cell*.74,delay);
    if(event.kind==='twin-release'&&event.from!==undefined&&event.to!==undefined){
     beam(layout.position(event.from),layout.position(event.to),delay,215,.3,0xffdd9e);
    }
    if((event.kind==='fuse-blast'||event.kind==='mushroom-pulse')&&event.from!==undefined){
     const from=layout.position(event.from);
     bloom(from,delay,cell*2.8,0xffa55a,260,true);
     ring(from,cell*2.35,delay,230);
    }
    if(event.kind==='chapter-relay'&&event.from!==undefined&&event.cells.length){
     beam(layout.position(event.from),layout.position(event.cells[0]!),delay,230,.3,0xc7e9ff);
    }
    if(event.kind==='chapter-compost'||event.kind==='chapter-color-wave'||event.kind==='chapter-reseal'){
     for(const at of event.cells)flash(layout.position(at),cell*.72,delay);
    }
    if(['petal-boomerang-flight','petal-boomerang-return','crystal-chain','rail-clear'].includes(event.kind??''))circuitEffect(event,delay,after);
    if(['dandelion-seed-flight','roller-pin-flight','roller-roll','beacon-charge','bloom-unlock','beacon-pulse'].includes(event.kind??''))siegeEffect(event,delay);
    if((event.kind==='wind-seed-flight'||event.kind==='petal-disc-flight')&&event.from!==undefined&&event.effectId!==undefined){
     const cells=windTargets.get(event.effectId);
     if(cells?.length){
      const points=cells.map(layout.position);
      const center=points.reduce((p,at)=>({x:p.x+at.x/points.length,y:p.y+at.y/points.length}),{x:0,y:0});
      windSeed(layout.position(event.from),center,delay,event.kind==='petal-disc-flight');
     }
    }
    if(event.kind==='shelf-collapse'&&event.cells.length){
     const points=event.cells.map(layout.position),origin=points.reduce((p,c)=>({x:p.x+c.x/points.length,y:p.y+c.y/points.length}),{x:0,y:0});
     emit(images(['siege-rack-frame']),delay,FRONTIER_BEATS.shelfCollapse,cell*4,origin,(sprite,t,base)=>{
      sprite.position.set(origin.x,origin.y+cell*.7*t*t);sprite.scale.set(base*(1+.1*t));sprite.rotation=.05*Math.sin(Math.PI*t);sprite.alpha=1-smooth(t);
     },false,0xffffff,10);debris?.burst('rack-frame',origin,cell,epoch+delay,epoch+timing.settleAt,true,event.cells[0]??0);impulse(delay+70,2.4,160);
     for(const at of event.cells)pulse(['siege-garden-pulse'],layout.position(at),cell*1.6,delay+40,310);
    }
    if(event.kind==='canopy-open'&&event.from!==undefined){
     const origin=layout.position(event.from),points=event.cells.map(layout.position),target=points.reduce((p,c)=>({x:p.x+c.x/points.length,y:p.y+c.y/points.length}),{x:0,y:0});
     beam(origin,target,delay,FRONTIER_BEATS.unroll,.12,0xd6eaa0);
     pulse(['siege-garden-pulse'],target,cell*2,delay+FRONTIER_BEATS.unroll-90,280);
    }
    if(event.type==='hit'&&event.kind==='boomerang-pod'&&event.obstacleAfter===null){
     const origin=layout.position(event.cells[0]!);emit(images(['siege-boomerang-pod-2']),delay,140,cell*.98,origin,(sprite,t,base)=>{sprite.scale.set(base*(1+.18*Math.sin(Math.PI*t)));sprite.alpha=1-smooth(t);},false,0xffffff,9);
    }
    if(event.type==='hit'&&event.kind==='dandelion-turret'){
     const from=layout.position(event.cells[0]!);
     pulse(['siege-garden-pulse'],from,cell*1.15,delay,210);
    }
    if(event.type==='hit'&&event.kind==='pottery-nest'&&event.obstacleAfter===null){
     const points=event.cells.map(layout.position),from=points.reduce((p,c)=>({x:p.x+c.x/points.length,y:p.y+c.y/points.length}),{x:0,y:0});
     emit(images(['siege-pottery-nest-2']),delay,ASSAULT_BEATS.reveal+100,cell*1.98,from,(sprite,t,base)=>{
      sprite.position.set(from.x,from.y-cell*.4*smooth(t));sprite.scale.set(base*(1+.08*t));sprite.alpha=1-smooth(t);
     },false,0xffffff,12);
    }
    if(event.kind==='starlight-lantern'&&event.obstacleAfter?.hp===1){
     for(const at of event.cells)flash(layout.position(at),cell*1.28,delay);
    }
    if(event.kind==='domino-chain'&&event.from!==undefined&&event.to!==undefined){
     const from=layout.position(event.from),to=layout.position(event.to);
     emit(images(['domino-slat']),delay,DOMINO_BEAT+75,cell*.76,from,(sprite,t,scale)=>{
      const phase=Math.min(1,t*1.75),p=curvedPoint(from,to,phase,cell*.1);
      sprite.position.set(p.x,p.y);sprite.rotation=phase*Math.PI*.5;sprite.scale.set(scale*(1-.3*phase));sprite.alpha=1-t;
     },false,0xffffff,4);
     contactFlash(to,delay+DOMINO_BEAT,1.2);
    }
    if(event.kind==='soil-split'&&event.from!==undefined){
     const from=layout.position(event.from);
     for(const at of event.cells){const to=layout.position(at);
      emit(images(['soil-chip']),delay,SOIL_SPLIT_TRAVEL,cell*.74,from,(sprite,t)=>{
       const p=curvedPoint(from,to,t,cell*.3);sprite.position.set(p.x,p.y);sprite.rotation=t*.4;
      },false,0xffffff,4);
     }
    }
    if(event.kind==='garden-light-on'&&event.from!==undefined){
     const from=layout.position(event.from),end=event.cells.at(-1);
     chargeRing(from,cell*1.7,delay,300,0xffe6a0);
     if(end!==undefined)beam(from,layout.position(end),delay,400,.25,0xffe6a0);
    }
    if(event.kind==='fence-close')for(const at of event.cells)flash(layout.position(at),cell*1.5,delay);
    if(event.from!==undefined&&['greenhouse-sluice-open','vine-knot-open','rotating-shelf-open'].includes(event.kind??'')){
     const from=layout.position(event.from),travel=PLANTER_REVEAL_TRAVEL;
     const water=event.kind==='greenhouse-sluice-open',shelf=event.kind==='rotating-shelf-open';
     const tint=water?0x86e6ff:shelf?0xffdb8f:0xb4ef77;
     chargeRing(from,cell*1.7,delay,travel,tint);
     if(shelf)emit(images(['rotating-shelf']),delay,travel,cell*.96,from,(sprite,t,base)=>{
      sprite.scale.set(base*Math.abs(Math.cos(Math.PI*t)),base);
      sprite.alpha=1-t;
     },false,0xffffff,5);
     for(const at of event.cells){
      const target=layout.position(at);
      beam(from,target,delay,travel,.17,tint);
      flash(target,cell*1.3,delay+travel);
     }
    }
    if(event.kind==='power-rainbow-aftershock'&&event.from!==undefined){
     const origin=layout.position(event.from),face=bounds(after);
     ring(origin,Math.max(face.width,face.height)*1.45,delay,460);
     bloom(origin,delay,cell*5,0xc3afff,330,true);emberFan(origin,delay,event.from,0xe9cbff,10,3.1);
     impulse(delay,2.65,160);
    }
    if(event.kind==='echo-pulse'&&event.from!==undefined){
     ring(layout.position(event.from),cell*3.3,Math.max(0,delay-90),440);
     flash(layout.position(event.from),cell*1.9,delay);
    }
    if(event.kind==='portal-transfer'||event.kind==='dye-stencil'||event.kind==='mirror-pulse'){
     for(const at of event.cells.slice(0,12)){
      contactFlash(layout.position(at),delay,1.35);
      ring(layout.position(at),cell*1.35,delay,260);
     }
    }
    const rocketAt=timing.rocketContacts.get(index);
    if(materialHits.has(index))return;
    const matched=isMatchImpact(event,timing);
    if(event.type==='remove')for(const at of event.cells){
     if(timing.activationAt.has(at)||gatherCells.has(at))continue;
     const previous=oldTile(at),kind=event.kind??(previous?.kind==='normal'?previous.color:previous?.kind??''),origin=layout.position(at);
     if(matched){
      if(!fragmentColors[kind])continue;
      if(pops++>=26)break;
      if(!tileShatter(tileArt('normal',kind),at,delay,{matched:true,count:3,push:.28})&&hasArt(`fragment_${fragmentColors[kind]}`)){
       fragments(kind,origin,2,delay,.38,115,at*.6,.48);
      }
      continue;
     }
     // Every tile an item breaks in its own wave cracks apart; the magnet's tiles crack where they land instead.
     if(!refilled&&!magnetPull&&previous?.kind==='normal'){
      const source=event.effectId===undefined?undefined:sources.get(event.effectId);
      if(tileShatter(tileArt('normal',previous.color),at,delay,{from:source?.origin??nearestBlast(origin),push:source?.rocket?1.15:.6,count:piecesPerTile}))continue;
     }
     if(pops++>=32)break;
     powerShatter(kind,at,delay);
    }
    if(!matched&&event.type==='hit'&&event.kind!=='windmill'&&event.kind!=='sun-gate'&&event.kind!=='planter-reveal'&&hits++<12){
     const at=rocketAt??event.cells[0];
     if(at!==undefined){
      const origin=layout.position(at);
      contactFlash(origin,delay,1.5);ring(origin,cell*1.55,delay,210);
     }
    }
    if(timing.special&&!matched&&event.type==='spawn'&&event.kind!=='normal'&&event.kind!=='seed'){const at=event.cells[0];if(at!==undefined)ring(layout.position(at),cell*1.65,event.effectId===undefined?timing.settleAt:delay,230);}
   });
   pending.sort((a,b)=>a.start-b.start||b.depth-a.depth);return longest;
  },clear,
  destroy(){if(disposed)return;clear();debris?.destroy();disposed=true;app.ticker.remove(tick);for(const slot of pool)slot.sprite.destroy();pool.length=0;},
  get activeCount(){return pool.reduce((count,slot)=>count+Number(slot.active),0);},
 };
}

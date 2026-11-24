import {Sprite,type Application,type Container,type Texture} from 'pixi.js';
import {fxMaterial} from './board-fx-art';

type Point={x:number;y:number};
export interface LumiIntroLayout {cellSize:()=>number;position:(index:number)=>Point;bounds:()=>{x:number;y:number;width:number;height:number};tileAt:(index:number)=>Sprite|undefined}

/** Lumi's beats, in ms: hop in, wind up, toss (items leave the basket), cheer, then duck away. */
export const LUMI_INTRO={hop:380,windup:300,toss:420,cheer:520,leave:320,flight:480,stagger:110} as const;
export const lumiIntroDuration=(items:number)=>LUMI_INTRO.hop+LUMI_INTRO.windup+Math.max(LUMI_INTRO.toss,LUMI_INTRO.stagger*Math.max(0,items-1)+LUMI_INTRO.flight)+LUMI_INTRO.cheer+LUMI_INTRO.leave;
const easeOut=(t:number)=>1-(1-t)**3,clamp=(t:number)=>Math.max(0,Math.min(1,t));
const backOut=(t:number,s=1.6)=>1+(s+1)*(t-1)**3+s*(t-1)**2;

/** Plays once at the start of a run: Lumi pops up below the board and throws the chosen start boosters onto their cells. */
export function playLumiIntro(app:Application,layer:Container,layout:LumiIntroLayout,cells:readonly number[]):number{
 const poses={hop:fxMaterial('lumi_hop' as never),windup:fxMaterial('lumi_windup' as never),toss:fxMaterial('lumi_toss' as never),cheer:fxMaterial('lumi_cheer' as never)} as Record<string,Texture|undefined>;
 if(!poses.hop||!poses.windup||!poses.toss||!poses.cheer||!cells.length)return 0;
 const face=layout.bounds(),cell=layout.cellSize(),height=Math.min(face.height*.42,cell*3.6);
 const home={x:face.x+face.width/2,y:face.y+face.height-height*.42},below=face.y+face.height+height*.6;
 const lumi=new Sprite(poses.hop);lumi.anchor.set(.5);lumi.eventMode='none';lumi.zIndex=40;layer.addChild(lumi);
 const baseScale=height/poses.hop.height;
 // The chosen boosters wait hidden on their cells until their flight lands.
 const targets=cells.flatMap(at=>{const tile=layout.tileAt(at);if(!tile)return [];const scale={x:tile.scale.x,y:tile.scale.y};tile.alpha=0;return [{at,tile,scale}];});
 const flyers=targets.map(({tile})=>{const s=new Sprite(tile.texture);s.anchor.set(.5);s.eventMode='none';s.zIndex=41;s.visible=false;layer.addChild(s);return s;});
 const star=fxMaterial('fx_star'),glow=fxMaterial('fx_glow'),trail=fxMaterial('fx_trail');
 const sparks=targets.map(()=>{if(!star)return undefined;const s=new Sprite(star);s.anchor.set(.5);s.blendMode='add';s.tint=0xffe6a0;s.visible=false;s.zIndex=42;layer.addChild(s);return s;});
 const tails=targets.map(()=>{if(!trail)return undefined;const s=new Sprite(trail);s.anchor.set(1,.5);s.blendMode='add';s.tint=0xfff0c0;s.visible=false;s.zIndex=40;layer.addChild(s);return s;});
 const halo=glow?new Sprite(glow):undefined;if(halo){halo.anchor.set(.5);halo.blendMode='add';halo.tint=0xffd27a;halo.alpha=0;halo.zIndex=39;layer.addChild(halo);}
 const {hop,windup,toss,cheer,leave,flight,stagger}=LUMI_INTRO,tossAt=hop+windup,throwSpan=Math.max(toss,stagger*Math.max(0,targets.length-1)+flight),cheerAt=tossAt+throwSpan,leaveAt=cheerAt+cheer,total=leaveAt+leave;
 // The basket sits up and to the right of Lumi in the toss pose.
 const basket=()=>({x:lumi.x+height*.22,y:lumi.y-height*.22});
 const start=performance.now();let done=false;
 const tick=()=>{
  const ms=performance.now()-start;
  if(ms>=total){finish();return;}
  let y=home.y,sx=1,sy=1,pose=poses.hop!;
  if(ms<hop){const u=clamp(ms/hop);y=below+(home.y-below)*backOut(u);sy=1+.12*(1-u);sx=1-.08*(1-u);}
  else if(ms<tossAt){pose=poses.windup!;const u=(ms-hop)/windup;sx=1+.06*Math.sin(Math.PI*u);sy=1-.06*Math.sin(Math.PI*u);}
  else if(ms<cheerAt){pose=poses.toss!;const u=clamp((ms-tossAt)/120);y=home.y-height*.06*Math.sin(Math.PI*u);}
  else if(ms<leaveAt){pose=poses.cheer!;y=home.y-height*.04*Math.abs(Math.sin((ms-cheerAt)/cheer*Math.PI*2));}
  else{pose=poses.cheer!;const u=easeOut(clamp((ms-leaveAt)/leave));y=home.y+(below-home.y)*u;}
  if(lumi.texture!==pose)lumi.texture=pose;
  lumi.position.set(home.x,y);lumi.scale.set(baseScale*sx,baseScale*sy);
  if(halo){const u=clamp((ms-hop)/windup);const on=ms<tossAt?u:ms<cheerAt?1-clamp((ms-tossAt)/throwSpan)*.6:0;const b=basket();halo.position.set(b.x,b.y);halo.width=halo.height=cell*2.2*(.6+.4*on);halo.alpha=.8*on;}
  targets.forEach(({at,tile,scale},i)=>{
   const flyer=flyers[i]!,spark=sparks[i],tail=tails[i],launch=tossAt+i*stagger,t=(ms-launch)/flight,to=layout.position(at),from=basket();
   if(t<0)return;
   if(t<1){
    const arc=Math.min(cell*2.6,Math.hypot(to.x-from.x,to.y-from.y)*.45),x=from.x+(to.x-from.x)*t,yy=from.y+(to.y-from.y)*t-arc*Math.sin(Math.PI*t);
    flyer.visible=true;flyer.position.set(x,yy);flyer.rotation=(1-t)*Math.PI*1.5*(i%2?1:-1);flyer.scale.set(scale.x*(.55+.45*t),scale.y*(.55+.45*t));
    if(tail){const dx=x-(from.x+(to.x-from.x)*(t-.04)),dy=yy-(from.y+(to.y-from.y)*(t-.04)-arc*Math.sin(Math.PI*(t-.04)));tail.visible=true;tail.position.set(x,yy);tail.rotation=Math.atan2(dy,dx);tail.width=cell*1.6;tail.height=cell*.35;tail.alpha=.8*(1-t*.4);}
    return;
   }
   flyer.visible=false;if(tail)tail.visible=false;
   // Landing: the real board tile pops into place with a sparkle.
   const land=clamp((t-1)*flight/220);tile.alpha=1;const pop=1+.25*Math.sin(Math.PI*land);tile.scale.set(scale.x*pop,scale.y*pop);
   if(spark){spark.visible=land<1;spark.position.set(to.x,to.y);spark.width=spark.height=cell*(.8+1.2*land);spark.alpha=1-land;}
  });
 };
 function finish(){
  if(done)return;done=true;app.ticker.remove(tick);
  for(const {tile,scale} of targets)if(!tile.destroyed){tile.alpha=1;tile.scale.set(scale.x,scale.y);}
  for(const s of [lumi,...flyers,...sparks,...tails,halo])if(s&&!s.destroyed)s.destroy();
 }
 app.ticker.add(tick);
 return total;
}

/** Where createGame put the chosen start boosters: they are the newest special tiles of those kinds. */
export function startBoosterCells(state:{turn:number;cells:ReadonlyArray<{tile?:{id:number;kind:string}|null}>},preBoosters:readonly string[],gifts:readonly {at:number;kind:string}[]=[]):number[]{
 if(state.turn!==0)return [];
 const purchased=state.cells.flatMap((cell,at)=>cell.tile&&preBoosters.includes(cell.tile.kind)?[{at,id:cell.tile.id}]:[])
  .sort((a,b)=>b.id-a.id).slice(0,preBoosters.length).map(item=>item.at);
 return [...new Set([...purchased,...gifts.filter(gift=>state.cells[gift.at]?.tile?.kind===gift.kind).map(gift=>gift.at)])].sort((a,b)=>a-b);
}

import {tr,t} from "./i18n";
import {useEffect,useRef,useState} from 'react';
import {Application,Container,NineSliceSprite,Sprite,Text,Texture} from 'pixi.js';
import type {Action,GameState,GameEvent,Booster,Obstacle} from '@garden/contracts';
import {stateHash} from '@garden/core';
import {texture,tileArt,hasArt,animationTextures,assetInfo} from './assets';
import {tileVisualSize} from './tile-visuals';
import {createBoardEffects,effectTiming} from './board-effects';
import {VISUAL_BEATS} from './visual-timing';
import {impactOverlays,type ImpactOverlay} from './impact-overlays';
import {drawMechanicArt} from './mechanic-art';
import {tileOrigins,tileDepartures,pointOnPath,type TileOrigin} from './tile-origins';
import {draggableCell,projectDrag,type DragAxis,type DragProjection} from './drag-preview';
import {combinationAt,combinationParts} from './special-combination';
import {createIdleHintClock,nextBoardHint,hintCells,type BoardHint} from './idle-hint';
import {enclosedAperture,fittedBoardGeometry,cellPosition,cellIndex,boardClip,BOARD_FRAME_SCALE,type BoardGeometry,type FrameAperture,type Insets} from './board-geometry';
import {sound,haptic,startMusic} from './sound';
interface Props {state:GameState;events:GameEvent[];action?:Action;locked:boolean;tool:Booster|null;onAction:(action:Action)=>void;onVisualStart?:(durationMs:number)=>void;onVisualSettled?:()=>void;reduced:boolean;tutorial?:{from:number;to:number}}
type Point={x:number;y:number};
type Motion={sprite:Sprite;start:number;duration:number;from:Point;to:Point;alpha?:boolean;elastic?:boolean;pop?:boolean;fade?:boolean;fall?:boolean;form?:boolean;path?:Point[];scale:number;finish?:()=>void};
type Pair={from:number;to:number;stamp:string};
const visualKeys=new WeakMap<GameState,string>();
const stamp=(state:GameState)=>{let key=visualKeys.get(state);if(!key){key=stateHash(state);visualKeys.set(state,key);}return key;};

export default function Board(props:Props){
 const host=useRef<HTMLDivElement>(null),current=useRef(props);current.current=props;
 const controller=useRef<{render:(animate:boolean)=>void;tap:(index:number)=>void;cancel:()=>void;resetHint:()=>void}|null>(null);
 const [selected,setSelected]=useState<number|null>(null);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  const app=new Application();let disposed=false,cell=0,width=0,animationEnd=0,chosen:number|null=null;
  let camera={start:0,duration:0,strength:0};
  let visualActive=false,pendingAction:Action|undefined,pendingFusion:Map<number,Point>|undefined,primaryImpact:{at:number;name:string}|undefined;
  let last:GameState|undefined,lastEvents:GameEvent[]|undefined,lastStamp='',pointer:Sprite|null=null,fx:ReturnType<typeof createBoardEffects>|undefined;
  let down:{id:number;from:number;x:number;y:number;axis:DragAxis|null;projection:DragProjection;stamp:string;tool:Booster|null}|null=null;
  let commit:Pair|null=null,awaitingSwap:Pair|null=null,commitTimer:ReturnType<typeof setTimeout>|undefined,settleTimer:ReturnType<typeof setTimeout>|undefined;
  const floors=new Container(),tiles=new Container(),overlays=new Container(),departures=new Container(),frostCovers=new Container(),cellLayers=new Container(),effects=new Container(),highlights=new Container(),border=new Container(),counters=new Container(),clipSprite=new Sprite(Texture.WHITE);tiles.sortableChildren=true;counters.eventMode='none';counters.label='obstacle-counters';overlays.eventMode='none';overlays.label='obstacle-covers';departures.label='board-departures';frostCovers.eventMode='none';frostCovers.label='frost-covers';
  // Even departing or enlarged pieces stay behind the images that cover them.
  cellLayers.addChild(floors,tiles,departures,overlays,frostCovers);cellLayers.mask=clipSprite;clipSprite.eventMode='none';
  const apertures=new Map<string,FrameAperture>();let geometry:BoardGeometry|null=null,clipTexture:Texture|undefined,clipKey='';
  const overlayNodes=new Map<string,Container>(),counterNodes=new Map<string,Text>(),frostNodes=new Map<number,{base:Sprite;cover:Container}>(),displayedObstacles:Record<string,number>={},displayedFrost:Record<number,number>={};let overlaySteps:Array<ImpactOverlay&{start:number}>=[];
  const requirementNodes=new Map<string,{icon:Sprite;color:string}>();
  const active=new Map<number,Sprite>(),tilePool:Sprite[]=[],motions:Motion[]=[],previewCells=new Set<number>();
  const idleClock=createIdleHintClock(),hintSprites:Sprite[]=[];let idleHint:BoardHint|null=null,hintChecked=false,hintStarted=0;
  const position=(index:number):Point=>geometry?cellPosition(index,geometry):{x:0,y:0};
  function updateGeometry(w:number,s:GameState){
   const frameId=hasArt('board_frame_v6')?'board_frame_v6':hasArt('board_frame')?'board_frame':null,slices:Insets=frameId?assetInfo(frameId)?.sliceInsets??{left:128,right:128,top:128,bottom:128}:{left:0,right:0,top:0,bottom:0};let aperture:FrameAperture|null=null;
   if(frameId){aperture=apertures.get(frameId)??null;if(!aperture){const source=texture(frameId),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source.source.resource as CanvasImageSource,0,0);aperture=enclosedAperture(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);apertures.set(frameId,aperture);}}
   geometry=fittedBoardGeometry(w,s.width,s.height,aperture?.insets??{left:0,right:0,top:0,bottom:0});cell=geometry.cell;
   const key=frameId+':'+w+':'+s.width+':'+s.height+':'+s.cells.map(c=>c.exists?'1':'0').join('');
   if(key!==clipKey){const raster=boardClip(geometry,s.cells.map(c=>c.exists),aperture,slices),canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;canvas.getContext('2d')!.putImageData(new ImageData(raster.pixels,raster.width,raster.height),0,0);const next=Texture.from(canvas);next.source.scaleMode='nearest';clipSprite.texture=next;clipTexture?.destroy(true);clipTexture=next;clipKey=key;}
   clipSprite.position.set(0,0);clipSprite.width=geometry.width;clipSprite.height=geometry.height;
   if(host.current)host.current.dataset.boardGeometry=JSON.stringify({...geometry,frameId,clipResolution:2});
   return {frameId,slices};
  }
  const spriteAt=(index:number)=>{const tile=current.current.state.cells[index]?.tile;return tile?active.get(tile.id):undefined;};
  const phase=(value:string)=>{if(host.current&&host.current.dataset.inputPhase!==value)host.current.dataset.inputPhase=value;};
  const busy=()=>disposed||current.current.locked||visualActive||performance.now()<animationEnd||!!commit||!!awaitingSwap||current.current.state.status!=='playing';
  function visualSettled(){if(!visualActive)return;visualActive=false;animationEnd=0;resetIdleHint();phase('idle');if(host.current){host.current.dataset.visualSettledAt=String(performance.now());host.current.dataset.visualRemaining='0';}current.current.onVisualSettled?.();}
  function visualStart(duration:number){if(visualActive)visualSettled();resetIdleHint();visualActive=true;animationEnd=performance.now()+duration;phase('settling');if(host.current){host.current.dataset.visualStartedAt=String(performance.now());host.current.dataset.visualDuration=String(Math.round(duration));}current.current.onVisualStart?.(duration);}
  function clearHighlights(){highlights.removeChildren().forEach(sprite=>sprite.destroy());hintSprites.length=0;pointer=null;}
  function halo(index:number){const sprite=new Sprite(texture('halo')),at=position(index);sprite.anchor.set(.5);sprite.position.set(at.x,at.y);sprite.width=cell*1.08;sprite.height=cell*1.08;highlights.addChild(sprite);return sprite;}
  function highlight(){clearHighlights();const p=current.current;if(p.locked||visualActive||down?.axis||commit)return;if(idleHint){for(const index of hintCells(idleHint)){const sprite=halo(index);sprite.tint=0xffe6a1;sprite.alpha=.65;hintSprites.push(sprite);}}else if(chosen!==null)halo(chosen);else if(p.tutorial&&p.state.turn===0){halo(p.tutorial.from);halo(p.tutorial.to);pointer=new Sprite(texture('hand'));pointer.anchor.set(.25,.12);pointer.width=cell*1.1;pointer.height=cell*1.1;highlights.addChild(pointer);}}
  function resetIdleHint(){idleClock.reset();hintChecked=false;idleHint=null;if(host.current)delete host.current.dataset.hintCells;highlight();}
  function updateIdleHint(now:number){const p=current.current,eligible=!busy()&&!down&&!motions.length&&!overlaySteps.length&&!fx?.activeCount&&!p.tool&&!(p.tutorial&&p.state.turn===0)&&!document.hidden&&document.hasFocus();
   if(!idleClock.due(now,eligible)){if(idleHint){idleHint=null;hintChecked=false;if(host.current)delete host.current.dataset.hintCells;highlight();}return;}
   if(!hintChecked){hintChecked=true;idleHint=nextBoardHint(p.state,chosen);hintStarted=now;if(idleHint){if(chosen!==null&&!hintCells(idleHint).includes(chosen)){chosen=null;setSelected(null);}if(host.current)host.current.dataset.hintCells=hintCells(idleHint).join(',');highlight();}}
   const pulse=p.reduced ? .5 : (1-Math.cos((now-hintStarted)/1400*Math.PI*2))/2;for(const sprite of hintSprites){sprite.alpha=.5+pulse*.3;sprite.width=cell*(1.04+pulse*.05);sprite.height=cell*(1.04+pulse*.05);}
  }
  function recycle(sprite:Sprite){if(sprite.destroyed)return;sprite.visible=false;sprite.alpha=1;sprite.zIndex=0;if(tilePool.length>=96){sprite.destroy();return;}tiles.addChild(sprite);tilePool.push(sprite);}
  function move(sprite:Sprite,to:Point,duration:number,delay=0,options:Partial<Motion>={}){for(let i=motions.length-1;i>=0;i--)if(motions[i]!.sprite===sprite)motions.splice(i,1);motions.push({sprite,from:{x:sprite.x,y:sprite.y},to,start:performance.now()+delay,duration,scale:sprite.scale.x,...options});}
  function restorePreview(elastic=true){for(const index of previewCells){const sprite=spriteAt(index);if(!sprite)continue;sprite.zIndex=0;if(elastic)move(sprite,position(index),170,0,{elastic:true});else sprite.position.copyFrom(position(index));}previewCells.clear();if(host.current){delete host.current.dataset.dragFrom;delete host.current.dataset.dragTo;delete host.current.dataset.dragX;delete host.current.dataset.dragY;}}
  function cancel(){if(!down&&!commit)return;down=null;commit=null;if(commitTimer)clearTimeout(commitTimer);commitTimer=undefined;restorePreview(true);animationEnd=performance.now()+170;phase('returning');highlight();}
  function select(index:number){chosen=index;setSelected(index);highlight();sound('button');}
  function dispatch(action:Action){chosen=null;setSelected(null);clearHighlights();phase('settling');animationEnd=performance.now()+90;pendingAction=action;current.current.onAction(action);}
  function swap(from:number,to:number){
   if(busy())return;const s=current.current.state;
   if(!draggableCell(s,from)||!draggableCell(s,to)||Math.abs(from%s.width-to%s.width)+Math.abs(Math.floor(from/s.width)-Math.floor(to/s.width))!==1){restorePreview();dispatch({type:'swap',from,to});return;}
   if(combinationAt(s,from,to)){pendingFusion=new Map([from,to].map(index=>{const sprite=spriteAt(index);return [index,sprite?{x:sprite.x,y:sprite.y}:position(index)]}));previewCells.clear();dispatch({type:'swap',from,to});return;}
   chosen=null;setSelected(null);clearHighlights();const pair={from,to,stamp:stamp(s)};commit=pair;previewCells.add(from);previewCells.add(to);phase('swapping');
   const duration=current.current.reduced?65:120;animationEnd=performance.now()+duration+90;
   for(const [a,b]of [[from,to],[to,from]]){const sprite=spriteAt(a!);if(sprite)move(sprite,position(b!),duration);}
   commitTimer=setTimeout(()=>{
    commitTimer=undefined;if(disposed)return;
    if(current.current.locked||stamp(current.current.state)!==pair.stamp){cancel();return;}
    commit=null;awaitingSwap=pair;previewCells.clear();dispatch({type:'swap',from,to});
    // A parent that declines an input must not leave its visual preview swapped.
    settleTimer=setTimeout(()=>{if(awaitingSwap===pair){awaitingSwap=null;for(const index of [from,to]){const sprite=spriteAt(index);if(sprite)move(sprite,position(index),170,0,{elastic:true});}animationEnd=performance.now()+170;}},250);
   },duration);
  }
  function tap(index:number){resetIdleHint();if(busy()||!current.current.state.cells[index]?.exists)return;const p=current.current;
   if(p.tool){dispatch({type:'booster',item:p.tool,at:index});return;}
   if(chosen!==null&&chosen!==index){const from=chosen;chosen=null;swap(from,index);return;}
   const tile=p.state.cells[index]!.tile;if(tile&&tile.kind!=='normal'&&tile.kind!=='seed'){dispatch({type:'tap',at:index});return;}select(index);
  }
  function drawObstacle(obstacle:Obstacle){if(obstacle.hp<=0)return;const layer=new Container();overlays.addChild(layer);overlayNodes.set(obstacle.id,layer);displayedObstacles[obstacle.id]=obstacle.hp;
   const authored=drawMechanicArt(layer,obstacle,cell,position);
   const id=obstacle.kind==='crate'?`crate_${Math.min(obstacle.hp,3)}`:obstacle.kind,sprite=new Sprite(texture(hasArt(id)?id:'crate_1'));sprite.anchor.set(.5);
   const points=obstacle.footprint.map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs)+cell,h=Math.max(...ys)-Math.min(...ys)+cell;sprite.position.set((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2);sprite.scale.set(Math.min(w/sprite.texture.width,h/sprite.texture.height)*.98);if(!authored)layer.addChild(sprite);else sprite.destroy();
   // Counts have their own foreground layer so later obstacles, moving pieces
   // and departure/effect sprites cannot paint over them. Keep them inside the cell.
   if(obstacle.kind==='pot'&&obstacle.color){
    const at=position(obstacle.anchor),icon=new Sprite(texture(tileArt('normal',obstacle.color)));icon.anchor.set(.5);icon.width=cell*.44;icon.height=cell*.44;icon.position.set(at.x-cell*.26,at.y+cell*.25);icon.label='pot-requires-'+obstacle.color;counters.addChild(icon);requirementNodes.set(obstacle.id,{icon,color:obstacle.color});
   }
   if(obstacle.hp>1||obstacle.kind==='cabinet'){const hp=new Text({text:String(obstacle.hp),style:{fontFamily:'Lilita One',fontWeight:'normal',fontSize:15,fill:'#ffffff',stroke:{color:'#1f3a54',width:3}}});hp.anchor.set(1,1);hp.position.set(Math.max(...xs)+cell*.44,Math.max(...ys)+cell*.44);counters.addChild(hp);counterNodes.set(obstacle.id,hp);}
  }
  function drawFrost(index:number,value:number){if(!value||!hasArt('frost'))return;const at=position(index),fullFloor=hasArt('frost_floor_v19'),base=new Sprite(texture(fullFloor?'frost_floor_v19':'frost'));base.anchor.set(.5);base.position.set(at.x,at.y);base.width=cell*(fullFloor?1.005:1.22);base.height=cell*(fullFloor?1.005:1.22);floors.addChild(base);const cover=new Container();cover.position.set(at.x,at.y);cover.alpha=value>1?.48:.24;const ice=new Sprite(texture('frost'));ice.anchor.set(.5);ice.width=cell*1.04;ice.height=cell*1.04;cover.addChild(ice);frostCovers.addChild(cover);frostNodes.set(index,{base,cover});displayedFrost[index]=value;}
  function overlayDebug(){if(host.current){host.current.dataset.obstacleRequirements=JSON.stringify([...requirementNodes].map(([id,{icon,color}])=>({id,color,art:tileArt('normal',color),x:icon.x,y:icon.y,width:icon.width,height:icon.height,foreground:icon.parent===counters})));host.current.dataset.obstacleVisual=JSON.stringify(displayedObstacles);host.current.dataset.frostVisual=JSON.stringify(displayedFrost);delete host.current.dataset.frostMarkers;host.current.dataset.coverOrder=JSON.stringify({departures:cellLayers.getChildIndex(departures),obstacles:cellLayers.getChildIndex(overlays),frost:cellLayers.getChildIndex(frostCovers)});host.current.dataset.frostCovers=JSON.stringify([...frostNodes].map(([at,{base,cover}])=>({at,layers:displayedFrost[at],x:cover.x,y:cover.y,alpha:cover.alpha,images:cover.children.length,foreground:cover.parent===frostCovers,base:{width:base.width,height:base.height,alpha:base.alpha}})));host.current.dataset.obstacleArtBounds=JSON.stringify([...overlayNodes].map(([id,layer])=>{const sprite=layer.children[0] as Sprite,hp=counterNodes.get(id);return {id,x:sprite.x-sprite.width/2,y:sprite.y-sprite.height/2,width:sprite.width,height:sprite.height,counter:hp?{x:hp.x,y:hp.y}:null};}));}}
  function updateOverlay(step:ImpactOverlay){if(step.kind==='obstacle'){const old=overlayNodes.get(step.id);if(old){old.destroy({children:true});overlayNodes.delete(step.id);}counterNodes.get(step.id)?.destroy();counterNodes.delete(step.id);requirementNodes.get(step.id)?.icon.destroy();requirementNodes.delete(step.id);delete displayedObstacles[step.id];if(step.value){drawObstacle(step.value);if(step.value.kind==='carousel'){const event=current.current.events.find(e=>e.type==='mechanic'&&e.obstacleId===step.id);const icon=overlayNodes.get(step.id)?.children[0] as Sprite|undefined;if(icon&&event?.from!==undefined){const from=position(event.from),to=position(step.value.anchor);icon.position.set(from.x,from.y);motions.push({sprite:icon,from,to,start:performance.now(),duration:current.current.reduced?1:320,scale:icon.scale.x});}}}}else{const old=frostNodes.get(step.at);old?.base.destroy();old?.cover.destroy({children:true});frostNodes.delete(step.at);delete displayedFrost[step.at];drawFrost(step.at,step.value);}overlayDebug();}
  function render(animate:boolean){
   if(!app.renderer||disposed||!host.current)return;const p=current.current,s=p.state,w=host.current.clientWidth;if(w<32)return;
   // Server acknowledgement and HUD re-renders must not snap an in-progress visual cascade to its final board.
   if(stamp(s)===lastStamp&&p.events===lastEvents&&w===width){highlight();return;}
   resetIdleHint();
   if(down||commit)cancel();animate=animate&&p.events!==lastEvents&&p.events.length>0;if(!animate){for(const motion of motions)motion.finish?.();motions.length=0;primaryImpact=undefined;fx?.clear();animationEnd=0;phase('idle');visualSettled();}const invalid=animate&&p.events.some(event=>event.type==='invalid'),timing=effectTiming(p.events,s,p.action??pendingAction),prior=animate&&!p.reduced&&last&&last.width===s.width&&last.height===s.height?last:s;
   const frameLayout=updateGeometry(w,s);width=w;app.renderer.resize(geometry!.width,geometry!.height);floors.removeChildren().forEach(sprite=>sprite.destroy());overlays.removeChildren().forEach(sprite=>sprite.destroy({children:true}));frostCovers.removeChildren().forEach(cover=>cover.destroy({children:true}));counters.removeChildren().forEach(label=>label.destroy());overlayNodes.clear();counterNodes.clear();requirementNodes.clear();frostNodes.clear();for(const key of Object.keys(displayedObstacles))delete displayedObstacles[key];for(const key of Object.keys(displayedFrost))delete displayedFrost[Number(key)];overlaySteps=[];border.removeChildren().forEach(sprite=>sprite.destroy());
   s.cells.forEach((c,index)=>{if(!c.exists)return;const at=position(index),floor=new Sprite(texture(hasArt('board_cell')?'board_cell':'cell'));floor.anchor.set(.5);floor.position.set(at.x,at.y);floor.width=cell*1.005;floor.height=cell*1.005;floors.addChild(floor);drawFrost(index,prior.cells[index]?.frost??0);});
   for(const obstacle of Object.values(prior.obstacles))drawObstacle(obstacle);if(prior!==s){const epoch=performance.now();overlaySteps=impactOverlays(prior,s,p.events,timing).map(step=>({...step,start:epoch+step.delay}));}overlayDebug();
   if(frameLayout.frameId){const insets=frameLayout.slices,frame=new NineSliceSprite({texture:texture(frameLayout.frameId),leftWidth:insets.left,rightWidth:insets.right,topHeight:insets.top,bottomHeight:insets.bottom});frame.scale.set(BOARD_FRAME_SCALE);frame.width=geometry!.width/BOARD_FRAME_SCALE;frame.height=geometry!.height/BOARD_FRAME_SCALE;border.addChild(frame);}
   const settleAt=p.reduced?0:invalid?0:timing.settleAt,ids=new Set<number>();let finalMovement=0;
   const births=animate&&last?tileOrigins(last,s,p.events):new Map<number,TileOrigin>(),removals=animate&&last?tileDepartures(last,p.events,timing):new Map<number,{delay:number;activation:boolean}>();if(host.current){host.current.dataset.refillOrigins=JSON.stringify([...births.values()]);host.current.dataset.tileDepartures=JSON.stringify([...removals].map(([id,plan])=>({id,...plan})));}
   s.cells.forEach((c,index)=>{const tile=c.tile;if(!c.exists||!tile)return;ids.add(tile.id);let sprite=active.get(tile.id),fresh=false;
    if(!sprite){sprite=tilePool.pop()||new Sprite(texture(tileArt(tile.kind,tile.kind==='normal'?tile.color:undefined)));sprite.visible=true;sprite.anchor.set(.5);tiles.addChild(sprite);active.set(tile.id,sprite);fresh=true;}
    sprite.texture=texture(tileArt(tile.kind,tile.kind==='normal'?tile.color:undefined));sprite.width=cell*tileVisualSize(tile.kind);sprite.height=cell*tileVisualSize(tile.kind);sprite.rotation=0;sprite.zIndex=0;
    const to=position(index);
    if(animate&&!p.reduced){const birth=fresh?births.get(tile.id):undefined,path:Point[]|undefined=birth?.points.map(point=>({x:geometry!.face.x+point.x*cell,y:geometry!.face.y+point.y*cell}));if(fresh){const origin=birth?.origin??{x:index%s.width+.5,y:-.5};sprite.position.set(geometry!.face.x+origin.x*cell,geometry!.face.y+origin.y*cell);sprite.alpha=0;}const distance=path?path.slice(1).reduce((sum,point,i)=>sum+Math.hypot(point.x-path[i]!.x,point.y-path[i]!.y),0):Math.hypot(sprite.x-to.x,sprite.y-to.y);if(distance>.5||fresh){const duration=invalid?190:Math.min(timing.special?390:320,260+distance*.22),delay=invalid?0:settleAt+(index%s.width)*4;move(sprite,to,duration,delay,{alpha:fresh,elastic:invalid,fall:!invalid,form:birth?.mode==='formation',path});finalMovement=Math.max(finalMovement,delay+duration);}else sprite.alpha=1;}
    else{sprite.position.set(to.x,to.y);sprite.alpha=1;}
   });
   const fusedIds=new Set(animate?p.events.filter(event=>event.type==='special'&&event.cells.length===2&&combinationParts(event.kind??'')).flatMap(event=>event.cells.flatMap(index=>last?.cells[index]?.tile?[last.cells[index]!.tile!.id]:[])):[]);
   active.forEach((sprite,id)=>{if(ids.has(id))return;active.delete(id);
    if(fusedIds.has(id)){recycle(sprite);return;}
    if(animate&&!p.reduced){departures.addChild(sprite);const departure=removals.get(id),delay=departure?.delay??Math.max(0,timing.settleAt-VISUAL_BEATS.pop),activation=departure?.activation??false;move(sprite,{x:sprite.x,y:sprite.y},activation?80:VISUAL_BEATS.pop,delay,{pop:!activation,fade:activation,finish:()=>recycle(sprite)});}
    else recycle(sprite);
   });
   if(animate){const duration=fx?.play(p.events,last,s,p.reduced,p.action??pendingAction,timing,pendingFusion)||0;visualStart(Math.max(p.reduced?110:invalid?190:0,duration,finalMovement));if(invalid)sound('invalid');else{const delay=p.reduced?0:timing.primaryImpactAt;primaryImpact={at:performance.now()+delay,name:timing.special?'special':'match'};if(delay>0)sound('button');if(host.current){host.current.dataset.impactPlannedMs=String(delay);delete host.current.dataset.impactPlayedAt;}}}
   else if(stamp(s)!==lastStamp){fx?.clear();animationEnd=0;phase('idle');}
   if(animate||stamp(s)!==lastStamp){pendingAction=undefined;pendingFusion=undefined;}awaitingSwap=null;if(settleTimer)clearTimeout(settleTimer);lastEvents=p.events;last=s;lastStamp=stamp(s);highlight();
  }
  const point=(event:PointerEvent):Point=>{const rect=app.canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*(geometry?.width??app.screen.width)/rect.width,y:(event.clientY-rect.top)*(geometry?.height??app.screen.height)/rect.height};};
  function inside(p:Point){return !!geometry&&cellIndex(p,geometry)!==null;}
  function pointerDown(event:PointerEvent){if(busy()||down||(event.pointerType==='mouse'&&event.button!==0))return;const at=point(event);if(!inside(at))return;const s=current.current.state,index=cellIndex(at,geometry!)!;if(!s.cells[index]?.exists)return;
   event.preventDefault();startMusic();down={id:event.pointerId,from:index,x:at.x,y:at.y,axis:null,projection:projectDrag(s,index,0,0,cell),stamp:stamp(s),tool:current.current.tool};phase('holding');if(pointer)pointer.alpha=0;try{app.canvas.setPointerCapture(event.pointerId);}catch{/* Synthetic accessibility pointers may not have native capture. */}
  }
  function pointerMove(event:PointerEvent){if(!down||event.pointerId!==down.id)return;if(current.current.locked||stamp(current.current.state)!==down.stamp||current.current.tool!==down.tool){cancel();return;}if(down.tool)return;
   event.preventDefault();const at=point(event),projection=projectDrag(current.current.state,down.from,at.x-down.x,at.y-down.y,cell,down.axis);down.axis=projection.axis;down.projection=projection;if(!projection.axis)return;
   restorePreview(false);chosen=null;setSelected(null);clearHighlights();const from=position(down.from),source=spriteAt(down.from),combining=projection.to!==null&&!!combinationAt(current.current.state,down.from,projection.to);if(source){source.position.set(from.x+projection.x*(combining ? .82 : 1),from.y+projection.y*(combining ? .82 : 1));source.zIndex=5;previewCells.add(down.from);}
   if(projection.to!==null){const target=spriteAt(projection.to),to=position(projection.to);if(target){const travel=combining ? .07 : 1;target.position.set(to.x+(from.x-to.x)*projection.progress*travel,to.y+(from.y-to.y)*projection.progress*travel);target.zIndex=4;previewCells.add(projection.to);}}
   phase('dragging');if(host.current){host.current.dataset.dragFrom=String(down.from);host.current.dataset.dragTo=String(projection.to??'');host.current.dataset.dragX=projection.x.toFixed(2);host.current.dataset.dragY=projection.y.toFixed(2);}
  }
  function pointerUp(event:PointerEvent){if(!down||event.pointerId!==down.id)return;event.preventDefault();const d=down,at=point(event);down=null;try{app.canvas.releasePointerCapture(event.pointerId);}catch{/* Capture may already have been released by the OS. */}
   if(current.current.locked||stamp(current.current.state)!==d.stamp||current.current.tool!==d.tool){restorePreview();animationEnd=performance.now()+170;phase('returning');highlight();return;}
   // Pointer capture can release beyond the frame after crossing a valid edge cell.
   // Decide swaps by the adjacent-cell projection; only taps require an inside release.
   const projection=d.tool?d.projection:projectDrag(current.current.state,d.from,at.x-d.x,at.y-d.y,cell,d.axis);
   if(projection.axis){if(projection.canRelease&&projection.to!==null)swap(d.from,projection.to);else{restorePreview();animationEnd=performance.now()+170;phase('returning');highlight();}}
   else if(inside(at))tap(d.from);else{restorePreview();animationEnd=performance.now()+170;phase('returning');highlight();}
  }
  const pointerCancel=(event:PointerEvent)=>{if(down?.id===event.pointerId)cancel();};
  const onBlur=()=>{resetIdleHint();cancel();},onVisibility=()=>{resetIdleHint();if(document.hidden)cancel();},onInput=()=>resetIdleHint();
  void app.init({width:360,height:360,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true}).then(()=>{
   if(disposed||host.current!==element||!element.isConnected){app.destroy({removeView:true,releaseGlobalResources:false});return;}element.appendChild(app.canvas);app.stage.addChild(cellLayers,clipSprite,effects,highlights,border,counters);fx=createBoardEffects(app,effects,{cellSize:()=>cell,position,bounds:()=>geometry?.face??{x:0,y:0,width:0,height:0},frames:animationTextures,impulse:(strength,duration)=>{camera={start:performance.now(),duration,strength:current.current.reduced?0:Math.min(3.2,strength)};if(!strength||!duration)app.stage.position.set(0,0);}});
   app.canvas.style.touchAction='none';app.canvas.style.marginInline='auto';app.canvas.addEventListener('pointerdown',pointerDown);app.canvas.addEventListener('pointermove',pointerMove);app.canvas.addEventListener('pointerup',pointerUp);app.canvas.addEventListener('pointercancel',pointerCancel);app.canvas.addEventListener('lostpointercapture',pointerCancel);window.addEventListener('blur',onBlur);document.addEventListener('visibilitychange',onVisibility);document.addEventListener('pointerdown',onInput,true);document.addEventListener('keydown',onInput,true);
   controller.current={render,tap,cancel,resetHint:resetIdleHint};
   app.ticker.add(()=>{const now=performance.now(),shake=camera.duration?Math.min(1,(now-camera.start)/camera.duration):1,energy=(1-shake)**2*camera.strength;app.stage.position.set(Math.sin(shake*Math.PI*6)*energy,Math.sin(shake*Math.PI*8)*energy*.55);if(host.current)host.current.dataset.cameraOffset=`${app.stage.x.toFixed(2)},${app.stage.y.toFixed(2)}`;if(primaryImpact&&now>=primaryImpact.at){sound(primaryImpact.name);haptic();if(host.current)host.current.dataset.impactPlayedAt=String(now);primaryImpact=undefined;}while(overlaySteps[0]&&now>=overlaySteps[0].start)updateOverlay(overlaySteps.shift()!);for(let i=motions.length-1;i>=0;i--){const motion=motions[i]!,sprite=motion.sprite;if(sprite.destroyed){motions.splice(i,1);continue;}if(now<motion.start)continue;const t=Math.min(1,(now-motion.start)/motion.duration),u=motion.elastic?1+(2.2*(t-1)**3+1.2*(t-1)**2):motion.fall?(t<.5?4*t*t*t:1-(-2*t+2)**3/2):t*t*(3-2*t);const at=motion.path?pointOnPath(motion.path,u):{x:motion.from.x+(motion.to.x-motion.from.x)*u,y:motion.from.y+(motion.to.y-motion.from.y)*u};sprite.position.set(at.x,at.y);if(motion.alpha)sprite.alpha=Math.min(1,t*5);if(motion.fade)sprite.alpha=1-t;if(motion.fall){const squash=t>.82?Math.sin((t-.82)/.18*Math.PI)*.035:0;const form=motion.form ? .72+.28*(1-(1-Math.min(1,t/.35))**3):1;sprite.scale.set(motion.scale*form*(1+squash),motion.scale*form*(1-squash));}if(motion.pop){const scale=t<.27?1+.35*t/.27:1.35*(1-(t-.27)/.73);sprite.scale.set(motion.scale*Math.max(.01,scale));sprite.alpha=t<.3?1:1-(t-.3)/.7;sprite.rotation+=.008;}if(t===1){motion.finish?.();motions.splice(i,1);}}
    if(pointer&&!pointer.destroyed&&current.current.tutorial&&!down&&!commit){const path=current.current.tutorial,a=position(path.from),b=position(path.to),phase=(now%1600)/1600,u=Math.min(1,Math.max(0,(phase-.18)/.55));pointer.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u);pointer.alpha=phase>.85?(1-phase)/.15:Math.min(1,phase/.12);}
    if(host.current&&fx){const count=String(fx.activeCount);if(host.current.dataset.activeEffects!==count)host.current.dataset.activeEffects=count;}if(host.current&&width!==host.current.clientWidth)render(false);if(visualActive&&host.current)host.current.dataset.visualRemaining=String(Math.max(0,Math.round(animationEnd-now)));if(now>=animationEnd&&!motions.length&&!overlaySteps.length&&!fx?.activeCount&&!down&&!commit&&!awaitingSwap){if(visualActive)visualSettled();else phase('idle');}updateIdleHint(now);
   });render(false);
  });
  return()=>{disposed=true;if(visualActive)visualSettled();else if(pendingAction)current.current.onVisualSettled?.();controller.current=null;if(commitTimer)clearTimeout(commitTimer);if(settleTimer)clearTimeout(settleTimer);window.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('pointerdown',onInput,true);document.removeEventListener('keydown',onInput,true);fx?.destroy();if(app.renderer)app.destroy({removeView:true,releaseGlobalResources:false},{children:true});clipTexture?.destroy(true);};
 },[]);
 useEffect(()=>{controller.current?.render(true)},[props.state,props.events,props.tutorial]);
 useEffect(()=>{controller.current?.resetHint();if(props.locked)controller.current?.cancel()},[props.locked,props.tool]);
 return <div className="board-wrap"><div className="board" ref={host} aria-label={tr("퍼즐 보드")} role="application" data-input-phase="idle"/>
  <div className="sr-only" role="group" aria-label={tr("퍼즐 칸")}>{props.state.cells.map((cell,index)=>cell.exists?<button key={index} disabled={props.locked||props.state.status!=='playing'} aria-pressed={selected===index} onClick={()=>controller.current?.tap(index)}>{Math.floor(index/props.state.width)+1}{tr("행")}{' '}{index%props.state.width+1}{tr("열")}{' '}{cell.tile?.kind==='normal'?t(`item.${cell.tile.color}`):cell.tile?.kind||cell.obstacleId}{cell.frost>0?` · ${t('item.frost')} ${cell.frost}`:''}</button>:null)}</div>
 </div>;
}

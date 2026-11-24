import {mobileObstacleArt} from './mobile-obstacle-art';
import {flowerShelfGeometry,SHELF_VASE_SCALE,shelfVaseY} from './flower-shelf-layout';
import {isCircuitObstacle} from '../../../packages/contracts/src/garden-circuit';
import {isFrontierObstacle} from '../../../packages/contracts/src/garden-frontier';
import {isSiegeObstacle,gardenSiegeArt} from '../../../packages/contracts/src/garden-siege';
import {isVariedObstacle,variedObstacleArt} from '../../../packages/contracts/src/varied-obstacles';
import type {ExpeditionAnimal} from '@garden/contracts';
import GardenStageOverlay from './GardenStageOverlay';
import {gardenStageMotion} from './garden-stage-motion';
import {gardenFloor} from './garden-stage-visual';
import {stageFloorArt} from './garden-stage-texture';
import {itemName,tr,t} from "./i18n";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Application,Container,Graphics,Mesh,MeshGeometry,NineSliceSprite,Sprite,Text,Texture} from 'pixi.js';
import {supportsOpenGardenStages,supportsVisibleTargets,type Action,type GameState,type GameEvent,type Booster,type Obstacle} from '@garden/contracts';
import {stateHash} from '@garden/core';
import {isDeviceGate} from '../../../packages/game-core/src/campaign-devices';
import {turntableCells} from '../../../packages/game-core/src/greenhouse-devices';
import {texture,tileArt,hasArt,animationTextures,assetInfo} from './assets';
import {tileVisualSize} from './tile-visuals';
import {boardEffectTexture,boardSpriteSize,boardTexture} from './board-sprite-art';
import {MATCH_RELEASE,MATCH_SQUEEZE,breakPose,matchBreakPose,obstacleRecoil,tileGathering,impactCues,type ImpactCue} from './tile-impact';
import {fallMotion,fallPose} from './tile-fall';
import {createBoardEffects,effectTiming} from './board-effects';
import {playLumiIntro} from './lumi-intro';
import {createBoardRipple,fxMaterial,prepareFxMaterials,tileShards,type FxMaterial} from './board-fx-art';
import {createDebrisSurface} from './obstacle-debris';
import {VISUAL_BEATS} from './visual-timing';
import {impactOverlays,type ImpactOverlay,type ObstacleImpact} from './impact-overlays';
import {drawMechanicArt} from './mechanic-art';
import {drawGardenPuzzleFloor,drawGardenPuzzleObstacle,gardenPuzzleObstacleArt} from './garden-puzzle-art';
import {drawObstacleRule,obstacleRuleDetail,obstacleRuleLabel} from './obstacle-rule-art';
import {chapterObstacleLabel,drawChapterObstacle} from './chapter-obstacle-art';
import {harvestCartPushPath} from '../../../packages/game-core/src/garden-puzzles';
import {tileOrigins,tileDepartures,tileFallPaths,pointOnPath,type TileDeparture,type TileOrigin} from './tile-origins';
import {draggableCell,projectDrag,dragIntent,releaseDrag,sameCanvasBounds,type CanvasBounds,type DragAxis,type DragProjection} from './drag-preview';
import {recordInputTrace,recordInputAction,addDragSample,type InputTrace} from './input-diagnostics';
import {combinationAt,combinationParts} from './special-combination';
import {createIdleHintClock,hintRotation,hintCells,hintNudge,hintVisibility,matchOutline,HINT_ROTATE_MS,type BoardHint,type HintPlan} from './idle-hint';
import {enclosedAperture,boardGeometry,fittedBoardGeometry,cellPosition,cellIndex,boardClip,BOARD_FRAME_SCALE,type BoardGeometry,type FrameAperture,type Insets} from './board-geometry';
import {sound,haptic,startMusic,prepareBoardSounds} from './sound';
import {isBreakableObstacle,isGardenOpener} from '../../../packages/contracts/src/breakable-obstacles';
export interface BoardProps {goldGarden?:boolean;animal?:'rabbit'|ExpeditionAnimal;state:GameState;events:GameEvent[];action?:Action;continuingCascade?:boolean;locked:boolean;tool:Booster|null;onAction:(action:Action)=>void|Promise<void>;onVisualStart?:(durationMs:number)=>void;onVisualSettled?:()=>void;reduced:boolean;boosterIntro?:readonly number[];tutorial?:{from:number;to:number;cells?:number[]};fillWidth?:boolean}
type Point={x:number;y:number};
type Motion={sprite:Container;start:number;duration:number;from:Point;to:Point;alpha?:boolean;elastic?:boolean;pop?:'match'|'impact';anticipation?:number;recoil?:boolean;gather?:boolean;fade?:boolean;fall?:boolean;travel?:number;form?:boolean;portal?:boolean;path?:Point[];scale:number;scaleY:number;finish?:()=>void};
type Pair={from:number;to:number;stamp:string};
const visualKeys=new WeakMap<GameState,string>();
const windMarks=[['●',0xffd994],['◆',0x8ff1de],['▲',0xafdcff],['■',0xfcc5e9],['✦',0xc9ef93],['✚',0xd5c2ff]] as const;
const stamp=(state:GameState)=>{let key=visualKeys.get(state);if(!key){key=stateHash(state);visualKeys.set(state,key);}return key;};
function planterGroupNumber(obstacle:Obstacle|undefined){
 const source=obstacle?.cover?.source??(obstacle&&isGardenOpener(obstacle.kind)?obstacle.id:undefined);
 return source===undefined?undefined:Number(source.match(/\d+$/)?.[0])||1;
}

export default function Board(props:BoardProps){
 const host=useRef<HTMLDivElement>(null),current=useRef(props);current.current=props;
 const controller=useRef<{render:(animate:boolean)=>void;tap:(index:number)=>void;cancel:()=>void;resetHint:()=>void}|null>(null);
 const [selected,setSelected]=useState<number|null>(null);
 const [stageGeometry,setStageGeometry]=useState<BoardGeometry|null>(null);
 useEffect(()=>{
  const candidate=host.current;if(!candidate)return;const element:HTMLDivElement=candidate;prepareBoardSounds();
  const app=new Application();let disposed=false,cell=0,width=0,canvasInset=0,animationEnd=0,chosen:number|null=null;
  let camera={start:0,duration:0,strength:0};
  let visualActive=false,pendingAction:Action|undefined,pendingFusion:Map<number,Point>|undefined,contacts:Array<ImpactCue&{at:number}>=[];
  let last:GameState|undefined,lastEvents:GameEvent[]|undefined,lastStamp='',pointer:Sprite|null=null,fx:ReturnType<typeof createBoardEffects>|undefined,ripple:ReturnType<typeof createBoardRipple>|undefined;
  let down:{id:number;from:number;clientX:number;clientY:number;bounds:CanvasBounds;scaleX:number;scaleY:number;axis:DragAxis|null;projection:DragProjection;dragged:boolean;stamp:string;tool:Booster|null;trace:InputTrace}|null=null;
  let commit:Pair|null=null,awaitingSwap:Pair|null=null,commitTimer:ReturnType<typeof setTimeout>|undefined,settleTimer:ReturnType<typeof setTimeout>|undefined;
  let inputTraceAt:number|undefined;
  const pieceLayers=new Container(),pieceClipSprite=new Sprite(Texture.WHITE);let pieceClipTexture:Texture|undefined,pieceClipKey='',pieceClipStep:{at:number;cells:number[]}|undefined;
  const circuitFloor=new Container();circuitFloor.eventMode='none';
  const frontierDecor=new Container(),sharedShelves=new Container();frontierDecor.eventMode='none';sharedShelves.eventMode='none';
  const floors=new Container(),puzzleFloor=new Container(),tiles=new Container(),overlays=new Container(),departures=new Container(),frostCovers=new Container(),cellLayers=new Container(),effects=new Container(),highlights=new Container(),border=new Container(),counters=new Container(),clipSprite=new Sprite(Texture.WHITE);tiles.sortableChildren=true;counters.eventMode='none';counters.label='obstacle-counters';overlays.eventMode='none';overlays.label='obstacle-covers';departures.label='board-departures';frostCovers.eventMode='none';frostCovers.label='frost-covers';
  const effectShade=new Sprite(Texture.WHITE);
  effectShade.tint=0x060d26;effectShade.visible=false;effectShade.eventMode='none';
  // Keep the lesson dimmer and hand in one scene: no DOM overlay can dim the hand.
  const lessonFocus=new Graphics(),tutorialPointers=new Container();
  lessonFocus.eventMode='none';tutorialPointers.eventMode='none';lessonFocus.label='tutorial-focus';tutorialPointers.label='tutorial-pointers';let lessonFocusKey='';
  let puzzleFloorAt:number|undefined;
  // Even departing or enlarged pieces stay behind the images that cover them.
  pieceLayers.addChild(tiles,departures);pieceClipSprite.eventMode='none';cellLayers.addChild(floors,puzzleFloor,circuitFloor,pieceLayers,sharedShelves,overlays,frontierDecor,frostCovers,effectShade);cellLayers.mask=clipSprite;clipSprite.eventMode='none';
  const apertures=new Map<string,FrameAperture>();let geometry:BoardGeometry|null=null,clipTexture:Texture|undefined,clipKey='';
  const frontierPieces=new Map<string,Obstacle>(),frontierNodes=new Map<string,Sprite[]>(),frontierOpenings=new Map<string,number>();
  const overlayNodes=new Map<string,Container>(),counterNodes=new Map<string,Text>(),frostNodes=new Map<number,{base:Sprite;cover:Container}>(),displayedObstacles:Record<string,number>={},displayedFrost:Record<number,number>={};let overlaySteps:Array<ImpactOverlay&{start:number}>=[];
  const pollenNodes=new Map<Graphics,Sprite>();
  const floorMarkers=new Container();counters.addChild(floorMarkers);
  let floorKey='',markerKey='',frameKey='';
  const obstaclePlans=new Map<string,string>();
 const requirementNodes=new Map<string,{icon:Sprite;color:string}>();
  const active=new Map<number,Sprite>(),tilePool:Sprite[]=[],motions:Motion[]=[],previewCells=new Set<number>();
  const idleClock=createIdleHintClock(),hintSprites:Sprite[]=[];let idleHint:BoardHint|null=null,hintChecked=false,hintStarted=0,hintPlans:HintPlan[]=[],hintIndex=0,hintOutline:Graphics|null=null,nudged:{sprite:Sprite;home:Point;toward:Point}|null=null;
  const position=(index:number):Point=>geometry?cellPosition(index,geometry):{x:0,y:0};
  function updateGeometry(w:number,s:GameState){
   const frameId=hasArt('board_frame_v6')?'board_frame_v6':hasArt('board_frame')?'board_frame':null,slices:Insets=frameId?assetInfo(frameId)?.sliceInsets??{left:128,right:128,top:128,bottom:128}:{left:0,right:0,top:0,bottom:0};let aperture:FrameAperture|null=null;
   if(frameId){aperture=apertures.get(frameId)??null;if(!aperture){const source=texture(frameId),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source.source.resource as CanvasImageSource,0,0);aperture=enclosedAperture(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);apertures.set(frameId,aperture);}}
   const measure=current.current.fillWidth?boardGeometry:fittedBoardGeometry;
   geometry=measure(w,s.width,s.height,aperture?.insets??{left:0,right:0,top:0,bottom:0});cell=geometry.cell;
   if(s.gardenStage||current.current.tutorial?.cells){const next=geometry;setStageGeometry(old=>old?.width===next.width&&old?.height===next.height?old:next);}
   const key=frameId+':'+w+':'+s.width+':'+s.height+':'+s.cells.map(c=>c.exists?'1':'0').join('');
   if(key!==clipKey){const raster=boardClip(geometry,s.cells.map(c=>c.exists),aperture,slices),canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;canvas.getContext('2d')!.putImageData(new ImageData(raster.pixels,raster.width,raster.height),0,0);const next=Texture.from(canvas);next.source.scaleMode='nearest';clipSprite.texture=next;clipTexture?.destroy(true);clipTexture=next;clipKey=key;}
   clipSprite.position.set(0,0);clipSprite.width=geometry.width;clipSprite.height=geometry.height;
   effectShade.width=geometry.width;effectShade.height=geometry.height;
   if(host.current)host.current.dataset.boardGeometry=JSON.stringify({...geometry,frameId,clipResolution:2});
   return {frameId,slices};
  }
  // Open floors remain visible, but ordinary falling/departing sprites cannot
  // paint over them. The cutout changes after the old piece's contact beat.
  function updatePieceClip(open:number[]){
   if(!geometry)return;const state=current.current.state;
   if(!supportsOpenGardenStages(state.engineVersion)||!open.length){pieceLayers.mask=null;pieceClipSprite.visible=false;if(host.current)host.current.dataset.openFloorClip='[]';return;}
   const key=geometry.width+':'+geometry.height+':'+state.cells.map(c=>c.exists?'1':'0').join('')+':'+open.join(',');
   if(key!==pieceClipKey){const excluded=new Set(open),raster=boardClip(geometry,state.cells.map((c,i)=>c.exists&&!excluded.has(i)),null,{left:0,right:0,top:0,bottom:0}),canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;canvas.getContext('2d')!.putImageData(new ImageData(raster.pixels,raster.width,raster.height),0,0);const next=Texture.from(canvas);next.source.scaleMode='nearest';pieceClipSprite.texture=next;pieceClipTexture?.destroy(true);pieceClipTexture=next;pieceClipKey=key;}
   pieceClipSprite.visible=true;pieceClipSprite.position.set(0,0);pieceClipSprite.width=geometry.width;pieceClipSprite.height=geometry.height;pieceLayers.mask=pieceClipSprite;
   if(host.current)host.current.dataset.openFloorClip=JSON.stringify(open);
  }
  const spriteAt=(index:number)=>{const tile=current.current.state.cells[index]?.tile;return tile?active.get(tile.id):undefined;};
  const phase=(value:string)=>{if(host.current&&host.current.dataset.inputPhase!==value)host.current.dataset.inputPhase=value;};
  const busy=()=>disposed||current.current.locked||visualActive||performance.now()<animationEnd||motions.length>0||!!commit||!!awaitingSwap||current.current.state.status!=='playing';
  function visualSettled(force=false){if(!visualActive&&!force)return;visualActive=false;animationEnd=0;resetIdleHint();phase('idle');if(host.current){host.current.dataset.visualSettledAt=String(performance.now());host.current.dataset.visualRemaining='0';}current.current.onVisualSettled?.();}
  function visualStart(duration:number){if(visualActive)visualSettled();resetIdleHint();visualActive=true;animationEnd=performance.now()+duration;phase('settling');if(host.current){host.current.dataset.visualStartedAt=String(performance.now());host.current.dataset.visualDuration=String(Math.round(duration));}current.current.onVisualStart?.(duration);}
  function clearHighlights(){if(nudged&&!nudged.sprite.destroyed)nudged.sprite.position.set(nudged.home.x,nudged.home.y);nudged=null;if(pointer&&!pointer.destroyed)pointer.destroy();highlights.removeChildren().forEach(sprite=>sprite.destroy());hintSprites.length=0;hintOutline=null;pointer=null;}
  function syncLessonFocus(){
   const cells=current.current.tutorial?.cells,g=geometry,key=cells&&g?[g.width,g.height,g.columns,g.cell,g.face.x,g.face.y,...cells].join(':'):'';
   if(key===lessonFocusKey)return;lessonFocusKey=key;lessonFocus.clear();if(!cells||!g)return;
   const {width,height,face,cell,columns}=g;
   lessonFocus.rect(0,0,width,height).fill({color:0x071830,alpha:.68});
   for(const at of cells)lessonFocus.rect(face.x+at%columns*cell+cell*.025,face.y+Math.floor(at/columns)*cell+cell*.025,cell*.95,cell*.95).cut();
   for(const at of cells)lessonFocus.roundRect(face.x+at%columns*cell+cell*.025,face.y+Math.floor(at/columns)*cell+cell*.025,cell*.95,cell*.95,cell*.14).stroke({color:0xfff9d3,width:Math.max(1.5,cell*.035)});
  }
  function halo(index:number){const sprite=new Sprite(texture('halo')),at=position(index);sprite.anchor.set(.5);sprite.position.set(at.x,at.y);sprite.width=cell*1.08;sprite.height=cell*1.08;highlights.addChild(sprite);return sprite;}
  function highlight(){syncLessonFocus();clearHighlights();const p=current.current;if(p.locked||visualActive||down?.axis||commit)return;if(idleHint){const plan=hintPlans[hintIndex],mover=idleHint.type==='swap'?idleHint.from:idleHint.at;if(plan&&geometry)drawHintOutline(plan.group);const frame=halo(mover);frame.tint=0xffe6a1;hintSprites.push(frame);const sprite=spriteAt(mover);if(idleHint.type==='swap'&&sprite)nudged={sprite,home:position(mover),toward:position(idleHint.to)};}else if(chosen!==null)halo(chosen);else if(p.tutorial){halo(p.tutorial.from);halo(p.tutorial.to);pointer=new Sprite(texture('hand'));pointer.anchor.set(.25,.12);pointer.width=cell*1.1;pointer.height=cell*1.1;tutorialPointers.addChild(pointer);}}
  // The cells the move would clear, traced as one bright white line around the whole match.
  function drawHintOutline(group:number[]){if(!geometry)return;const {face,columns}=geometry,pad=cell*.03,line=new Graphics();
   for(const loop of matchOutline(group,columns)){
    // Push each corner out along both neighbouring edges' outward normals so the line sits just outside the tiles.
    const outer=loop.map(([x,y],i)=>{const [px,py]=loop[(i+loop.length-1)%loop.length]!,[nx,ny]=loop[(i+1)%loop.length]!,inX=Math.sign(x-px),inY=Math.sign(y-py),outX=Math.sign(nx-x),outY=Math.sign(ny-y);
     return {x:face.x+x*cell+(inY+outY)*pad,y:face.y+y*cell-(inX+outX)*pad,radius:cell*.2};});
    line.roundShape(outer,cell*.2).stroke({color:0xffffff,width:cell*.16,alpha:.22,join:'round'});
    line.roundShape(outer,cell*.2).stroke({color:0xffffff,width:Math.max(2,cell*.055),alpha:1,join:'round'});}
   line.alpha=0;highlights.addChildAt(line,0);hintOutline=line;}
  function resetIdleHint(){idleClock.reset();hintChecked=false;idleHint=null;hintPlans=[];hintIndex=0;if(host.current)delete host.current.dataset.hintCells;highlight();}
  function updateIdleHint(now:number){const p=current.current,eligible=!busy()&&!down&&!motions.length&&!overlaySteps.length&&!fx?.activeCount&&!p.tool&&!p.tutorial&&!document.hidden&&document.hasFocus();
   if(!idleClock.due(now,eligible)){if(idleHint){idleHint=null;hintChecked=false;if(host.current)delete host.current.dataset.hintCells;highlight();}return;}
   // After each hint has had its turn, the next different move takes over; the whole set then repeats.
   if(hintChecked&&hintPlans.length>1&&now-hintStarted>=HINT_ROTATE_MS){hintIndex=(hintIndex+1)%hintPlans.length;idleHint=hintPlans[hintIndex]!.action;hintStarted=now;if(host.current)host.current.dataset.hintCells=hintCells(idleHint).join(',');highlight();}
   if(!hintChecked){hintChecked=true;hintPlans=hintRotation(p.state,chosen);hintIndex=0;idleHint=hintPlans[0]?.action??null;hintStarted=now;if(idleHint){if(chosen!==null&&!hintCells(idleHint).includes(chosen)){chosen=null;setSelected(null);}if(host.current)host.current.dataset.hintCells=hintCells(idleHint).join(',');highlight();}}
   const elapsed=now-hintStarted,shown=hintVisibility(elapsed,hintPlans.length>1),pulse=p.reduced ? .5 : (1-Math.cos(elapsed/1400*Math.PI*2))/2;
   if(hintOutline)hintOutline.alpha=shown*(.8+pulse*.2);
   // The tile to move leans toward the cell it should go to, carrying its frame with it.
   let lean={x:0,y:0};if(nudged&&!nudged.sprite.destroyed&&!p.reduced){const reach=cell*.2*hintNudge(elapsed)*shown,dx=nudged.toward.x-nudged.home.x,dy=nudged.toward.y-nudged.home.y,length=Math.hypot(dx,dy)||1;lean={x:dx/length*reach,y:dy/length*reach};nudged.sprite.position.set(nudged.home.x+lean.x,nudged.home.y+lean.y);}
   for(const sprite of hintSprites){const home=nudged?.home;if(home)sprite.position.set(home.x+lean.x,home.y+lean.y);sprite.alpha=shown*(.75+pulse*.25);sprite.width=sprite.height=cell*(1.06+pulse*.05);}
  }
  function recycle(sprite:Sprite){if(sprite.destroyed)return;sprite.visible=false;sprite.alpha=1;sprite.zIndex=0;if(tilePool.length>=96){sprite.destroy();return;}tiles.addChild(sprite);tilePool.push(sprite);}
  function stopMotion(sprite:Container){for(let i=motions.length-1;i>=0;i--)if(motions[i]!.sprite===sprite)motions.splice(i,1);}
  function move(sprite:Container,to:Point,duration:number,delay=0,options:Partial<Motion>={}){stopMotion(sprite);motions.push({sprite,from:{x:sprite.x,y:sprite.y},to,start:performance.now()+delay,duration,scale:sprite.scale.x,scaleY:sprite.scale.y,...options});}
  function cartSpriteAt(index:number){
   const state=current.current.state,id=state.cells[index]?.obstacleId;
   return id&&state.obstacles[id]?.kind==='harvest-cart'?overlayNodes.get(id)?.children[0] as Sprite|undefined:undefined;
  }
  function restorePreview(elastic=true){for(const index of previewCells){const sprite=cartSpriteAt(index)??spriteAt(index);if(!sprite)continue;sprite.zIndex=0;if(elastic)move(sprite,position(index),170,0,{elastic:true});else{stopMotion(sprite);sprite.position.copyFrom(position(index));}}previewCells.clear();if(host.current){delete host.current.dataset.dragFrom;delete host.current.dataset.dragTo;delete host.current.dataset.dragX;delete host.current.dataset.dragY;}}
  function cancel(reason='interrupted'){if(!down&&!commit)return;if(down)recordInputTrace({...down.trace,decision:'cancel',reason,to:null});inputTraceAt=undefined;down=null;commit=null;if(commitTimer)clearTimeout(commitTimer);commitTimer=undefined;restorePreview(true);animationEnd=performance.now()+170;phase('returning');highlight();}
  function select(index:number){chosen=index;setSelected(index);highlight();sound('button');}
  function dispatch(action:Action){if(inputTraceAt!==undefined&&action.type!=='continue')recordInputAction(inputTraceAt,action);inputTraceAt=undefined;chosen=null;setSelected(null);clearHighlights();phase('settling');animationEnd=performance.now()+90;pendingAction=action;return current.current.onAction(action);}
  function swap(from:number,to:number){
   if(busy())return;const s=current.current.state;
   if(cartSpriteAt(from)){restorePreview(false);dispatch({type:'swap',from,to});return;}
   if(!draggableCell(s,from)||!draggableCell(s,to)||Math.abs(from%s.width-to%s.width)+Math.abs(Math.floor(from/s.width)-Math.floor(to/s.width))!==1){restorePreview();dispatch({type:'swap',from,to});return;}
   if(combinationAt(s,from,to)){pendingFusion=new Map([from,to].map(index=>{const sprite=spriteAt(index);return [index,sprite?{x:sprite.x,y:sprite.y}:position(index)]}));previewCells.clear();dispatch({type:'swap',from,to});return;}
   chosen=null;setSelected(null);clearHighlights();const pair={from,to,stamp:stamp(s)};commit=pair;previewCells.add(from);previewCells.add(to);phase('swapping');
   const duration=current.current.reduced?65:120;animationEnd=performance.now()+duration+90;
   for(const [a,b]of [[from,to],[to,from]]){const sprite=spriteAt(a!);if(sprite)move(sprite,position(b!),duration);}
   commitTimer=setTimeout(()=>{
    commitTimer=undefined;if(disposed)return;
    if(current.current.locked||stamp(current.current.state)!==pair.stamp){cancel();return;}
    // A timer can run before the last animation frame on a busy mobile WebView.
    // Finish the actual swap before effects read the pieces' source positions.
    for(const [a,b]of [[from,to],[to,from]]){const sprite=spriteAt(a!);if(sprite){stopMotion(sprite);sprite.position.copyFrom(position(b!));}}
    commit=null;awaitingSwap=pair;previewCells.clear();const completion=dispatch({type:'swap',from,to});
    // A parent that declines an input must not leave its visual preview swapped.
    const restore=()=>{if(awaitingSwap===pair){awaitingSwap=null;for(const index of [from,to]){const sprite=spriteAt(index);if(sprite)move(sprite,position(index),170,0,{elastic:true});}animationEnd=performance.now()+170;}};
    if(completion)void completion.then(()=>{if(!disposed&&awaitingSwap===pair)settleTimer=setTimeout(restore,250);},restore);
    else settleTimer=setTimeout(restore,250);
   },duration);
  }
  function tap(index:number){resetIdleHint();if(busy()||!current.current.state.cells[index]?.exists)return;const p=current.current;
   if(p.tutorial?.cells&&index!==p.tutorial.from&&index!==p.tutorial.to)return;
   if(p.tool){dispatch({type:'booster',item:p.tool,at:index});return;}
   if(chosen!==null&&chosen!==index){const from=chosen;chosen=null;swap(from,index);return;}
   const tile=p.state.cells[index]!.tile;if(tile&&tile.kind!=='seed'&&(tile.kind!=='normal'||turntableCells(p.state)?.includes(index))){dispatch({type:'tap',at:index});return;}select(index);inputTraceAt=undefined;
  }
  function obstaclePlan(obstacle:Obstacle,state:GameState){return JSON.stringify([obstacle,obstacle.rule||obstacle.chapter?state.turn:undefined,state.devices,state.gardenPuzzle,obstacle.link?state.obstacles[obstacle.link]:undefined]);}
  function removeObstacle(id:string){
   frontierPieces.delete(id);
   overlayNodes.get(id)?.destroy({children:true});overlayNodes.delete(id);
   counterNodes.get(id)?.destroy();counterNodes.delete(id);
   requirementNodes.get(id)?.icon.destroy();requirementNodes.delete(id);
   obstaclePlans.delete(id);delete displayedObstacles[id];
  }
  function drawObstacle(obstacle:Obstacle,state=current.current.state){if(obstacle.hp<=0)return;if(isFrontierObstacle(obstacle.kind)||isCircuitObstacle(obstacle.kind))frontierPieces.set(obstacle.id,obstacle);obstaclePlans.set(obstacle.id,obstaclePlan(obstacle,state));const layer=new Container();overlays.addChild(layer);overlayNodes.set(obstacle.id,layer);displayedObstacles[obstacle.id]=obstacle.hp;
   const revisedArt=mobileObstacleArt(obstacle,gardenPuzzleObstacleArt(obstacle,state)==='shadow-bud-covered');
   const mobile=revisedArt&&hasArt(revisedArt)?revisedArt:undefined;
   const authored=drawMechanicArt(layer,obstacle,cell,position);
   const isGate=isDeviceGate(current.current.state.devices?.steps,obstacle.anchor);
   const damaged=isBreakableObstacle(obstacle.kind)&&obstacle.hp<obstacle.maxHp;
   const lanternState=obstacle.kind==='starlight-lantern'?(obstacle.hp===1?'starlight-lantern-open':obstacle.hp===2?'starlight-lantern-cracked':undefined):undefined;
   const coverArt=obstacle.cover&&({'greenhouse-sluice':'garden-planter-mud','vine-knot':'garden-planter-bound','rotating-shelf':'rotating-shelf'} as const)[obstacle.cover.kind];
   const id=current.current.goldGarden&&obstacle.kind==='crate'?'coin':isGate?(hasArt('mobile-garden-gate-0')?'mobile-garden-gate-0':'stage_mud_gate_v33'):mobile??gardenSiegeArt(obstacle)??variedObstacleArt(obstacle)??coverArt??lanternState??gardenPuzzleObstacleArt(obstacle,state)??(damaged?`${obstacle.kind}-damaged`:obstacle.kind==='crate'?`crate_${Math.min(obstacle.hp,3)}`:obstacle.kind);
   const artId=hasArt(id)?id:hasArt(obstacle.kind)?obstacle.kind:'crate_1';
   const sprite=new Sprite(boardTexture(artId));sprite.anchor.set(.5);sprite.label=artId;
   if(!mobile&&obstacle.kind==='wind-pod'&&damaged)sprite.tint=0xc6e8c9;
   if(obstacle.rule==='shutter-closed')sprite.tint=mobile?0xdde7ff:0xa5a5bc;
   const points=obstacle.footprint.map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs)+cell,h=Math.max(...ys)-Math.min(...ys)+cell;
   sprite.position.set((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2);
   const size=boardSpriteSize(sprite.texture,w,h);
   sprite.width=size.width;sprite.height=size.height;
   if(mobile&&obstacle.kind==='shelf-vase'){sprite.width*=SHELF_VASE_SCALE;sprite.height*=SHELF_VASE_SCALE;sprite.y=shelfVaseY(sprite.y,cell,sprite.height);}
   if(mobile&&obstacle.direction&&(obstacle.kind==='garden-light'||obstacle.kind==='domino-slat')){const angles={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2};sprite.rotation=angles[obstacle.direction]-(obstacle.kind==='domino-slat'?Math.PI/2:0);}
   if(obstacle.kind==='dandelion-turret'&&state.siege?.bank.length&&state.siege.bank.reduce((n,at)=>n+at%state.width,0)/state.siege.bank.length>obstacle.anchor%state.width)sprite.scale.x*=-1;
   if(!mobile&&obstacle.kind==='bloom-bud'&&hasArt('siege-restored-bed')){
    const cradle=new Sprite(boardTexture('siege-restored-bed'));cradle.label='siege-bloom-cradle';cradle.anchor.set(.5);cradle.position.copyFrom(sprite.position);
    cradle.width=w*.99;cradle.height=h*.99;layer.addChild(cradle);
   }
   if(!authored)layer.addChild(sprite);else sprite.destroy();
   if(obstacle.kind==='garden-beacon'&&(obstacle.charge??0)<(obstacle.siege?.capacity??0)&&hasArt('siege-dew-orb')){
    const charge=obstacle.charge??0;
    for(let i=0;i<charge;i++){
     const orb=new Sprite(texture('siege-dew-orb'));orb.anchor.set(.5);orb.width=orb.height=w*.105;
     orb.position.set(sprite.x+w*(-.18+i*.12),sprite.y+h*.263);orb.label='beacon-dew-socket';layer.addChild(orb);
    }
   }
   if(!mobile&&obstacle.kind==='statue'&&damaged&&hasArt('board-statue')){
    const {x,y}=sprite,radius=Math.min(w,h);
    sprite.tint=0xccc9be;
    const crack=new Graphics().moveTo(x+.03*radius,y-.34*radius).lineTo(x-.055*radius,y-.13*radius)
     .lineTo(x+.04*radius,y-.055*radius).lineTo(x-.08*radius,y+.18*radius)
     .moveTo(x-.055*radius,y-.13*radius).lineTo(x-.22*radius,y-.06*radius);
    crack.stroke({color:0x4d4a44,width:radius*.025,join:'round'});layer.addChild(crack);
   }
   // Counts have their own foreground layer so later obstacles, moving pieces
   // and departure/effect sprites cannot paint over them. Keep them inside the cell.
   if(obstacle.kind==='pot'&&obstacle.color){
    const at=position(obstacle.anchor),icon=new Sprite(texture(tileArt('normal',obstacle.color)));icon.anchor.set(.5);icon.width=cell*.44;icon.height=cell*.44;icon.position.set(at.x-cell*.26,at.y+cell*.25);icon.label='pot-requires-'+obstacle.color;counters.addChild(icon);requirementNodes.set(obstacle.id,{icon,color:obstacle.color});
   }
   if(obstacle.kind==='cabinet'&&(obstacle.seeds??0)>0){const pouch=new Sprite(texture('seed'));pouch.anchor.set(.5);pouch.width=pouch.height=cell*.52;pouch.position.set(Math.min(...xs)-cell*.12,Math.min(...ys));pouch.label='cabinet-contained-seed';layer.addChild(pouch);}
   if(obstacle.contents&&obstacle.kind!=='pottery-nest'){
    const previewArt=obstacle.contents.innerCrateHp===undefined?(mobileObstacleArt({kind:obstacle.contents.kind,hp:1,maxHp:1})??gardenSiegeArt({kind:obstacle.contents.kind,hp:1,maxHp:1})??variedObstacleArt({kind:obstacle.contents.kind,hp:1,maxHp:1})??obstacle.contents.kind):'supply-crate';
    const wide=obstacle.footprint.length>1;
    const icon=new Sprite(texture(previewArt));icon.anchor.set(.5);icon.width=icon.height=cell*(wide?.58:.40);
    icon.position.set(wide?Math.min(...xs)-cell*.17:sprite.x-cell*.27,wide?Math.max(...ys)+cell*.17:sprite.y+cell*.25);layer.addChild(icon);
   }
   const preview=obstacle.storedRocket??(obstacle.cover?.kind==='rotating-shelf'?'garden-planter':undefined);
   if(preview){const icon=new Sprite(texture(tileArt(preview)));icon.anchor.set(.5);icon.width=icon.height=cell*.46;icon.position.set(sprite.x+cell*.18,sprite.y+cell*.15);layer.addChild(icon);}
   const number=planterGroupNumber(obstacle);
   if(number!==undefined){
    const colors=[0x94e5ff,0xffdf91,0xb7ed84,0xf4b8ff,0xffb4a8,0xbbcdff,0x77e7d6];
    const color=colors[(number-1)%colors.length]!;
    const x=sprite.x-cell*.30,y=sprite.y-cell*.31;
    const badge=new Graphics().circle(x,y,cell*.13).fill(0x173c48).stroke({color,width:Math.max(1,cell*.031)});
    const label=new Text({text:String(number),style:{fontSize:Math.max(9,cell*.20),fontWeight:'bold',fill:color}});
    label.anchor.set(.5);label.position.set(x,y);layer.addChild(badge,label);
   }
   if(obstacle.kind==='windmill'||obstacle.kind==='wind-pod'){
    const windmill=obstacle.kind==='windmill'?obstacle:state.obstacles[obstacle.link!];
    if(windmill){
     const at=position(obstacle.anchor),dot=new Graphics(),x=at.x-cell*.30,y=at.y-cell*.30;
     if(windmill.id.startsWith('layered-')){
      const row=Math.floor(windmill.anchor/state.width),column=windmill.anchor%state.width;
      const [mark,color]=windMarks[(Math.floor((row-3)/2)*2+Number(column%4>=2))%windMarks.length]!;
      dot.circle(x,y,cell*.158).fill(0x173c48).stroke({color,width:Math.max(1,cell*.028)});
      const label=new Text({text:mark,style:{fontFamily:'sans-serif',fontSize:cell*.21,fill:color}});
      label.anchor.set(.5);label.position.set(x,y);layer.addChild(dot,label);
     }else{
      const color=windmill.anchor<state.width*Math.floor(state.height/2)?0xeaca7f:0x7af9d9;
      dot.circle(x,y,cell*.088).fill(color).stroke({color:0x163c44,width:1.6});layer.addChild(dot);
     }
    }
   }
   if(state.gardenPuzzle)drawGardenPuzzleObstacle(layer,obstacle,state,cell,position);
   if(obstacle.rule)drawObstacleRule(layer,obstacle,position(obstacle.anchor),cell,state.turn);
   if(obstacle.chapter)drawChapterObstacle(layer,obstacle,state,position(obstacle.anchor),cell);
   const showsDamageInArt=isSiegeObstacle(obstacle.kind)||isVariedObstacle(obstacle.kind)||obstacle.kind==='starlight-lantern'||obstacle.kind==='urn'&&obstacle.maxHp===2||obstacle.kind==='crate'&&obstacle.maxHp<=3;
   if(!showsDamageInArt&&!obstacle.cover&&obstacle.kind!=='wire-planter'&&((obstacle.hp>1&&!obstacle.endOnly)||obstacle.kind==='cabinet'||(isBreakableObstacle(obstacle.kind)&&obstacle.maxHp>1))){
    const layered=obstacle.id.startsWith('layered-');
    const hp=new Text({text:layered?'●'.repeat(obstacle.hp):String(obstacle.hp),style:{fontFamily:layered?'sans-serif':'Lilita One',fontWeight:'normal',fontSize:layered?cell*.17:15,fill:'#ffffff',stroke:{color:'#1f3a54',width:layered?2:3}}});
    hp.anchor.set(1,1);hp.position.set(Math.max(...xs)+cell*.44,Math.max(...ys)+cell*.44);counters.addChild(hp);counterNodes.set(obstacle.id,hp);
   }
  }
  function drawFrost(index:number,value:number){
   if(!value||!hasArt('frost'))return;
   const at=position(index),frame=value>1?'frost-thick':'frost-cracked';
   const revised=supportsVisibleTargets(current.current.state.engineVersion)&&hasArt(frame);
   const fullFloor=hasArt('frost_floor_v19');
   const mobileFrost=hasArt('mobile-frost-0');
   const base=new Sprite(boardTexture(fullFloor?'frost_floor_v19':'frost'));
   base.anchor.set(.5);base.position.set(at.x,at.y);base.width=cell*1.005;base.height=cell*1.005;
   base.visible=!revised&&!mobileFrost;floors.addChild(base);
   const cover=new Container();
   cover.position.set(at.x,at.y);cover.alpha=revised||mobileFrost?1:value>1?.48:.24;
   const ice=new Sprite(boardTexture(mobileFrost?value>1?'mobile-frost-0':'mobile-frost-2':revised?frame:'frost'));
   ice.anchor.set(.5);ice.width=cell*.99;ice.height=cell*.99;
   cover.addChild(ice);frostCovers.addChild(cover);frostNodes.set(index,{base,cover});displayedFrost[index]=value;
  }
  let overlayDebugPending=false;
  function overlayDebug(){overlayDebugPending=true;}
  function flushOverlayDebug(){overlayDebugPending=false;if(host.current){host.current.dataset.obstacleRequirements=JSON.stringify([...requirementNodes].map(([id,{icon,color}])=>({id,color,art:tileArt('normal',color),x:icon.x,y:icon.y,width:icon.width,height:icon.height,foreground:icon.parent===counters})));host.current.dataset.obstacleVisual=JSON.stringify(displayedObstacles);host.current.dataset.frostVisual=JSON.stringify(displayedFrost);delete host.current.dataset.frostMarkers;host.current.dataset.coverOrder=JSON.stringify({departures:cellLayers.getChildIndex(pieceLayers),obstacles:cellLayers.getChildIndex(overlays),frost:cellLayers.getChildIndex(frostCovers)});host.current.dataset.frostCovers=JSON.stringify([...frostNodes].map(([at,{base,cover}])=>({at,layers:displayedFrost[at],x:cover.x,y:cover.y,alpha:cover.alpha,images:cover.children.length,foreground:cover.parent===frostCovers,base:{width:base.width,height:base.height,alpha:base.alpha}})));host.current.dataset.obstacleArtBounds=JSON.stringify([...overlayNodes].map(([id,layer])=>{const sprite=(layer.children.find(child=>child.label!=='siege-bloom-cradle')??layer.children[0]) as Sprite,hp=counterNodes.get(id);return {id,art:sprite.label,x:sprite.x-sprite.width/2,y:sprite.y-sprite.height/2,width:sprite.width,height:sprite.height,counter:hp?{x:hp.x,y:hp.y}:null};}));}}
  function syncCircuitDecor(state=current.current.state){
   circuitFloor.removeChildren().forEach(node=>node.destroy());const pieces=[...frontierPieces.values()];
   // Standalone pots keep their own silhouette. Do not add an individual carrier frame or a stretched backdrop.
   if(state.circuit?.kind==='rail'&&hasArt('mobile-rail-pot-0')){if(host.current)host.current.dataset.circuitDecor='[]';return;}
   if(state.circuit?.kind==='rail'&&pieces.some(o=>o.kind==='rail-pot')&&hasArt('siege-rail-deck')){
    const points=state.circuit.tracks.flatMap(t=>t.cells).map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),deck=new Sprite(boardTexture('siege-rail-deck'));
    deck.anchor.set(.5);deck.position.set((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2);deck.width=Math.max(...xs)-Math.min(...xs)+cell;deck.height=Math.max(...ys)-Math.min(...ys)+cell;deck.label='garden-carrier-deck';circuitFloor.addChild(deck);
   }
   if(state.circuit?.kind==='crystal'&&hasArt('siege-crystal-link'))for(const group of state.circuit.groups){
    const nodes=pieces.filter(o=>o.kind==='linked-crystal'&&o.circuit?.group===group.id);
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
     const a=nodes[i]!.anchor,b=nodes[j]!.anchor;if(Math.abs(a%state.width-b%state.width)+Math.abs(Math.floor(a/state.width)-Math.floor(b/state.width))!==1)continue;
     const from=position(a),to=position(b),link=new Sprite(boardTexture('siege-crystal-link'));link.anchor.set(.5);link.position.set((from.x+to.x)/2,(from.y+to.y)/2);link.width=cell*1.02;link.height=cell*.19;link.rotation=Math.atan2(to.y-from.y,to.x-from.x);link.label='living-crystal-link';circuitFloor.addChild(link);
    }
   }
   if(host.current)host.current.dataset.circuitDecor=JSON.stringify(circuitFloor.children.map(o=>({art:o.label,x:o.x,y:o.y})));
  }
  function syncFrontierDecor(state=current.current.state){
   frontierDecor.removeChildren().forEach(node=>node.destroy());sharedShelves.removeChildren().forEach(node=>node.destroy());frontierNodes.clear();
   for(const group of state.frontier?.groups??[]){
    const members=[...frontierPieces.values()].filter(o=>o.frontier?.group===group.id);
    const shelf=state.frontier?.kind==='shelf',visible=shelf?members.some(o=>o.kind==='shelf-vase'):members.some(o=>o.kind==='canopy-orchid'&&o.frontier?.locked);
    if(hasArt(shelf?'mobile-shelf-vase-0':'mobile-canopy-orchid-0')){
     if(visible){
      const points=group.cells.map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),art=shelf?'mobile-rack-frame-0':'mobile-awning-row-0';
      if(hasArt(art)){
       const width=Math.max(...xs)-Math.min(...xs)+cell*.98;
       if(shelf){
        const face=boardTexture(art,true),height=Math.max(...ys)-Math.min(...ys)+cell;
        const geometry=new MeshGeometry(flowerShelfGeometry(width,height,face.frame)),image=new Mesh({geometry,texture:face});
        image.position.set(Math.min(...xs)-cell*.49,Math.min(...ys)-cell*.5);image.label='shared-flower-vase-shelf';
        image.on('destroyed',()=>geometry.destroy(true));sharedShelves.addChild(image);
       }else{
        const image=new Sprite(boardTexture(art,true));image.anchor.set(.5,0);
        image.position.set((Math.min(...xs)+Math.max(...xs))/2,Math.min(...ys)-cell*.49);
        image.width=width;image.height=Math.max(...ys)-Math.min(...ys)+cell*.98;
        image.alpha=.65;image.label='shared-greenhouse-awning';frontierDecor.addChild(image);frontierNodes.set(group.id,[image]);
       }
      }
     }
     continue;
    }
    const art=shelf?'siege-rack-frame':'siege-awning-row';if(!visible||!hasArt(art))continue;
    const points=group.cells.map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),image=new Sprite(boardTexture(art));
    image.anchor.set(.5,shelf?.5:0);image.position.set((Math.min(...xs)+Math.max(...xs))/2,shelf?(Math.min(...ys)+Math.max(...ys))/2:Math.min(...ys)-cell/2);
    image.width=Math.max(...xs)-Math.min(...xs)+cell;image.height=Math.max(...ys)-Math.min(...ys)+cell;
    image.alpha=shelf?1:.45;image.label=shelf?'flower-vase-shelf':'greenhouse-awning';frontierDecor.addChild(image);frontierNodes.set(group.id,[image]);
   }
   if(host.current)host.current.dataset.frontierDecor=JSON.stringify([...sharedShelves.children,...frontierDecor.children].map(o=>({art:o.label,x:o.x,y:o.y,width:o.width,height:o.height})));
  }
  function updateOverlay(step:ImpactOverlay){
   if(step.kind==='obstacle'){
    const previousHp=displayedObstacles[step.id];
    removeObstacle(step.id);
    if(step.value){
     drawObstacle(step.value);
     const layer=overlayNodes.get(step.id),icon=layer?.children[0];
     if(step.fallFrom!==undefined&&layer&&!current.current.reduced){
      const fall=position(step.fallFrom).y-position(step.value.anchor).y;
      layer.y=fall;
      move(layer,{x:0,y:0},220);
      const counter=counterNodes.get(step.id);
      if(counter){const to={x:counter.x,y:counter.y};counter.y+=fall;move(counter,to,220);}
     }
     if(icon instanceof Sprite){
      const kind=step.value.kind;
      const travel=kind==='carousel'||kind==='harvest-cart'||kind==='rail-pot';
      const event=current.current.events.find(e=>e.obstacleId===step.id&&
       (travel&&e.type==='mechanic'||step.value?.chapter?.kind==='slide'&&e.type==='hit'&&e.to===step.value.anchor));
      if(event&&event.from!==undefined){
       const {x,y}=position(event.from);
       icon.position.set(x,y);
       move(icon,position(step.value.anchor),current.current.reduced?1:kind==='harvest-cart'||step.value.chapter?.kind==='slide'?220:320);
      }else if(!current.current.reduced&&previousHp!==undefined&&step.value.hp<previousHp){
       move(icon,{x:icon.x,y:icon.y},144,0,{recoil:true});
      }
     }
    }
   }else{
    const old=frostNodes.get(step.at);
    old?.base.destroy();old?.cover.destroy({children:true});frostNodes.delete(step.at);
    delete displayedFrost[step.at];drawFrost(step.at,step.value);
   }
   syncCircuitDecor();syncFrontierDecor();overlayDebug();
  }
  function paintPuzzleFloor(state:GameState){puzzleFloor.removeChildren().forEach(marker=>marker.destroy());drawGardenPuzzleFloor(puzzleFloor,state,cell,position);}
  function render(animate:boolean){
   if(!app.renderer||disposed||!host.current)return;const p=current.current,s=p.state,w=host.current.clientWidth;if(w<32)return;
   // Server acknowledgement and HUD re-renders must not snap an in-progress visual cascade to its final board.
   if(stamp(s)===lastStamp&&p.events===lastEvents&&w===width){highlight();return;}
   resetIdleHint();
   if(down||commit)cancel();animate=animate&&p.events!==lastEvents&&p.events.length>0;if(!animate){for(const motion of motions)motion.finish?.();motions.length=0;contacts=[];fx?.clear();animationEnd=0;phase('idle');visualSettled();}const invalid=animate&&p.events.some(event=>event.type==='invalid'),timing=effectTiming(p.events,s,p.action??pendingAction),prior=animate&&!p.reduced&&last&&last.width===s.width&&last.height===s.height?last:s;
   const frameLayout=updateGeometry(w,s);pieceClipStep=undefined;const open=s.gardenStage?.connected??[],oldOpen=animate&&!p.reduced?prior.gardenStage?.connected??[]:open;updatePieceClip(oldOpen);if(open.join(',')!==oldOpen.join(','))pieceClipStep={at:performance.now()+timing.settleAt,cells:open};width=w;canvasInset=Math.ceil(cell*3);
   const renderWidth=geometry!.width+canvasInset*2,renderHeight=geometry!.height+canvasInset*2;
   if(app.screen.width!==renderWidth||app.screen.height!==renderHeight)app.renderer.resize(renderWidth,renderHeight);
   Object.assign(element.style,{position:'relative',height:geometry!.height+'px',overflow:'visible'});
   Object.assign(app.canvas.style,{position:'absolute',left:-canvasInset+'px',top:-canvasInset+'px',pointerEvents:'none'});
   app.stage.position.set(canvasInset,canvasInset);
   const geometryChanged=frameKey!==clipKey;
   const floorState=s.engineVersion==='1.6.0'?s:prior;
   const nextFloorKey=clipKey+JSON.stringify([floorState.gardenStage??null,floorState.siege??null]);
   const rebuildFloor=floorKey!==nextFloorKey;
   if(rebuildFloor){
    floors.removeChildren().forEach(sprite=>sprite.destroy());
    frostCovers.removeChildren().forEach(cover=>cover.destroy({children:true}));
    frostNodes.clear();for(const at of Object.keys(displayedFrost))delete displayedFrost[Number(at)];
    floorKey=nextFloorKey;
   }
   const nextMarkerKey=clipKey+JSON.stringify([s.devices,s.cells.map(c=>[c.exit,c.obstacleId?s.obstacles[c.obstacleId]?.endOnly:undefined])]);
   const rebuildMarkers=markerKey!==nextMarkerKey;
   if(rebuildMarkers){floorMarkers.removeChildren().forEach(marker=>marker.destroy({children:true}));markerKey=nextMarkerKey;}
   for(const badge of pollenNodes.keys())badge.destroy();
   pollenNodes.clear();overlaySteps=[];
   if(geometryChanged){for(const id of [...overlayNodes.keys()])removeObstacle(id);border.removeChildren().forEach(sprite=>sprite.destroy());}
   const puzzle=s.devices,device=puzzle?.steps[puzzle.index];
   const activeZone=device?.kind==='switchback'?(puzzle?.progress??0)%2:device?.kind==='relay'?Number(puzzle?.color!==undefined):
    device?.kind==='branch'&&puzzle?.branch!==undefined?1-puzzle.branch:undefined;
   const marked=new Map(device?.kind==='pollen'?[]:device?.zones.flatMap((zone,n)=>zone.map((index,i)=>[index,{n,i,next:zone[(i+1)%zone.length]!}] as const)));
   const boardWide=device?.zones.length===1&&marked.size===s.cells.filter(cell=>cell.exists).length;
   s.cells.forEach((c,index)=>{if(!c.exists)return;const at=position(index);
    if(rebuildFloor){const floor=new Sprite(texture(hasArt('board_cell')?'board_cell':'cell'));floor.anchor.set(.5);floor.position.set(at.x,at.y);floor.width=cell*1.005;floor.height=cell*1.005;floors.addChild(floor);}
    const mark=marked.get(index);
    if(rebuildMarkers&&mark&&!(device?.kind==='keys'&&puzzle?.openedLocks?.includes(mark.i))&&!(c.obstacleId&&s.obstacles[c.obstacleId]?.endOnly)){
     const charged=device?.kind==='twin-plates'&&puzzle?.chargedPlates?.includes(mark.i)||puzzle?.echoAt===index;
     const color=charged?0xa4fa82:device?.kind==='echo'?0xcbb0ff:device?.kind==='reflector'?0x9ef5ff:mark.n===0?0xffdc77:0x84e7ed;
     const alpha=(activeZone===undefined||activeZone===mark.n)?0.95:0.26;
     const marker=new Graphics();
     if(device?.kind==='conveyor'){
      const next=position(mark.next),angle=Math.atan2(next.y-at.y,next.x-at.x);
      marker.circle(0,0,cell*.14).fill({color:0x173d65,alpha:.94});
      marker.poly([-cell*.066,-cell*.072,cell*.083,0,-cell*.066,cell*.072]).fill({color,alpha});
      marker.position.set(at.x+cell*.27,at.y-cell*.27);marker.rotation=angle;
     }else if(!boardWide){
      if(device?.kind==='echo'&&puzzle?.echoAt===index)marker.circle(at.x,at.y,cell*.46).stroke({color,alpha:.85,width:Math.max(2,cell*.09)});
      if(device?.kind==='reflector'){
       const x=at.x-cell*.27,y=at.y+cell*.27;
       marker.moveTo(x-cell*.11,y+cell*.11).lineTo(x+cell*.11,y-cell*.11).stroke({color:0x173d65,width:cell*.17,cap:'round'});
       marker.moveTo(x-cell*.11,y+cell*.11).lineTo(x+cell*.11,y-cell*.11).stroke({color,width:cell*.10,cap:'round'});
      }
      marker.roundRect(at.x-cell*.46,at.y-cell*.46,cell*.92,cell*.92,cell*.10).stroke({color,alpha,width:Math.max(1.3,cell*.042)});
     }
     floorMarkers.addChild(marker);
     const badge=device?.kind==='twin-plates'||device?.kind==='keys'?String(mark.i+1):
      device?.kind==='portal'?'↔':device?.kind==='updraft'?'↑':device?.kind==='turntable'?'↻':
       device?.kind==='carrier'?'▲':device?.kind==='echo'&&charged?'✦':undefined;
     if(badge){
      const x=at.x+cell*.29,y=at.y-cell*.29;
      marker.circle(x,y,cell*.155).fill(0x173d65).stroke({color,width:1.1});
      const label=new Text({text:badge,style:{fontSize:Math.max(8,cell*.22),fontWeight:'bold',fill:color}});
      label.anchor.set(.5);label.position.set(x,y);floorMarkers.addChild(label);
     }
    }
    // Retained v1.6 runs still have pieces on open floors, so update their
    // under-piece water here. New open-floor runs reveal above it on their beat.
    if(rebuildFloor&&s.gardenStage?.channels.includes(index)){
     const shown=s.engineVersion==='1.6.0'?s:prior;
     const floor=gardenFloor(s.gardenStage,index,s.width,!!shown.gardenStage?.connected.includes(index));
     const path=new Sprite(stageFloorArt(floor.id).texture);
     path.anchor.set(.5);
     path.position.set(at.x,at.y);
     path.width=path.height=cell*1.005;
     path.rotation=floor.rotation*Math.PI/180;
     floors.addChild(path);
    }
    if(rebuildMarkers&&c.exit){const r=cell*.16,y=at.y+cell*.47,arrow=new Graphics().poly([at.x-r,y-r,at.x+r,y-r,at.x,y]).fill({color:0xffd35b}).stroke({color:0x234b78,width:1.3});arrow.label='seed-exit-'+index;floorMarkers.addChild(arrow);}
    const frost=prior.cells[index]?.frost??0;
    if((displayedFrost[index]??0)!==frost)updateOverlay({kind:'frost',at:index,value:frost,delay:0});
   });
   const obstacleImpacts:ObstacleImpact[]=[];
   for(const id of [...overlayNodes.keys()])if(!prior.obstacles[id])removeObstacle(id);
   for(const obstacle of Object.values(prior.obstacles))if(obstaclePlans.get(obstacle.id)!==obstaclePlan(obstacle,prior)){removeObstacle(obstacle.id);drawObstacle(obstacle,prior);}
   if(prior!==s){const epoch=performance.now();overlaySteps=impactOverlays(prior,s,p.events,timing,impact=>obstacleImpacts.push(impact)).map(step=>({...step,start:epoch+step.delay}));}overlayDebug();
   if(!animate&&!p.events.length)frontierOpenings.clear();
   if(animate)for(const [index,event]of p.events.entries())if(event.kind==='canopy-open'){
    const group=s.frontier?.groups.find(g=>g.cells.some(at=>event.cells.includes(at)));
    if(group)frontierOpenings.set(group.id,performance.now()+timing.delays[index]!);
   }
   syncCircuitDecor(prior);syncFrontierDecor(prior);
   if(s.gardenPuzzle){paintPuzzleFloor(prior);puzzleFloorAt=prior!==s?performance.now()+timing.settleAt:undefined;}
   else if(puzzleFloor.children.length){paintPuzzleFloor(s);puzzleFloorAt=undefined;}
   if(geometryChanged&&frameLayout.frameId){const insets=frameLayout.slices,frame=new NineSliceSprite({texture:texture(frameLayout.frameId),leftWidth:insets.left,rightWidth:insets.right,topHeight:insets.top,bottomHeight:insets.bottom});frame.scale.set(BOARD_FRAME_SCALE);frame.width=geometry!.width/BOARD_FRAME_SCALE;frame.height=geometry!.height/BOARD_FRAME_SCALE;border.addChild(frame);}
   frameKey=clipKey;
   const settleAt=p.reduced?0:invalid?0:timing.settleAt,ids=new Set<number>();let finalMovement=0;
   const gathering=animate&&last?tileGathering(last,p.events):new Map<number,{anchor:number;at:number}>();
   const portal=p.events.find(event=>event.kind==='portal-transfer');
   const turntableTurn=p.events.some(event=>event.kind==='turntable-spin');
   const falls=animate&&last?tileFallPaths(last,s,p.events):new Map<number,Array<Point>>(),births=animate&&last?tileOrigins(last,s,p.events):new Map<number,TileOrigin>(),removals=animate&&last?tileDepartures(last,p.events,timing):new Map<number,TileDeparture>();if(host.current){host.current.dataset.refillOrigins=JSON.stringify([...births.values()]);host.current.dataset.tileDepartures=JSON.stringify([...removals].map(([id,plan])=>({id,...plan})));}
   s.cells.forEach((c,index)=>{const tile=c.tile;if(!c.exists||!tile)return;ids.add(tile.id);let sprite=active.get(tile.id),fresh=false;
    const artId=tileArt(tile.kind,tile.kind==='normal'?tile.color:undefined,s.powerRainbow);
    const face=tile.kind==='normal'?texture(artId):boardTexture(artId);
    if(!sprite){sprite=tilePool.pop()||new Sprite(face);sprite.visible=true;sprite.anchor.set(.5);tiles.addChild(sprite);active.set(tile.id,sprite);fresh=true;}
    sprite.texture=face;
    if(tile.kind==='normal'){
     sprite.width=sprite.height=cell*tileVisualSize('normal');
    }else{
     const rocket=tile.kind==='wind-row'||tile.kind==='wind-column';
     const size=boardSpriteSize(face,cell,cell,rocket?'rocket':'item');
     sprite.width=size.width;sprite.height=size.height;
    }
    sprite.rotation=0;sprite.zIndex=0;
    const to=position(index);
    if(animate&&!p.reduced){
     const birth=fresh?births.get(tile.id):undefined;
     const path=(birth?.points??falls.get(tile.id))?.map(point=>({x:geometry!.face.x+point.x*cell,y:geometry!.face.y+point.y*cell}));
     const warping=!!portal&&p.events.every(event=>event.type==='swap'||event.kind==='portal-transfer')&&
      !!path&&(index===portal.from||index===portal.to);
     if(fresh){const origin=birth?.origin??{x:index%s.width+.5,y:-.5};sprite.position.set(geometry!.face.x+origin.x*cell,geometry!.face.y+origin.y*cell);sprite.alpha=birth?.mode==='formation'?0:1;}
     const distance=path?path.slice(1).reduce((sum,point,i)=>sum+Math.hypot(point.x-path[i]!.x,point.y-path[i]!.y),0):Math.hypot(sprite.x-to.x,sprite.y-to.y);
     if(distance>.5||fresh){
      const falling=fallMotion(distance/cell,index%s.width),formation=birth?.mode==='formation';
      const rotating=turntableTurn&&!!path&&p.events.every(event=>event.kind==='turntable-spin');
      const duration=rotating?200:warping?280:invalid||formation?190:falling.duration,delay=invalid||warping||rotating?0:settleAt+falling.delay;
      move(sprite,to,duration,delay,{alpha:fresh&&formation,elastic:invalid,fall:!invalid&&!warping&&!rotating,travel:formation?125:falling.travel,form:formation,path,portal:warping});
      finalMovement=Math.max(finalMovement,delay+duration);
     }else sprite.alpha=1;
    }
    else{sprite.position.set(to.x,to.y);sprite.alpha=1;}
   });
   const pollen=new Set([...(prior.devices?.pollenIds??[]),...(s.devices?.pollenIds??[])]);
   for(const id of pollen){
    const sprite=active.get(id);if(!sprite)continue;
    const badge=new Graphics().circle(0,0,cell*.145).fill(0x57346f).stroke({color:0xffe28d,width:1.25});
    for(const [x,y]of [[0,-.058],[-.051,.03],[.051,.03]])badge.circle(x!*cell,y!*cell,cell*.041).fill(0xffe28d);
    badge.position.set(sprite.x+cell*.28,sprite.y-cell*.28);
    badge.label='pollen-'+id;
    counters.addChild(badge);
    pollenNodes.set(badge,sprite);
   }
   const fusedIds=new Set(animate?p.events.filter(event=>event.type==='special'&&event.cells.length===2&&combinationParts(event.kind??'')).flatMap(event=>event.cells.flatMap(index=>last?.cells[index]?.tile?[last.cells[index]!.tile!.id]:[])):[]);
   active.forEach((sprite,id)=>{if(ids.has(id))return;active.delete(id);
    if(fusedIds.has(id)){recycle(sprite);return;}
    if(animate&&!p.reduced){
     departures.addChild(sprite);
     const departure=removals.get(id),delay=departure?.delay??Math.max(0,timing.settleAt-VISUAL_BEATS.pop);
     const activation=departure?.activation??false,matched=departure?.matched,gather=gathering.get(id);
     const anticipation=matched||!timing.special?Math.min(delay,MATCH_SQUEEZE):0;
     const duration=activation?80:anticipation+(matched&&!gather?MATCH_RELEASE:110);
     move(sprite,gather?position(gather.anchor):{x:sprite.x,y:sprite.y},duration,delay-anticipation,{
      pop:activation||gather?undefined:matched?'match':'impact',anticipation,gather:!!gather,fade:activation,finish:()=>recycle(sprite),
     });
    }
    else recycle(sprite);
   });
   if(animate){const duration=fx?.play(p.events,last,s,p.reduced,p.action??pendingAction,timing,pendingFusion,p.continuingCascade,obstacleImpacts)||0;visualStart(p.reduced?110:Math.max(invalid?190:0,p.events.some(e=>e.type==='shuffle')?duration:0,p.events.some(e=>e.type==='win')?Math.min(duration,timing.settleAt+450):0,timing.settleAt+65,timing.circuitEnd??0,finalMovement,gardenStageMotion(p.events,timing.settleAt,false).end));if(invalid)sound('invalid');else{const epoch=performance.now();contacts=impactCues(p.events,timing,p.reduced).map(cue=>({...cue,at:epoch+cue.delay}));if(host.current){host.current.dataset.impactPlannedMs=String(contacts[0]?.delay??0);host.current.dataset.impactCues=JSON.stringify(contacts);delete host.current.dataset.impactPlayedAt;}}}
   else if(stamp(s)!==lastStamp){fx?.clear();animationEnd=0;phase('idle');}
   if(animate||stamp(s)!==lastStamp){pendingAction=undefined;pendingFusion=undefined;}awaitingSwap=null;if(settleTimer)clearTimeout(settleTimer);lastEvents=p.events;last=s;lastStamp=stamp(s);highlight();
   // A resize/remount may present the settled state without an animation. The
   // parent can already be holding input for that action and still needs an ACK.
   if(!animate)visualSettled(true);
  }
  const point=(event:PointerEvent):Point=>{const rect=element.getBoundingClientRect();return {x:(event.clientX-rect.left)*element.clientWidth/rect.width,y:(event.clientY-rect.top)*element.clientHeight/rect.height};};
  function inside(p:Point){return !!geometry&&cellIndex(p,geometry)!==null;}
  function pointerDown(event:PointerEvent){
   if(down&&event.pointerId!==down.id){cancel('second-pointer');return;}
   if(busy()||down||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;const at=point(event);if(!inside(at))return;const s=current.current.state,index=cellIndex(at,geometry!)!;if(!s.cells[index]?.exists)return;if(current.current.tutorial?.cells&&index!==current.current.tutorial.from&&index!==current.current.tutorial.to)return;
   const rect=element.getBoundingClientRect(),bounds={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
   event.preventDefault();startMusic();down={id:event.pointerId,from:index,clientX:event.clientX,clientY:event.clientY,bounds,scaleX:element.clientWidth/rect.width,scaleY:element.clientHeight/rect.height,axis:null,projection:projectDrag(s,index,0,0,cell),dragged:false,stamp:stamp(s),tool:current.current.tool,trace:{at:Date.now(),pointer:['touch','mouse','pen'].includes(event.pointerType)?event.pointerType:'unknown',turn:s.turn,state:stamp(s),from:index,tile:s.cells[index]?.tile?.kind??'empty',cell,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},samples:[],decision:'cancel',reason:'interrupted',to:null}};phase('holding');if(pointer)pointer.alpha=0;try{element.setPointerCapture(event.pointerId);}catch{/* Synthetic accessibility pointers may not have native capture. */}
  }
  function previewDrag(index:number,projection:DragProjection){
   restorePreview(false);chosen=null;setSelected(null);clearHighlights();
   const state=current.current.state,from=position(index);
   const cartPath=projection.to===null?undefined:harvestCartPushPath(state,index,projection.to);
   const combining=projection.to!==null&&!!combinationAt(state,index,projection.to);
   for(const at of cartPath?.slice(0,-1)??[index]){
    const p=position(at),source=cartSpriteAt(at)??spriteAt(at);
    if(source){source.position.set(p.x+projection.x*(combining ? .82 : 1),p.y+projection.y*(combining ? .82 : 1));source.zIndex=5;previewCells.add(at);}
   }
   if(projection.to!==null&&(!cartPath||cartPath.length===2)){const target=spriteAt(projection.to),to=position(projection.to);if(target){const travel=combining ? .07 : 1;target.position.set(to.x+(from.x-to.x)*projection.progress*travel,to.y+(from.y-to.y)*projection.progress*travel);target.zIndex=4;previewCells.add(projection.to);}}
   phase('dragging');if(host.current){host.current.dataset.dragFrom=String(index);host.current.dataset.dragTo=String(projection.to??'');host.current.dataset.dragX=projection.x.toFixed(2);host.current.dataset.dragY=projection.y.toFixed(2);}
  }
  function pointerMove(event:PointerEvent){if(!down||event.pointerId!==down.id)return;if(current.current.locked||stamp(current.current.state)!==down.stamp||current.current.tool!==down.tool){cancel('state-changed');return;}if(!sameCanvasBounds(down.bounds,element.getBoundingClientRect())){cancel('layout-changed');return;}if(down.tool)return;
   event.preventDefault();const dx=(event.clientX-down.clientX)*down.scaleX,dy=(event.clientY-down.clientY)*down.scaleY,intent=dragIntent(current.current.state,down.from,dx,dy,cell,down.axis);down.axis=intent.axis;down.projection=intent.projection;addDragSample(down.trace,{dx:dx/cell,dy:dy/cell,axis:intent.projection.axis,to:intent.projection.to});if(intent.projection.axis){down.dragged=true;previewDrag(down.from,intent.projection);}else{restorePreview(false);phase('holding');}
  }
  function pointerUp(event:PointerEvent){if(!down||event.pointerId!==down.id)return;if(!sameCanvasBounds(down.bounds,element.getBoundingClientRect())){cancel('layout-changed');return;}event.preventDefault();const d=down,at=point(event),dx=(event.clientX-d.clientX)*d.scaleX,dy=(event.clientY-d.clientY)*d.scaleY;down=null;try{element.releasePointerCapture(event.pointerId);}catch{/* Capture may already have been released by the OS. */}
   if(current.current.locked||stamp(current.current.state)!==d.stamp||current.current.tool!==d.tool){recordInputTrace({...d.trace,decision:'cancel',reason:'state-changed',to:null});restorePreview();animationEnd=performance.now()+170;phase('returning');highlight();return;}
   // Pointer capture can release beyond the frame after crossing a valid edge cell.
   // Decide swaps by the adjacent-cell projection; only taps require an inside release.
   const release=d.tool?{projection:d.projection,observed:d.projection,cancelled:false,reason:'tool'}:releaseDrag(current.current.state,d.from,dx,dy,cell,d.axis,d.projection),projection=release.projection;
   const swapping=!release.cancelled&&projection.canRelease&&projection.to!==null,tapping=!projection.axis&&inside(at)&&!d.dragged;
   recordInputTrace({...d.trace,release:{dx:dx/cell,dy:dy/cell,axis:release.observed.axis,to:release.observed.to},decision:swapping?'swap':tapping?(current.current.state.cells[d.from]?.tile?.kind==='normal'&&!d.tool&&!turntableCells(current.current.state)?.includes(d.from)?'select':'tap'):'cancel',reason:release.reason,to:swapping?projection.to:null});
   inputTraceAt=swapping||tapping?d.trace.at:undefined;
   if(projection.axis){if(!release.cancelled)previewDrag(d.from,projection);if(swapping)swap(d.from,projection.to!);else{restorePreview();animationEnd=performance.now()+170;phase('returning');highlight();}}
   else if(tapping)tap(d.from);else{restorePreview();animationEnd=performance.now()+170;phase('returning');highlight();}
  }
  const pointerCancel=(event:PointerEvent)=>{if(down?.id===event.pointerId)cancel('pointer-cancel');};
  const onBlur=()=>{resetIdleHint();cancel();},onVisibility=()=>{resetIdleHint();if(document.hidden)cancel();},onInput=()=>resetIdleHint();
  void app.init({width:360,height:360,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true}).then(()=>{
   if(disposed||host.current!==element||!element.isConnected){app.destroy({removeView:true,releaseGlobalResources:false});return;}element.appendChild(app.canvas);app.stage.addChild(cellLayers,clipSprite,pieceClipSprite,effects,highlights,border,counters,lessonFocus,tutorialPointers);ripple=createBoardRipple(app,effects);void prepareFxMaterials();fx=createBoardEffects(app,effects,{shards:tileShards,fxArt:id=>fxMaterial(id as FxMaterial),ripple:(origin,reach,duration,strength)=>{if(!current.current.reduced||duration<=0)ripple?.play(origin,reach,duration,strength);},cellSize:()=>cell,position,bounds:()=>geometry?.face??{x:0,y:0,width:0,height:0},frames:animationTextures,debris:createDebrisSurface(element,element,()=>geometry??app.screen),pieceTexture:boardEffectTexture,woodenCrates:()=>!current.current.goldGarden,shade:alpha=>{effectShade.alpha=alpha;effectShade.visible=alpha>0&&!current.current.reduced;},impulse:(strength,duration)=>{camera={start:performance.now(),duration,strength:current.current.reduced?0:Math.min(12,strength)};if(!strength||!duration)app.stage.position.set(canvasInset,canvasInset);}});
   app.canvas.style.touchAction='none';app.canvas.style.marginInline='auto';element.addEventListener('pointerdown',pointerDown);element.addEventListener('pointermove',pointerMove);element.addEventListener('pointerup',pointerUp);element.addEventListener('pointercancel',pointerCancel);element.addEventListener('lostpointercapture',pointerCancel);window.addEventListener('blur',onBlur);document.addEventListener('visibilitychange',onVisibility);document.addEventListener('pointerdown',onInput,true);document.addEventListener('keydown',onInput,true);
   controller.current={render,tap,cancel,resetHint:resetIdleHint};
   app.ticker.add(()=>{
    if(puzzleFloorAt!==undefined&&performance.now()>=puzzleFloorAt){puzzleFloorAt=undefined;paintPuzzleFloor(current.current.state);}
    for(const [badge,sprite]of pollenNodes){
     badge.visible=sprite.visible&&(sprite.parent===tiles||sprite.parent===departures);
     badge.alpha=sprite.alpha;
     badge.position.set(sprite.x+cell*.28,sprite.y-cell*.28);
    }
    for(const [id,start]of frontierOpenings){const nodes=frontierNodes.get(id);if(!nodes){frontierOpenings.delete(id);continue;}
     const u=Math.max(0,Math.min(1,(performance.now()-start)/460)),height=1-u*u*(3-2*u);for(const node of nodes){node.height=cell*Math.max(.001,height);node.alpha=(hasArt('mobile-awning-row-0')?.65:.45)*(1-u*.3);}
    }
    const now=performance.now(),shake=camera.duration?Math.min(1,(now-camera.start)/camera.duration):1,energy=(1-shake)**2*camera.strength;const heavy=camera.strength>4,swings=heavy?Math.max(3,camera.duration/65):1.5;app.stage.position.set(canvasInset+Math.sin(shake*Math.PI*2*swings)*energy,canvasInset+Math.sin(shake*Math.PI*2*swings*(heavy?1.33:4/3)+(heavy?1.3:0))*energy*(heavy?.75:.45));if(host.current)host.current.dataset.cameraOffset=`${(app.stage.x-canvasInset).toFixed(2)},${(app.stage.y-canvasInset).toFixed(2)}`;while(contacts[0]&&now>=contacts[0].at){const cue=contacts.shift()!;if(now-cue.at>120)continue;sound(cue.name,cue.accent);haptic(cue.strength);if(cue.shake)camera={start:now,duration:95,strength:cue.shake};if(host.current)host.current.dataset.impactPlayedAt=String(now);}if(pieceClipStep&&now>=pieceClipStep.at){updatePieceClip(pieceClipStep.cells);pieceClipStep=undefined;}while(overlaySteps[0]&&now>=overlaySteps[0].start)updateOverlay(overlaySteps.shift()!);if(overlayDebugPending)flushOverlayDebug();for(let i=motions.length-1;i>=0;i--){const motion=motions[i]!,sprite=motion.sprite;if(sprite.destroyed){motions.splice(i,1);continue;}if(now<motion.start)continue;const elapsed=now-motion.start,t=Math.min(1,elapsed/motion.duration),pose=motion.fall?fallPose(elapsed,motion.travel??motion.duration-65):undefined,u=motion.elastic?1+(2.2*(t-1)**3+1.2*(t-1)**2):pose?pose.progress:t*t*(3-2*t);const at=motion.path?pointOnPath(motion.path,u):{x:motion.from.x+(motion.to.x-motion.from.x)*u,y:motion.from.y+(motion.to.y-motion.from.y)*u};sprite.position.set(at.x,at.y);if(motion.portal){const position=t<.5?motion.from:motion.to;sprite.position.set(position.x,position.y);sprite.alpha=Math.abs(2*t-1);}if(motion.alpha)sprite.alpha=Math.min(1,t*5);if(motion.fade)sprite.alpha=1-t;if(motion.fall){const form=motion.form ? .72+.28*(1-(1-Math.min(1,t/.35))**3):1;sprite.y+=(pose?.offset??0)*cell;sprite.scale.set(motion.scale*form*(pose?.scaleX??1),motion.scaleY*form*(pose?.scaleY??1));}if(motion.pop){const body=(motion.pop==='match'?matchBreakPose:breakPose)(elapsed,motion.anticipation);sprite.scale.set(motion.scale*body.scaleX,motion.scaleY*body.scaleY);sprite.alpha=body.alpha;}
    if(motion.recoil){const pose=obstacleRecoil(t);sprite.scale.set(motion.scale*pose.x,motion.scaleY*pose.y);}
    if(motion.gather){const u=t*t;sprite.position.set(motion.from.x+(motion.to.x-motion.from.x)*u,motion.from.y+(motion.to.y-motion.from.y)*u);sprite.scale.set(motion.scale*(1-.8*u),motion.scaleY*(1-.8*u));sprite.alpha=1-Math.max(0,(t-.7)/.3);sprite.rotation=Math.sin(Math.PI*t)*.16;}if(t===1){motion.finish?.();motions.splice(i,1);}}
    if(pointer&&!pointer.destroyed&&current.current.tutorial&&!down&&!commit){const path=current.current.tutorial,a=position(path.from),b=position(path.to),phase=(now%1600)/1600,u=Math.min(1,Math.max(0,(phase-.18)/.55));pointer.position.set(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u);pointer.alpha=phase>.85?(1-phase)/.15:Math.min(1,phase/.12);}
    if(host.current&&fx){const count=String(fx.activeCount);if(host.current.dataset.activeEffects!==count)host.current.dataset.activeEffects=count;}if(host.current&&width!==host.current.clientWidth)render(true);if(visualActive&&host.current)host.current.dataset.visualRemaining=String(Math.max(0,Math.round(animationEnd-now)));if(now>=animationEnd&&!motions.length&&!overlaySteps.length&&!down&&!commit&&!awaitingSwap){if(visualActive)visualSettled();else phase('idle');}updateIdleHint(now);
   });render(false);
   // Lumi delivers the chosen start boosters once per run; the board takes no input until she is done.
   const intro=current.current.boosterIntro;if(intro?.length&&!current.current.reduced)void prepareFxMaterials().then(()=>{if(disposed)return;const duration=playLumiIntro(app,effects,{cellSize:()=>cell,position,bounds:()=>geometry?.face??{x:0,y:0,width:0,height:0},tileAt:index=>{const id=current.current.state.cells[index]?.tile?.id;return id===undefined?undefined:active.get(id);}},intro);if(duration){animationEnd=Math.max(animationEnd,performance.now()+duration);resetIdleHint();}});
  });
  return()=>{disposed=true;if(visualActive)visualSettled();else if(pendingAction)current.current.onVisualSettled?.();controller.current=null;if(commitTimer)clearTimeout(commitTimer);if(settleTimer)clearTimeout(settleTimer);window.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('pointerdown',onInput,true);document.removeEventListener('keydown',onInput,true);element.removeEventListener('pointerdown',pointerDown);element.removeEventListener('pointermove',pointerMove);element.removeEventListener('pointerup',pointerUp);element.removeEventListener('pointercancel',pointerCancel);element.removeEventListener('lostpointercapture',pointerCancel);fx?.destroy();ripple?.destroy();if(app.renderer)app.destroy({removeView:true,releaseGlobalResources:false},{children:true});clipTexture?.destroy(true);pieceClipTexture?.destroy(true);};
 },[]);
 // Consume new actions before the Pixi resize ticker. Dismissing a tutorial
 // changes the board width in the same commit as its first accepted swap.
 useLayoutEffect(()=>{controller.current?.render(true)},[props.state,props.events,props.tutorial]);
 useEffect(()=>{controller.current?.resetHint();if(props.locked)controller.current?.cancel()},[props.locked,props.tool]);
 return <div className="board-wrap"><div className="board" ref={host} aria-label={tr("퍼즐 보드")} role="application" data-input-phase="idle"/>
  {props.state.gardenStage&&stageGeometry&&<GardenStageOverlay animal={props.animal} state={props.state} events={props.events} action={props.action} geometry={stageGeometry} reduced={props.reduced}/>}
  <div className="sr-only" role="group" aria-label={tr("퍼즐 칸")}>{props.state.cells.map((cell,index)=>{
   if(!cell.exists)return null;
   const obstacle=cell.obstacleId?props.state.obstacles[cell.obstacleId]:undefined;
   const number=planterGroupNumber(obstacle);
   const group=number===undefined?'':` · ${obstacle?.cover?itemName(obstacle.cover.kind)+' ':''}${number}`;
   const rule=obstacle?.chapter?' · '+chapterObstacleLabel(obstacle,props.state):
    obstacle?.rule?' · '+[tr(obstacleRuleLabel[obstacle.rule]),obstacleRuleDetail(obstacle,props.state.turn),obstacle.lastHitColor&&itemName(obstacle.lastHitColor)].filter(Boolean).join(' '):'';
   return <button key={index} disabled={props.locked||props.state.status!=='playing'||!!props.tutorial?.cells&&index!==props.tutorial.from&&index!==props.tutorial.to} aria-pressed={selected===index} onClick={()=>controller.current?.tap(index)}>{Math.floor(index/props.state.width)+1}{tr("행")}{' '}{index%props.state.width+1}{tr("열")}{' '}{cell.obstacleId&&isDeviceGate(props.state.devices?.steps,index)?tr('장치 문'):cell.tile?.kind==='normal'?t(`item.${cell.tile.color}`):cell.tile?.kind==='rainbow'&&props.state.powerRainbow?t('powerRainbow.name'):cell.tile?itemName(cell.tile.kind):(obstacle?props.goldGarden?tr('금화'):itemName(obstacle.kind):null)}{group}{rule}{props.state.devices?.pollenIds?.includes(cell.tile?.id??-1)?' · '+tr('꽃가루 표식'):''}{cell.frost>0?` · ${t('item.frost')} ${cell.frost}`:''}{cell.exit?' · '+tr('씨앗 출구'):''}</button>;
  })}</div>
 </div>;
}

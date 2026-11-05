import {forwardRef,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from 'react';
import {DECORATIONS,GARDEN_WORLD,gardenBounds,gardenLandCells,gardenPlotCells,decorationFootprint,gardenGridToScreen,gardenScreenToCell,zoomGardenAt,constrainGardenCamera,placementCells,type GardenCamera,type GardenExpansionPlot,type GardenPlacement,type GardenPoint,type GardenWorldState} from '../../../../packages/garden-world/src';
import type {LoadedArt} from './assets';
import {GardenResidents,type GardenResident} from './residents';
import {gardenBrushLine} from './paint';
import {gardenDirectionArt,gardenObjectBounds} from './direction-art';
import {residentDirectionArt} from './resident-art';
import {restorationPreview} from './restoration-preview';
import type {RestorationVisual} from '../GardenScene';
export const MAP_GRID={tileWidth:96,tileHeight:48};
export interface MapHandle {focus:(point:GardenPoint)=>void;framePlot:(plot:GardenExpansionPlot)=>void;zoom:(factor:number)=>void}
interface Props {world:GardenWorldState;images:Record<string,LoadedArt>;preview:GardenPlacement|null;previewValid:boolean;editable:boolean;onSelect:(id:string)=>void;onPreview:(point:GardenPoint)=>void;onZoom?:(zoom:number)=>void;reducedMotion?:boolean;paint?:boolean;onPaint?:(cells:GardenPoint[])=>void;expansionPreview?:GardenExpansionPlot|null;restoration?:RestorationVisual|null}
interface Hit {id:string;x:number;y:number;width:number;height:number;flipped:boolean;art:LoadedArt}
interface Pointer {x:number;y:number}
const definition=(id:string)=>DECORATIONS.find(item=>item.id===id)!;
function objectView(world:GardenWorldState,images:Record<string,LoadedArt>,placed:GardenPlacement,camera:GardenCamera){
 const owned=world.owned[placed.instanceId]!,item=definition(owned.itemId),view=gardenDirectionArt(images,item.id,owned.variant,placed.rotation);
 return {...view,...gardenObjectBounds(item,placed,view.art,camera,MAP_GRID)};
}
export const WorldMap=forwardRef<MapHandle,Props>(function WorldMap(props,ref){
 const canvas=useRef<HTMLCanvasElement>(null),residents=useRef(new GardenResidents()),measured=useRef({width:0,height:0}),hits=useRef<Hit[]>([]),pointers=useRef(new Map<number,Pointer>()),gesture=useRef<{start:Pointer;camera:GardenCamera;moved:boolean;pinch?:{distance:number;middle:Pointer};drag?:{offset:GardenPoint};paint?:GardenPoint}|null>(null);
 const [size,setSize]=useState({width:0,height:0}),[camera,setCamera]=useState<GardenCamera>({x:0,y:0,zoom:.68});
 const pendingFocus=useRef<GardenPoint|null>(null);
 const live=useRef({props,camera,size});live.current={props,camera,size};
 const focus=(point:GardenPoint)=>{
  const {camera,size}=live.current;if(!size.width||!size.height){pendingFocus.current=point;return;}
  const origin=gardenGridToScreen(point,{x:0,y:0,zoom:camera.zoom},MAP_GRID);
  setCamera({...camera,x:size.width/2-origin.x,y:size.height*.45-origin.y});
 };
 useImperativeHandle(ref,()=>({focus,framePlot:plot=>{
  const {size}=live.current;if(!size.width)return;const zoom=Math.min(.68,(size.width-40)/((plot.width+plot.height)*MAP_GRID.tileWidth/2)),point={x:plot.x+plot.width/2,y:plot.y+plot.height/2},origin=gardenGridToScreen(point,{x:0,y:0,zoom},MAP_GRID);setCamera({zoom,x:size.width/2-origin.x,y:size.height*.37-origin.y});
 },zoom:factor=>{
  const {camera,size,props}=live.current;setCamera(constrainGardenCamera(zoomGardenAt(camera,{x:size.width/2,y:size.height*.45},camera.zoom*factor),gardenBounds(props.world,GARDEN_WORLD,props.expansionPreview),size,80,MAP_GRID));
 }}));
 useLayoutEffect(()=>{
  const el=canvas.current!,observer=new ResizeObserver(()=>{const width=el.clientWidth,height=el.clientHeight,old=measured.current;
   if(old.width===width&&old.height===height)return;
   measured.current={width,height};setSize({width,height});
   setCamera(previous=>{
    if(!old.width){const point=pendingFocus.current||{x:16.5,y:16.5};pendingFocus.current=null;const at=gardenGridToScreen(point,{x:0,y:0,zoom:previous.zoom},MAP_GRID);return {...previous,x:width/2-at.x,y:height*.45-at.y};}
    return {...previous,x:previous.x+(width-old.width)/2,y:previous.y+(height-old.height)*.45};
   });
  });observer.observe(el);return()=>observer.disconnect();
 },[]);
 useEffect(()=>props.onZoom?.(camera.zoom),[camera.zoom,props.onZoom]);
 useEffect(()=>{
  const el=canvas.current!;
  const wheel=(event:WheelEvent)=>{event.preventDefault();const rect=el.getBoundingClientRect(),current=live.current;setCamera(constrainGardenCamera(zoomGardenAt(current.camera,{x:event.clientX-rect.left,y:event.clientY-rect.top},current.camera.zoom*Math.exp(-event.deltaY*.001)),gardenBounds(current.props.world,GARDEN_WORLD,current.props.expansionPreview),current.size,80,MAP_GRID));};
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
 },[]);
 useEffect(()=>{
  const el=canvas.current;if(!el||!size.width)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);el.width=Math.round(size.width*dpr);el.height=Math.round(size.height*dpr);
  const context=el.getContext('2d');if(!context)return;const ctx=context;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size.width,size.height);ctx.imageSmoothingEnabled=true;
  const project=(point:GardenPoint)=>gardenGridToScreen(point,camera,MAP_GRID),tw=MAP_GRID.tileWidth*camera.zoom,th=MAP_GRID.tileHeight*camera.zoom;
  const visible=(x:number,y:number,width:number,height:number)=>x+width>-20&&x<size.width+20&&y+height>-20&&y<size.height+20;
  const construction=restorationPreview(props.world,props.restoration?.taskId);
  const land=gardenLandCells(props.world),mapBounds=gardenBounds(construction?.world??props.world,GARDEN_WORLD,props.expansionPreview),unlocked=(x:number,y:number)=>land.has(x+','+y);
  el.dataset.restoration=JSON.stringify(props.restoration?{...props.restoration,pending:construction?.pending??false,placement:construction?.placement??null}:null);
  el.dataset.unlockedCells=String(land.size);el.dataset.expansions=JSON.stringify(props.world.expansions??[]);el.dataset.expansionPreview=JSON.stringify(props.expansionPreview??null);
  for(let sum=0;sum<mapBounds.width+mapBounds.height;sum++)for(let y=0;y<mapBounds.height;y++){
   const x=sum-y;if(x<0||x>=mapBounds.width)continue;const at=project({x:x+.5,y:y+.5});if(!visible(at.x-tw/2,at.y-th/2,tw,th))continue;
   ctx.globalAlpha=unlocked(x,y)?1:.25;ctx.drawImage(props.images.ground!.image,at.x-tw*.525,at.y-th*.525,tw*1.05,th*1.05);
  }
  ctx.globalAlpha=1;
  const objects=Object.values(props.world.placements).filter(p=>p.instanceId!==props.preview?.instanceId);
  function drawGround(placed:GardenPlacement,alpha=1,world=props.world){
   const item=definition(world.owned[placed.instanceId]!.itemId),at=project({x:placed.x+.5,y:placed.y+.5});if(!visible(at.x-tw/2,at.y-th/2,tw,th))return;
   ctx.save();ctx.globalAlpha=alpha;ctx.translate(at.x,at.y);
   if(placed.rotation===90)ctx.transform(0,.5,-2,0,0,0);else if(placed.rotation===180)ctx.scale(-1,-1);else if(placed.rotation===270)ctx.transform(0,-.5,2,0,0,0);
   ctx.drawImage(props.images[item.id]!.image,-tw*.504,-th*.504,tw*1.008,th*1.008);ctx.restore();
  }
  for(const placed of objects){
   const owned=props.world.owned[placed.instanceId]!,item=definition(owned.itemId);if(item.layer!=='ground')continue;
   drawGround(placed);
  }
  function diamond(x:number,y:number,fill:string,stroke:string){const at=project({x,y});ctx.beginPath();ctx.moveTo(at.x,at.y);ctx.lineTo(at.x+tw/2,at.y+th/2);ctx.lineTo(at.x,at.y+th);ctx.lineTo(at.x-tw/2,at.y+th/2);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  if(props.expansionPreview)for(const cell of gardenPlotCells(props.expansionPreview))diamond(cell.x,cell.y,unlocked(cell.x,cell.y)?'rgba(114,223,137,.30)':'rgba(255,208,76,.38)','#fff0a4');
  if(props.preview||props.paint){
   for(let y=0;y<mapBounds.height;y++)for(let x=0;x<mapBounds.width;x++){const at=project({x,y});if(unlocked(x,y)&&visible(at.x-tw/2,at.y,tw,th))diamond(x,y,'transparent','rgba(255,255,234,.24)');}
   if(props.preview){const owned=props.world.owned[props.preview.instanceId]!,item=definition(owned.itemId);
    for(const cell of placementCells(item,props.preview))diamond(cell.x,cell.y,props.previewValid?'rgba(76,208,108,.48)':'rgba(244,66,72,.55)',props.previewValid?'#e9ffc7':'#ffe1d7');}
  }
  const sorted=objects.filter(p=>definition(props.world.owned[p.instanceId]!.itemId).layer==='object');
  sorted.sort((a,b)=>{const af=decorationFootprint(definition(props.world.owned[a.instanceId]!.itemId),a.rotation),bf=decorationFootprint(definition(props.world.owned[b.instanceId]!.itemId),b.rotation);return (a.x+a.y+af.width+af.height)-(b.x+b.y+bf.width+bf.height)||a.x-b.x;});
  let nextHits:Hit[]=[];
  function drawObject(placed:GardenPlacement,ghost=false,world=props.world){
   const {art,x,y,width,height,flipped}=objectView(world,props.images,placed,camera);
   if(!visible(x,y,width,height))return;ctx.save();ctx.globalAlpha=ghost?.64:1;
   if(flipped){ctx.translate(x+width,y);ctx.scale(-1,1);ctx.drawImage(art.image,0,0,width,height);}else ctx.drawImage(art.image,x,y,width,height);
   ctx.restore();if(!ghost)nextHits.push({id:placed.instanceId,x,y,width,height,flipped,art});
  }
  // Cache the terrain once; only residents and depth-sorted objects redraw during a walk.
  const terrain=document.createElement('canvas');terrain.width=el.width;terrain.height=el.height;terrain.getContext('2d')!.drawImage(el,0,0);
  residents.current.sync(props.world);
  function drawResident(actor:GardenResident){
   const {art,flipped}=residentDirectionArt(props.images,actor);
   const bottom=project({x:actor.x+1,y:actor.y+1}),width=tw*(actor.animal?1.02:.91)*art.width/Math.max(art.width,art.height),height=width*art.height/art.width;
   const bob=actor.pose==='sleep'?Math.sin(residents.current.time*2)*th*.012:0;
   const x=bottom.x-width/2,y=bottom.y-height*.98+bob;if(!visible(x,y,width,height))return;
   ctx.save();if(flipped){ctx.translate(x+width,y);ctx.scale(-1,1);ctx.drawImage(art.image,0,0,width,height);}else ctx.drawImage(art.image,x,y,width,height);ctx.restore();
   if(actor.animal)nextHits.push({id:actor.id,x,y,width,height,flipped,art});
  }
  let animation=0,last=performance.now(),lastDraw=0,lastDebug=0;
  const render=(now:number)=>{
   animation=requestAnimationFrame(render);if(now-lastDraw<33)return;
   if(document.hidden){last=now;return;}if((props.editable&&!props.restoration||props.reducedMotion)&&lastDraw)return;
   const delta=(now-last)/1000;last=now;lastDraw=now;
   residents.current.step(delta,props.editable||props.reducedMotion||document.hidden);
   ctx.clearRect(0,0,size.width,size.height);ctx.drawImage(terrain,0,0,size.width,size.height);nextHits=[];
   const scene:Array<{depth:number;draw:()=>void}>=sorted.filter(p=>props.editable||definition(props.world.owned[p.instanceId]!.itemId).category!=='animal').map(placed=>{const foot=decorationFootprint(definition(props.world.owned[placed.instanceId]!.itemId),placed.rotation);return {depth:placed.x+placed.y+foot.width+foot.height,draw:()=>drawObject(placed)};});
   if(construction?.pending){const {placement,world}=construction,item=definition(world.owned[placement.instanceId]!.itemId),foot=decorationFootprint(item,placement.rotation);scene.push({depth:placement.x+placement.y+foot.width+foot.height,draw:()=>item.layer==='ground'?drawGround(placement,.64,world):drawObject(placement,true,world)});}
   for(const actor of residents.current.actors)if(!props.editable||!actor.animal)scene.push({depth:actor.x+actor.y+2,draw:()=>drawResident(actor)});
   scene.sort((a,b)=>a.depth-b.depth);scene.forEach(item=>item.draw());
   if(construction&&props.restoration){const placed=construction.placement,item=definition(construction.world.owned[placed.instanceId]!.itemId),foot=decorationFootprint(item,placed.rotation),at=project({x:placed.x+foot.width/2,y:placed.y+foot.height/2});
    if(props.restoration.phase==='building'){const icon=props.images['restoration-hammer'];if(icon){ctx.save();ctx.translate(at.x,at.y-th*1.1);ctx.rotate(props.reducedMotion?0:Math.sin(now*.008)*.26);ctx.drawImage(icon.image,-tw*.38,-tw*.65,tw*.76,tw*.76);ctx.restore();}}
   }
   if(props.preview){const item=definition(props.world.owned[props.preview.instanceId]!.itemId);if(item.layer==='ground')drawGround(props.preview,.7);else drawObject(props.preview,true);}
   hits.current=nextHits;
   if(!lastDebug||now-lastDebug>500){lastDebug=now;el.dataset.residents=JSON.stringify(residents.current.actors.map(actor=>{const {id,art,x,y,pose,frame,rear,placementRotation,walkDistance,facing}=actor,{assetId,direction}=residentDirectionArt(props.images,actor);return {id,art,x,y,pose,frame,rear,facing,placementRotation,walkDistance,assetId,direction};}));el.dataset.camera=JSON.stringify(camera);
    const describe=(placed:GardenPlacement)=>{const item=definition(props.world.owned[placed.instanceId]!.itemId),foot=decorationFootprint(item,placed.rotation);if(item.layer==='ground')return {...placed,foot,assetId:item.id};const {assetId,flipped,x,y,width,height}=objectView(props.world,props.images,placed,camera);return {...placed,foot,assetId,flipped,bounds:{x,y,width,height}};};
    el.dataset.placementDirections=JSON.stringify(objects.map(describe));el.dataset.previewPlacement=JSON.stringify(props.preview?describe(props.preview):null);
   }
  };render(last);
  return()=>cancelAnimationFrame(animation);
 },[camera,size,props.world,props.images,props.preview,props.previewValid,props.editable,props.reducedMotion,props.paint,props.expansionPreview,props.restoration]);
 function point(event:React.PointerEvent<HTMLCanvasElement>):Pointer {const rect=event.currentTarget.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
 function down(event:React.PointerEvent<HTMLCanvasElement>){
  event.preventDefault();event.currentTarget.focus({preventScroll:true});const at=point(event);pointers.current.set(event.pointerId,at);event.currentTarget.setPointerCapture(event.pointerId);
  if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];gesture.current={start:at,camera:live.current.camera,moved:true,pinch:{distance:Math.max(1,Math.hypot(a!.x-b!.x,a!.y-b!.y)),middle:{x:(a!.x+b!.x)/2,y:(a!.y+b!.y)/2}}};return;}
  const current=live.current;const cell=gardenScreenToCell(at,current.camera,MAP_GRID),preview=current.props.preview;
  if(current.props.paint&&current.props.editable){gesture.current={start:at,camera:current.camera,moved:true,paint:cell};current.props.onPaint?.([cell]);return;}
  let drag:undefined|{offset:GardenPoint};
  if(preview&&current.props.editable){
   const item=definition(current.props.world.owned[preview.instanceId]!.itemId),foot=decorationFootprint(item,preview.rotation),view=item.layer==='ground'?{art:current.props.images[item.id]!,flipped:false,...gardenObjectBounds(item,preview,current.props.images[item.id]!,current.camera,MAP_GRID)}:objectView(current.props.world,current.props.images,preview,current.camera),{art,width,height,flipped,x:left,y:top}=view;
   let touchesImage=false;
   if(at.x>=left&&at.x<left+width&&at.y>=top&&at.y<top+height){let x=Math.floor((at.x-left)/width*art.width);const y=Math.floor((at.y-top)/height*art.height);if(flipped)x=art.width-1-x;touchesImage=art.alpha[(y*art.width+x)*4+3]!>32;}
   if(touchesImage||(cell.x>=preview.x&&cell.y>=preview.y&&cell.x<preview.x+foot.width&&cell.y<preview.y+foot.height))drag={offset:{x:cell.x-preview.x,y:cell.y-preview.y}};
  }
  gesture.current={start:at,camera:current.camera,moved:false,drag};
 }
 function move(event:React.PointerEvent<HTMLCanvasElement>){
  if(!pointers.current.has(event.pointerId))return;const at=point(event);pointers.current.set(event.pointerId,at);const g=gesture.current;if(!g)return;
  if(pointers.current.size>=2&&g.pinch){const [a,b]=[...pointers.current.values()],middle={x:(a!.x+b!.x)/2,y:(a!.y+b!.y)/2};const zoomed=zoomGardenAt(g.camera,g.pinch.middle,g.camera.zoom*Math.hypot(a!.x-b!.x,a!.y-b!.y)/g.pinch.distance);setCamera(constrainGardenCamera({...zoomed,x:zoomed.x+middle.x-g.pinch.middle.x,y:zoomed.y+middle.y-g.pinch.middle.y},gardenBounds(live.current.props.world,GARDEN_WORLD,live.current.props.expansionPreview),live.current.size,80,MAP_GRID));return;}
  if(g.paint){if(!live.current.props.editable||!live.current.props.paint)return;const cell=gardenScreenToCell(at,live.current.camera,MAP_GRID);live.current.props.onPaint?.(gardenBrushLine(g.paint,cell));g.paint=cell;return;}
  const dx=at.x-g.start.x,dy=at.y-g.start.y;if(Math.hypot(dx,dy)>7)g.moved=true;if(!g.moved)return;
  if(g.drag){const cell=gardenScreenToCell(at,live.current.camera,MAP_GRID);live.current.props.onPreview({x:cell.x-g.drag.offset.x,y:cell.y-g.drag.offset.y});}
  else setCamera(constrainGardenCamera({...g.camera,x:g.camera.x+dx,y:g.camera.y+dy},gardenBounds(live.current.props.world,GARDEN_WORLD,live.current.props.expansionPreview),live.current.size,80,MAP_GRID));
 }
 function end(event:React.PointerEvent<HTMLCanvasElement>,cancel=false){
  const at=point(event),g=gesture.current;const existed=pointers.current.delete(event.pointerId);if(!existed)return;
  if(pointers.current.size){const remaining=[...pointers.current.values()][0]!;gesture.current={start:remaining,camera:live.current.camera,moved:true};return;}
  gesture.current=null;if(cancel||!g||g.moved)return;
  if(live.current.props.expansionPreview)return;
  if(live.current.props.preview){if(!g.drag)live.current.props.onPreview(gardenScreenToCell(at,live.current.camera,MAP_GRID));return;}
  for(const hit of [...hits.current].reverse()){
   if(at.x<hit.x||at.y<hit.y||at.x>=hit.x+hit.width||at.y>=hit.y+hit.height)continue;
   let x=Math.min(hit.art.width-1,Math.floor((at.x-hit.x)/hit.width*hit.art.width));const y=Math.min(hit.art.height-1,Math.floor((at.y-hit.y)/hit.height*hit.art.height));if(hit.flipped)x=hit.art.width-1-x;
   if(hit.art.alpha[(y*hit.art.width+x)*4+3]!>32){live.current.props.onSelect(hit.id);return;}
  }
  const cell=gardenScreenToCell(at,live.current.camera,MAP_GRID),ground=Object.values(live.current.props.world.placements).find(placed=>placed.x===cell.x&&placed.y===cell.y&&definition(live.current.props.world.owned[placed.instanceId]!.itemId).layer==='ground');
  if(ground)live.current.props.onSelect(ground.instanceId);
 }
 return <canvas ref={canvas} className="gw-map" role="application" aria-label="정원 지도" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>{if(pointers.current.has(event.pointerId))end(event,true);}} onKeyDown={event=>{
  const delta:Record<string,GardenPoint>={ArrowLeft:{x:48,y:0},ArrowRight:{x:-48,y:0},ArrowUp:{x:0,y:48},ArrowDown:{x:0,y:-48}};
  if(delta[event.key]){event.preventDefault();const d=delta[event.key]!;setCamera(constrainGardenCamera({...live.current.camera,x:live.current.camera.x+d.x,y:live.current.camera.y+d.y},gardenBounds(live.current.props.world,GARDEN_WORLD,live.current.props.expansionPreview),live.current.size,80,MAP_GRID));}
 }}/>
});

import {tr} from '../i18n';
import {forwardRef,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from 'react';
import {DECORATIONS,GARDEN_WORLD,gardenBounds,gardenLandCells,gardenPlotCells,decorationFootprint,gardenGridToScreen,gardenScreenToCell,zoomGardenAt,fitGardenView,constrainGardenCamera,placementCells,type GardenCamera,type GardenExpansionPlot,type GardenPlacement,type GardenPoint,type GardenWorldState,type GridRect} from '../../../../packages/garden-world/src';
import type {LoadedArt} from './assets';
import {GardenResidents,type GardenResident} from './residents';
import {gardenBrushLine} from './paint';
import {gardenDirectionArt,gardenObjectBounds} from './direction-art';
import {placedAnimalArt,residentArtBounds,residentDirectionArt} from './resident-art';
import {restorationPreview} from './restoration-preview';
import {gardenObjectOccludes} from './depth';
import type {RestorationVisual} from '../GardenScene';
export const MAP_GRID={tileWidth:96,tileHeight:48};
export interface MapHandle {focus:(point:GardenPoint)=>void;framePlot:(plot:GardenExpansionPlot)=>void;zoom:(factor:number)=>void;overview:()=>void}
interface Props {overviewInsets?:{top:number;bottom:number;left?:number;right?:number};world:GardenWorldState;images:Record<string,LoadedArt>;preview:GardenPlacement|null;previewValid:boolean;editable:boolean;onSelect:(id:string)=>void;onPreview:(point:GardenPoint)=>void;onZoom?:(zoom:number)=>void;reducedMotion?:boolean;paint?:boolean;onPaint?:(cells:GardenPoint[])=>void;expansionPreview?:GardenExpansionPlot|null;expansionValid?:boolean;expansionOptions?:GardenExpansionPlot[];onExpansionPreview?:(point:GardenPoint)=>void;restoration?:RestorationVisual|null}
interface Sprite {x:number;y:number;width:number;height:number;flipped:boolean;art:LoadedArt}
interface ObjectSprite extends Sprite {id:string;footprint:GridRect;opacity:number}
interface ResidentSprite extends Sprite {id?:string;feet:GardenPoint}
interface Hit extends Sprite {id:string;occluders?:readonly ObjectSprite[]}
interface Pointer {x:number;y:number}
const definition=(id:string)=>DECORATIONS.find(item=>item.id===id)!;
function objectView(world:GardenWorldState,images:Record<string,LoadedArt>,placed:GardenPlacement,camera:GardenCamera){
 const owned=world.owned[placed.instanceId]!,item=definition(owned.itemId);
 if(item.category==='animal'){
  const view=placedAnimalArt(images,item.id,placed.rotation),foot=decorationFootprint(item,placed.rotation);
  const bottom=gardenGridToScreen({x:placed.x+foot.width,y:placed.y+foot.height},camera,MAP_GRID);
  return {...view,foot,...residentArtBounds(view.art,bottom,MAP_GRID.tileWidth*camera.zoom,true)};
 }
 const view=gardenDirectionArt(images,item.id,owned.variant,placed.rotation);
 return {...view,...gardenObjectBounds(item,placed,view.art,camera,MAP_GRID)};
}
function paintSprite(ctx:CanvasRenderingContext2D,sprite:Sprite,opacity=1){
 const {art,x,y,width,height,flipped}=sprite;
 ctx.save();
 ctx.globalAlpha=opacity;
 if(flipped){ctx.translate(x+width,y);ctx.scale(-1,1);ctx.drawImage(art.image,0,0,width,height);}
 else ctx.drawImage(art.image,x,y,width,height);
 ctx.restore();
}
function spritesOverlap(a:Sprite,b:Sprite){
 return a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
}
function spriteContains(sprite:Sprite,point:Pointer){
 const {x,y,width,height,art,flipped}=sprite;
 if(point.x<x||point.y<y||point.x>=x+width||point.y>=y+height)return false;
 const column=Math.min(art.width-1,Math.floor((point.x-x)/width*art.width));
 const row=Math.min(art.height-1,Math.floor((point.y-y)/height*art.height));
 return art.alpha[(row*art.width+(flipped?art.width-1-column:column))*4+3]!>32;
}
export const WorldMap=forwardRef<MapHandle,Props>(function WorldMap(props,ref){
 const canvas=useRef<HTMLCanvasElement>(null),residents=useRef(new GardenResidents()),measured=useRef({width:0,height:0}),hits=useRef<Hit[]>([]),pointers=useRef(new Map<number,Pointer>()),gesture=useRef<{start:Pointer;camera:GardenCamera;moved:boolean;pinch?:{distance:number;middle:Pointer};drag?:{offset:GardenPoint};expansion?:{offset:GardenPoint};paint?:GardenPoint}|null>(null);
 const [size,setSize]=useState({width:0,height:0}),[camera,setCamera]=useState<GardenCamera>({x:0,y:0,zoom:.68});
 const pendingFocus=useRef<GardenPoint|null>(null),pendingOverview=useRef(false);
 const live=useRef({props,camera,size});live.current={props,camera,size};
 const focus=(point:GardenPoint)=>{
  const {camera,size}=live.current;if(!size.width||!size.height){pendingFocus.current=point;return;}
  const origin=gardenGridToScreen(point,{x:0,y:0,zoom:camera.zoom},MAP_GRID);
  setCamera({...camera,x:size.width/2-origin.x,y:size.height*.45-origin.y});
 };
 const overview=()=>{
  const {props,size}=live.current;if(!size.width||!size.height){pendingOverview.current=true;return;}pendingOverview.current=false;
  const land=[...gardenLandCells(props.world).values()];if(!land.length)return;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const include=(x:number,y:number)=>{left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)};
  for(const cell of land)for(const [dx,dy]of [[0,0],[1,0],[0,1],[1,1]]){const at=gardenGridToScreen({x:cell.x+dx!,y:cell.y+dy!},{x:0,y:0,zoom:1},MAP_GRID);include(at.x,at.y);}
  for(const placed of Object.values(props.world.placements)){const item=definition(props.world.owned[placed.instanceId]!.itemId);if(item.layer==='ground')continue;const box=objectView(props.world,props.images,placed,{x:0,y:0,zoom:1});include(box.x,box.y);include(box.x+box.width,box.y+box.height);}
  const upper=props.overviewInsets?.top??(props.editable?145:115),lower=props.overviewInsets?.bottom??(props.editable?size.height*.48:190),insetLeft=props.overviewInsets?.left??18,insetRight=props.overviewInsets?.right??18;
  setCamera(fitGardenView({left,top,right,bottom},{left:insetLeft,top:upper,width:Math.max(1,size.width-insetLeft-insetRight),height:Math.max(80,size.height-upper-lower)}));
 };
 useEffect(()=>{if(pendingOverview.current&&size.width&&size.height)overview()},[size.width,size.height]);
 useImperativeHandle(ref,()=>({focus,overview,framePlot:plot=>{
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
  el.dataset.unlockedCells=String(land.size);el.dataset.expansions=JSON.stringify(props.world.expansions??[]);el.dataset.expansionPreview=JSON.stringify(props.expansionPreview??null);el.dataset.expansionValid=String(props.expansionValid!==false);
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
  if(construction?.pending&&definition(construction.world.owned[construction.placement.instanceId]!.itemId).layer==='ground'){
   drawGround(construction.placement,.64,construction.world);
  }
  function diamond(x:number,y:number,fill:string,stroke:string){const at=project({x,y});ctx.beginPath();ctx.moveTo(at.x,at.y);ctx.lineTo(at.x+tw/2,at.y+th/2);ctx.lineTo(at.x,at.y+th);ctx.lineTo(at.x-tw/2,at.y+th/2);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  // Show the available boundary, rather than offering a fixed list of eight positions.
  if(props.expansionOptions){
   const available=new Map<string,GardenPoint>();for(const plot of props.expansionOptions)for(const cell of gardenPlotCells(plot))available.set(cell.x+','+cell.y,cell);
   for(const cell of available.values()){const at=project(cell);if(visible(at.x-tw/2,at.y,tw,th))diamond(cell.x,cell.y,'rgba(99,202,255,.13)','rgba(204,243,255,.35)');}
  }
  if(props.expansionPreview){
   const plot=props.expansionPreview,valid=props.expansionValid!==false,owned=gardenPlotCells(plot).every(cell=>unlocked(cell.x,cell.y));
   for(const cell of gardenPlotCells(plot))diamond(cell.x,cell.y,valid?(owned?'rgba(84,219,121,.4)':'rgba(255,208,76,.45)'):'rgba(240,68,64,.43)',valid?'#fff0a4':'#ffd2cb');
   const corners=[{x:plot.x,y:plot.y},{x:plot.x+plot.width,y:plot.y},{x:plot.x+plot.width,y:plot.y+plot.height},{x:plot.x,y:plot.y+plot.height}].map(project);
   ctx.beginPath();corners.forEach((at,i)=>i?ctx.lineTo(at.x,at.y):ctx.moveTo(at.x,at.y));ctx.closePath();ctx.strokeStyle=valid?(owned?'#a9ffb6':'#ffe261'):'#ff5e59';ctx.lineWidth=3;ctx.stroke();
  }
  if(props.preview||props.paint){
   for(let y=0;y<mapBounds.height;y++)for(let x=0;x<mapBounds.width;x++){const at=project({x,y});if(unlocked(x,y)&&visible(at.x-tw/2,at.y,tw,th))diamond(x,y,'transparent','rgba(255,255,234,.24)');}
   if(props.preview){const owned=props.world.owned[props.preview.instanceId]!,item=definition(owned.itemId);
    for(const cell of placementCells(item,props.preview))diamond(cell.x,cell.y,props.previewValid?'rgba(76,208,108,.48)':'rgba(244,66,72,.55)',props.previewValid?'#e9ffc7':'#ffe1d7');}
  }
  const buildings:ObjectSprite[]=[],placedAnimals:ResidentSprite[]=[];
  function stageObject(placed:GardenPlacement,world=props.world,opacity=1){
   const item=definition(world.owned[placed.instanceId]!.itemId);
   if(item.layer!=='object'||item.category==='animal'&&!props.editable)return;
   const sprite=objectView(world,props.images,placed,camera);
   if(!visible(sprite.x,sprite.y,sprite.width,sprite.height))return;
   const id=placed.instanceId;
   if(item.category==='animal'){
    placedAnimals.push({...sprite,id,feet:{x:placed.x+sprite.foot.width,y:placed.y+sprite.foot.height}});
   }else{
    buildings.push({...sprite,id,opacity,footprint:{x:placed.x,y:placed.y,...sprite.foot}});
   }
  }
  for(const placed of objects)stageObject(placed);
  if(construction?.pending)stageObject(construction.placement,construction.world,.64);
  buildings.sort((a,b)=>{
   const p=a.footprint,q=b.footprint;
   return (p.x+p.y+p.width+p.height)-(q.x+q.y+q.width+q.height)||p.x-q.x;
  });
  for(const building of buildings)paintSprite(ctx,building,building.opacity);
  const buildingHits=buildings.filter(building=>building.opacity===1);
  // Cache the stationary scene while residents move in front of and behind it.
  const backdrop=document.createElement('canvas');backdrop.width=el.width;backdrop.height=el.height;backdrop.getContext('2d')!.drawImage(el,0,0);
  const residentLayer=document.createElement('canvas');
  const residentContext=residentLayer.getContext('2d')!;
  residents.current.sync(props.world);
  function walkingSprite(actor:GardenResident):ResidentSprite{
   const {art,flipped}=residentDirectionArt(props.images,actor);
   const feet={x:actor.x+1,y:actor.y+1};
   const bounds=residentArtBounds(art,project(feet),tw,actor.animal);
   const bob=actor.pose==='sleep'?Math.sin(residents.current.time*2)*th*.012:actor.pose==='walk'&&art===props.images[actor.art]?-Math.abs(Math.sin(actor.walkDistance*8))*th*.045:0;
   return {id:actor.animal?actor.id:undefined,feet,art,flipped,...bounds,y:bounds.y+bob};
  }
  function drawResident(sprite:ResidentSprite,nextHits:Hit[]){
   const occluders=buildings.filter(building=>spritesOverlap(sprite,building)&&gardenObjectOccludes(sprite.feet,building.footprint));
   if(!occluders.length){
    paintSprite(ctx,sprite);
   }else{
    // Mask only the overlapping pixels of the foreground artwork, preserving transparent gaps.
    const left=Math.floor(sprite.x*dpr),top=Math.floor(sprite.y*dpr);
    const width=Math.ceil((sprite.x+sprite.width)*dpr)-left,height=Math.ceil((sprite.y+sprite.height)*dpr)-top;
    if(residentLayer.width<width)residentLayer.width=width;
    if(residentLayer.height<height)residentLayer.height=height;
    residentContext.setTransform(1,0,0,1,0,0);
    residentContext.clearRect(0,0,width,height);
    residentContext.setTransform(dpr,0,0,dpr,-left,-top);
    paintSprite(residentContext,sprite);
    residentContext.globalCompositeOperation='destination-out';
    for(const building of occluders)paintSprite(residentContext,building,building.opacity);
    residentContext.globalCompositeOperation='source-over';
    ctx.drawImage(residentLayer,0,0,width,height,left/dpr,top/dpr,width/dpr,height/dpr);
   }
   if(sprite.id)nextHits.push({...sprite,id:sprite.id,occluders:occluders.filter(building=>building.opacity===1)});
  }
  let animation=0,last=performance.now(),lastDraw=0,lastDebug=0;
  const render=(now:number)=>{
   animation=requestAnimationFrame(render);if(now-lastDraw<33)return;
   if(document.hidden||el.closest('[inert]')){last=now;return;}if((props.editable&&!props.restoration||props.reducedMotion)&&lastDraw)return;
   const delta=(now-last)/1000;last=now;lastDraw=now;
   residents.current.step(delta,props.editable||props.reducedMotion||document.hidden);
   ctx.clearRect(0,0,size.width,size.height);ctx.drawImage(backdrop,0,0,size.width,size.height);
   const nextHits:Hit[]=[...buildingHits],actors=[...placedAnimals];
   for(const actor of residents.current.actors){
    if(props.editable&&actor.animal)continue;
    const sprite=walkingSprite(actor);
    if(visible(sprite.x,sprite.y,sprite.width,sprite.height))actors.push(sprite);
   }
   actors.sort((a,b)=>(a.feet.x+a.feet.y)-(b.feet.x+b.feet.y));
   for(const actor of actors)drawResident(actor,nextHits);
   if(construction&&props.restoration){const placed=construction.placement,item=definition(construction.world.owned[placed.instanceId]!.itemId),foot=decorationFootprint(item,placed.rotation),at=project({x:placed.x+foot.width/2,y:placed.y+foot.height/2});
    if(props.restoration.phase==='building'){const icon=props.images['restoration-hammer'];if(icon){ctx.save();ctx.translate(at.x,at.y-th*1.1);ctx.rotate(props.reducedMotion?0:Math.sin(now*.008)*.26);ctx.drawImage(icon.image,-tw*.38,-tw*.65,tw*.76,tw*.76);ctx.restore();}}
   }
   if(props.preview){
    const item=definition(props.world.owned[props.preview.instanceId]!.itemId);
    if(item.layer==='ground')drawGround(props.preview,.7);
    else {
     const sprite=objectView(props.world,props.images,props.preview,camera);
     if(visible(sprite.x,sprite.y,sprite.width,sprite.height))paintSprite(ctx,sprite,.64);
    }
   }
   hits.current=nextHits;
   if(!lastDebug||now-lastDebug>500){lastDebug=now;el.dataset.residents=JSON.stringify(residents.current.actors.map(actor=>{const {id,art,x,y,pose,frame,rear,placementRotation,walkDistance,facing}=actor,{assetId,direction}=residentDirectionArt(props.images,actor);return {id,art,x,y,pose,frame,rear,facing,placementRotation,walkDistance,assetId,direction};}));el.dataset.camera=JSON.stringify(camera);
    const describe=(placed:GardenPlacement)=>{const item=definition(props.world.owned[placed.instanceId]!.itemId),foot=decorationFootprint(item,placed.rotation);if(item.layer==='ground')return {...placed,foot,assetId:item.id};const {assetId,flipped,x,y,width,height}=objectView(props.world,props.images,placed,camera);return {...placed,foot,assetId,flipped,bounds:{x,y,width,height}};};
    el.dataset.placementDirections=JSON.stringify(objects.map(describe));el.dataset.previewPlacement=JSON.stringify(props.preview?describe(props.preview):null);
   }
  };render(last);
  return()=>cancelAnimationFrame(animation);
 },[camera,size,props.world,props.images,props.preview,props.previewValid,props.editable,props.reducedMotion,props.paint,props.expansionPreview,props.expansionValid,props.expansionOptions,props.restoration]);
 function point(event:React.PointerEvent<HTMLCanvasElement>):Pointer {const rect=event.currentTarget.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
 function down(event:React.PointerEvent<HTMLCanvasElement>){
  event.preventDefault();event.currentTarget.focus({preventScroll:true});const at=point(event);pointers.current.set(event.pointerId,at);event.currentTarget.setPointerCapture(event.pointerId);
  if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];gesture.current={start:at,camera:live.current.camera,moved:true,pinch:{distance:Math.max(1,Math.hypot(a!.x-b!.x,a!.y-b!.y)),middle:{x:(a!.x+b!.x)/2,y:(a!.y+b!.y)/2}}};return;}
  const current=live.current;const cell=gardenScreenToCell(at,current.camera,MAP_GRID),preview=current.props.preview;
  if(current.props.onExpansionPreview&&current.props.editable){
   const plot=current.props.expansionPreview,inside=plot&&cell.x>=plot.x&&cell.x<plot.x+plot.width&&cell.y>=plot.y&&cell.y<plot.y+plot.height;
   gesture.current={start:at,camera:current.camera,moved:false,expansion:{offset:inside?{x:cell.x-plot.x,y:cell.y-plot.y}:{x:2,y:1}}};return;
  }
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
  if(g.expansion){const cell=gardenScreenToCell(at,live.current.camera,MAP_GRID);live.current.props.onExpansionPreview?.({x:cell.x-g.expansion.offset.x,y:cell.y-g.expansion.offset.y});return;}
  if(g.drag){const cell=gardenScreenToCell(at,live.current.camera,MAP_GRID);live.current.props.onPreview({x:cell.x-g.drag.offset.x,y:cell.y-g.drag.offset.y});}
  else setCamera(constrainGardenCamera({...g.camera,x:g.camera.x+dx,y:g.camera.y+dy},gardenBounds(live.current.props.world,GARDEN_WORLD,live.current.props.expansionPreview),live.current.size,80,MAP_GRID));
 }
 function end(event:React.PointerEvent<HTMLCanvasElement>,cancel=false){
  const at=point(event),g=gesture.current;const existed=pointers.current.delete(event.pointerId);if(!existed)return;
  if(pointers.current.size){const remaining=[...pointers.current.values()][0]!;gesture.current={start:remaining,camera:live.current.camera,moved:true};return;}
  gesture.current=null;if(cancel||!g)return;
  if(g.expansion){const cell=gardenScreenToCell(at,live.current.camera,MAP_GRID);live.current.props.onExpansionPreview?.({x:cell.x-g.expansion.offset.x,y:cell.y-g.expansion.offset.y});return;}
  if(g.moved)return;
  if(live.current.props.expansionPreview)return;
  if(live.current.props.preview){if(!g.drag)live.current.props.onPreview(gardenScreenToCell(at,live.current.camera,MAP_GRID));return;}
  for(const hit of [...hits.current].reverse()){
   if(spriteContains(hit,at)&&!hit.occluders?.some(building=>spriteContains(building,at))){live.current.props.onSelect(hit.id);return;}
  }
  const cell=gardenScreenToCell(at,live.current.camera,MAP_GRID),ground=Object.values(live.current.props.world.placements).find(placed=>placed.x===cell.x&&placed.y===cell.y&&definition(live.current.props.world.owned[placed.instanceId]!.itemId).layer==='ground');
  if(ground)live.current.props.onSelect(ground.instanceId);
 }
 return <canvas ref={canvas} className="gw-map" role="application" aria-label={tr('정원 지도')} tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>{if(pointers.current.has(event.pointerId))end(event,true);}} onKeyDown={event=>{
  const delta:Record<string,GardenPoint>={ArrowLeft:{x:48,y:0},ArrowRight:{x:-48,y:0},ArrowUp:{x:0,y:48},ArrowDown:{x:0,y:-48}};
  if(delta[event.key]){event.preventDefault();const d=delta[event.key]!;setCamera(constrainGardenCamera({...live.current.camera,x:live.current.camera.x+d.x,y:live.current.camera.y+d.y},gardenBounds(live.current.props.world,GARDEN_WORLD,live.current.props.expansionPreview),live.current.size,80,MAP_GRID));}
 }}/>
});

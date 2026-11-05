import {frameScale,frameBleed,frameIsVisible} from './frame-layout';
import {art,assetInfo} from './assets';

/** Keep the older Android text-outline compatibility decision independent of
 * the native PNG frame renderer shared by every platform. */
export function needsRasterCompatibility(){
 const ua=navigator.userAgent,chromium=Number(/(?:Chrome|Chromium)\/(\d+)/.exec(ua)?.[1]||0);
 return /Android/i.test(ua)&&chromium>0&&chromium<140;
}
export function mountRasterSurface(host:HTMLDivElement,scene?:'home'|'play'|'greenhouse'|'terrace'|'pages_v9'){
 const root=host.parentElement!;
 const frames=new Map<HTMLElement,{face:HTMLDivElement;position:string;isolation:string}>();
 let request=0,disposed=false;
 host.dataset.renderer='native-frames';
 if(scene){const background=document.createElement('img');background.src=art(`bg_${scene}`);background.alt='';background.draggable=false;Object.assign(background.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover'});host.appendChild(background);}
 const schedule=()=>{if(!disposed&&!request)request=requestAnimationFrame(draw);};
 const observer=new MutationObserver(records=>{
  // Face style updates are renderer output, not new layout input.
  if(records.some(record=>!(record.target instanceof Element)||!record.target.closest('[data-local-frame]')))schedule();
 });
 const resize=new ResizeObserver(schedule);
 function remove(el:HTMLElement){const entry=frames.get(el);if(!entry)return;entry.face.remove();resize.unobserve(el);el.style.position=entry.position;el.style.isolation=entry.isolation;frames.delete(el);}
 function draw(){
  request=0;if(disposed)return;
  const active=new Set<HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-frame]').forEach(el=>{
   if(el.closest('[data-art-root]')!==root||!frameIsVisible(el,root))return;
   const r=el.getBoundingClientRect();if(!r.width||!r.height)return;active.add(el);
   let entry=frames.get(el);
   if(!entry){const face=document.createElement('div');face.dataset.localFrame='';face.setAttribute('aria-hidden','true');entry={face,position:el.style.position,isolation:el.style.isolation};frames.set(el,entry);if(getComputedStyle(el).position==='static')el.style.position='relative';el.style.isolation='isolate';el.insertBefore(face,el.firstChild);resize.observe(el);}
   if(entry.face.parentElement!==el)el.insertBefore(entry.face,el.firstChild);
   const id=el.dataset.frame!,inset=assetInfo(id)?.sliceInsets||{left:24,right:24,top:24,bottom:24};
   const requested=frameScale(id,r.height,el.dataset.frameScale),scale=Math.min(requested,r.width/(inset.left+inset.right),r.height/(inset.top+inset.bottom));
   // CSS nine-slices the original image. The face is attached to the control;
   // no scroll offsets or delayed JS position tracking are involved.
   Object.assign(entry.face.style,{position:'absolute',boxSizing:'border-box',pointerEvents:'none',zIndex:'-1',left:'0',top:'0',width:'100%',height:`calc(100% + ${frameBleed(el.dataset.frameBleed)}px)`,borderStyle:'solid',borderColor:'transparent',borderWidth:`${inset.top*scale}px ${inset.right*scale}px ${inset.bottom*scale}px ${inset.left*scale}px`,borderImageSource:`url("${art(id)}")`,borderImageSlice:`${inset.top} ${inset.right} ${inset.bottom} ${inset.left} fill`,borderImageWidth:'1',borderImageRepeat:'stretch'});
  });
  frames.forEach((_,el)=>{if(!active.has(el))remove(el);});
 }
 observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-frame','data-frame-scale','data-frame-bleed','disabled','open','hidden']});
 resize.observe(root);schedule();
 return()=>{disposed=true;cancelAnimationFrame(request);observer.disconnect();resize.disconnect();for(const el of frames.keys())remove(el);host.replaceChildren();};
}

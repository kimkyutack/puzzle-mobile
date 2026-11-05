import {writeFile} from 'node:fs/promises';
import {visibleInk} from './cua-ink-commerce.mjs';

export async function captureFrame(cdp,directory,name){
 const evaluate=async fn=>{const r=await cdp.send('Runtime.evaluate',{expression:'('+fn.toString()+')()',returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 await evaluate(async()=>{let last='',stable=0;for(let frame=0;frame<120;frame++){await new Promise(requestAnimationFrame);const current=JSON.stringify([innerWidth,innerHeight,...[...document.querySelectorAll('.modal-content,.page-content')].map(e=>[e.scrollTop,e.scrollLeft,e.clientWidth,e.clientHeight])]);stable=current===last?stable+1:0;last=current;if(stable>=6)break}});
 const geometry=await evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'&&r.bottom>0&&r.y<innerHeight};
  const selected=document.querySelector('.hub-nav-item[aria-current=page]');
  const frame=selected?.querySelector('.raster-frame-face');
  const clipping=frame?[...function*(e){for(let p=e.parentElement;p;p=p.parentElement)yield p}(frame)].map(e=>({tag:e.tagName,cls:e.className,rect:box(e),overflow:getComputedStyle(e).overflow})).filter(r=>/(hidden|clip|auto|scroll)/.test(r.overflow)):[];
  const panels=[...document.querySelectorAll('[data-frame],.raster-frame-face')].filter(visible).map(e=>({id:e.getAttribute('data-frame')||getComputedStyle(e).borderImageSource,cls:e.className,rect:box(e),slice:getComputedStyle(e).borderImageSlice,width:getComputedStyle(e).borderWidth}));
  const scope=document.querySelector('.commerce-dialog-host .modal-layer')||document.querySelector('.modal-layer:last-of-type')||document.querySelector('.game-shell');
  const overflow=[...scope.querySelectorAll('h1,h2,h3,strong,button,small,p')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2&&e.clientWidth>0).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,80),client:e.clientWidth,scroll:e.scrollWidth,rect:box(e)}));
  return{viewport:{width:innerWidth,height:innerHeight},url:location.href,selected:selected?{label:selected.getAttribute('aria-label'),rect:box(selected),frame:frame?box(frame):null,clipping}:null,panels,overflow,dialogs:document.querySelectorAll('[role=dialog]').length,qa:window.__v11Qa};
 });
 const ink=await visibleInk({evaluate});
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(`${directory}/${name}.png`,Buffer.from(shot.data,'base64'));
 try{await evaluate(()=>{const s=document.createElement('style');s.id='frame-hide-text';s.textContent='html *{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important}';document.head.append(s)});const b=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(`${directory}/${name}-background.png`,Buffer.from(b.data,'base64'))}finally{await evaluate(()=>document.getElementById('frame-hide-text')?.remove())}
 await writeFile(`${directory}/${name}.json`,JSON.stringify(ink,null,2));await writeFile(`${directory}/${name}-geometry.json`,JSON.stringify(geometry,null,2));
 return{name,selected:geometry.selected,dialogs:geometry.dialogs,overflow:geometry.overflow,errors:geometry.qa?.errors,blocked:geometry.qa?.blocked};
}

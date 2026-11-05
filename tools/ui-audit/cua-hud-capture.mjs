import {writeFile} from 'node:fs/promises';
import {visibleInk} from './cua-ink-v9.mjs';

export async function captureHud(cdp, directory, name) {
  const evaluate=async fn=>{
    const r=await cdp.send('Runtime.evaluate',{expression:'('+fn.toString()+')()',returnByValue:true});
    if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const geometry=await evaluate(()=>{
    const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,font:s.fontSize,line:s.lineHeight,stroke:s.webkitTextStrokeWidth}};
    const panel=document.querySelector('.target-panel');
    if(!panel)throw new Error('HUD not ready');
    const label=panel.querySelector('.hud-label');
    const goals=[...panel.querySelectorAll('.targets>div')].map(e=>({row:box(e),icon:box(e.querySelector('.icon')),number:box(e.querySelector('strong')),text:e.innerText}));
    return{viewport:{width:innerWidth,height:innerHeight},header:box(document.querySelector('.play-hud')),panel:box(panel),label:box(label),goals,lumi:box(document.querySelector('.lumi-hud')),tool:box(document.querySelector('.hud-tool')),moves:box(document.querySelector('.moves-panel')),qa:window.__v9Qa};
  });
  const ink=await visibleInk({evaluate});
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});
  await writeFile(`${directory}/${name}.png`,Buffer.from(shot.data,'base64'));
  try{
    await evaluate(()=>{const s=document.createElement('style');s.id='hud-hide-text';s.textContent='html *{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important}';document.head.append(s)});
    const background=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(`${directory}/${name}-background.png`,Buffer.from(background.data,'base64'));
  }finally{await evaluate(()=>document.getElementById('hud-hide-text')?.remove());}
  await writeFile(`${directory}/${name}.json`,JSON.stringify(ink,null,2));
  await writeFile(`${directory}/${name}-geometry.json`,JSON.stringify(geometry,null,2));
  return {name,panel:geometry.panel,labelBottom:geometry.label.bottom,iconTop:Math.min(...geometry.goals.map(g=>g.icon.y)),numberBottom:Math.max(...geometry.goals.map(g=>g.number.bottom)),fonts:geometry.goals.map(g=>g.number.font),tool:geometry.tool,errors:geometry.qa.errors,blocked:geometry.qa.blocked};
}

export async function captureMoves(cdp,directory,name,value){
 const edited=await cdp.send('Runtime.evaluate',{expression:`(()=>{const el=document.querySelector('.moves-panel strong');if(!el)throw new Error('HUD not ready');el.textContent=${JSON.stringify(String(value))};return true})()`,returnByValue:true});
 if(edited.exceptionDetails)throw new Error(JSON.stringify(edited.exceptionDetails));
 await captureHud(cdp,directory,name);
 const r=await cdp.send('Runtime.evaluate',{expression:`(()=>{const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const p=document.querySelector('.moves-panel'),n=p.querySelector('strong'),l=p.querySelector('.hud-label');return{panel:b(p),number:b(n),label:b(l),font:getComputedStyle(n).fontSize,text:n.textContent}})()`,returnByValue:true});
 await writeFile(`${directory}/${name}-moves.json`,JSON.stringify({name,requestedValue:value,presentationOnly:true,...r.result.value},null,2));
 return {name,...r.result.value};
}

import {writeFile} from 'node:fs/promises';
import {captureHud} from './cua-hud-capture.mjs';
export async function captureMoves(cdp,directory,name,value){
 const edited=await cdp.send('Runtime.evaluate',{expression:`(()=>{const el=document.querySelector('.moves-panel strong');if(!el)throw new Error('HUD not ready');el.textContent=${JSON.stringify(String(value))};return true})()`,returnByValue:true});
 if(edited.exceptionDetails)throw new Error(JSON.stringify(edited.exceptionDetails));
 await captureHud(cdp,directory,name);
 const r=await cdp.send('Runtime.evaluate',{expression:`(()=>{const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const p=document.querySelector('.moves-panel'),n=p.querySelector('strong'),l=p.querySelector('.hud-label');return{panel:b(p),number:b(n),label:b(l),font:getComputedStyle(n).fontSize,text:n.textContent}})()`,returnByValue:true});
 await writeFile(`${directory}/${name}-moves.json`,JSON.stringify({name,requestedValue:value,presentationOnly:true,...r.result.value},null,2));
 return {name,...r.result.value};
}

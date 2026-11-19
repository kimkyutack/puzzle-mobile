import {prepareAssets} from '../apps/client/src/assets';
import {mountRasterSurface as current} from '../apps/client/src/RasterSurface';
import {mountRasterSurface as previous} from './raster-layout-before';
const style=document.createElement('style');style.textContent='body{margin:0;background:#1d3970;color:white;font:14px sans-serif}nav{display:flex;gap:12px;padding:12px}button{padding:8px}output{display:block;min-height:40px}main{height:70vh;overflow:auto;margin:10px;padding:15px}#cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}article{position:relative;height:65px;padding:12px;text-align:center}';document.head.appendChild(style);
let dispose:(()=>void)|undefined,sets=0,mode='new';
const assign=Object.assign;
Object.assign=function(target:unknown,...sources:unknown[]){if(target instanceof CSSStyleDeclaration&&sources.some(source=>source&&typeof source==='object'&&'borderImageSource' in source))sets++;return assign(target as object,...sources);} as typeof Object.assign;
const cards=document.getElementById('cards')!,host=document.getElementById('surface') as HTMLDivElement,result=document.getElementById('result')!;
async function measure(operation:()=>void,phase:string){sets=0;const start=performance.now();operation();await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));result.textContent=JSON.stringify({mode,phase,ms:Math.round((performance.now()-start)*100)/100,styleAssignments:sets,frames:host.parentElement!.querySelectorAll('[data-local-frame]').length});}
function mount(next:string){mode=next;dispose?.();cards.innerHTML=Array.from({length:120},(_,i)=>`<article data-frame="card_blue_v4" data-frame-scale="0.1"><span>상품 ${i+1}</span></article>`).join('');void measure(()=>{dispose=(mode==='old'?previous:current)(host);},'mount');}
document.getElementById('old')!.onclick=()=>mount('old');document.getElementById('new')!.onclick=()=>mount('new');
document.getElementById('update')!.onclick=()=>void measure(()=>{cards.querySelector('span')!.textContent='상품 숫자만 갱신 '+Date.now();},'text-update');
await prepareAssets(()=>{});result.textContent='준비 완료';mount('new');

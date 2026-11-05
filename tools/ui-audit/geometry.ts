import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
interface Box {left:number;top:number;right:number;bottom:number;width:number;height:number}
interface Finding {kind:string;text:string;owner:string;rect?:Box;bounds?:Box;detail?:string}
interface Mask {width:number;height:number;size:number;alpha:string;insets:{left:number;right:number;top:number;bottom:number}}
export interface Measurement {findings:Finding[];textLines:number;buttonLines:number;partiallyClippedLines:number;english:string[];viewport:Box|null;panel:Box|null;scroll:{top:number;maximum:number}|null;frames:string[];footer:{height:number;usableHeight:number;occupiedHeight:number}|null;brokenImages:string[]}
export async function loadMasks(){const manifest=JSON.parse(await readFile('apps/client/public/assets/asset-manifest.json','utf8')) as {assets:Array<{id:string;width:number;height:number;runtimePath:string;sliceInsets?:Mask['insets']}>};const masks:Record<string,Mask>={};for(const asset of manifest.assets.filter(a=>a.sliceInsets)){const file=path.join('apps/client/public',asset.runtimePath);const {data,info}=await sharp(file).ensureAlpha().resize(192,192,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});const alpha=Buffer.alloc(192*192);for(let i=0;i<alpha.length;i++)alpha[i]=data[i*info.channels+3]!;masks[asset.id]={width:asset.width,height:asset.height,size:192,alpha:alpha.toString('base64'),insets:asset.sliceInsets!};}return masks;}
export async function scanGeometry(page:Page,safeTop:number,safeBottom:number,scopeSelector?:string):Promise<Measurement>{
 return page.evaluate(({safeTop,safeBottom,scopeSelector})=>{
  type B={left:number;top:number;right:number;bottom:number;width:number;height:number};
  type F={kind:string;text:string;owner:string;rect?:B;bounds?:B;detail?:string};
  type M={width:number;height:number;size:number;alpha:string;insets:{left:number;right:number;top:number;bottom:number}};
  const runtime=window as unknown as {__uiQaMasks:Record<string,M>;__uiQaDecoded?:Record<string,Uint8Array>;__uiQaDynamic:string[];__uiQaFrameScale:(id:string,height:number,explicit?:string)=>number;__uiQaFrameBleed:(value?:string)=>number};
  const masks=runtime.__uiQaMasks,decoded=runtime.__uiQaDecoded??={};
  const scope=document.querySelector<HTMLElement>(scopeSelector||'.modal-layer:last-of-type')||document.querySelector<HTMLElement>('.game-shell')!;
  const scroll=scope.querySelector<HTMLElement>('.modal-content'),panel=scope.querySelector<HTMLElement>('.modal');
  const box=(r:DOMRect|B):B=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
  const inset=(r:B,x:number,top:number,bottom=top):B=>({left:r.left+x,top:r.top+top,right:r.right-x,bottom:r.bottom-bottom,width:r.width-2*x,height:r.height-top-bottom});
  const within=(r:B,b:B,tolerance=.85)=>r.left>=b.left-tolerance&&r.top>=b.top-tolerance&&r.right<=b.right+tolerance&&r.bottom<=b.bottom+tolerance;
  const intersects=(r:B,b:B)=>r.right>b.left&&r.left<b.right&&r.bottom>b.top&&r.top<b.bottom;
  const viewport=scroll?box(scroll.getBoundingClientRect()):null,screen={left:0,top:safeTop,right:innerWidth,bottom:innerHeight-safeBottom,width:innerWidth,height:innerHeight-safeTop-safeBottom};
  const ownerLabel=(el:Element)=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).join('.'):'');
  const visible=(el:HTMLElement)=>{if(el.closest('.sr-only,[aria-hidden=true]'))return false;for(let details=el.closest('details');details;details=details.parentElement?.closest('details')??null)if(!details.open&&!details.querySelector(':scope > summary')?.contains(el))return false;const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&el.getClientRects().length>0;};
  const scale=(el:HTMLElement,id:string)=>runtime.__uiQaFrameScale(id,el.getBoundingClientRect().height,el.dataset.frameScale);
  function mapAxis(v:number,dest:number,source:number,before:number,after:number,factor:number){const fit=Math.min(1,dest/((before+after)*factor)),b=before*factor*fit,a=after*factor*fit;if(v<b)return v/b*before;if(v>dest-a)return source-(dest-v)/a*after;const center=dest-b-a;return before+(center>0?(v-b)/center:0)*(source-before-after);}
  function painted(el:HTMLElement,rect:B){const id=el.dataset.frame!,mask=masks[id];if(!mask)return null;const bounds=el.getBoundingClientRect(),requested=scale(el,id),paintedHeight=bounds.height+runtime.__uiQaFrameBleed(el.dataset.frameBleed),factor=requested*Math.min(1,bounds.width/((mask.insets.left+mask.insets.right)*requested),paintedHeight/((mask.insets.top+mask.insets.bottom)*requested));const pixels=decoded[id]??=Uint8Array.from(atob(mask.alpha),char=>char.charCodeAt(0));let minimum=255;
   // Nine samples cover corners and middle of the ink/line box, including tiny labels.
   for(const x of [rect.left+.7,(rect.left+rect.right)/2,rect.right-.7])for(const y of [rect.top+.7,(rect.top+rect.bottom)/2,rect.bottom-.7]){
    const sx=mapAxis(x-bounds.left,bounds.width,mask.width,mask.insets.left,mask.insets.right,factor),sy=mapAxis(y-bounds.top,paintedHeight,mask.height,mask.insets.top,mask.insets.bottom,factor);
    if(sx<0||sy<0||sx>=mask.width||sy>=mask.height){minimum=0;continue;}const ix=Math.min(mask.size-1,Math.floor(sx/mask.width*mask.size)),iy=Math.min(mask.size-1,Math.floor(sy/mask.height*mask.size));minimum=Math.min(minimum,pixels[iy*mask.size+ix]!);
   }return minimum;
  }
  const findings:F[]=[],english:string[]=[],walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let textLines=0,buttonLines=0,partiallyClippedLines=0;
  if(panel&&scroll){const p=box(panel.getBoundingClientRect()),style=getComputedStyle(panel),inner: B={left:p.left+parseFloat(style.paddingLeft),right:p.right-parseFloat(style.paddingRight),top:p.top+parseFloat(style.paddingTop),bottom:p.bottom-parseFloat(style.paddingBottom),width:0,height:0};inner.width=inner.right-inner.left;inner.height=inner.bottom-inner.top;if(!within(viewport!,inner))findings.push({kind:'panel-scroll-viewport-outside-inner-frame',text:'modal-content',owner:ownerLabel(panel),rect:viewport!,bounds:inner});}
  for(let node=walker.nextNode();node;node=walker.nextNode()){
   const text=node.textContent?.trim()||'',parent=node.parentElement as HTMLElement|null;if(!text||!parent||!visible(parent)||parent.closest('script,style,option,input,textarea'))continue;
   const style=getComputedStyle(parent),fontSize=parseFloat(style.fontSize)||14,lineHeight=parseFloat(style.lineHeight)||fontSize*1.2,stroke=(parseFloat(style.webkitTextStrokeWidth)||0)/2;const shadow={left:0,right:0,top:0,bottom:0},offsets=(style.textShadow.match(/-?[\d.]+px/g)||[]).map(parseFloat);for(let n=0;n+2<offsets.length;n+=3){const [x,y,blur]=offsets.slice(n,n+3) as [number,number,number];shadow.left=Math.max(shadow.left,-x+blur);shadow.right=Math.max(shadow.right,x+blur);shadow.top=Math.max(shadow.top,-y+blur);shadow.bottom=Math.max(shadow.bottom,y+blur);}
   const range=document.createRange();range.selectNodeContents(node);const button=parent.closest<HTMLElement>('button'),frame=parent.closest<HTMLElement>('[data-frame]');
   for(const raw of range.getClientRects()){
    if(!raw.width||!raw.height)continue;const h=Math.max(raw.height,lineHeight),r:B={left:raw.left-stroke-shadow.left,right:raw.right+stroke+shadow.right,top:(raw.top+raw.bottom-h)/2-stroke-shadow.top,bottom:(raw.top+raw.bottom+h)/2+stroke+shadow.bottom,width:raw.width+stroke*2+shadow.left+shadow.right,height:h+stroke*2+shadow.top+shadow.bottom};textLines++;
    const inScroll=!!scroll&&scroll.contains(parent),onScreen=intersects(r,screen)&&(!inScroll||intersects(r,viewport!));
    if(button){buttonLines++;const b=box(button.getBoundingClientRect()),hasOwnFrame=!!button.dataset.frame,face=inset(b,hasOwnFrame?Math.min(10,b.width*.08):0,hasOwnFrame?Math.min(7,b.height*.1):0);if(!within(r,face))findings.push({kind:'text-outside-button-face',text,owner:ownerLabel(button),rect:r,bounds:face});}
    const rowBody=parent.closest<HTMLElement>('.row-body');if(rowBody&&!within(r,box(rowBody.getBoundingClientRect())))findings.push({kind:'text-outside-row-content',text,owner:ownerLabel(rowBody),rect:r,bounds:box(rowBody.getBoundingClientRect())});
    if(frame&&((button&&button.dataset.frame)||parent.closest('.modal-heading')||parent.closest('.play-footer,.bottom-nav'))){const alpha=painted(frame,r);if(alpha!==null&&alpha<200)findings.push({kind:'text-outside-opaque-painted-frame',text,owner:ownerLabel(frame),rect:r,bounds:box(frame.getBoundingClientRect()),detail:`nine-slice sampled alpha ${alpha}/255`});}
    // Inline line-height includes unpainted leading. Keep it for button fit, but use actual
    // Range ink plus stroke/shadow at a scrolling clip edge (otherwise normal scroll clips fail).
    if(inScroll&&onScreen){const row=parent.closest<HTMLElement>('.pass-row,.list-row')||button||parent;const rowBox=box(row.getBoundingClientRect()),ink:B={left:raw.left-stroke-shadow.left,right:raw.right+stroke+shadow.right,top:raw.top-stroke-shadow.top,bottom:raw.bottom+stroke+shadow.bottom,width:raw.width+stroke*2+shadow.left+shadow.right,height:raw.height+stroke*2+shadow.top+shadow.bottom};const partial=rowBox.top<viewport!.top-.85||rowBox.bottom>viewport!.bottom+.85;if(partial)partiallyClippedLines++;else if(!within(ink,viewport!))findings.push({kind:'visible-text-outside-panel-viewport',text,owner:ownerLabel(parent),rect:ink,bounds:viewport!});}
    if(onScreen&&!inScroll&&!within(r,screen))findings.push({kind:'visible-text-outside-device-safe-area',text,owner:ownerLabel(parent),rect:r,bounds:screen});
    if(onScreen&&/[A-Za-z]/.test(text)&&!runtime.__uiQaDynamic.some(value=>value.trim()!==''&&text===value.trim())){const latin=text.match(/[A-Za-z][A-Za-z .&-]*/g)||[];for(const token of latin.map(value=>value.trim()).filter(Boolean)){if(!/^(Google|Apple|English|UTC)$/.test(token)&&!english.includes(token))english.push(token);}}
   }
  }
  for(const token of english)findings.push({kind:'static-english-auxiliary-label',text:token,owner:'visible text'});
  const footer=scope.querySelector<HTMLElement>('.play-footer,.bottom-nav');let footerMetrics:Measurement['footer']=null;if(footer){const r=footer.getBoundingClientRect(),children=[...footer.querySelectorAll<HTMLElement>('button')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);footerMetrics={height:r.height,usableHeight:r.height-safeBottom,occupiedHeight:children.length?Math.max(...children.map(r=>r.bottom))-Math.min(...children.map(r=>r.top)):0};}
  return {findings,textLines,buttonLines,partiallyClippedLines,english,viewport,panel:panel?box(panel.getBoundingClientRect()):null,scroll:scroll?{top:scroll.scrollTop,maximum:scroll.scrollHeight-scroll.clientHeight}:null,frames:[...new Set([...scope.querySelectorAll<HTMLElement>('[data-frame]')].map(el=>el.dataset.frame!))],footer:footerMetrics,brokenImages:[...scope.querySelectorAll<HTMLImageElement>('img')].filter(i=>i.getBoundingClientRect().width>0&&(!i.complete||!i.naturalWidth)).map(i=>i.getAttribute('src')||'<missing>')};
 },{safeTop,safeBottom,scopeSelector});
}

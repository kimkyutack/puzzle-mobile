import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore,type RefObject} from 'react';
import type {Player} from '@garden/contracts';
import {art} from './assets';
import {homeRewardTotal,landHomeRewards,pendingHomeRewards,rewardPieces,watchHomeRewards,type HomeReward,type HomeRewardKind} from './home-rewards';

const kinds=['coins','stars'] as const;
const empty:readonly HomeReward[]=[];
const reduceQuery='(prefers-reduced-motion: reduce)';

export function useHomeRewardFlight(player:Player,enabled:boolean,header:RefObject<HTMLElement|null>,layer:RefObject<HTMLDivElement|null>){
 const subscribe=useCallback((listener:()=>void)=>watchHomeRewards(player.id,listener),[player.id]);
 const snapshot=useCallback(()=>pendingHomeRewards(player.id),[player.id]);
 const pending=useSyncExternalStore(subscribe,snapshot,()=>empty);
 const ready=useMemo(()=>pending.filter(reward=>reward.version<=player.version),[pending,player.version]);
 const total=useMemo(()=>homeRewardTotal(ready),[ready]);
 const [environment,setEnvironment]=useState(()=>({visible:!document.hidden,reduced:window.matchMedia(reduceQuery).matches}));
 const [cycle,setCycle]=useState(0);
 const active=useRef<{cancel:()=>void}|null>(null);
 const visible=enabled&&environment.visible;
 const reduced=player.settings.reducedMotion||environment.reduced;

 useEffect(()=>{
  const preference=window.matchMedia(reduceQuery);
  const update=()=>setEnvironment({visible:!document.hidden,reduced:preference.matches});
  document.addEventListener('visibilitychange',update);
  preference.addEventListener('change',update);
  update();
  return ()=>{document.removeEventListener('visibilitychange',update);preference.removeEventListener('change',update);};
 },[]);

 useLayoutEffect(()=>{
  const reset=()=>{active.current?.cancel();active.current=null;};
  const resize=()=>{if(!active.current)return;reset();setCycle(value=>value+1);};
  window.addEventListener('resize',resize);
  return ()=>{window.removeEventListener('resize',resize);reset();};
 },[player.id,visible,reduced]);

 useEffect(()=>{
  const surface=layer.current,head=header.current;
  if(!visible||!ready.length||active.current||!surface||!head)return;
  const receipts=new Set(ready.map(reward=>reward.id));
  if(reduced||typeof surface.animate!=='function'){
   landHomeRewards(player.id,receipts);
   return;
  }
  const bounds=surface.getBoundingClientRect();
  const width=surface.clientWidth,height=surface.clientHeight;
  if(!width||!height||!bounds.width||!bounds.height)return;
  const targets=kinds.flatMap(kind=>{
   if(!total[kind])return [];
   const icon=head.querySelector<HTMLImageElement>(`[data-reward-target="${kind}"] > .icon`);
   const src=art(kind==='coins'?'coin':'star');
   return icon&&src?[{kind,icon,src}]:[];
  });
  if(targets.length!==kinds.filter(kind=>total[kind]>0).length){landHomeRewards(player.id,receipts);return;}

  const motions:Animation[]=[],pulses=new Map<HomeRewardKind,Animation>();
  const batch={cancel:()=>{motions.forEach(motion=>motion.cancel());pulses.forEach(pulse=>pulse.cancel());surface.replaceChildren();}};
  active.current=batch;
  const particles=targets.flatMap(target=>rewardPieces(target.kind,total[target.kind]).map((amount,index)=>({...target,amount,index})));
  let arrivals=particles.length;
  for(const {kind,icon,src,amount,index} of particles){
   const target=icon.getBoundingClientRect();
   const toX=(target.x+target.width/2-bounds.x)*width/bounds.width;
   const toY=(target.y+target.height/2-bounds.y)*height/bounds.height;
   const spread=(index%5-2)*13;
   const fromX=width*(kind==='coins'?.44:.56)+spread;
   const fromY=height*.57+(index%3-1)*18;
   const midX=(fromX+toX)/2+spread*.85;
   const midY=fromY+(toY-fromY)*.64;
   const at=(x:number,y:number,angle:number,scale:number)=>`translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${angle}deg) scale(${scale})`;
   const sprite=new Image();
   sprite.src=src;sprite.alt='';sprite.draggable=false;
   sprite.className='home-reward-particle';sprite.dataset.rewardKind=kind;
   const size=kind==='coins'?24+index%4*3:26+index%3*3;
   sprite.width=size;sprite.height=size;
   surface.appendChild(sprite);
   const motion=sprite.animate([
    {offset:0,transform:at(fromX,fromY+10,-17,.55),opacity:0},
    {offset:.16,transform:at(fromX,fromY,14,1.08),opacity:1},
    {offset:.55,transform:at(midX,midY,-9,.92),opacity:1},
    {offset:.92,transform:at(toX,toY+4,0,.76),opacity:1},
    {offset:1,transform:at(toX,toY,0,.5),opacity:.35},
   ],{delay:120+index*55+(kind==='stars'?100:0),duration:540+index%3*18,fill:'both',easing:'cubic-bezier(.22,.66,.36,1)'});
   motions.push(motion);
   void motion.finished.then(()=>{
    if(active.current!==batch)return;
    sprite.remove();
    if(amount)landHomeRewards(player.id,receipts,{[kind]:amount});
    pulses.get(kind)?.cancel();
    const base=getComputedStyle(icon).transform;
    const transform=base==='none'?'':base+' ';
    pulses.set(kind,icon.animate([
     {transform:transform+'scale(1)'},{transform:transform+'scale(1.18)',offset:.34},{transform:transform+'scale(1)'},
    ],{duration:190,easing:'ease-out'}));
    if(--arrivals===0){active.current=null;setCycle(value=>value+1);}
   },()=>{});
  }
 },[cycle,header,layer,player.id,ready,reduced,total,visible]);

 return {coins:Math.max(0,player.coins+player.boundCoins-total.coins),stars:Math.max(0,player.stars-total.stars)};
}

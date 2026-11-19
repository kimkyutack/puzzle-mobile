import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {OfferChainReward,ShopOffer} from '@garden/contracts';
import rail from '../../../packages/assets/offer-chain/rail.webp';
import openLock from '../../../packages/assets/offer-chain/padlock-open.webp';
import closedLock from '../../../packages/assets/offer-chain/padlock-closed.webp';
import stand from '../../../packages/assets/offer-chain/reward-stand.webp';
import {Button,Icon} from './ui';
import {ProductContents,bundleArt} from './commerce-ui';
import {tr} from './i18n';

type ChainStep={id:string;offer:ShopOffer;reward?:never}|{id:string;offer?:never;reward:OfferChainReward};
type Props={
 offers:ShopOffer[];
 rewards:OfferChainReward[];
 timeLeft:string;
 busy:boolean;
 reducedMotion:boolean;
 purchaseAction:(offer:ShopOffer,disabled?:boolean)=>ReactNode;
 claim:(reward:OfferChainReward)=>void;
};

function useOrbitPosition(target:number,reducedMotion:boolean){
 const [position,setPosition]=useState(target);
 const previous=useRef(target);

 useEffect(()=>{
  const from=previous.current;
  if(from===target)return;
  if(reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   previous.current=target;
   setPosition(target);
   return;
  }
  const start=performance.now();
  let frame=0;
  const advance=(now:number)=>{
   const progress=Math.min(1,(now-start)/620);
   const next=progress===1?target:from+(target-from)*(1-(1-progress)**3);
   previous.current=next;
   setPosition(next);
   if(progress<1)frame=requestAnimationFrame(advance);
  };
  frame=requestAnimationFrame(advance);
  return ()=>cancelAnimationFrame(frame);
 },[target,reducedMotion]);
 return position;
}

const stateOf=(step:ChainStep)=>step.offer?.status??step.reward?.status;
const completed=(step:ChainStep)=>stateOf(step)==='purchased'||stateOf(step)==='claimed';

export default function OfferChainCarousel({offers,rewards,timeLeft,busy,reducedMotion,purchaseAction,claim}:Props){
 const steps=offers.flatMap<ChainStep>(offer=>{
  const reward=rewards.find(step=>step.previousProductId===offer.product.id);
  return [{id:offer.product.id,offer},...(reward?[{id:reward.id,reward}]:[])];
 });
 const available=steps.findIndex(step=>stateOf(step)==='available');
 const refunded=steps.findIndex(step=>stateOf(step)==='refunded');
 const lastCompleted=steps.reduce((latest,step,index)=>completed(step)?index:latest,0);
 const focus=available>=0?available:refunded>=0?refunded:lastCompleted;
 const position=useOrbitPosition(focus,reducedMotion);
 const turning=position!==focus;
 const current=steps[focus];
 if(!current)return null;

 return <section className="chain-carousel" aria-busy={turning||busy} data-current-step={current.id} data-spinning={turning} data-reduced-motion={reducedMotion}>
  <div className="chain-scene">
   <Icon id="bg_greenhouse_v6" className="chain-greenhouse" size={390}/>
   <p className="chain-deadline">{timeLeft}</p>
   <div className="chain-orbit" aria-hidden="true">
    <img className="chain-rail-art" src={rail} alt=""/>
    {steps.map((step,index)=>{
     const angle=(index-position)*2*Math.PI/steps.length;
     const depth=(Math.cos(angle)+1)/2;
     const size=.22+.78*depth**7;
     const front=depth>.94;
     const finished=completed(step);
     const showReward=front||Boolean(step.reward&&!finished);
     const opened=finished||index===available&&!turning;
     return <div key={step.id} className="chain-slot" data-step={step.id} data-open={opened} data-front={front}
      style={{left:50+Math.sin(angle)*43+'%',top:62+(depth*2-1)*17+'%',zIndex:Math.round(depth*100),opacity:.52+.48*depth,
       transform:`translate(-50%, -50%) scale(${size})`}}>
      <img className="chain-slot-stand" src={stand} alt=""/>
      {showReward&&<Icon className="chain-slot-reward" id={step.offer?bundleArt(step.offer.product):'chest'} size={200}/>}
      <img className={'chain-slot-lock'+(showReward?' has-reward':'')} src={opened?openLock:closedLock} alt=""/>
     </div>;
    })}
   </div>
  </div>
  <div className="chain-checkout">
   <h3>{current.offer?tr(current.offer.product.offer!.title):tr('무료 보상')}</h3>
   <ProductContents product={current.offer?.product??current.reward!.reward}/>
   <div className="chain-action">
    {current.offer?purchaseAction(current.offer,busy||turning):
     current.reward.status==='available'?<Button className="chain-claim" tone="green" rasterFrame={false} disabled={busy||turning}
      onClick={()=>claim(current.reward)}>{tr('무료로 받기')}</Button>:<p className="deal-state">{tr('수령 완료')}</p>}
   </div>
  </div>
 </section>;
}

import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {ActivityReward} from '@garden/contracts';
import closedArt from '../../../packages/assets/event-ui-v44/treasure-bloom-closed.webp';
import openArt from '../../../packages/assets/event-ui-v44/treasure-bloom-open.webp';
import {formatLocale,tr} from './i18n';
import {Icon,names} from './ui';
import {sound} from './sound';
import './treasure-reward-reveal.css';

export default function TreasureRewardReveal({reward,reduced,onDismiss}:{reward:ActivityReward;reduced:boolean;onDismiss:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),confirm=useRef<HTMLButtonElement>(null),title=useId();
 const [opened,setOpened]=useState(false);
 const nativeDialog=typeof HTMLDialogElement!=='undefined'&&typeof HTMLDialogElement.prototype.showModal==='function';
 const prizes=[['coin',reward.coins] as const,...Object.entries(reward.items)].filter(([,count])=>(count??0)>0);
 useEffect(()=>{
  const image=new Image();
  image.src=openArt;
  const element=dialog.current;
  if(nativeDialog){if(element&&!element.open)element.showModal();return;}
  const previous=document.activeElement;
  element?.querySelector('button')?.focus();
  return ()=>{if(previous instanceof HTMLElement)previous.focus();};
 },[nativeDialog]);
 useEffect(()=>{if(opened)confirm.current?.focus();},[opened]);
 const dismiss=()=>{if(nativeDialog)dialog.current?.close();else onDismiss();};
 return createPortal(<dialog ref={dialog} open={nativeDialog?undefined:true}
  className={'treasure-reveal'+(nativeDialog?'':' is-legacy')+(reduced?' is-reduced':'')}
  aria-labelledby={title} aria-modal="true" onClose={onDismiss} onKeyDown={event=>{
   if(nativeDialog)return;
   if(event.key==='Tab')event.preventDefault();
   if(event.key==='Escape'){event.preventDefault();dismiss();}
  }}>
  <div className="treasure-reveal-content">
   <h2 id={title}>{tr('보물 도구를 찾았어요!')}</h2>
   {opened?<>
    <div className="treasure-reveal-display is-open">
     <img className="treasure-reveal-art" src={openArt} alt="" draggable={false}/>
     <div className="treasure-reveal-contents" aria-hidden="true">
      {prizes.map(([id])=><Icon key={id} id={id} size={56}/>)}
     </div>
    </div>
    <ul className="treasure-reveal-prizes">{prizes.map(([id,count])=><li key={id}>
     <Icon id={id} size={40}/><span>{id==='coin'?tr('코인'):names[id]??id}</span>
     <strong>{id==='coin'?'+':'×'}{count?.toLocaleString(formatLocale())}</strong>
    </li>)}</ul>
    <button ref={confirm} className="treasure-reveal-confirm" type="button" onClick={dismiss}>{tr('확인')}</button>
   </>:<button type="button" className="treasure-reveal-open" onClick={()=>{sound('button');setOpened(true);}}>
    <img className="treasure-reveal-art" src={closedArt} alt="" draggable={false}/>
    <span>{tr('탭해서 열기')}</span>
   </button>}
  </div>
 </dialog>,document.body);
}

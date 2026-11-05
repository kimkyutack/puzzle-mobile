import {useEffect,useRef,type KeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Modal} from './ui';
import './commerce-actions.css';

/** Confirmation belongs to the viewport rather than a scrolling page/popup body. */
export default function CommerceDialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const app=document.getElementById('root'),wasInert=app?.inert??false;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  if(app)app.inert=true;
  host.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
  return()=>{if(app)app.inert=wasInert;if(previous?.isConnected)previous.focus();};
 },[]);
 function keyboard(event:KeyboardEvent){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
  if(event.key!=='Tab')return;
  const controls=Array.from(host.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]).filter(element=>element.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(!first){event.preventDefault();return;}
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
 return createPortal(<div className="commerce-dialog-host" data-commerce-dialog ref={host} onKeyDown={keyboard}><Modal theme="shop" title={title} onClose={onClose}>{children}</Modal></div>,document.body);
}

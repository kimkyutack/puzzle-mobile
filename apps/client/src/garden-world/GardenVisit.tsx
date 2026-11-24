import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {GardenVisitResponse} from '../../../../packages/garden-world/src';
import {request} from '../api';
import {tr} from '../i18n';
import {Button,Icon,IconButton} from '../ui';
import ArtSurface from '../ArtSurface';
import {loadWorldArt,type LoadedArt} from './assets';
import {WorldMap,type MapHandle} from './WorldMap';
import './garden-visit.css';

/** Visiting never edits the owner's layout. A visible map can acknowledge a visit. */
export default function GardenVisit({userId,onClose,reducedMotion=false}:{userId:string;onClose:()=>void;reducedMotion?:boolean}){
 const [data,setData]=useState<GardenVisitResponse|null>(null),[images,setImages]=useState<Record<string,LoadedArt>|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const host=useRef<HTMLDivElement>(null),map=useRef<MapHandle>(null);
 const [visitError,setVisitError]=useState(''),[visitRetry,setVisitRetry]=useState(0);
 useEffect(()=>{
  const root=document.getElementById('root'),wasInert=root?.inert??false,previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  if(root)root.inert=true;
  host.current?.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{if(root)root.inert=wasInert;if(previous?.isConnected)previous.focus();};
 },[]);
 useEffect(()=>{
  let live=true;setData(null);setError('');
  void Promise.all([request<GardenVisitResponse>('/garden/visits/'+encodeURIComponent(userId)),loadWorldArt()]).then(([garden,art])=>{
   if(!live)return;
   if(garden.owner.userId!==userId||garden.world.ownerId!==userId)throw Error(tr('정원을 불러오지 못했어요.'));
   setData(garden);setImages(art);
  }).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:tr('정원을 불러오지 못했어요.'));});
  return()=>{live=false;};
 },[userId,retry]);
 useEffect(()=>{if(data&&images)map.current?.overview();},[data,images]);
 useEffect(()=>{
  if(!data?.invitationVisits||!images)return;
  let live=true,timer:ReturnType<typeof setTimeout>;setVisitError('');
  const waitForPaint=()=>{
   if(!live)return;
   if(document.hidden||!host.current?.querySelector('canvas[data-camera]')){timer=setTimeout(waitForPaint,150);return;}
   timer=setTimeout(()=>{
    if(document.hidden){waitForPaint();return;}
    void request('/garden/invite/visit',{ownerId:userId}).catch(()=>{if(live)setVisitError(tr('방문 기록을 저장하지 못했어요. 다시 시도해 주세요.'));});
   },500);
  };
  waitForPaint();return()=>{live=false;clearTimeout(timer);};
 },[data,images,userId,visitRetry]);
 function keyboard(event:KeyboardEvent){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
  if(event.key!=='Tab')return;
  const controls=Array.from(host.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')??[]).filter(el=>el.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
 return createPortal(<div ref={host} className="garden-visit" role="dialog" aria-modal="true" aria-label={tr('정원 방문')} onKeyDown={keyboard} data-art-root>
  <ArtSurface/>
  <div className="garden-visit-stage">{data&&images?<WorldMap key={data.owner.userId} ref={map} world={data.world} images={images} preview={null} previewValid editable={false} reducedMotion={reducedMotion} overviewInsets={{top:120,bottom:125,left:16,right:16}} onSelect={()=>{}} onPreview={()=>{}}/>:<div className="garden-visit-status" role={error?'alert':'status'}><Icon id="home" size={86}/><p>{error||tr('정원을 불러오는 중…')}</p>{error&&<Button secondary onClick={()=>setRetry(n=>n+1)}>{tr('다시 불러오기')}</Button>}</div>}</div>
  <header className="garden-visit-header" data-frame="event_sky_v9" data-frame-scale="0.13"><Icon id="home" size={46}/><div><h1>{data?tr('{0}의 정원',{0:data.owner.nickname}):tr('정원 방문')}</h1><p><span>{tr('구경 중')}</span>{data&&<><Icon id="level_completed_v61" size={21}/><span>{tr('레벨')} {data.owner.level}</span></>}</p></div><IconButton id="close" label={tr('돌아가기')} onClick={onClose}/></header>
  <nav className="garden-visit-controls" aria-label={tr('정원 보기')}>
   <button className="garden-visit-zoom" data-frame="button_secondary" disabled={!data||!images} aria-label={tr('정원 축소')} onClick={()=>map.current?.zoom(1/1.25)}>−</button>
   <Button secondary disabled={!data||!images} onClick={()=>map.current?.overview()}>{tr('전체 보기')}</Button>
   <button className="garden-visit-zoom" data-frame="button_secondary" disabled={!data||!images} aria-label={tr('정원 확대')} onClick={()=>map.current?.zoom(1.25)}>+</button>
  </nav>
  {visitError&&<div className="garden-visit-record-error" role="alert"><p>{visitError}</p><Button secondary onClick={()=>setVisitRetry(n=>n+1)}>{tr('다시 시도')}</Button></div>}
 </div>,document.body);
}

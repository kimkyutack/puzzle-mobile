import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {Action,GameEvent,Player} from '@garden/contracts';
import {actionWithFrames,type CascadeFrame} from '@garden/core';
import {GOLD_GARDEN_INTERVAL,GOLD_GARDEN_VERSION,goldGardenCoins,type GoldGardenVersion} from '../../../packages/content/src/gold-garden';
import {request} from './api';
import ArtSurface from './ArtSurface';
import CascadeBoard from './CascadeBoard';
import {goldGardenCacheKey,isRefillGoldGardenVersion,loadGoldGarden,type RefillGoldGardenVersion} from './gold-garden-progress';
import {rememberHomeReward} from './home-rewards';
import {t,tr} from './i18n';
import {Amount,Button,Icon,IconButton} from './ui';
import './gold-garden.css';

interface RoundProps {player:Player;milestone:number;version:RefillGoldGardenVersion;onClose:()=>void;onClaim:(player:Player)=>void}
interface GoldGardenStatus {milestones:number[];version?:GoldGardenVersion}
function GoldGardenRound({player,milestone,version,onClose,onClaim}:RoundProps){
 const [initial]=useState(()=>loadGoldGarden(milestone,version,savedVersion=>{
  try{return localStorage.getItem(goldGardenCacheKey(player.id,milestone,savedVersion));}
  catch{return null;}
 }));
 const cacheKey=goldGardenCacheKey(player.id,milestone,initial.version);
 const [state,setState]=useState(initial.state),[shown,setShown]=useState(initial.state),[events,setEvents]=useState<GameEvent[]>([]);
 const [frames,setFrames]=useState<CascadeFrame[]>([]),[action,setAction]=useState<Action>(),[busy,setBusy]=useState(false);
 const [saving,setSaving]=useState(false),[paid,setPaid]=useState<number|null|undefined>(),[error,setError]=useState('');
 const log=useRef(initial.actions),guard=useRef(false),claimed=useRef(false),auto=useRef(false),alive=useRef(true);
 const finished=state.status==='won'||state.status==='lost';
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;}},[]);

 function play(move:Action){
  if(guard.current||state.status!=='playing'||move.type!=='swap'&&move.type!=='tap')return;
  const result=actionWithFrames(state,move);
  if(!result.accepted)return;
  if(result.state.status==='error'){
   setError(tr('퍼즐을 진행하지 못했어요. 황금 정원을 다시 열어 주세요.'));
   return;
  }
  guard.current=true;setBusy(true);
  log.current=[...log.current,move];
  try{localStorage.setItem(cacheKey,JSON.stringify(log.current));}
  catch{setError(tr('이 기기에 진행을 보관할 수 없어요.')); }
  setAction(move);setState(result.state);setFrames(result.frames);setEvents(result.events);
 }

 async function finish(){
  if(claimed.current||busy||!finished||paid!==undefined)return;
  claimed.current=true;setSaving(true);setError('');
  try{
   const result=await request<{player:Player;coins:number|null}>('/gold-garden/finish',{
    milestone,actions:log.current,version:initial.version,
   });
   if(result.player.id!==player.id)return;
   if(result.coins)rememberHomeReward(result.player,`gold-garden:${milestone}`,{coins:result.coins,stars:0});
   try{localStorage.removeItem(cacheKey);}catch{/* The server already settled this round. */}
   onClaim(result.player);
   if(alive.current)setPaid(result.coins);
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:tr('보상을 확인하지 못했어요. 다시 시도해 주세요.'));}
  finally{claimed.current=false;if(alive.current)setSaving(false);}
 }
 useEffect(()=>{
  if(finished&&!busy&&!auto.current){auto.current=true;void finish();}
 },[finished,busy]);

 return createPortal(<div className="gold-garden-overlay">
  <section className="game-shell playing gold-garden-screen" role="dialog" aria-modal="true" aria-label={tr('황금 정원')} data-art-root onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}}}>
   <ArtSurface scene="play"/>
   <header className="gold-garden-heading" data-frame="event_sky_v9" data-frame-scale="0.12">
    <Icon id="coin" size={33}/><h2>{tr('황금 정원')}</h2>
    <IconButton id="close" label={tr('나가기')} onClick={onClose}/>
   </header>
   <div className="gold-garden-hud" data-frame="play_hud_goals_v32" data-frame-scale="0.24">
    <span role="status">{tr('모은 골드')} <Amount kind="coin" value={goldGardenCoins(shown)}/></span>
    <span aria-label={t('hud.moves')+' '+shown.moves}>{t('hud.moves')} <strong>{shown.moves}</strong></span>
   </div>
   <div className="board-area">
    <CascadeBoard goldGarden fillWidth state={state} frames={frames} events={events} action={action}
     onStateShown={setShown} locked={busy||finished} tool={null} onAction={play}
     onVisualSettled={()=>{guard.current=false;setBusy(false);}} reduced={player.settings.reducedMotion}/>
   </div>
   <footer className="gold-garden-footer play-footer" data-frame="dock_v3" data-frame-bleed="8">
    {finished&&!busy?(paid!==undefined?<>
     <p role="status">{paid===null?tr('이미 보상을 받았어요.'):tr('황금 정원 보상')} {paid!==null&&<Amount kind="coin" value={'+'+paid}/>}</p>
     <Button tone="gold" onClick={onClose}>{t('common.done')}</Button>
    </>:<><p role="status">{tr(saving?'보상을 확인하고 있어요.':'모은 골드를 받을 수 있어요.')}</p>
     {!!error&&<Button tone="gold" disabled={saving} onClick={()=>void finish()}>{tr('다시 시도')}</Button>}
    </>):<p>{tr('아이템을 누르거나 합쳐 금화를 모아요. 금화 한 개는 1코인이에요.')}</p>}
    {error&&<p role="alert" className="gold-garden-error">{error}</p>}
   </footer>
  </section>
 </div>,document.body);
}

export default function GoldGardenEntry({player,onPlayer,milestone,onRoundOpenChange,buttonClassName='',fallback}:{
 player:Player;onPlayer:(player:Player)=>void;milestone?:number;onRoundOpenChange?:(open:boolean)=>void;
 buttonClassName?:string;fallback:ReactNode;
}){
 const [status,setStatus]=useState<GoldGardenStatus|null>(null),[open,setOpen]=useState<number>();
 const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 const canEarn=player.level>GOLD_GARDEN_INTERVAL;
 useEffect(()=>()=>onRoundOpenChange?.(false),[onRoundOpenChange]);
 useEffect(()=>{
  if(!canEarn)return;
  let current=true;
  void request<GoldGardenStatus>(`/gold-garden?version=${GOLD_GARDEN_VERSION}`).then(result=>{
   if(current)setStatus(result);
  }).catch(()=>{if(current)setFailed(true);});
  return()=>{current=false;};
 },[player.id,canEarn,attempt]);
 if(!canEarn)return fallback;
 const next=milestone===undefined?status?.milestones[0]:status?.milestones.includes(milestone)?milestone:undefined;
 const version=status?.version;
 const needsRuleUpdate=next!==undefined&&!isRefillGoldGardenVersion(version);
 if(!status||needsRuleUpdate)return <Button className={buttonClassName+' gold-garden-lookup'} tone="green"
  disabled={!failed&&!needsRuleUpdate} onClick={()=>{setFailed(false);setStatus(null);setAttempt(value=>value+1);}}>
  {failed||needsRuleUpdate?tr('다시 연결'):t('common.wait')}
 </Button>;
 if(!isRefillGoldGardenVersion(version))return fallback;
 function showRound(level:number|undefined){setOpen(level);onRoundOpenChange?.(level!==undefined);}
 return <>
  {next===undefined?fallback:<Button className={`${buttonClassName} gold-garden-play`}
   tone="gold" icon="coin" onClick={()=>showRound(next)}>{tr('황금 정원')}</Button>}
  {open!==undefined&&<GoldGardenRound key={player.id+':'+open} player={player} milestone={open}
   version={version} onClose={()=>showRound(undefined)}
   onClaim={result=>{setStatus(current=>current&&{...current,milestones:current.milestones.filter(level=>level!==open)});onPlayer(result);}}/>}
 </>;
}

import {gameEventAvailable,gameEventConfig} from '../../../packages/contracts/src/operations';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Player,ProgressionResponse,MissionPeriod,ActivityReward,TreasureAttempt,TreasurePair} from '@garden/contracts';
import {replayTreasure} from '@garden/content';
import {request,key,serverNow,duration} from './api';
import {tr} from './i18n';
import {Button,Card,Icon,Amount,names,Poster} from './ui';
import {sound} from './sound';
import './activity-v14.css';
import {eventArt} from './event-art-v17';
import './events-v17.css';
import {useOperations} from './OperationsUI';
import {attentionState} from './attention-state';
import TreasureRewardReveal from './TreasureRewardReveal';
import TreasureCardScene from './TreasureCardScene';

interface ActivityContextValue{data:ProgressionResponse|null;player:Player|null;now:number;error:string;reload:()=>Promise<void>;updatePlayer:(player:Player)=>void;updateData:(update:(data:ProgressionResponse)=>ProgressionResponse)=>void}
const Context=createContext<ActivityContextValue>({data:null,player:null,now:0,error:'',reload:async()=>{},updatePlayer:()=>{},updateData:()=>{}});
export const useActivity=()=>useContext(Context);
export function useAttention(){const {data,player,now}=useActivity(),operations=useOperations();return attentionState(player,data,operations.data,now||serverNow());}
export function ActivityProvider({player,active,onPlayer,children}:{player:Player;active:boolean;onPlayer:(player:Player)=>void;children:ReactNode}){
 const [data,setData]=useState<ProgressionResponse|null>(null),[error,setError]=useState(''),[,tick]=useState(0),current=useRef(player),updater=useRef(onPlayer),loading=useRef<{id:string;promise:Promise<void>}|null>(null),revision=useRef(0),alive=useRef(true);current.current=player;updater.current=onPlayer;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;}},[]);
 const updateData=useCallback((update:(value:ProgressionResponse)=>ProgressionResponse)=>{revision.current++;setData(value=>value?.player.id===current.current.id?update(value):value);},[]);
 const reload=useCallback(()=>{
  revision.current++;const id=current.current.id;if(loading.current?.id===id)return loading.current.promise;
  const work=(async()=>{let observed:number;
   do{observed=revision.current;const result=await request<ProgressionResponse>('/progression');
    // Older deployed servers do not include this snapshot. New servers reuse their existing query.
    if(!result.eventRewards)result.eventRewards=await request<NonNullable<ProgressionResponse['eventRewards']>>('/events');
    if(!alive.current||current.current.id!==id)return;
    if(observed!==revision.current)continue;
    if(result.player.version<current.current.version)return;
    setData(result);setError('');if(result.player.version>current.current.version)updater.current(result.player);
   }while(observed!==revision.current);
  })().catch(error=>{if(alive.current&&current.current.id===id)setError(error instanceof Error?error.message:tr('연결을 확인해 주세요.'));}).finally(()=>{if(loading.current?.promise===work)loading.current=null;});
  loading.current={id,promise:work};return work;
 },[player.id]);
 useEffect(()=>{if(!active)return;const timer=setTimeout(()=>void reload(),150);return()=>clearTimeout(timer)},[player.id,player.version,active,reload]);
 useEffect(()=>{if(!active)return;const timer=setInterval(()=>{if(!document.hidden)void reload()},30000),clock=setInterval(()=>{if(!document.hidden)tick(n=>n+1)},1000),refresh=()=>void reload(),visible=()=>{if(!document.hidden)refresh()};window.addEventListener('online',refresh);window.addEventListener('focus',refresh);window.addEventListener('garden:activity-changed',refresh);document.addEventListener('visibilitychange',visible);return()=>{clearInterval(timer);clearInterval(clock);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('garden:activity-changed',refresh);document.removeEventListener('visibilitychange',visible)}},[active,reload]);
 return <Context value={{data:data?.player.id===player.id?data:null,player,now:serverNow(),error,reload,updatePlayer:p=>updater.current(p),updateData}}>{children}</Context>;
}
export function RewardDot({count=0}:{count?:number}){return count>0?<i className="reward-dot" role="status" aria-label={tr('받을 보상 또는 새 알림')+' '+count}><span aria-hidden="true"/></i>:null;}
export function ActivityRewards({reward}:{reward:ActivityReward}){return <span className="activity-rewards">{reward.coins>0&&<Amount kind="coin" value={reward.coins}/>} {(Object.entries(reward.items)).map(([item,count])=><span key={item} className="activity-item-reward" title={names[item]}><Icon id={item} size={29}/><strong>×{count}</strong></span>)}</span>;}
function LoadingActivity(){const {error,reload}=useActivity();return <Card><p role="status">{error||tr('정원 활동을 준비하고 있어요.')}</p>{error&&<Button onClick={()=>void reload()}>{tr('다시 연결')}</Button>}</Card>;}
export function MissionMenu(){
 const operations=useOperations();
 const {data,error,reload,updatePlayer,updateData}=useActivity(),[period,setPeriod]=useState<MissionPeriod>('daily'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(operations.data?.settings.features.missions===false)return <p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p>;
 if(!data)return <div className="mission-menu"><LoadingActivity/></div>;
 const source=data[period],window={...source,missions:source.missions.map(m=>({...m,claimable:serverNow()<source.endsAt&&!m.claimed&&m.progress>=m.target}))},claimable=window.missions.filter(m=>m.claimable).length;
 const claim=async(ids?:string[])=>{if(busy)return;setBusy(true);setMessage('');try{const res=await request<{player:Player;claimed:string[]}>('/missions/claim',{key:key(),period,periodId:window.id,...(ids?{ids}:{})});updatePlayer(res.player);updateData(data=>({...data,[period]:{...data[period],missions:data[period].missions.map(m=>res.claimed.includes(m.id)?{...m,claimed:true,claimable:false}:m)}}));sound('win');setMessage(res.claimed.length?tr('미션 보상을 받았어요!'):tr('현재 받을 보상을 모두 받았어요.'));await reload();}catch(error){setMessage(error instanceof Error?error.message:tr('잠시 후 다시 시도해 주세요.'));}finally{setBusy(false);}};
 return <div className="mission-menu">
  <div className="activity-tabs" role="tablist" aria-label={tr('미션 기간')}>
   {(['daily','weekly'] as const).map(value=><button key={value} role="tab" aria-selected={period===value} onClick={()=>setPeriod(value)} data-frame={period===value?'button_mint_v6':'card_sage_v6'} data-frame-scale="0.12">
    <Icon id={value==='daily'?'icon_attendance_v17':'missions_menu_v51'} size={28}/>
    {tr(value==='daily'?'일일 미션':'주간 미션')}
    <RewardDot count={serverNow()<data[value].endsAt?data[value].missions.filter(m=>!m.claimed&&m.progress>=m.target).length:0}/>
   </button>)}
  </div>
  <div className="mission-summary" data-frame="card_peach_v9" data-frame-scale="0.14">
   <Icon id="chest" size={53}/><div><strong>{window.missions.filter(m=>m.claimed).length} / {window.missions.length}</strong><small>{tr('남은 시간')} {duration(window.endsAt-serverNow())}</small></div>
   <Button icon="chest" disabled={busy||!claimable} onClick={()=>void claim()}>{tr('모두 받기')}</Button>
  </div>
  {(message||error)&&<p className="activity-feedback" role="status">{message||error}</p>}
  <div className="mission-list">{window.missions.map(m=><section key={window.id+m.id} className={'mission-row '+(m.claimable?'is-ready':'')} data-frame={m.claimed?'card_green_v4':m.claimable?'card_gold_v4':'card_sage_v6'} data-frame-scale="0.13">
   <div className="mission-objective-icon"><Icon id={m.icon==='star'?'level_completed_v61':m.icon} size={40}/></div>
   <div className="mission-copy"><h3>{tr(m.title)}</h3><div className="activity-meter" role="progressbar" aria-label={tr(m.title)} aria-valuenow={m.progress} aria-valuemax={m.target}><i style={{width:100*m.progress/m.target+'%'}}/><span>{m.progress} / {m.target}</span></div></div>
   {m.claimed?<span className="mission-complete">{tr('수령 완료')}</span>:m.claimable?<Button className="mission-claim" attention={1} disabled={busy} onClick={()=>void claim([m.id])}>
    <span className="mission-claim-label">
     {m.reward.coins>0&&<span role="img" aria-label={tr('코인')+' '+m.reward.coins}><Icon id="coin" size={18}/></span>}
     {Object.entries(m.reward.items).map(([item,count])=><span key={item} role="img" aria-label={`${names[item]} ×${count}`}><Icon id={item} size={18}/></span>)}
     {tr('받기')}
    </span>
   </Button>:<span className="mission-in-progress">{tr('진행 중')}</span>}
  </section>)}</div>
 </div>;
}
// Retained for older isolated scroll fixtures. The live Events page uses EventTabs.
export function ActivityEntries({onPage,attendanceAvailable=false,seasonAvailable=true,seasonClaimableCount=0}:{onPage:(page:string)=>void;attendanceAvailable?:boolean;seasonAvailable?:boolean;seasonClaimableCount?:number}){
 const {counts}=useAttention();
 const jump=(id:string)=>{sound('button');document.getElementById(id)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
 return <nav className="event-icon-chips" aria-label={tr('이벤트 메뉴')}>
  <button className="event-icon-chip chip-festival" onClick={()=>onPage('power-festival')}><span className="event-chip-art"><Icon id="bundle_tools_v7" size={58}/><RewardDot count={counts.festival}/></span><strong>{tr('도구 축제')}</strong></button>
  <button className="event-icon-chip chip-treasure" onClick={()=>jump('event-treasure')}><span className="event-chip-art"><Icon id="chest" size={58}/><RewardDot count={counts.minigame}/></span><strong>{tr('보물 카드')}</strong></button>
  <button className="event-icon-chip chip-attendance" onClick={()=>jump('event-attendance')}><span className="event-chip-art"><img src={eventArt.calendar} alt="" draggable={false}/><RewardDot count={Number(attendanceAvailable)}/></span><strong>{tr('출석 선물')}</strong></button>
  {seasonAvailable?<button className="event-icon-chip chip-season" onClick={()=>jump('event-season')}><span className="event-chip-art"><Icon id="guild" size={58}/><RewardDot count={seasonClaimableCount}/></span><strong>{tr('시즌 이벤트')}</strong></button>:<button className="event-icon-chip chip-season" onClick={()=>{sound('button');onPage('pass')}}><span className="event-chip-art"><Icon id="star" size={58}/><RewardDot count={counts.pass}/></span><strong>{tr('정원 패스')}</strong></button>}
 </nav>;
}

const treasureKey=(id:string)=>'cloud-garden-treasure-'+id;
function savedPairs(attempt:TreasureAttempt):TreasurePair[]{try{const pairs=JSON.parse(localStorage.getItem(treasureKey(attempt.id))||'[]') as TreasurePair[];return replayTreasure(attempt.deck,pairs,attempt.maxTurns).valid?pairs:[];}catch{return [];}}
export function TreasureMenu({presentation}:{presentation?:'scene'}={}){
 const operations=useOperations();
 const {data,reload,updatePlayer,updateData}=useActivity(),[attempt,setAttempt]=useState<TreasureAttempt|null>(data?.minigame.active??null),[pairs,setPairs]=useState<TreasurePair[]>(()=>data?.minigame.active?savedPairs(data.minigame.active):[]),[flipped,setFlipped]=useState<number[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [showReward,setShowReward]=useState(false);
 const revealTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),finishGuard=useRef(false),startKey=useRef(key());
 useEffect(()=>()=>clearTimeout(revealTimer.current),[]);
 useEffect(()=>{if(!attempt&&data?.minigame.active){setAttempt(data.minigame.active);setPairs(savedPairs(data.minigame.active));}},[data?.minigame.active?.id]);
 const result=attempt?replayTreasure(attempt.deck,pairs,attempt.maxTurns):null,available=gameEventAvailable('treasure',operations.data?.settings,serverNow())&&!!data&&data.player.level>=gameEventConfig('treasure',operations.data?.settings).minLevel;
 const begin=async()=>{if(busy)return;setBusy(true);setMessage('');try{const res=await request<{player:Player;attempt:TreasureAttempt}>('/minigames/treasure/start',{key:startKey.current});startKey.current=key();updatePlayer(res.player);updateData(data=>({...data,minigame:{...data.minigame,active:res.attempt,remaining:Math.max(0,data.minigame.remaining-Number(data.minigame.active?.id!==res.attempt.id))}}));setAttempt(res.attempt);setPairs(savedPairs(res.attempt));setFlipped([]);await reload();}catch(error){setMessage(error instanceof Error?error.message:tr('잠시 후 다시 시도해 주세요.'));}finally{setBusy(false);}};
 const finish=useCallback(async()=>{
  if(!attempt||!result||result.status==='playing'||finishGuard.current||attempt.status!=='playing')return;
  finishGuard.current=true;setBusy(true);
  try{
   const res=await request<{player:Player;attempt:TreasureAttempt}>(`/minigames/treasure/${attempt.id}/finish`,{key:'treasure-finish-'+attempt.id,pairs});
   updatePlayer(res.player);
   updateData(data=>({...data,minigame:{...data.minigame,active:res.attempt.status==='playing'?res.attempt:null}}));
   setAttempt(res.attempt);
   if(res.attempt.status==='won'){
    setShowReward(!!res.attempt.reward);
    setMessage(res.attempt.reward?'':tr('보물 도구를 찾았어요!'));
    sound('win');
   }else setMessage(tr('아쉬워요! 다음 보물 카드에 도전해요.'));
   await reload();
  }catch(error){setMessage(error instanceof Error?error.message:tr('보상 확인 중'));}
  finally{finishGuard.current=false;setBusy(false);}
 },[attempt?.id,attempt?.status,pairs,result?.status,reload]);
 useEffect(()=>{if(result&&result.status!=='playing'&&!flipped.length&&attempt?.status==='playing')void finish();},[result?.status,flipped.length,attempt?.status,finish]);
 const flip=(index:number)=>{if(!attempt||!result||busy||attempt.status!=='playing'||result.status!=='playing'||flipped.length>=2||flipped.includes(index)||result.matched.includes(index))return;sound('button');const next=[...flipped,index];setFlipped(next);if(next.length===2){const pair={first:next[0]!,second:next[1]!};revealTimer.current=setTimeout(()=>{const nextPairs=[...pairs,pair];localStorage.setItem(treasureKey(attempt.id),JSON.stringify(nextPairs));setPairs(nextPairs);setFlipped([]);sound(attempt.deck[pair.first]===attempt.deck[pair.second]?'match':'invalid');},700);}};
 if(!data)return <LoadingActivity/>;
 if(presentation==='scene')return <><TreasureCardScene attempt={attempt} result={result} flipped={flipped} busy={busy} available={available} remaining={data.minigame.remaining} reset={duration(data.minigame.nextReset-serverNow())} message={message} onBegin={()=>void begin()} onFlip={flip} onFinish={()=>void finish()}/>{showReward&&attempt?.reward&&<TreasureRewardReveal reward={attempt.reward} reduced={data.player.settings.reducedMotion} onDismiss={()=>setShowReward(false)}/>}</>;
 return <div className="treasure-menu">{!attempt&&<div className="treasure-grid treasure-preview" aria-hidden="true">{Array.from({length:12},(_,index)=><div key={index} className="treasure-card"><span className="treasure-card-back"><Icon id="chest" size={37}/></span></div>)}</div>}<div className="treasure-status" data-frame="card_gold_v4" data-frame-scale="0.12"><span><Icon id="heart" size={24}/>{tr('하트 소모 없음')}</span><strong>{tr('오늘 남은 도전')} {data.minigame.remaining} / 3</strong></div>{attempt&&result?<><div className="treasure-score"><span>{tr('찾은 짝')} <b>{result.matched.length/2} / 6</b></span><span>{tr('남은 기회')} <b>{Math.max(0,attempt.maxTurns-result.turns)}</b></span></div><div className="treasure-grid" role="group" aria-label={tr('보물 카드 12장')}>{attempt.deck.map((color,index)=>{const shown=flipped.includes(index)||result.matched.includes(index),matched=result.matched.includes(index);return <button key={attempt.id+index} className={'treasure-card '+(shown?'is-open ':'')+(matched?'is-matched':'')} disabled={busy||matched||flipped.length>=2||attempt.status!=='playing'||result.status!=='playing'} aria-label={tr('카드')+' '+(index+1)+(shown?' · '+names[color]:'')} aria-pressed={shown} onClick={()=>flip(index)}><span className="treasure-card-back"><Icon id="chest" size={43}/><b>?</b></span><span className="treasure-card-face"><Icon id={'tile_'+color} size={64}/></span></button>;})}</div>{result.status==='playing'&&<section className="treasure-potential-prizes" data-frame="card_peach_v9" data-frame-scale="0.1"><strong>{tr('6쌍 완성 선물')}</strong><div>{['coin','hammer','cross-firework','color-magnet','move-hourglass'].map(item=><Icon key={item} id={item} size={27}/>)}</div></section>}{!showReward&&attempt.reward&&<div className="treasure-payout" data-frame="card_gold_v4" data-frame-scale="0.14"><Icon id="chest" size={56}/><ActivityRewards reward={attempt.reward}/></div>}{result.status!=='playing'&&attempt.status==='playing'&&<Button disabled={busy} onClick={()=>void finish()}>{busy?tr('보상 확인 중'):tr('보상 다시 확인')}</Button>}{attempt.status!=='playing'&&<Button disabled={busy||!available||data.minigame.remaining===0} onClick={()=>void begin()}>{data.minigame.remaining?tr('한 번 더 도전'):tr('오늘 도전 완료')}</Button>}</>:<><Card title={tr('짝을 찾아 도구를 모아요')} tone="blue"><p>{tr('12장의 카드에서 같은 그림 6쌍을 찾아요. 12번 안에 성공하면 코인과 도구를 받아요.')}</p><div className="treasure-sample-prizes" aria-label={tr('구출 보상')}>{['hammer','cross-firework','color-magnet','move-hourglass'].map(item=><Icon key={item} id={item} size={52}/>)}</div></Card><Button icon="chest" disabled={busy||!available||data.minigame.remaining===0} onClick={()=>void begin()}>{busy?tr('카드 준비 중'):data.minigame.remaining?tr('보물 카드 시작'):tr('오늘 도전 완료')}</Button></>}{message&&<p className="activity-feedback" role="status">{message}</p>}<p className="fine">{tr('새 도전까지')} {duration(data.minigame.nextReset-serverNow())}</p>{showReward&&attempt?.reward&&<TreasureRewardReveal reward={attempt.reward} reduced={data.player.settings.reducedMotion} onDismiss={()=>setShowReward(false)}/>}</div>;
}

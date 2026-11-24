import {refinedEventArt} from './event-refinement-art';
import './event-refinement-v74.css';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Action,ActivityReward,AnimalExpeditionAttempt,GameEvent,Player,ExpeditionAnimal} from '@garden/contracts';
import {actionWithFrames,type CascadeFrame} from '@garden/core';
import {ANIMAL_EXPEDITION_STAGES,expeditionDailyStatus,EXPEDITION_ANIMALS,configuredExpeditionRound,expeditionRounds,expeditionRound} from '../../../packages/content/src/animal-expedition';
import {gameEventAvailable,gameEventConfig} from '../../../packages/contracts/src/operations';
import {restoreExpedition,expeditionCacheKey,expeditionCanResume} from './expedition-progress';
import {useOperations} from './OperationsUI';
import Board from './CascadeBoard';
import PlayHud from './PlayHud';
import ArtSurface from './ArtSurface';
import {ActivityRewards} from './Activity';
import ExpeditionRouteMap from './ExpeditionRouteMap';
import {WORLD_ART} from './garden-world/assets';
import {tr,formatLocale} from './i18n';
import {request,key,serverNow,duration,ApiFailure} from './api';
import {Button,Icon,Modal,Poster,names} from './ui';
import {sound} from './sound';
import './expedition-map.css';
interface Props {player:Player;onPlayer:(player:Player)=>void;onClose:()=>void;onPage:(page:string)=>void;embedded?:boolean;weekly?:boolean}
interface ExpeditionReceipt {stage:number;reward:ActivityReward;friend:boolean;animal:ExpeditionAnimal}
function ExpeditionRewards({reward,friend=false,animal='panda'}:{reward:ActivityReward;friend?:boolean;animal?:ExpeditionAnimal}){
 const friendInfo=EXPEDITION_ANIMALS[animal];
 return <div className="expedition-rewards" role="group" aria-label={tr('구출 보상')}>
  {reward.coins>0&&<div className="expedition-reward-entry" aria-label={tr('코인')+' +'+reward.coins}><Icon id="coin" size={38}/><span><small>{tr('코인')}</small><strong>+{reward.coins.toLocaleString(formatLocale())}</strong></span></div>}
  {Object.entries(reward.items).filter(([,count])=>(count??0)>0).map(([item,count])=><div key={item} className="expedition-reward-entry" aria-label={tr(names[item]??item)+' ×'+count}><Icon id={item} size={40}/><span><small>{tr(names[item]??item)}</small><strong>×{count}</strong></span></div>)}
  {friend&&<div className="expedition-reward-entry expedition-reward-friend" aria-label={tr(friendInfo.name)+' ×1'}><img src={WORLD_ART[friendInfo.itemId]} alt=""/><span><small>{tr(friendInfo.name)}</small><strong>×1</strong></span></div>}
 </div>;
}
export default function AnimalExpedition(props:Props){
 const {player}=props;
 const {data:operations}=useOperations(),config=gameEventConfig('animalExpedition',operations?.settings),configured=configuredExpeditionRound(operations?.settings,serverNow());
 const [selectedRound,setSelectedRound]=useState<string|null>(null),rounds=expeditionRounds(player.animalExpedition),known=expeditionRound(player.animalExpedition,selectedRound??configured.roundId);
 const progress=known??{...configured,completedStages:0,completedAttempts:[]},attempt=progress.attempt,completed=progress.completedStages,animal=progress.animal,friendInfo=EXPEDITION_ANIMALS[animal];
 const now=serverNow(),daily=expeditionDailyStatus(player.animalExpedition,now,config.dailyLimit),available=gameEventAvailable('animalExpedition',operations?.settings,now),resumable=expeditionCanResume(player,progress.roundId);
 const [playing,setPlaying]=useState(false),menuHost=useRef<HTMLDivElement>(null),roundHost=useRef<Element|null>(null);
 const [received,setReceived]=useState<ExpeditionReceipt|null>(null);
 const [showCourses,setShowCourses]=useState(false);
 useEffect(()=>{roundHost.current=menuHost.current?.closest('.game-shell')??null;},[]);
 useEffect(()=>{if(received)(menuHost.current?.closest('.event-tab-panel,.modal-content') as HTMLElement|undefined)?.scrollTo({top:0,behavior:'instant'});},[received]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const guard=useRef(false),alive=useRef(true),startKey=useRef(key());
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 async function start(restart=false){if(guard.current)return;if(props.embedded&&attempt&&!restart){setSelectedRound(progress.roundId);setPlaying(true);return;}guard.current=true;setSelectedRound(progress.roundId);setBusy(true);setError('');try{const result=await request<{player:Player}>('/animal-expedition/start',{key:startKey.current,roundId:progress.roundId,...(restart?{restart:true,attemptId:attempt?.id}:{})});if(!alive.current)return;startKey.current=key();props.onPlayer(result.player);setPlaying(true);}catch(e){if(alive.current)setError(e instanceof Error?e.message:tr('다시 시도해 주세요.'));if(e instanceof ApiFailure&&['EXPEDITION_DAILY_LIMIT','EXPEDITION_CHANGED'].includes(e.code)){try{const current=await request<{player:Player}>('/me');if(alive.current)props.onPlayer(current.player);}catch{}}}finally{guard.current=false;if(alive.current)setBusy(false);}}
 if(attempt&&(!props.embedded||playing)){const round=<ExpeditionRound key={attempt.id} {...props} onClose={props.embedded?()=>setPlaying(false):props.onClose} onCollected={setReceived} animal={animal} attempt={attempt} restart={()=>void start(true)} restarting={busy} parentError={error}/>;return props.embedded&&roundHost.current?createPortal(round,roundHost.current):round;}
 const nextCourse=ANIMAL_EXPEDITION_STAGES[completed],stageCount=ANIMAL_EXPEDITION_STAGES.length;
 const startLabel=busy?tr('원정 준비 중…'):
  resumable?tr('이어서 구출'):
  daily.remaining===0?tr('오늘의 도전을 모두 사용했어요'):
  !available?tr('이벤트 준비 중'):
  attempt?tr('재시도'):tr('{0}단계 시작',{0:completed+1});
 const startDisabled=busy||(!resumable&&(player.level<config.minLevel||!available||daily.remaining===0));
 const begin=()=>void start(!!attempt&&!resumable);
 const earlierRounds:typeof rounds=[];
 const roundsLabel=tr(friendInfo.name)+' · '+tr('이번 원정');
 const courses=showCourses?<Modal title={tr('원정 코스')} onClose={()=>setShowCourses(false)} wide>
  <p className="intro">{tr('하트와 보유 도구를 쓰지 않아요. 완료한 코스는 나갔다 와도 유지돼요.')}</p>
  <p className="intro">{tr('한국 시간 00:00 초기화 · 이어하기는 차감 없어요.')}</p>
  <ol className="expedition-course-list">{ANIMAL_EXPEDITION_STAGES.map((stage,i)=><li key={stage.title} className={i<completed?'is-complete':i===completed?'is-current':''} aria-current={i===completed?'step':undefined}>
   <span>{i+1}</span><div><strong>{tr(stage.title)}</strong><small>{tr(i<completed?'구출 완료':i===completed?'이번에 구할 친구':'앞 코스 완료 후 열려요.')}</small></div>
   {i===completed&&<ActivityRewards reward={stage.reward}/>}
  </li>)}</ol>
 </Modal>:null;
 if(props.weekly)return <div ref={menuHost} className="weekly-rescue-layout">
  <strong className="weekly-rescue-quota">{tr('오늘 도전 {0} / {1}',{0:daily.remaining,1:daily.maximum})}</strong>
  <div className="weekly-rescue-sign"><img src={refinedEventArt.sign} alt=""/><span>{tr(friendInfo.name)}<br/>{tr("구출!")}</span></div><span className="weekly-rescue-log">{tr("탐험 기록")}</span>
  <img className="weekly-rescue-friend" src={WORLD_ART[friendInfo.itemId]} alt={tr(friendInfo.name)}/>
  {[completed+1<=3?completed+1:1,completed+1>=4&&completed+1<=7?completed+1:5,completed+1>=8?Math.min(stageCount,completed+1):stageCount].map((stage,i)=><button key={i} className={'weekly-trail-step trail-step-'+i} disabled={stage!==completed+1||startDisabled} aria-label={tr('{0}단계 시작',{0:stage})} onClick={begin}><img className="weekly-trail-flag" src={refinedEventArt.flag} alt=""/>{tr('{0}단계',{0:stage})}</button>)}
  <section className="weekly-rescue-rewards" aria-label={tr('구출 보상')}>
   <div><strong>{nextCourse?tr('{0}단계 보상',{0:completed+1}):tr('구출 완료')}</strong>{nextCourse&&<ActivityRewards reward={nextCourse.reward}/>}</div>
   <div><strong>{tr('완주 보상')}</strong><img src={WORLD_ART[friendInfo.itemId]} alt={tr(friendInfo.name)}/><ActivityRewards reward={ANIMAL_EXPEDITION_STAGES.at(-1)!.reward}/></div>
  </section>
  <Button rasterFrame={false} className="weekly-scene-cta" disabled={nextCourse?startDisabled:false} onClick={nextCourse?begin:()=>props.onPage('garden-bag')}>{nextCourse?startLabel:tr('정원에 초대하기')}</Button>
  {error&&<p className="weekly-scene-error" role="alert">{error}</p>}
  {received&&<p className="weekly-scene-message" role="status">{tr('{0}코스 보상을 받았어요!',{0:received.stage})}</p>}
 </div>;
 const content=<div ref={menuHost} className="expedition-menu expedition-map-menu">
  {received&&<section className="expedition-reward-summary expedition-receipt" data-frame="card_ice_v9" data-frame-scale="0.13" role="status"><h3>{tr('{0}코스 보상을 받았어요!',{0:received.stage})}</h3><ExpeditionRewards reward={received.reward} friend={received.friend} animal={received.animal}/></section>}
  <header className="expedition-map-heading">
   {props.embedded&&<h2 className="expedition-map-title">{tr('동물 구출 원정')}</h2>}
   {earlierRounds.length>0?<label className="expedition-map-round">
    <span className="sr-only">{tr('원정 회차 선택')}</span>
    <select value={progress.roundId} disabled={busy} onChange={event=>{setSelectedRound(event.currentTarget.value);setReceived(null);setError('');}}>
     <option value={configured.roundId}>{tr(EXPEDITION_ANIMALS[configured.animal].name)} · {tr('이번 원정')}</option>
     {earlierRounds.map(round=><option key={round.roundId} value={round.roundId}>{tr(EXPEDITION_ANIMALS[round.animal].name)} · {round.completedStages}/{stageCount}</option>)}
    </select>
   </label>:<div className="expedition-map-round">{roundsLabel}</div>}
   <div className="expedition-map-status">
    <strong>{tr('오늘 도전 {0} / {1}',{0:daily.remaining,1:daily.maximum})}</strong>
    <button type="button" className="expedition-map-progress" aria-haspopup="dialog" onClick={()=>setShowCourses(true)}>
     {tr('진행 {0} / {1}',{0:completed,1:stageCount})}<span aria-hidden="true">›</span>
    </button>
   </div>
  </header>
  <ExpeditionRouteMap animal={animal} completed={completed} startLabel={startLabel} startDisabled={startDisabled} onStart={begin}/>
  <footer className="expedition-map-actions">
   {nextCourse?<>
    <h3>{tr(nextCourse.title)}</h3>
    <Button tone="green" rasterFrame={false} className="expedition-map-start" disabled={startDisabled} onClick={begin}>{startLabel}</Button>
    {daily.remaining===0&&!resumable&&<span className="expedition-map-note">{tr('다음 도전까지 {0}',{0:duration(daily.nextReset-now)})}</span>}
   </>:<>
    <h3>{tr('{0} · 정원에 초대해요',{0:tr(friendInfo.name)})}</h3>
    <Button tone="gold" rasterFrame={false} className="expedition-map-start" onClick={()=>props.onPage('garden-bag')}>{tr('정원에 초대하기')}</Button>
    <span className="expedition-map-note">{tr('보관함에서 놓으면 정원을 천천히 산책해요.')}</span>
   </>}
   {error&&<p role="alert" className="content-event-error">{error}</p>}
  </footer>
  {courses&&(roundHost.current?createPortal(courses,roundHost.current):courses)}
 </div>;
 return props.embedded?content:<Modal title={tr('동물 구출 원정')} onClose={props.onClose}>{content}</Modal>;
}
type ExpeditionRoundProps=Props&{animal:ExpeditionAnimal;attempt:AnimalExpeditionAttempt;restart:()=>void;restarting:boolean;parentError:string;onCollected:(receipt:ExpeditionReceipt)=>void};

function ExpeditionRound(props:ExpeditionRoundProps){
 const cacheKey=expeditionCacheKey(props.player.id,props.attempt.id);
 const [saved]=useState(()=>{
  let raw:string|null=null;
  try{raw=localStorage.getItem(cacheKey);}catch{}
  try{return restoreExpedition(props.attempt,raw);}catch{return null;}
 });
 if(!saved)return <Modal title={tr('동물 구출 원정')} onClose={props.onClose}>
  <p role="alert">{tr('퍼즐 정보를 확인하지 못했어요. 다시 불러와 주세요.')}</p>
  <Button onClick={props.onClose}>{tr('나가기')}</Button>
 </Modal>;
 return <ExpeditionBoard {...props} cacheKey={cacheKey} saved={saved}/>;
}

function ExpeditionBoard({player,attempt,animal,onPlayer,onClose,restart,restarting,parentError,onCollected,cacheKey,saved}:ExpeditionRoundProps&{cacheKey:string;saved:ReturnType<typeof restoreExpedition>}){
 const [state,setState]=useState(saved.state),[shownState,setShownState]=useState(saved.state),[events,setEvents]=useState<GameEvent[]>([]),[frames,setFrames]=useState<CascadeFrame[]>([]),[lastAction,setLastAction]=useState<Action>(),[locked,setLocked]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [retryConfirm,setRetryConfirm]=useState(false),{data:operations}=useOperations(),now=serverNow(),config=gameEventConfig('animalExpedition',operations?.settings),daily=expeditionDailyStatus(player.animalExpedition,now,config.dailyLimit),canRetry=player.level>=config.minLevel&&daily.remaining>0&&gameEventAvailable('animalExpedition',operations?.settings,now);
 const current=useRef(state),log=useRef(saved.actions),guard=useRef(false),claimGuard=useRef(false),alive=useRef(true);current.current=state;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 function persist(){try{localStorage.setItem(cacheKey,JSON.stringify(log.current));}catch{setError(tr('이 기기에 원정 진행을 보관할 수 없어요. 화면을 나가기 전에 코스를 마쳐 주세요.'));}}
 function act(action:Action){if(retryConfirm||guard.current||saving||restarting||current.current.status!=='playing'||!['swap','tap'].includes(action.type))return;const result=actionWithFrames(current.current,action);if(!result.accepted)return;guard.current=true;setLocked(true);current.current=result.state;log.current=[...log.current,action];persist();setLastAction(action);setFrames(result.frames);setEvents(result.events);setState(result.state);}
 async function finish(){if(claimGuard.current||locked||current.current.status!=='won')return;claimGuard.current=true;setSaving(true);setError('');try{const result=await request<{player:Player;reward?:ActivityReward}>('/animal-expedition/finish',{key:'expedition-finish-'+attempt.id,attemptId:attempt.id,actions:log.current});if(!alive.current)return;try{localStorage.removeItem(cacheKey)}catch{}sound('win');onCollected({stage:attempt.stage,reward:result.reward??ANIMAL_EXPEDITION_STAGES[attempt.stage-1]!.reward,friend:attempt.stage===ANIMAL_EXPEDITION_STAGES.length,animal});onPlayer(result.player);}catch(e){if(alive.current)setError(e instanceof Error?e.message:tr('연결되면 구출 기록을 다시 저장할 수 있어요.'));}finally{claimGuard.current=false;if(alive.current)setSaving(false);}}
 const definition=ANIMAL_EXPEDITION_STAGES[attempt.stage-1]!;
 return <section className="game-shell playing animal-expedition-screen" role="dialog" aria-modal="true" aria-label={tr('동물 구출 원정')} data-result={state.status==='won'&&locked?'playing':state.status} data-art-root>
  <ArtSurface scene="play"/>
  <PlayHud animal={animal} state={shownState} moves={state.moves} tool={null} locked={locked||saving||restarting||retryConfirm} onCancelTool={()=>{}}/>
  <div className="board-area"><div className="level-ribbon expedition-event-level" data-frame="event_sky_v9" data-frame-scale="0.1"><span>{tr('동물 구출 원정')} {attempt.stage}</span></div><Board animal={animal} state={state} events={events} frames={frames} action={lastAction} onStateShown={setShownState} locked={locked||saving||restarting||retryConfirm||state.status!=='playing'} tool={null} onAction={act} onVisualStart={()=>{guard.current=true;setLocked(true)}} onVisualSettled={()=>{guard.current=false;setLocked(false)}} reduced={player.settings.reducedMotion}/></div>
  <footer className="play-footer expedition-controls" data-frame="dock_v3" data-frame-bleed="8"><div className="expedition-round-actions"><Button secondary icon="shuffle" disabled={locked||saving||restarting||retryConfirm||state.status!=='playing'||!canRetry} onClick={()=>setRetryConfirm(true)}>{tr('재시도')}</Button><Button tone="gold" icon="home" disabled={saving||restarting||retryConfirm||state.status!=='playing'} onClick={onClose}>{tr('나가기')}</Button></div></footer>
  {retryConfirm&&<Modal title={tr('재시도할까요?')} onClose={()=>{if(!restarting)setRetryConfirm(false)}}><p>{tr('이번 판을 처음부터 시작하고 오늘 도전 1회를 사용해요.')}</p><p className="expedition-retry-remaining">{tr('오늘 도전 {0} / {1}',{0:daily.remaining,1:daily.maximum})}</p><Button disabled={restarting||!canRetry} onClick={restart}>{tr(restarting?'원정 준비 중…':'재시도')}</Button><Button secondary disabled={restarting} onClick={()=>setRetryConfirm(false)}>{tr('취소')}</Button>{parentError&&<p role="alert" className="content-event-error">{parentError}</p>}</Modal>}
  {state.status==='won'&&!locked&&!retryConfirm&&<Modal theme="result" title={tr('집까지 무사히 도착했어요!')} onClose={onClose}><Poster id="poster_victory_v5" className="victory-poster" label={tr('꽃별을 들어 올리며 기뻐하는 루미')}/><section className="expedition-reward-summary" data-frame="card_ice_v9" data-frame-scale="0.13"><h3>{tr('구출 보상')}</h3><ExpeditionRewards reward={definition.reward} friend={attempt.stage===ANIMAL_EXPEDITION_STAGES.length} animal={animal}/></section><Button tone="gold" disabled={saving} onClick={()=>void finish()}>{saving?tr('구출 기록 저장 중…'):tr('선물 받고 원정 계속하기')}</Button>{(error||parentError)&&<p role="alert" className="content-event-error">{error||parentError}</p>}</Modal>}
  {!locked&&!retryConfirm&&(state.status==='lost'||state.status==='error')&&<Modal theme="result" title={tr('다시 도전해 볼까요?')} onClose={onClose}><p>{tr('완료한 코스는 유지돼요. 이 길에 다시 도전해 볼까요?')}</p><Button disabled={restarting||!canRetry} onClick={()=>setRetryConfirm(true)}>{tr('재시도')}</Button><p className="fine">{tr('오늘 도전 {0} / {1}',{0:daily.remaining,1:daily.maximum})}</p>{(error||parentError)&&<p role="alert" className="content-event-error">{error||parentError}</p>}</Modal>}
 </section>;
}

import {tr} from "./i18n";
import {useCallback,useEffect,useRef,useState} from 'react';
import {createGame,applyAction} from '@garden/core';
import {BRIDGE_EPISODE,bridgeLevel,bridgeStage} from '@garden/content';
import type {Action,GameEvent,Player,StoryState,DailyRescueState,DailyRescueResult} from '@garden/contracts';
import {art} from './assets';
import {request,serverNow} from './api';
import Board from './Board';
import ArtSurface from './ArtSurface';
import {Amount,Button,Icon,IconButton,names} from './ui';
import {dailyRescueCacheKey,restoreRescue} from './rescue-progress';
import './rescue.css';
interface Props {player:Player;onClose:()=>void;onHome:()=>void;onComplete:()=>void;onPlayer?:(player:Player)=>void}
export default function BridgeEpisode(props:Props){
 const [daily,setDaily]=useState<DailyRescueState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const generation=useRef(0);
 const reload=useCallback(async()=>{const ticket=++generation.current;setLoading(true);setError('');try{const story=await request<StoryState>('/story');if(ticket!==generation.current)return;if(!story.dailyRescue)throw Error(tr('오늘의 구조 도전을 준비 중이에요. 잠시 후 다시 열어 주세요.'));setDaily(story.dailyRescue);}catch(e){if(ticket===generation.current)setError(e instanceof Error?e.message:tr('연결을 확인해 주세요.'));}finally{if(ticket===generation.current)setLoading(false);}},[props.player.id]);
 useEffect(()=>{void reload();const resume=()=>{if(!document.hidden)void reload();};document.addEventListener('visibilitychange',resume);return()=>{generation.current++;document.removeEventListener('visibilitychange',resume);}},[reload]);
 useEffect(()=>{if(!daily)return;const timer=setTimeout(()=>void reload(),Math.max(50,daily.endsAt-serverNow()+50));return()=>clearTimeout(timer);},[daily?.endsAt,reload]);
 if(!daily)return <section className="rescue-screen" aria-label={tr('구름길 구조대')} data-art-root><ArtSurface scene="play"/><div className="rescue-loading"><Icon id="tori_v8" size={90}/><p role="status">{error||tr('오늘의 구조 도전을 불러오는 중…')}</p>{error&&<Button disabled={loading} onClick={()=>void reload()}>{tr('다시 불러오기')}</Button>}<Button secondary onClick={props.onClose}>{tr('돌아가기')}</Button></div></section>;
 return <DailyBridgeRound key={props.player.id+daily.periodId} {...props} daily={daily} onClaim={setDaily} onDayChanged={()=>void reload()}/>;
}
function DailyBridgeRound({player,onClose,onHome,onComplete,onPlayer,daily,onClaim,onDayChanged}:Props&{daily:DailyRescueState;onClaim:(daily:DailyRescueState)=>void;onDayChanged:()=>void}){
 const cacheKey=dailyRescueCacheKey(player.id,daily.periodId),[saved]=useState(()=>{try{return restoreRescue(daily.claimed?null:localStorage.getItem(cacheKey))}catch{return restoreRescue(null)}});
 const [state,setState]=useState(saved.state),[actions,setActions]=useState(saved.actions),[events,setEvents]=useState<GameEvent[]>([]);
 const [started,setStarted]=useState(saved.actions.length>0),[locked,setLocked]=useState(false),[stage,setStage]=useState(bridgeStage(saved.state.goals));
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[finished,setFinished]=useState(false);
 const current=useRef(state),log=useRef(actions),guard=useRef(false),claimGuard=useRef(false),alive=useRef(true),target=useRef(stage);current.current=state;log.current=actions;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;}},[]);
 const claimed=daily.claimed||finished,displayStage=claimed?3:stage;
 useEffect(()=>{if(claimed)return;try{localStorage.setItem(cacheKey,JSON.stringify(actions));}catch{setError(tr("이 기기에 진행을 보관할 수 없어요. 화면을 나가기 전에 이야기를 마쳐 주세요."));}},[cacheKey,actions,claimed]);
 const act=(action:Action)=>{if(guard.current||locked||!started||current.current.status!=='playing'||!['swap','tap'].includes(action.type))return;
 const r=applyAction(current.current,action);if(!r.accepted)return;guard.current=true;target.current=bridgeStage(r.state.goals);setLocked(true);setEvents(r.events);setState(r.state);setActions([...log.current,action]);};
 const settle=()=>{setStage(target.current);setLocked(false);guard.current=false;};
 const restart=()=>{const next=createGame(bridgeLevel());current.current=next;log.current=[];guard.current=false;target.current=0;setState(next);setActions([]);setStage(0);setEvents([]);setLocked(false);setError('');setFinished(false);setStarted(true);};
 const complete=async()=>{if(claimGuard.current||claimed)return;claimGuard.current=true;setSaving(true);setError('');try{const result=await request<DailyRescueResult>('/story/episodes/bridge-v1/complete',{actions:log.current,periodId:daily.periodId});if(!alive.current)return;onPlayer?.(result.player);setFinished(true);onClaim(result.dailyRescue);try{localStorage.removeItem(cacheKey);}catch{}onComplete();}catch(e){if(alive.current){setError(e instanceof Error?e.message:tr("연결되면 구조 기록을 다시 저장할 수 있어요."));if((e as {code?:string}).code==='RESCUE_DAY_CHANGED')onDayChanged();}}finally{if(alive.current)setSaving(false);claimGuard.current=false;}};
 return <section className="rescue-screen" aria-label={BRIDGE_EPISODE.title} data-art-root>
  <ArtSurface scene="play"/>
  <div className="rescue-scroll">
  <header className="rescue-header" data-frame="footer_azure_v9"><Icon id="tori_v8" size={48}/><div><small>{tr("구름길 구조대")}</small><h1>{tr("토리의 구름다리")}</h1></div><IconButton id="close" label={tr("이야기 나가기")} onClick={onClose}/></header>
  <div className="rescue-cinematic" data-stage={displayStage}>
   <img className="rescue-environment" src={art(BRIDGE_EPISODE.scene)} alt={tr("구름 사이로 끊어진 다리와 양쪽 정원")}/>
   {[0,1,2].map(i=><img key={i} className={'rescue-plank'+(displayStage>i?' is-built':'')} style={{left:(27+i*15)+'%'}} src={art(BRIDGE_EPISODE.plank)} alt={displayStage>i?tr("연결된 다리 조각"):''}/>)}
   <img className={'rescue-tori'+(displayStage===3?' is-safe':'')} src={art('tori_v8')} alt={displayStage===3?tr("안전한 정원에 도착한 토리"):tr("다리 앞에서 기다리는 토리")}/>
  </div>
  <p className="rescue-dialogue" data-frame="card_ice_v9" aria-live="polite">{displayStage===3?tr("토리: 편지도 무사해! 이제 축제에 갈 수 있겠어!"):!started?tr("토리: 바람에 다리가 끊어졌어! 나무 조각 세 개만 모아 줄래?"):stage===0?tr("상자 세 개를 열어 다리를 이어 주세요."):stage===1?tr("토리: 첫 조각이 연결됐어! 조금만 더!"):tr("토리: 거의 다 왔어! 마지막 조각을 부탁해!")}</p>
  {claimed?<div className="rescue-intro rescue-daily-done" data-frame="card_peach_v9"><h2>{tr('오늘의 구조 완료!')}</h2><Icon id={daily.reward.item} size={85}/><Amount kind={daily.reward.item} value={'+'+daily.reward.quantity}/><p>{tr('오늘 보상을 받았어요.')}</p><small>{tr('한국 시간 자정에 새 도전이 열려요.')}</small><Button onClick={onHome}>{tr('정원으로')}</Button></div>:!started?<div className="rescue-intro" data-frame="card_peach_v9"><Icon id="crate_1" size={74}/><p>{tr("퍼즐 속 상자를 열면")}<br/>{tr("구름다리가 한 조각씩 연결돼요.")}</p><div className="rescue-daily-reward"><span>{tr('오늘의 보상')}</span><Amount kind={daily.reward.item} value={'+'+daily.reward.quantity}/></div><Button onClick={()=>setStarted(true)}>{tr("오늘의 구조 도전")}</Button><small>{tr("하트와 보유 도구를 사용하지 않아요.")}<br/>{tr('성공 보상은 하루 한 번 받을 수 있어요.')}</small></div>:<>
   <div className="rescue-targets" data-frame="resource_pearl_v9"><span><Icon id="crate_1" size={34}/><strong>{state.goals[0]!.remaining}</strong></span><span>{tr("남은 이동")}{' '}<strong>{state.moves}</strong></span></div>
   <div className="rescue-board"><Board state={state} events={events} tool={null} locked={locked||state.status!=='playing'} onAction={act} onVisualStart={()=>setLocked(true)} onVisualSettled={settle} reduced={false}/></div>
   {(state.status==='lost'||state.status==='error')&&!locked?<div className="rescue-actions"><p>{tr("바람이 잠잠해졌어요. 다시 이어 볼까요?")}</p><Button onClick={restart}>{tr("다시 도전")}</Button></div>:stage===3&&!locked?<div className="rescue-actions"><Button icon={daily.reward.item} disabled={saving} onClick={()=>void complete()}>{saving?tr('보상을 받는 중…'):tr('보상 받기')+' · '+names[daily.reward.item]+' +'+daily.reward.quantity}</Button>{error&&<p role="alert">{tr(error)}</p>}</div>:<p className="rescue-footnote">{tr("연결한 다리는 나갔다 와도 이어져요.")}</p>}
  </>}
  </div>
 </section>;
}

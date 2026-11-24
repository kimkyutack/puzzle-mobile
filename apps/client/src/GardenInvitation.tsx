import {useCallback,useEffect,useRef,useState} from 'react';
import type {Player} from '@garden/contracts';
import {GARDEN_INVITE_STAGES,type GardenInviteState} from '../../../packages/contracts/src/garden-invite';
import {request,serverNow} from './api';
import {Button,Icon} from './ui';
import {tr} from './i18n';
import {WORLD_ART} from './garden-world/assets';
import HubLoading from './HubLoading';
import heroPrepare from '../../../packages/assets/garden-invite-v117/runtime/hero-prepare.webp';
import heroShare from '../../../packages/assets/garden-invite-v117/runtime/hero-share.webp';
import heroReward from '../../../packages/assets/garden-invite-v117/runtime/hero-reward.webp';
import ticket from '../../../packages/assets/garden-invite-v117/runtime/invite-icon.webp';
import pavilion from '../../../packages/assets/garden-invite-v117/runtime/pavilion.webp';
import './garden-invitation.css';

const objectives={bench:{title:'벤치 놓기',art:'garden-bench'},building:{title:'건물 복원',art:'garden-greenhouse'},tree:{title:'나무 배치',art:'garden-tree'}} as const;
interface Props {player:Player;onPlayer:(player:Player)=>void;onStatus:(claimable:boolean)=>void;onPage:(page:string)=>void}
export default function GardenInvitation({player,onPlayer,onStatus,onPage}:Props){
 const [data,setData]=useState<GardenInviteState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[now,setNow]=useState(serverNow),[showReward,setShowReward]=useState(false);
 const live=useRef(true),sequence=useRef(0),actionKey=useRef<{action:string;key:string}|null>(null),inFlight=useRef(false);
 const load=useCallback(async()=>{const current=++sequence.current;try{const result=await request<GardenInviteState>('/garden/invite');if(live.current&&current===sequence.current){setData(result);onStatus(!!GARDEN_INVITE_STAGES[result.claimedStages]&&result.visitors>=GARDEN_INVITE_STAGES[result.claimedStages]!.visitors);setError('');}}catch(cause){if(live.current&&current===sequence.current)setError(cause instanceof Error?cause.message:tr('연결을 확인해 주세요.'));}finally{if(live.current&&current===sequence.current)setLoading(false);}},[onStatus]);
 useEffect(()=>{live.current=true;void load();const refresh=()=>{if(!document.hidden)void load();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=window.setInterval(refresh,25_000);return()=>{live.current=false;sequence.current++;window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[load]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(serverNow()),1000);return()=>window.clearInterval(timer);},[]);
 async function act(action:'prepare'|'share'|'claim',stage?:number){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');
  const identity=action+':'+(stage??'');if(actionKey.current?.action!==identity)actionKey.current={action:identity,key:crypto.randomUUID()};
  try{
   const result=await request<{player?:Player;granted?:boolean;decoration?:string}>('/garden/invite/'+action,{key:actionKey.current.key,...(stage?{stage}:{})});
   if(!live.current)return;
   actionKey.current=null;if(result.player)onPlayer(result.player);
   if(action==='share')setNotice(tr('길드 채팅에 정원 초대장을 보냈어요!'));
   if(action==='claim'){setNotice(tr(result.decoration?'별빛 소원 정자를 보관함에 넣었어요!':'방문객 선물을 받았어요!'));setShowReward(false);}
   await load();
  }catch(cause){if(live.current)setError(cause instanceof Error?cause.message:tr('잠시 후 다시 시도해 주세요.'));}
  finally{inFlight.current=false;if(live.current)setBusy(false);}
 }
 if(!data)return <div className="garden-invite-loading"><HubLoading kind="events" reducedMotion={player.settings.reducedMotion} error={error} retrying={loading} onRetry={()=>{setLoading(true);void load();}}/></div>;
 const complete=data.objectives.filter(goal=>goal.complete).length,prepared=complete===data.objectives.length;
 const next=GARDEN_INVITE_STAGES[data.claimedStages],claimable=!!next&&data.visitors>=next.visitors;
 const rewardView=showReward&&claimable,phase=!data.ready?'prepare':rewardView?'reward':'share';
 const cooldown=Math.max(0,Math.ceil((data.nextShareAt-now)/1000));
 const help=phase==='prepare'?'정원을 꾸미고 초대를 준비해요':phase==='reward'?'친구들이 찾아와 선물이 도착했어요!':'채팅에 공유하면 친구들이 찾아와요';
 const label=busy?'확인 중…':phase==='prepare'?(prepared?'초대 준비 완료':'정원 꾸미기'):rewardView?'보상 받기':claimable?'방문객 선물 보기':!player.guildId?'길드 찾아보기':cooldown?tr('{0}초 뒤 다시 공유',{0:cooldown}):'채팅에 정원 공유';
 function primary(){
  if(phase==='prepare'){if(prepared)void act('prepare');else onPage('garden');}
  else if(rewardView)void act('claim',data!.claimedStages+1);
  else if(claimable)setShowReward(true);
  else if(!player.guildId)onPage('guild/find');
  else void act('share');
 }
 return <section className="garden-invitation" data-phase={phase} data-reduced-motion={player.settings.reducedMotion} aria-label={tr('내 정원에 놀러 와!')}>
  <h2>{tr('내 정원에 놀러 와!')}</h2>
  <p className="garden-invite-status"><img src={ticket} alt=""/>{!data.ready?tr('초대 준비 {0} / 3',{0:complete}):rewardView?tr('방문객 {0}명 달성!',{0:next!.visitors}):tr('방문객 {0}명',{0:data.visitors})}</p>
  <div className="garden-invite-hero"><img data-hero="prepare" src={heroPrepare} alt="" draggable={false}/><img data-hero="share" src={heroShare} alt="" draggable={false}/><img data-hero="reward" src={heroReward} alt="" draggable={false}/></div>
  <div className="garden-invite-information">
   {phase==='prepare'?<ul className="garden-invite-objectives">{data.objectives.map(goal=><li key={goal.id}><img src={WORLD_ART[objectives[goal.id].art]} alt=""/><strong>{tr(objectives[goal.id].title)}</strong><span className={goal.complete?'is-complete':''}>{goal.complete?'✓':'○'}</span><b>{goal.complete?1:0} / 1</b></li>)}</ul>:rewardView?<div className="garden-invite-prize"><h3>{tr('{0}명 방문 선물',{0:next!.visitors})}</h3><div><span><Icon id="coin"/><strong>{next!.reward.coins.toLocaleString()}</strong></span>{Object.entries(next!.reward.items).map(([id,n])=><span key={id}><Icon id={id}/><strong>×{n}</strong></span>)}{next!.decoration&&<span className="garden-invite-exclusive"><img src={pavilion} alt=""/><strong>{tr('별빛 소원 정자')}</strong><small>{tr('100명 한정 장식')}</small></span>}</div></div>:<div className="garden-invite-milestones">
    <p>{next?tr('다음 선물까지 {0} / {1}명',{0:Math.min(data.visitors,next.visitors),1:next.visitors}):tr('모든 방문객 선물을 받았어요!')}</p>
    <progress max={next?.visitors??100} value={Math.min(data.visitors,next?.visitors??100)} aria-label={tr('방문객 진행도')}/>
    <ol>{GARDEN_INVITE_STAGES.map((stage,index)=><li key={stage.visitors} data-current={index===data.claimedStages} data-claimed={index<data.claimedStages}><strong>{tr('{0}명',{0:stage.visitors})}{index<data.claimedStages&&' ✓'}</strong>{stage.decoration?<img src={pavilion} alt={tr('별빛 소원 정자')}/>:<Icon id={index?'chest':'coin'}/>}<small>{tr(stage.decoration?'별빛 소원 정자':index?'코인 + 무지개등':'코인 + 망치')}</small></li>)}</ol>
   </div>}
  </div>
  <p className="garden-invite-caption"><span aria-hidden="true">ⓘ</span>{tr(help)}</p>
  <Button className="garden-invite-primary" tone="green" disabled={busy||(!data.ready&&!data.eligible)||(!claimable&&data.ready&&!!player.guildId&&cooldown>0)} onClick={primary}>{tr(label)}</Button>
  {notice&&<p className="garden-invite-notice" role="status">{notice}{notice.includes(tr('별빛 소원 정자'))&&<Button secondary onClick={()=>onPage('garden-bag')}>{tr('보관함 열기')}</Button>}</p>}
  {error&&<div className="garden-invite-notice" role="alert"><p>{error}</p><Button secondary disabled={busy} onClick={()=>void load()}>{tr('다시 불러오기')}</Button></div>}
  <details className="garden-invite-rules"><summary>{tr('초대 안내')}</summary><p>{tr('실제 정원 방문만 집계해요. 본인 방문은 제외하고, 같은 친구는 한국 시간 하루 한 번 인정해요.')}</p><p>{tr('방문객과 받은 선물은 초기화되지 않아요. 기존에 꾸민 정원도 초대 준비에 인정해요.')}</p><p>{tr('별빛 소원 정자는 100명 방문 선물로만 얻는 전용 장식이에요.')}</p></details>
 </section>;
}

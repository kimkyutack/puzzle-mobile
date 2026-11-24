import type {GardenWorldState} from '../../../packages/garden-world/src';
import FlowerlightGardenPreview from './FlowerlightGardenPreview';
import FlowerlightEventScene from './FlowerlightEventScene';
import {useEffect,useId,useRef,useState} from 'react';
import type {Player} from '@garden/contracts';
import {FLOWERLIGHT_STAGES,FLOWERLIGHT_GARDEN_GIFTS,flowerlightClaimable} from '../../../packages/content/src/flowerlight';
import {ApiFailure,request,key,serverNow,duration} from './api';
import {tr} from './i18n';
import {Button,Icon,Modal} from './ui';
import {ActivityRewards,RewardDot} from './Activity';
import {WORLD_ART} from './garden-world/assets';
import {art} from './assets';
import {sound} from './sound';
import {useOperations,featureEnabled} from './OperationsUI';
import {flowerlightAttention} from '../../../packages/content/src/attention';
import plaza from '../../../packages/assets/flowerlight-v42/festival-plaza.webp';
import expeditionPoster from '../../../packages/assets/expedition-v50/rescue-poster.webp';
import {gameEventAvailable,gameEventConfig} from '../../../packages/contracts/src/operations';
import './content-events.css';

export const contentEventArt={plaza,expeditionPoster};
export function ContentEventCards({player,onPage}:{player:Player;onPage:(page:string)=>void}){
 const {data}=useOperations(),festival=player.flowerFestival,done=festival?.restoredStages===5,expired=!!festival&&serverNow()>=festival.endsAt;
 const entries:Array<{id:'flowerlight'|'animal-expedition';title:string;kicker:string;status:string;action:string;ready:number}>=[];
 if(player.level>=gameEventConfig('flowerlight',data?.settings).minLevel&&featureEnabled('flowerlight',data)&&(gameEventAvailable('flowerlight',data?.settings,serverNow())||festival))entries.push({id:'flowerlight',title:'루미의 꽃빛축제',kicker:tr('{0}일간의 정원 이야기',{0:gameEventConfig('flowerlight',data?.settings).durationDays}),status:done?tr('축제 복원 완료'):expired?tr('모은 꽃잎으로 복원해요'):festival?tr('꽃잎 {0} / 20',{0:festival.petals}):tr('퍼즐을 깨고 꽃잎을 모아요'),action:done?'축제 보기':'축제 입장',ready:Number(flowerlightAttention(player,serverNow(),data?.settings))});
 const [selected,setSelected]=useState<string|null>(null),track=useRef<HTMLDivElement>(null),tabs=useRef<HTMLDivElement>(null),id=useId();
 const activeIndex=Math.max(0,entries.findIndex(entry=>entry.id===selected)),indexRef=useRef(activeIndex);indexRef.current=activeIndex;
 const entryIds=entries.map(entry=>entry.id).join('|');
 useEffect(()=>{
  const element=track.current;if(!element)return;
  const align=()=>element.scrollTo({left:indexRef.current*element.clientWidth,behavior:'instant'});align();
  const observer=new ResizeObserver(align);observer.observe(element);return()=>observer.disconnect();
 },[entryIds]);
 if(!entries.length)return null;
 const select=(index:number,focus=false)=>{const element=track.current;if(!element)return;const next=(index+entries.length)%entries.length;
  sound('button');element.scrollTo({left:next*element.clientWidth,behavior:player.settings?.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  if(focus)(tabs.current?.querySelectorAll('button')[next] as HTMLButtonElement|undefined)?.focus();
 };
 return <section className="content-event-cards featured-events" role="region" aria-roledescription={tr('슬라이드 배너')} aria-label={tr('특별 이벤트')}>
  <div className="featured-events-track" ref={track} onScroll={event=>{const element=event.currentTarget;if(element.clientWidth){const index=Math.max(0,Math.min(entries.length-1,Math.round(element.scrollLeft/element.clientWidth)));setSelected(entries[index]!.id);}}}>
   {entries.map((entry,index)=><article key={entry.id} id={id+'-'+entry.id} role={entries.length>1?'tabpanel':'group'} aria-labelledby={entries.length>1?id+'-tab-'+entry.id:undefined} aria-label={entries.length===1?tr(entry.title):undefined} aria-hidden={index!==activeIndex} inert={index!==activeIndex} className={'featured-event-slide '+(entry.id==='flowerlight'?'featured-flowerlight':'featured-expedition')}>
    <img className="featured-event-art" src={entry.id==='flowerlight'?plaza:expeditionPoster} alt="" draggable={false}/>
    {entry.id==='flowerlight'&&<img className="featured-fountain" src={WORLD_ART['garden-flowerlight-fountain']} alt="" draggable={false}/>}
    <div className="featured-event-shade" aria-hidden="true"/>
    <div className="featured-event-copy"><span>{tr(entry.kicker)}</span><h2>{tr(entry.title)}</h2></div>
    {entries.length>1&&<small className="featured-event-index" aria-hidden="true">{index+1} / {entries.length}</small>}
    <div className="featured-event-action"><span>{entry.status}</span><Button tone={entry.id==='flowerlight'?'gold':'green'} attention={entry.ready} onClick={()=>onPage(entry.id)}>{tr(entry.action)}</Button></div>
   </article>)}
  </div>
  {entries.length>1&&<div className="featured-event-tabs" role="tablist" aria-label={tr('특별 이벤트 선택')} ref={tabs} onKeyDown={event=>{
   const focused=(event.target as HTMLElement).closest('button'),source=focused?Array.from(event.currentTarget.querySelectorAll('button')).indexOf(focused):activeIndex;
   const from=source<0?activeIndex:source,next=event.key==='ArrowRight'?from+1:event.key==='ArrowLeft'?from-1:event.key==='Home'?0:event.key==='End'?entries.length-1:null;
   if(next!==null){event.preventDefault();select(next,true);}
  }}>{entries.map((entry,index)=><button key={entry.id} data-frame={index===activeIndex?'button_gold':'button_secondary'} data-frame-scale="0.11" id={id+'-tab-'+entry.id} role="tab" aria-selected={index===activeIndex} aria-controls={id+'-'+entry.id} tabIndex={index===activeIndex?0:-1} onClick={()=>select(index)}>
   {entry.id==='flowerlight'?<img src={WORLD_ART['garden-flowerlight-fountain']} alt=""/>:<Icon id="garden-route" size={28}/>}<span>{tr(entry.id==='flowerlight'?'꽃빛축제':'동물 구출 원정')}</span><RewardDot count={entry.ready}/>
  </button>)}</div>}
 </section>;
}
const festivalPlaces=FLOWERLIGHT_GARDEN_GIFTS.map(gift=>gift.itemId+(gift.variant==='festival'?':festival':''));
interface FestivalProps {player:Player;onPlayer:(player:Player)=>void;onClose:()=>void;onPage:(page:string)=>void;onPlay:()=>void;embedded?:boolean}
export function FlowerlightFestival({player,onPlayer,onClose,onPage,onPlay,embedded=false}:FestivalProps){
 const {data:operations}=useOperations(),config=gameEventConfig('flowerlight',operations?.settings),available=gameEventAvailable('flowerlight',operations?.settings,serverNow());
 const [installedReceipt,setInstalledReceipt]=useState<{installed:number;stored:number}|null>(null);
 const [gardenWorld,setGardenWorld]=useState<GardenWorldState|null>(null),[gardenError,setGardenError]=useState('');
 useEffect(()=>{if(embedded)return;let live=true;void request<{world:GardenWorldState}>('/garden/world').then(result=>{if(live&&result.world.ownerId===player.id)setGardenWorld(current=>current&&current.revision>result.world.revision?current:result.world)},()=>{if(live)setGardenError(tr('정원을 불러오지 못했어요.'))});return()=>{live=false}},[player.id,embedded]);
 const [joined,setJoined]=useState(player.flowerFestival),event=player.flowerFestival??joined;
 const stage=event?.restoredStages??0,next=FLOWERLIGHT_STAGES[stage],ready=!!event&&!!next&&event.petals>=next.target;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[dialogue,setDialogue]=useState<number|null>(null),[beat,setBeat]=useState(0),[celebrate,setCelebrate]=useState(false),[,tick]=useState(0);
 const guard=useRef(false),alive=useRef(true),attempted=useRef(false),startKey=useRef(key()),callbacks=useRef({onPlayer});callbacks.current={onPlayer};
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>tick(n=>n+1),1000);return()=>{alive.current=false;clearInterval(timer)}},[]);
 useEffect(()=>{if(!celebrate)return;const timer=setTimeout(()=>setCelebrate(false),1600);return()=>clearTimeout(timer)},[celebrate]);
 useEffect(()=>{if(!event&&!attempted.current&&player.level>=config.minLevel&&available){attempted.current=true;void submit(false);}},[event,player.level,config.minLevel,available]);
 const expired=!!event&&serverNow()>=event.endsAt,complete=stage===FLOWERLIGHT_STAGES.length;
 async function submit(restore:boolean){
  if(guard.current)return;guard.current=true;setBusy(true);setError('');
  try{
   const result=await request<{player:Player;granted?:boolean;world?:GardenWorldState;decoration?:{installed:string[];stored:string[]}}>(restore?'/flowerlight/restore':'/flowerlight/start',restore?{key:`flowerlight-restore-${event!.id}-${stage+1}`,stage:stage+1}:{key:startKey.current});
   // A successful HTTP response alone is not proof that entry was registered.
   if(result?.player?.id!==player.id||!result.player.flowerFestival)throw new Error(tr('축제 참여를 확인하지 못했어요. 다시 시도해 주세요.'));
   if(!alive.current)return;if(result.decoration)setInstalledReceipt({installed:result.decoration.installed.length,stored:result.decoration.stored.length});if(result.world)setGardenWorld(current=>current&&current.revision>result.world!.revision?current:result.world!);setJoined(result.player.flowerFestival);callbacks.current.onPlayer(result.player);
   if(!restore){setBeat(0);setDialogue(0);}else if(result.granted){sound('win');setCelebrate(true);if(stage>0&&FLOWERLIGHT_STAGES[stage]!.dialogue.length){setBeat(0);setDialogue(stage);}}
  }catch(e){if(alive.current)setError(e instanceof ApiFailure&&e.code==='NOT_FOUND'?tr('축제가 아직 열리지 않았어요. 잠시 후 다시 확인해 주세요.'):e instanceof Error?e.message:tr('다시 시도해 주세요.'));}finally{guard.current=false;if(alive.current)setBusy(false);}
 }
 const story=dialogue===null?null:FLOWERLIGHT_STAGES[dialogue]!,line=story?.dialogue[beat];
 const time=event?complete?tr('축제를 완성했어요!'):expired?tr('꽃잎 모으기 종료'):tr('남은 시간 {0}',{0:event.endsAt-serverNow()>=86_400_000?tr('{0}일',{0:Math.ceil((event.endsAt-serverNow())/86_400_000)}):duration(event.endsAt-serverNow())}):tr('{0}일간의 정원 이야기',{0:config.durationDays});
 const remaining=Math.max(0,(event?.endsAt??0)-serverNow()),days=Math.floor(remaining/86400000),hours=Math.floor(remaining/3600000)%24,minutes=Math.floor(remaining/60000)%60;
 const sceneTime=event&&!complete&&!expired?days?tr('{0}일',{0:days})+' '+String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0'):duration(remaining):time;
 if(embedded)return <FlowerlightEventScene event={event} stage={stage} ready={ready} busy={busy} expired={expired} available={available&&player.level>=config.minLevel} time={sceneTime} error={error} receipt={installedReceipt}
  dialogue={line?{speaker:line.speaker,text:line.text,last:beat+1>=story!.dialogue.length}:undefined}
  onNext={()=>{if(beat+1<story!.dialogue.length)setBeat(beat+1);else setDialogue(null)}} onJoin={()=>void submit(false)} onRestore={()=>void submit(true)} onPlay={onPlay} onHome={()=>onPage('home')}/>;
 const content=<div className="flowerlight-menu festival-v44 festival-v51" data-reduced-motion={player.settings.reducedMotion}>
   <FlowerlightGardenPreview world={gardenWorld} error={gardenError} onVisit={()=>onPage('home')} reduced={player.settings.reducedMotion}/>
   <div className="festival-real-time"><Icon id="move-hourglass" size={18}/><span>{time}</span></div>
   <ol className="festival-gift-track" aria-label={tr('축제 정원 선물')}>{FLOWERLIGHT_GARDEN_GIFTS.map((gift,i)=><li key={gift.grantId} className={i<stage?'is-complete':i===stage?'is-current':''} aria-current={i===stage?'step':undefined}><img src={WORLD_ART[festivalPlaces[i]!]} alt={tr(gift.name)}/><strong>{i<stage?'✓':i+1}</strong><small>×{gift.quantity}</small></li>)}</ol>
   {installedReceipt&&<p className="festival-install-receipt" role="status">{installedReceipt.installed>0&&tr('내 정원에 {0}개를 설치했어요.',{0:installedReceipt.installed})}{installedReceipt.stored>0&&' '+tr('보관함에 {0}개를 보관했어요.',{0:installedReceipt.stored})}</p>}
   {line?<section className="festival-conversation" aria-live="polite">
    <div className="festival-dialogue-portrait"><Icon id={line.speaker==='lumi'?'lumi':line.speaker==='tori'?'tori_v8':'naru_v8'} size={90}/></div>
    <div className="festival-dialogue-bubble" data-frame="card_ice_v9" data-frame-scale="0.12"><p>{tr(line.text)}</p></div>
    <Button tone="green" onClick={()=>{if(beat+1<story!.dialogue.length)setBeat(beat+1);else setDialogue(null)}}>{tr(beat+1<story!.dialogue.length?'다음 이야기':'꾸미러 가기')}</Button>
   </section>:<>
    {complete?<section className="festival-prize festival-grand-prize" data-frame="card_peach_v9" data-frame-scale="0.12"><img src={WORLD_ART['garden-flowerlight-fountain']} alt={tr('꽃빛 분수')}/><div><h3>{tr('내 정원에 꽃빛축제가 열렸어요!')}</h3><p>{tr('받은 장식은 축제가 끝나도 계속 남아요.')}</p></div></section>:<section className="festival-mission" aria-label={tr(next!.title)}>
     <h3 className="festival-mission-title" style={{backgroundImage:`url("${art('title_ribbon')}")`}}><span>{tr(next!.title)}</span></h3>
     <div className="festival-mission-tray">
      <div className="festival-petal-goal"><Icon id="stage_flower_bloom_v33" size={48}/><strong>{event?.petals??0}<small> / {next!.target}</small></strong></div>
      <div className="festival-mission-reward"><small>{tr('완성 선물')}</small><div className="festival-garden-gift"><img src={WORLD_ART[festivalPlaces[stage]!]} alt=""/><strong>{tr(FLOWERLIGHT_GARDEN_GIFTS[stage]!.name)} ×{FLOWERLIGHT_GARDEN_GIFTS[stage]!.quantity}</strong></div><ActivityRewards reward={next!.reward}/></div>
      <div className="festival-petal-meter" role="progressbar" aria-label={tr('모은 꽃잎')} aria-valuemin={0} aria-valuemax={next!.target} aria-valuenow={Math.min(next!.target,event?.petals??0)}><i style={{width:100*Math.min(1,(event?.petals??0)/next!.target)+'%'}}/></div>
     </div>
    </section>}
    <div className="festival-primary-action" aria-busy={busy}>
     {error&&<p className="content-event-error" role="alert">{error}</p>}
     {!event?<><p className="festival-joining" role="status">{tr(busy?'초대장을 여는 중…':'퍼즐에서 꽃잎을 모아 정원을 꾸며요.')}</p>{!busy&&<Button tone="gold" disabled={player.level<config.minLevel||!available} onClick={()=>void submit(false)}>{tr(available?'다시 연결':'이벤트 준비 중')}</Button>}</>:complete?<Button tone="gold" icon="home" onClick={()=>onPage('home')}>{tr('내 정원으로')}</Button>:ready?<Button tone="gold" icon="chest" disabled={busy} onClick={()=>void submit(true)}>{busy?tr('정원에 설치 중…'):tr('정원에 설치하기')}</Button>:expired?<p className="content-event-help">{tr('이번 축제에서 완성한 모습은 계속 남아요.')}</p>:<Button tone="green" icon="stage_flower_bloom_v33" onClick={onPlay}>{tr('꽃잎 모으기')}</Button>}
    </div>
    <p className="content-event-help">{tr('새 레벨을 클리어할 때마다 꽃잎 1개')}<br/>{tr('빈자리에 자동 설치돼요. 공간이 부족하면 보관함에서 꺼낼 수 있어요.')}</p>
   </>}
  </div>;
 return <Modal title={tr('루미의 꽃빛축제')} theme="sky" onClose={onClose}>{content}</Modal>;
}

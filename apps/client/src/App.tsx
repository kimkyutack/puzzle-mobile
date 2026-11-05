import {tr} from "./i18n";
import {useCallback,useEffect,useRef,useState} from 'react';
import {ENGINE_VERSION,supportsEngine} from '@garden/contracts';
import type {Action,AuthResponse,Booster,GameEvent,Player,PreBooster,Run,StateResponse,RewardIntent,StoryScene} from '@garden/contracts';
import {applyAction,stateHash} from '@garden/core';
import {availableBooster,backgroundSave} from './local-play';
import {applyPreferences,rememberPreferences,pendingPreferences,confirmPreferences,comfortKeys} from './play-preferences';
import {AREAS,RESTORATIONS,STORY_SCENES,storyForTask,getUnlockedStories} from '@garden/content';
import type {GardenWorldState} from '../../../packages/garden-world/src';
import {prepareAssets,art,goalArt} from './assets';
import {ApiFailure,guest,key,request,serverNow,duration,setToken,clearSession,installSession} from './api';
import {tokenStorage,onResume,rewardedAds,purchases,setSceneChrome} from './platform';
import {configureSound,pauseAudio,sound,startMusic} from './sound';
import ArtSurface from './ArtSurface';
import Board from './Board';
import Menus from './Menus';
import {ActivityProvider,MissionMenu,TreasureMenu} from './Activity';
import HomeHub from './HomeHub';
import HubNavigation,{currentHubTab,type HubTab} from './HubNavigation';
import HubPage from './HubPage';
import {FriendProfiles} from './FriendProfiles';
import StartLevelModal from './StartLevelModal';
import BridgeEpisode from './BridgeEpisode';
import LoadingScreen from './LoadingScreen';
import './loading-story.css';
import {StoryViewer,StoryJournal} from './StoryUI';
import {useStory} from './useStory';
import {Button,Icon,IconButton,Modal,Card,Amount,Poster,LinkAction,FrameFace,names} from './ui';
import {GardenScene,GardenEditor,type GardenTask,type RestorationVisual} from './GardenScene';
import {featureHelp,unseenBoardFeatures} from './feature-help';
import {cacheHelp,knownHelp,pendingHelp,rememberHelp,completeHelpSync} from './help-history';
import {applyPlayerLanguage,useI18n,translateText} from './i18n';
import {syncLanguagePreference} from './locale-preference';
import {reconcileCachedRun,type CachedRun} from './recovery';
import {pendingMutation} from './mutation-recovery';
import {HeartStartFlow} from './heart-start-flow';
import {createRunGateway} from './run-gateway';
import {needsFinish} from './completion';
import WinModal from './WinModal';
interface RunResponse {player:Player;run:Run;events?:GameEvent[]}
const menuTitles:Record<string,string>={offers:'특별 패키지','offers-limited':'한정 패키지','offers-timed':'타임 특가','offers-chain':'연쇄 패키지',shop:'상점',hearts:'하트 충전',ranking:'순위표',guild:'우리 길드',gifts:'선물함',settings:'설정',profile:'나의 정원사',events:'무료 선물',pass:'정원 패스'};
const cacheKey=(id:string)=>`cloud-garden-run-${id}`;
export default function App(){
 const {t}=useI18n();
 const [player,setPlayer]=useState<Player|null>(null),[run,setRun]=useState<Run|null>(null),[screen,setScreen]=useState<HubTab|'play'>(currentHubTab);
 const [menu,setMenu]=useState(''),[ready,setReady]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
 const heartStartFlow=useRef(new HeartStartFlow());
 const [busy,setBusy]=useState(false),[animating,setAnimating]=useState(false),[offline,setOffline]=useState(!navigator.onLine),[pending,setPending]=useState(false);
 const runGateway=useRef(createRunGateway(request));
 const [startEngine,setStartEngine]=useState(ENGINE_VERSION),[startError,setStartError]=useState('');
 const [lastAction,setLastAction]=useState<Action|undefined>();
 const [events,setEvents]=useState<GameEvent[]>([]),[tool,setTool]=useState<Booster|null>(null),[preBoosters,setPreBoosters]=useState<PreBooster[]>([]);
 const [notice,setNotice]=useState(''),[tutorial,setTutorial]=useState(true),[clock,setClock]=useState(0),[area,setArea]=useState(0);
 const [selectedGarden,setSelectedGarden]=useState(''),[gardenBusy,setGardenBusy]=useState(false),[restorationVisual,setRestorationVisual]=useState<RestorationVisual|null>(null);
 const [restoredWorld,setRestoredWorld]=useState<GardenWorldState|null>(null);
 const restorationGuard=useRef(false),restoreGeneration=useRef(0);
 const [activeStory,setActiveStory]=useState<StoryScene|null>(null),[pendingStory,setPendingStory]=useState<string|null>(null),[storyError,setStoryError]=useState('');
 const storyReturn=useRef(''),storyCloseGuard=useRef(false);
 const gardenTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
 useEffect(()=>()=>gardenTimers.current.forEach(clearTimeout),[]);
 const [adStatus,setAdStatus]=useState(''),[adIntent,setAdIntent]=useState<RewardIntent|null>(null);
 const [authRecovery,setAuthRecovery]=useState(false);const [unlock,setUnlock]=useState<string|null>(null);const [updateRequired,setUpdateRequired]=useState(false);
 useEffect(()=>{void setSceneChrome(screen!=='home'||(!!menu&&menu!=='garden')||!!unlock||!!activeStory).catch(()=>{});},[screen,menu,unlock,activeStory]);
 useEffect(()=>{const pop=()=>{heartStartFlow.current.cancel();setScreen(currentHubTab());setMenu('');setTool(null);setActiveStory(null);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 const ensureVersion=(r:Run)=>{if(!supportsEngine(r.state.engineVersion)||!supportsEngine(r.level.engineVersion)){setUpdateRequired(true);throw new Error(tr("새로운 퍼즐 버전이 필요해요. 앱을 업데이트한 뒤 같은 판을 이어가세요."));}};
 const playerRef=useRef<Player|null>(null),runRef=useRef<Run|null>(null),confirmed=useRef<Run|null>(null),cache=useRef<CachedRun|null>(null),syncing=useRef<Promise<void>|null>(null),finishing=useRef(false),starting=useRef<string|null>(null),inputGuard=useRef(false),startGuard=useRef(false);
 useEffect(()=>{++restoreGeneration.current;restorationGuard.current=false;setGardenBusy(false);setRestorationVisual(null);setRestoredWorld(null);gardenTimers.current.forEach(clearTimeout);gardenTimers.current=[];return()=>{++restoreGeneration.current;gardenTimers.current.forEach(clearTimeout);};},[player?.id]);
 const updatePlayer=(p:Player)=>{if(playerRef.current?.id===p.id&&playerRef.current.version>p.version)return;p=applyPreferences(p);configureSound(p.settings.sound,p.settings.haptics,p.settings.music);cacheHelp(p.id,p.tutorials);applyPlayerLanguage(p);playerRef.current=p;setPlayer(p)};
 const updateRun=(r:Run|null)=>{if(r){ensureVersion(r);const current=runRef.current;if(current?.id===r.id&&stateHash(current.state)===stateHash(r.state))r={...r,state:current.state};}runRef.current=r;setRun(r)};
 const notify=useCallback((s:string)=>{setNotice(translateText(s))},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(timer)},[notice]);
 const narrative=useStory(player,notify);
 useEffect(()=>{if(!pendingStory||screen!=='home'||menu||activeStory||restorationVisual||!player)return;const scene=STORY_SCENES.find(item=>item.id===pendingStory);setPendingStory(null);if(scene&&getUnlockedStories(player).includes(scene.id)&&!narrative.story?.seen.includes(scene.id)){storyReturn.current=scene.taskId?'garden':'';setStoryError('');setActiveStory(scene);}},[pendingStory,screen,menu,activeStory,restorationVisual,player?.restored,player?.level,narrative.story]);
 const pendingDiscovery=useRef<{runId:string;features:string[]}|null>(null);
 const screenRef=useRef(screen);screenRef.current=screen;
 const menuRef=useRef(menu);menuRef.current=menu;
 const visualBarrier=useRef<{active:boolean;waiters:Set<()=>void>}>({active:false,waiters:new Set()});
 const settleVisuals=useCallback(()=>{visualBarrier.current.active=false;inputGuard.current=false;setAnimating(false);for(const resolve of visualBarrier.current.waiters)resolve();visualBarrier.current.waiters.clear();},[]);
 const startVisuals=useCallback((_durationMs:number)=>{visualBarrier.current.active=true;setAnimating(true);},[]);
 function holdVisuals(_valid=true){if(screenRef.current!=='play'){settleVisuals();return;}visualBarrier.current.active=true;setAnimating(true);}
 useEffect(()=>()=>{for(const resolve of visualBarrier.current.waiters)resolve();visualBarrier.current.waiters.clear();visualBarrier.current.active=false},[]);
 useEffect(()=>{if(screen!=='play')settleVisuals()},[screen,settleVisuals]);
 const helpSyncing=useRef(false);
 async function flushHelp(){const p=playerRef.current;if(!p||helpSyncing.current||!navigator.onLine||!pendingHelp(p.id).length)return;helpSyncing.current=true;try{while(playerRef.current?.id===p.id&&navigator.onLine){const pending=pendingHelp(p.id);if(!pending.length)break;const response=await request<{player:Player}>('/me',{tutorials:knownHelp(p.id,playerRef.current.tutorials)},'PATCH');if(playerRef.current?.id!==p.id)return;updatePlayer(response.player);completeHelpSync(p.id,pending);}}catch{/* The durable discovery and pending acknowledgement survive offline play and restart. */}finally{helpSyncing.current=false}}
 function acknowledgeHelp(feature?:string){const p=playerRef.current;if(p&&feature&&!knownHelp(p.id,p.tutorials).includes(feature)){rememberHelp(p.id,[feature]);void flushHelp();}setUnlock(null);setTutorial(false);}
 useEffect(()=>{if(!run||!player||screen!=='play'||menu||unlock||animating||run.state.status!=='playing')return;const seen=knownHelp(player.id,player.tutorials),queued=pendingDiscovery.current?.runId===run.id?pendingDiscovery.current.features:[];const feature=queued.find(item=>!seen.includes(item))??unseenBoardFeatures(run.state,seen)[0];if(feature){rememberHelp(player.id,[feature]);setUnlock(feature);void flushHelp();}},[run?.id,run?.state,player?.tutorials,screen,menu,unlock,animating]);
 const persist=()=>{const p=playerRef.current;if(p&&cache.current){cache.current.baseSequence=cache.current.batch?.sequence??confirmed.current?.sequence;if(needsFinish(runRef.current))cache.current.finishPending=true;else delete cache.current.finishPending;localStorage.setItem(cacheKey(p.id),JSON.stringify(cache.current));}setPending(!!cache.current?.queue.length||!!cache.current?.finishPending)};
 const victorySound=useRef<string|null>(null);
 useEffect(()=>{if(!run||run.state.status!=='won'||screen!=='play'||menu||animating)return;const id=run.id,timer=setTimeout(()=>{if(runRef.current?.id!==id||runRef.current.state.status!=='won'||screenRef.current!=='play'||visualBarrier.current.active)return;if(victorySound.current!==id){victorySound.current=id;sound('win');}setMenu('win');},180);return()=>clearTimeout(timer);},[run?.id,run?.state.status,screen,menu,animating]);
 async function finish(){
  const r=confirmed.current;if(r)ensureVersion(r);if(!r||finishing.current||cache.current?.queue.length||r.state.status!=='won'||r.reward)return;
  finishing.current=true;persist();try{const res=await request<RunResponse>(`/runs/${r.id}/finish`,{key:`finish-${r.id}`});if(playerRef.current?.id!==r.userId||confirmed.current?.id!==r.id)return;updatePlayer(res.player);confirmed.current=res.run;updateRun(res.run);persist();if(res.player.level===2)setPendingStory('letters-prologue');if(res.player.level===5)notify(tr("무료 무제한과 길드가 열렸어요!"));}catch(e){setPending(true);notify(e instanceof Error?e.message:tr("보상을 확인하고 있어요."))}finally{finishing.current=false;}
 }
 async function sync(){
  if(confirmed.current)ensureVersion(confirmed.current);if(syncing.current)return syncing.current;if(!cache.current||!confirmed.current||!navigator.onLine)return;
  const work=(async()=>{try{while(cache.current?.queue.length){const c=cache.current;const r:Run=confirmed.current!;const batch=c.batch||{id:key(),sequence:r.sequence,actions:c.queue.slice(0,200)};c.batch=batch;persist();
    const res=await request<RunResponse>(`/runs/${r.id}/actions`,{idempotencyKey:batch.id,sequence:batch.sequence,actions:batch.actions});
    const decision=reconcileCachedRun(r,c,res.run);if(decision.kind==='conflict'){localStorage.setItem(cacheKey(playerRef.current!.id)+'-conflict',JSON.stringify(decision.archive));setMenu(value=>value==='win'?'':value);}cache.current=decision.cache;confirmed.current=r.sequence>res.run.sequence?r:res.run;updatePlayer(res.player);updateRun(decision.run);persist();setOffline(false);
   }await finish();
  }catch(e){if(e instanceof ApiFailure){notify(e.message);if(['STALE_SEQUENCE','SEQUENCE_MISMATCH','RUN_EXPIRED','RUN_CLOSED','ITEMS_EMPTY','INVALID_ACTION','INVALID_TARGET','ENGINE_ERROR','IDEMPOTENCY_CONFLICT'].includes(e.code)){const res=await request<{run:Run}>(`/runs/${confirmed.current!.id}`);localStorage.setItem(cacheKey(playerRef.current!.id)+'-conflict',JSON.stringify(cache.current));cache.current={runId:res.run.id,queue:[]};confirmed.current=res.run;updateRun(res.run);if(res.run.state.status!=='won')setMenu(value=>value==='win'?'':value);persist();await refresh();notify(tr("다른 기기의 최신 진행을 불러왔어요. 이 기기의 미저장 기록은 별도로 보관했어요."));if(res.run.status==='expired'||res.run.expiresAt<=serverNow()){cache.current=null;confirmed.current=null;updateRun(null);setScreen('home');setMenu('start');}}}else{setOffline(true);notify(tr("연결을 기다리는 중이에요. 이번 퍼즐은 계속할 수 있어요."));}}finally{/* The exact persisted batch remains retryable after a lost response. */}})();syncing.current=work;try{await work;}finally{if(syncing.current===work)syncing.current=null;}
 }
 const saveScheduler=useRef<ReturnType<typeof backgroundSave>|null>(null);
 saveScheduler.current??=backgroundSave(()=>sync());
 useEffect(()=>()=>saveScheduler.current?.cancel(),[]);
 const preferenceSync=useRef(false);
 async function flushPreferences(){const p=playerRef.current;if(!p||preferenceSync.current||!navigator.onLine)return;const values=pendingPreferences(p.id);if(!Object.keys(values).length)return;preferenceSync.current=true;try{const res=await request<{player:Player}>('/me',{key:key(),settings:values},'PATCH');if(playerRef.current?.id!==p.id)return;confirmPreferences(p.id,values,res.player.settings);updatePlayer(res.player);}catch{/* The device preference remains effective while offline. */}finally{preferenceSync.current=false;}}
 async function refresh(){const res=await request<StateResponse>('/me');res.player=await syncLanguagePreference(res.player,async language=>(await request<{player:Player}>('/me',{key:key(),settings:{language}},'PATCH')).player);updatePlayer(res.player);if(res.activeRun&&!cache.current?.queue.length){confirmed.current=res.activeRun;if(runRef.current?.id===res.activeRun.id)updateRun(res.activeRun);}}
 async function mutate(path:string,body:Record<string,unknown>={},method?:string){
  const p=playerRef.current!,settings=path==='/me'&&body.settings&&typeof body.settings==='object'?body.settings as Record<string,unknown>:null;
  if(settings&&comfortKeys.some(key=>typeof settings[key]==='boolean')){rememberPreferences(p.id,settings);updatePlayer({...p,settings:{...p.settings}});}
  const command=pendingMutation(p.id,path,body,method);
  try{const res=await request<{player?:Player;world?:GardenWorldState}>(path,{...body,key:command.id},method);command.complete();if(playerRef.current?.id!==p.id)return res;if(res.player){if(settings)confirmPreferences(p.id,settings,res.player.settings);updatePlayer(res.player);}else await refresh();return res;}catch(error){if(error instanceof ApiFailure&&!['INTERNAL_ERROR','NETWORK'].includes(error.code))command.complete();throw error;}
 }
 async function start(first=false){
  if(startGuard.current)return;startGuard.current=true;setBusy(true);setError('');setStartError('');starting.current??=key();
  try{await sync();if(cache.current?.queue.length)throw new Error(tr("이전 판의 행동을 서버에 저장한 뒤 시작할 수 있어요."));
   if(needsFinish(runRef.current))throw new Error(tr('보상을 확인하고 있어요.'));
   const res=await runGateway.current.start({idempotencyKey:starting.current,preBoosters:first?[]:preBoosters});setStartEngine(res.run.state.engineVersion);starting.current=null;updatePlayer(res.player);confirmed.current=res.run;updateRun(res.run);cache.current={runId:res.run.id,queue:[]};persist();setScreen('play');setMenu('');setPreBoosters([]);setTool(null);setEvents([]);setLastAction(undefined);setTutorial(!knownHelp(res.player.id,res.player.tutorials).includes(res.run.level.tutorial?.feature||''));sound('button');
  }catch(e){const message=e instanceof Error?e.message:tr("시작하지 못했어요.");setStartError(message);notify(message);if(e instanceof ApiFailure&&/HEART|LIFE/.test(e.code)){starting.current=null;heartStartFlow.current.waitForHearts();setMenu('hearts')}}finally{setBusy(false);startGuard.current=false;}
 }
 useEffect(()=>{let cancelled=false;async function boot(){try{
   await Promise.all([prepareAssets(setProgress),document.fonts.load('18px Jua'),document.fonts.load('18px "Lilita One"'),runGateway.current.resolveEngine().then(version=>{if(!cancelled)setStartEngine(version);})]);let res:StateResponse;const tokens=await tokenStorage.get();
   if(tokens){setToken(tokens.accessToken);res=await request<StateResponse>('/me')}
   else{const created=await guest();await tokenStorage.set(created);res=created;}
   if(cancelled)return;try{res.player=await syncLanguagePreference(res.player,async language=>(await request<{player:Player}>('/me',{key:key(),settings:{language}},'PATCH')).player)}catch{notify(tr("언어는 이 기기에 저장했어요. 연결되면 다시 동기화해요."))}if(cancelled)return;updatePlayer(res.player);setReady(true);void flushHelp();void flushPreferences();if(res.activeRun)ensureVersion(res.activeRun);
   if(purchases.available())void purchases.recover(res.player.id,input=>request('/purchases/verify',input)).finally(refresh).catch(()=>notify(tr("이전 구매 확인을 설정에서 다시 시도할 수 있어요.")));
   if(res.activeRun&&res.activeRun.status==='active'&&res.activeRun.expiresAt>serverNow()){
    confirmed.current=res.activeRun;const raw=localStorage.getItem(cacheKey(res.player.id));let saved:CachedRun|null=null;try{saved=raw?JSON.parse(raw):null}catch{/* invalid cache ignored */}
    setTutorial(!knownHelp(res.player.id,res.player.tutorials).includes(res.activeRun.level.tutorial?.feature||''));cache.current=saved?.runId===res.activeRun.id?saved:{runId:res.activeRun.id,queue:[]};
    if(cache.current.batch){updateRun(res.activeRun);setScreen('play');setBusy(true);persist();void sync().catch(error=>notify(error instanceof Error?error.message:tr('보상을 확인하고 있어요.'))).finally(()=>setBusy(false));}
    else{const decision=reconcileCachedRun(res.activeRun,cache.current);cache.current=decision.cache;if(decision.kind==='conflict')localStorage.setItem(cacheKey(res.player.id)+'-conflict',JSON.stringify(decision.archive));updateRun(decision.run);persist();setScreen('play');void sync().catch(error=>notify(error instanceof Error?error.message:tr('보상을 확인하고 있어요.')));}
   }
   else if(res.player.level===1){await start(true);}
  }catch(e){if(!cancelled){setError(e instanceof Error?e.message:tr("정원을 불러오지 못했어요."));if(e instanceof ApiFailure&&['UNAUTHORIZED','ACCOUNT_NOT_FOUND','SESSION_EXPIRED','AUTH_REQUIRED','REFRESH_EXPIRED'].includes(e.code))setAuthRecovery(true);}}}void boot();return()=>{cancelled=true}},[]);
 useEffect(()=>{const timer=setInterval(()=>setClock(n=>n+1),1000);const online=()=>{setOffline(false);void flushHelp();void flushPreferences();void sync().then(refresh).catch(()=>{})};const no=()=>setOffline(true);window.addEventListener('online',online);window.addEventListener('offline',no);const visibility=()=>{if(document.hidden){pauseAudio();void sync();}else{void flushPreferences();void sync().then(refresh).catch(()=>{});startMusic()}};document.addEventListener('visibilitychange',visibility);window.addEventListener('garden:audio-pause',pauseAudio);window.addEventListener('garden:audio-resume',startMusic);let release:(()=>void)|undefined;void onResume(online).then(v=>{release=v});return()=>{clearInterval(timer);window.removeEventListener('online',online);window.removeEventListener('offline',no);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('garden:audio-pause',pauseAudio);window.removeEventListener('garden:audio-resume',startMusic);release?.()}},[]);
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>{void sync()},5000);return()=>clearInterval(timer)},[pending]);
 useEffect(()=>{if(!adIntent||!['reserved','pending','review'].includes(adIntent.status))return;let cancelled=false,attempts=0;const timer=setInterval(()=>{if(++attempts>6){clearInterval(timer);return;}void request<{intent:RewardIntent|null}>('/ads/reward-intents/'+adIntent.id).then(r=>{if(cancelled||!r.intent)return;setAdIntent(r.intent);if(r.intent.status==='granted'){setAdStatus(tr("추가 코인을 받았어요!"));void refresh();clearInterval(timer);}}).catch(()=>{});},2000);return()=>{cancelled=true;clearInterval(timer)};},[adIntent?.id]);
 useEffect(()=>{if(run?.state.status==='lost'&&screen==='play'&&!menu&&!animating)setMenu('fail');if(run?.state.status==='error')setError(tr("퍼즐 처리에 오류가 있어요. 보상은 지급하지 않고 판을 보관했어요."));},[run?.state.status,screen,animating]);
 async function act(action:Action){const r=runRef.current;if(!r||updateRequired||inputGuard.current||busy||visualBarrier.current.active||r.state.status!=='playing')return;inputGuard.current=true;
  if(action.type==='booster'&&(!playerRef.current||availableBooster(playerRef.current,cache.current?.queue??[],action.item)<=0)){notify(tr("아이템이 부족해요."));inputGuard.current=false;return;}
  const result=applyAction(r.state,action);setLastAction(action);setEvents(result.events);holdVisuals(result.accepted);
  if(result.accepted){updateRun({...r,state:result.state});cache.current!.queue.push(action);persist();if(action.type==='booster')setTool(null);if(tutorial&&r.state.turn===0)acknowledgeHelp(r.level.tutorial?.feature);else setTutorial(false);
   const made=result.events.flatMap(e=>e.type==='spawn'&&e.kind&&['wind-row','wind-column','bomb','glider','rainbow'].includes(e.kind)?[e.kind]:[]);
   if(made.length)pendingDiscovery.current={runId:r.id,features:[...new Set([...(pendingDiscovery.current?.runId===r.id?pendingDiscovery.current.features:[]),...made])]};
   if(result.state.status==='won'||result.state.status==='lost'){saveScheduler.current?.cancel();void sync();}else saveScheduler.current?.schedule();
  }else{sound('invalid');notify(action.type==='booster'?(action.item==='color-magnet'?tr('일반 타일을 골라 같은 색을 모아요.'):tr('이 칸에는 사용할 수 없어요.')):result.reason==='not_adjacent'?tr("바로 옆 칸과 바꿔 주세요."):tr("같은 색 블록 3개를 연결해 보세요."));}
 }
 async function continueRun(){const r=runRef.current;if(!r)return;setBusy(true);try{await sync();if(cache.current?.queue.length)throw new Error(tr("판을 동기화한 뒤 이어할 수 있어요."));const res=await request<RunResponse>(`/runs/${r.id}/continue`,{key:key(),sequence:confirmed.current!.sequence});updatePlayer(res.player);confirmed.current=res.run;updateRun(res.run);setMenu('')}catch(e){notify(e instanceof Error?e.message:tr("이어할 수 없어요."))}finally{setBusy(false)}}
 async function exitRun(){const r=runRef.current;if(!r)return;setBusy(true);try{await sync();if(cache.current?.queue.length)throw new Error(tr("진행을 저장한 뒤 종료할 수 있어요."));const res=await request<{player:Player}>(`/runs/${r.id}/abandon`,{key:key()});updatePlayer(res.player);cache.current=null;localStorage.removeItem(cacheKey(res.player.id));confirmed.current=null;updateRun(null);setScreen('home');setMenu('')}catch(e){notify(e instanceof Error?e.message:tr("연결을 확인해 주세요."))}finally{setBusy(false)}}
 async function doubleCoins(){if(!run||!player)return;if(!rewardedAds.available()){setAdStatus(tr("광고가 연결된 모바일 앱에서 이용할 수 있어요."));return;}setBusy(true);let currentIntent:RewardIntent|undefined;let earned=false;try{const r=await request<{intent:RewardIntent}>('/ads/reward-intents',{key:key(),placement:'coin_bonus',runId:run.id});currentIntent=r.intent;setAdIntent(r.intent);const res=await rewardedAds.show(r.intent,player.id,state=>setAdStatus({loading:tr("광고 준비 중"),showing:tr("시청 중"),pending:tr("보상 확인 중"),granted:tr("지급 완료"),'no-fill':tr("지금 볼 수 있는 광고가 없어요"),cancelled:tr("시청을 종료했어요"),error:tr("광고를 불러오지 못했어요"),unavailable:tr("광고를 이용할 수 없어요"),idle:''}[state]));earned=res.earnedCallback;await request('/ads/reward-intents/'+r.intent.id,{key:key(),status:res.status==='cancelled'?'cancelled':'pending'});await refresh();}catch(e){if(currentIntent&&!earned)await request('/ads/reward-intents/'+currentIntent.id+'/cancel',{key:key()}).catch(()=>{});notify(e instanceof Error?e.message:tr("광고 연결 실패"))}finally{setBusy(false)}}
 async function reconnectIdentity(){setBusy(true);try{await clearSession();const session=await guest();await installSession(session);updatePlayer(session.player);confirmed.current=null;cache.current=null;updateRun(null);setAuthRecovery(false);setError('');setReady(true);setScreen('home');setMenu('profile');notify(tr("연결했던 Google 또는 Apple 계정으로 기존 정원을 불러오세요."));}catch(e){setError(e instanceof Error?e.message:tr("계정에 다시 연결하지 못했어요."))}finally{setBusy(false)}}
 function selectGarden(task:GardenTask){setSelectedGarden(task.id);setArea(Math.max(0,AREAS.findIndex(a=>a.id===task.area)));setScreen('home');setMenu('garden');setTool(null);}
 function changeGarden(index:number){setArea(index);const tasks=RESTORATIONS.filter(t=>t.area===AREAS[index]?.id);setSelectedGarden((tasks.find(t=>!playerRef.current?.restored.includes(t.id))||tasks[0])?.id??'');}
 async function restoreGarden(task:GardenTask){
  const current=playerRef.current;if(!current||restorationGuard.current||current.restored.includes(task.id))return;
  restorationGuard.current=true;setGardenBusy(true);const nonce=++restoreGeneration.current,started=performance.now();
  setArea(Math.max(0,AREAS.findIndex(a=>a.id===task.area)));setRestorationVisual({taskId:task.id,phase:'building',nonce});sound('restore');
  try{
   const result=await mutate('/garden/restore',{taskId:task.id});if(playerRef.current?.id!==current.id||restoreGeneration.current!==nonce)return;
   if(result.world)setRestoredWorld(result.world);
   const reveal=()=>{if(playerRef.current?.id!==current.id||restoreGeneration.current!==nonce)return;setRestorationVisual({taskId:task.id,phase:'revealed',nonce});gardenTimers.current.push(setTimeout(()=>{
    if(playerRef.current?.id!==current.id||restoreGeneration.current!==nonce)return;
    setRestorationVisual(null);restorationGuard.current=false;setGardenBusy(false);
    const scene=storyForTask(task.id);if(scene){if(screenRef.current==='home'&&menuRef.current==='garden')setMenu('');setPendingStory(scene.id);}
    if(result.world?.owned['restored-'+task.id]&&!result.world.placements['restored-'+task.id])notify(tr('복원한 시설은 보관함에 있어요. 원하는 자리에 놓아 주세요.'));
   },350));};
   const remaining=Math.max(0,600-(performance.now()-started));if(remaining)gardenTimers.current.push(setTimeout(reveal,remaining));else reveal();
  }catch(e){if(playerRef.current?.id===current.id&&restoreGeneration.current===nonce){setRestorationVisual(null);restorationGuard.current=false;setGardenBusy(false);notify(e instanceof Error?e.message:tr('정원을 가꾸지 못했어요.'));}}
 }
 async function closeStory(){if(!activeStory||storyCloseGuard.current)return;storyCloseGuard.current=true;try{await narrative.acknowledge(activeStory.id);setActiveStory(null);if(storyReturn.current==='garden'){const next=RESTORATIONS.find(t=>!playerRef.current?.restored.includes(t.id));if(next)setArea(Math.max(0,AREAS.findIndex(a=>a.id===next.area)));}setMenu(storyReturn.current);}catch(error){setStoryError(error instanceof Error?error.message:tr("기록을 저장하지 못했어요. 다시 시도해 주세요."));}finally{storyCloseGuard.current=false;}}
 function goTab(tab:HubTab){
  heartStartFlow.current.cancel();
  if(location.hash!=='#/'+tab)history.pushState({gardenTab:tab},'','#/'+tab);
  setScreen(tab);setMenu('');setTool(null);setActiveStory(null);
 }
 const openMenu=(value:string)=>{if(menu==='hearts'&&value!=='hearts'&&heartStartFlow.current.cancel()){setScreen('home');setPreBoosters([]);}if(value==='home'||value==='shop'||value==='friends'||value==='guild'||value==='events'){goTab(value);return;}if(value==='garden'){goTab('home');const next=RESTORATIONS.find(t=>!playerRef.current?.restored.includes(t.id))??RESTORATIONS.at(-1)!;setSelectedGarden(next.id);setArea(Math.max(0,AREAS.findIndex(a=>a.id===next.area)));}setMenu(value);setTool(null)};
 function closeHearts(){
  if(startGuard.current)return;
  const current=playerRef.current;if(!current)return;
  const action=heartStartFlow.current.close(current,serverNow());
  if(action==='wait')return;
  if(action==='resume'){setMenu('start');setTool(null);void start();return;}
  if(action==='home'){goTab('home');setPreBoosters([]);return;}
  setMenu('');
 }
 function onHeartsWorking(working:boolean){if(heartStartFlow.current.setWorking(working))closeHearts();}
 if(!ready||!player)return <LoadingScreen progress={progress} error={tr(error)} recovering={authRecovery} busy={busy} onRecover={()=>void reconnectIdentity()} onRetry={()=>location.reload()}/>;
 const editingGarden=menu==='garden';
 const now=serverNow()+clock*0;const unlimited=player.unlimitedUntil>now;
 const closeMenu=()=>{if(menu==='hearts'){closeHearts();return;}if(menu==='win'||menu==='start'){setScreen('home');setPreBoosters([]);setTool(null);}setMenu('')};
 return <ActivityProvider player={player} active={screen!=='play'} onPlayer={updatePlayer}><FriendProfiles userId={player.id} notify={notify}><main className={`game-shell ${screen==='play'?'playing':''} ${screen==='play'&&tutorial&&run?.state.turn===0&&run.level.tutorial?'has-tutorial':''}`} data-art-root>
  <ArtSurface scene={screen==='play'?'play':undefined}/>
  {screen==='home'?<HomeHub onPlayer={updatePlayer} story={narrative.story} styleBusy={narrative.styleBusy} onStyle={(taskId,style)=>void narrative.chooseStyle(taskId,style)} onStory={()=>openMenu('story')} player={player} area={area} editing={editingGarden} selected={selectedGarden} visual={restorationVisual} confirmedWorld={restoredWorld} busy={gardenBusy} resume={run?.status==='active'} menu={menu} onMenu={openMenu} onPlay={()=>{if(run?.status==='active'){setScreen('play');setMenu('')}else openMenu('start')}} onArea={changeGarden} onSelect={selectGarden} onRestore={task=>void restoreGarden(task)} onCloseEditor={()=>setMenu('')}/>:screen!=='play'?<HubPage key={screen} page={screen} player={player}><Menus page={screen} player={player} mutate={mutate} refresh={refresh} notify={notify} onPage={openMenu} onLogout={()=>location.reload()}/></HubPage>:run&&<>

   <header className={"play-hud"+(run.state.goals.length>3?" has-dense-goals":"")} data-frame="dock_v3"><div className={"target-panel goal-count-"+run.state.goals.length+(run.state.goals.length>2?" has-many-goals":"")} data-frame="resource_pearl_v9"><span className="hud-label">{t('hud.goals')}</span><div className="targets">{run.state.goals.map(g=><div key={g.kind}><Icon id={goalArt(g.kind)} size={34}/><strong className={g.remaining===0?"goal-complete":undefined}>{g.remaining===0?t('common.done'):g.remaining}</strong></div>)}</div></div><div className="lumi-hud">{tool?<button className="hud-tool" disabled={busy||animating} aria-label={tr("{0} 취소",{0:(names[tool])})} onClick={()=>setTool(null)}><Icon id="booster_socket" size={78}/><Icon id={tool} size={52}/><span data-frame="event_sky_v9" data-frame-scale="0.05">{tr("취소")}</span></button>:<><Icon id="portrait_frame" size={84}/><img src={art(run.state.status==='won'?'lumi_happy':run.state.moves<=5?'lumi_focus':'lumi')} alt={tr("루미")}/></>}</div><div className="moves-panel" data-frame="hud_moves"><span className="hud-label">{t('hud.moves')}</span><strong>{run.state.moves}</strong></div></header>
   <div className="board-area"><div className={`level-ribbon ${tool?'is-tool-hint':''}`} data-frame={tool?'resource_pearl_v9':'event_sky_v9'} data-frame-scale="0.1"><span>{tool?tr("{0} · 사용할 칸을 골라주세요",{0:(names[tool])}):tr("레벨 ")+run.level.id}</span></div><Board state={run.state} events={events} action={lastAction} locked={updateRequired||busy||!!menu||!!unlock} onVisualStart={startVisuals} onVisualSettled={settleVisuals} tool={tool} onAction={action=>void act(action)} reduced={false} tutorial={tutorial&&run.state.turn===0?run.level.tutorial:undefined}/>{tutorial&&run.state.turn===0&&run.level.tutorial&&<div className="tutorial-bubble" data-frame="card_blue_v4"><p>{tr(run.level.tutorial.text)}</p><button onClick={()=>acknowledgeHelp(run.level.tutorial?.feature)}>{tr("건너뛰기")}</button></div>}</div>
   <footer className="play-footer" data-frame="dock_v3" data-frame-bleed="8"><p className="play-status" role="status" data-frame="event_sky_v9" data-frame-scale="0.1">{pending?(offline?t('status.offline'):t('status.saving')):run.state.status==='won'?t('status.win'):''}</p><div className="booster-toolbar">{(['hammer','sweep-row','sweep-column','shuffle'] as const).map(item=><button key={item} disabled={busy||animating||!!menu||!!unlock||run.state.status!=='playing'} aria-label={names[item]} className={tool===item?'chosen':''} onClick={()=>{if(availableBooster(player,cache.current?.queue??[],item)===0){notify(tr("{0}가 없어요. 상점에서 구입할 수 있어요.",{0:(names[item])}));return;}if(item==='shuffle')void act({type:'booster',item});else setTool(tool===item?null:item)}}><span className="booster-socket"><Icon id="booster_socket" size={68}/><Icon id={item} size={51}/><span className="booster-count"><Icon id="count_badge" size={27}/><b>{availableBooster(player,cache.current?.queue??[],item)}</b></span></span><small>{names[item]}</small></button>)}<button aria-label={tr("도구 가방")} disabled={busy||animating||!!menu||!!unlock||run.state.status!=="playing"} onClick={()=>openMenu("tools")}><span className="booster-socket"><Icon id="booster_socket" size={68}/><Icon id="bundle_tools_v7" size={51}/><span className="booster-count"><Icon id="count_badge" size={27}/><b>{(["sweep-border","world-bomb","cross-firework","color-magnet","move-hourglass"] as const).reduce((sum,item)=>sum+availableBooster(player,cache.current?.queue??[],item),0)}</b></span></span><small>{tr("도구 가방")}</small></button><div className="play-footer-controls"><IconButton disabled={busy||animating} id="settings" label={tr("퍼즐 설정")} onClick={()=>openMenu('pause')}>{tr("설정")}</IconButton></div></div></footer>
  </>}
  {screen!=='play'&&!editingGarden&&<HubNavigation active={screen} onTab={goTab}/>}
  {offline&&<div className="connection-note" role="status">{tr("연결을 기다리고 있어요")}{' '}<button onClick={()=>void sync()}>{tr("다시 연결")}</button></div>}
  {notice&&<div className={'toast'+(screen==='friends'?' friend-toast':'')} role="status" data-frame="card_peach_v9">{screen==='friends'&&<FrameFace id="card_peach_v9"/>}{tr(notice)}</div>}
  {updateRequired&&<Modal title={tr("업데이트가 필요해요")} onClose={()=>{}}><p>{tr("새로운 퍼즐 규칙이 준비됐어요. 앱을 업데이트한 뒤 보관된 판을 이어갈 수 있어요.")}</p><Button onClick={()=>location.reload()}>{tr("다시 불러오기")}</Button></Modal>}
  {error&&!updateRequired&&<Modal title={tr("진행 확인")} onClose={()=>setError('')}><p>{tr(error)}</p><Button onClick={()=>void sync().then(refresh)}>{tr("다시 연결")}</Button></Modal>}
  {menu==='start'&&<StartLevelModal player={player} engineVersion={startEngine} error={startError} selected={preBoosters} busy={busy} unlimited={unlimited} onToggle={item=>{const count=player.inventory[item];if(!count||count.normal+count.bound===0){notify(tr("선택할 도구가 없어요."));return;}setPreBoosters(items=>items.includes(item)?items.filter(value=>value!==item):[...items,item]);}} onPlay={()=>void start()} onClose={closeMenu}/>}
  {menu==='win'&&run&&<WinModal run={run} player={player} busy={busy} onClose={closeMenu} onNext={()=>{setMenu('start');setAdStatus('')}} onHome={()=>{setScreen('home');setMenu('')}} onDouble={()=>void doubleCoins()}>{adStatus&&<p role="status">{tr(adStatus)}</p>}{adIntent&&<LinkAction icon="mail" onClick={()=>void request<{intent:RewardIntent}>('/ads/reward-intents/'+adIntent.id).then(r=>{setAdStatus(r.intent.status==='granted'?tr("추가 코인을 받았어요!"):tr("보상 확인 중"));void refresh()})}>{tr("지급 상태 확인")}</LinkAction>}</WinModal>}
  {menu==='fail'&&run&&<Modal theme="result" title={tr("계속할까요?")} onClose={closeMenu}><div className="continue-balance"><Amount kind="coin" value={player.coins+player.boundCoins}/></div><Poster id="poster_continue_v5" className="continue-poster" label={tr("루미가 추가 이동을 선물하는 황금 시계")}><span className="extra-moves">+5</span></Poster><p className="continue-description">{tr("이동 5회를 더해서 정원을 완성해요.")}</p><Button tone="green" disabled={busy||run.continues>=3} onClick={()=>void continueRun()}>{run.continues>=3?tr("추가 이동을 모두 사용했어요"):<><span>{tr("계속 플레이")}</span><Amount kind="coin" value={(run.continues+1)*300}/></>}</Button><LinkAction className="result-return" icon="home" disabled={busy} onClick={()=>void exitRun()}>{tr("이번 판 종료")}</LinkAction><p className="fine">{run.heartCharge==='failure'&&!run.heartSpent&&player.unlimitedUntil<=serverNow()?tr("이어하기는 하트를 사용하지 않아요. 포기하면 하트 1개를 사용해요."):tr("이 판은 하트를 추가로 사용하지 않아요.")}</p></Modal>}
  {menu==='pause'&&<Modal title={tr("잠깐 쉬어가기")} onClose={closeMenu}><Card title={tr("플레이")} tone="green"><Button onClick={()=>setMenu('')}>{tr("계속 플레이")}</Button></Card><Card title={tr("도움과 설정")} tone="gold"><Button secondary onClick={()=>openMenu('settings')}>{tr("음향과 플레이 설정")}</Button><Button secondary onClick={()=>{setScreen('home');setMenu('')}}>{tr("진행 보관하고 정원으로")}</Button></Card><Button secondary onClick={()=>void exitRun()}>{tr("이번 판 종료")}</Button><p className="fine">{run?.heartCharge==='failure'&&!run.heartSpent&&player.unlimitedUntil<=serverNow()?tr("진행을 보관하면 하트가 유지돼요. 판을 포기하면 1개를 사용해요."):tr("이 판은 하트를 추가로 사용하지 않아요.")}</p></Modal>}
  {menuTitles[menu]&&<Modal theme={menu==='garden'?'garden':menu==='pass'?'pass':menu==='shop'?'shop':menu==='guild'?'guild':'sky'} title={menuTitles[menu]} onClose={closeMenu} wide={!['settings','profile','hearts','gifts'].includes(menu)}><Menus page={menu} player={player} mutate={mutate} refresh={refresh} notify={notify} onPage={openMenu} onLogout={()=>location.reload()} onWorkingChange={menu==='hearts'?onHeartsWorking:undefined}/></Modal>}
  {menu==='missions'&&<Modal title={tr('미션')} onClose={closeMenu} wide><MissionMenu/></Modal>}
  {menu==='treasure'&&<Modal title={tr('보물 카드')} onClose={closeMenu}><TreasureMenu/></Modal>}
  {menu==='tools'&&<Modal title={tr('도구 가방')} onClose={closeMenu}><p className="intro">{tr('별빛 대폭탄은 새 퍼즐 10판마다 1개씩 모여요.')}</p><div className="tool-bag-grid">{(['hammer','sweep-row','sweep-column','shuffle','sweep-border','world-bomb','cross-firework','color-magnet','move-hourglass'] as const).map(item=><button key={item} className="tool-bag-item" data-frame="card_blue_v4" data-frame-scale="0.14" disabled={screen==='play'&&(!run||run.state.status!=='playing')||availableBooster(player,cache.current?.queue??[],item)===0} onClick={()=>{if(screen!=='play'){notify(tr('퍼즐 안에서 도구를 사용할 수 있어요.'));return;}setMenu('');if(['shuffle','sweep-border','world-bomb','move-hourglass'].includes(item))void act({type:'booster',item});else setTool(item);}}><Icon id={item} size={63}/><strong>{names[item]}</strong><small>{tr(({hammer:'한 칸 정리','sweep-row':'가로 한 줄 정리','sweep-column':'세로 한 줄 정리',shuffle:'타일 다시 섞기','sweep-border':'바깥 테두리 전체 정리','world-bomb':'맵 전체에 강력한 한 방','cross-firework':'가로와 세로를 함께 정리','color-magnet':'선택한 타일과 같은 색 정리','move-hourglass':'이동 횟수 3회 추가'} as const)[item])}</small><b>{availableBooster(player,cache.current?.queue??[],item)}</b></button>)}</div>{screen!=='play'&&<p className="fine">{tr('퍼즐 안에서 도구를 사용할 수 있어요.')}</p>}</Modal>}
  {menu==='story'&&!activeStory&&<StoryJournal story={narrative.story} player={player} loading={narrative.loading} error={narrative.error} onRetry={()=>void narrative.reload()} onPlay={scene=>{storyReturn.current='story';setStoryError('');setActiveStory(scene);}} onEpisode={()=>setMenu('rescue')} onClose={closeMenu}/>}
  {menu==='rescue'&&<BridgeEpisode key={player.id} player={player} onClose={()=>{setMenu('story')}} onHome={()=>goTab('home')} onPlayer={updatePlayer} onComplete={()=>void narrative.reload()}/>}
  {activeStory&&<StoryViewer key={activeStory.id} scene={activeStory} busy={narrative.saving} error={tr(storyError)} onClose={()=>void closeStory()}/>}
  {unlock&&<Modal title={tr("{0} 발견!",{0:(names[unlock])})} onClose={()=>acknowledgeHelp(unlock)}><Card className="discovery-card"><div className="hero-reward discovery-reward"><Icon id="fx_starburst" size={265}/><Icon id="fx_ring" size={190}/><Icon id={goalArt(unlock)} size={145}/><span className="discovery-spark s1"><Icon id="sparkle" size={38}/></span><span className="discovery-spark s2"><Icon id="sparkle" size={29}/></span></div><p className="intro">{featureHelp(unlock)}</p></Card><Button onClick={()=>acknowledgeHelp(unlock)}>{tr("좋아요!")}</Button></Modal>}
 </main></FriendProfiles></ActivityProvider>;
}

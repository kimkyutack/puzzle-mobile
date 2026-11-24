import {refinedEventArt} from './event-refinement-art';
import './event-refinement-v74.css';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {Player} from '@garden/contracts';
import {PINBALL_PHYSICS_VERSION,type GardenGameAttempt,type GardenGameId,type GardenGameResult,type GardenGameReward} from '../../../packages/contracts/src/garden-games';
import type {RuntimeSettings} from '../../../packages/contracts/src/operations';
import {GARDEN_GAME_STAGES,GARDEN_GAME_TITLES,gardenGameReward,gardenGameStatus} from '../../../packages/content/src/garden-games';
import {launchAcorn,pinballBoard,PINBALL_BALLS,PINBALL_HEIGHT,PINBALL_LAUNCHES,PINBALL_POCKETS,PINBALL_WIDTH,replayPinball,type PinballBoard,type PinballShot} from '../../../packages/content/src/acorn-pinball';
import {replayWater,waterBoard,WATER_WIDTH,type WaterBoard} from '../../../packages/content/src/greenhouse-water';
import {DECORATIONS} from '../../../packages/garden-world/src/catalog';
import {ApiFailure,duration,key,request,serverNow} from './api';
import {tr} from './i18n';
import {Button,Icon,names} from './ui';
import {WORLD_ART} from './garden-world/assets';
import {arcadeArt,arcadeIcons} from './garden-arcade-art';
import {sound} from './sound';
import {pinballDisplayY,pinballFlightDuration,pinballFlightFrames,PINBALL_STEP_MS} from './pinball-flight';
import './garden-game.css';
import {eventDesignArt} from './event-design-art';

const draftKey=(id:string)=>'garden-game-actions:'+id;
function readDraft(id:string):number[]{
 try{const value:unknown=JSON.parse(localStorage.getItem(draftKey(id))??'[]');return Array.isArray(value)&&value.length<=80&&value.every(Number.isInteger)?value:[];}catch{return [];}
}
const prizeName=(id:string)=>tr(DECORATIONS.find(item=>item.id===id)?.name??id);
const help={
 'acorn-pinball':'발사 위치를 골라 도토리를 떨어뜨려요. 도토리 3개로 아래의 빛나는 칸을 모두 맞혀 주세요.',
 'greenhouse-water':'수로를 눌러 시계 방향으로 돌려요. 물이 화분 세 곳에 모두 닿으면 성공이에요.',
};

function Reward({reward}:{reward:GardenGameReward}){
 return <span className="garden-game-reward">
  <span title={tr('골드')}><Icon id="coin" size={24}/><b>{reward.coins}</b></span>
  {Object.entries(reward.items).map(([id,count])=><span key={id} title={names[id]}><Icon id={id} size={24}/><b>×{count}</b></span>)}
  {reward.decoration&&<span><img src={WORLD_ART[reward.decoration]} width="32" height="32" alt=""/><b>{prizeName(reward.decoration)}</b></span>}
 </span>;
}

export default function GardenGameMenu({game,player,settings,onPlayer,onPuzzle,variant}:{game:GardenGameId;player:Player;settings?:RuntimeSettings;onPlayer:(player:Player)=>void;onPuzzle:()=>void;variant?:'weekly'}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<GardenGameResult>();
 const working=useRef(false),startKey=useRef<{roundId:string;value:string}|null>(null);
 const status=gardenGameStatus(game,player,serverNow(),settings);
 const attempt=status.attempt;
 const displayed=result??status.result;
 const next=gardenGameReward(game,Math.min(status.completed+1,GARDEN_GAME_STAGES),status.grandPrize);
 async function start(){
  if(working.current||!status.canStart)return;
  working.current=true;setBusy(true);setMessage('');
  startKey.current=startKey.current?.roundId===status.roundId?startKey.current:{roundId:status.roundId,value:key()};
  try{
   const response=await request<{player:Player}>(`/minigames/${game}/start`,{idempotencyKey:startKey.current.value,roundId:status.roundId,
    ...(game==='acorn-pinball'?{pinballPhysics:PINBALL_PHYSICS_VERSION}:{})});
   startKey.current=null;setResult(undefined);onPlayer(response.player);
  }catch(error){
   if(error instanceof ApiFailure)startKey.current=null;
   setMessage(error instanceof Error?error.message:tr('다시 연결'));
  }finally{working.current=false;setBusy(false);}
 }
 async function finish(attempt:GardenGameAttempt,actions:number[]){
  if(working.current)return;
  working.current=true;setBusy(true);setMessage('');
  try{
   const response=await request<{player:Player;result:GardenGameResult}>(`/minigames/${game}/finish`,{idempotencyKey:'game-finish:'+attempt.id,roundId:status.roundId,attemptId:attempt.id,actions,
    ...(attempt.pinballPhysics?{pinballPhysics:attempt.pinballPhysics}:{})});
   try{localStorage.removeItem(draftKey(attempt.id));}catch{/* Play continues without local storage. */}
   setResult(response.result);onPlayer(response.player);
  }catch(error){setMessage(error instanceof Error?error.message:tr('다시 연결'));}
  finally{working.current=false;setBusy(false);}
 }
 if(variant==='weekly')return <section className="weekly-game-layout" data-game={game} data-playing={!!attempt} aria-label={tr(GARDEN_GAME_TITLES[game])}>
  {attempt?<GardenGamePlay weekly key={attempt.id} game={game} attempt={attempt} busy={busy} reduced={player.settings.reducedMotion} onFinish={finish}/>:<div className="weekly-game-preview" aria-hidden="true">
   {game==='acorn-pinball'?<><Pinball weekly board={pinballBoard(Math.min(10,status.completed+1),62,PINBALL_PHYSICS_VERSION)} actions={[]} onMove={()=>{}} disabled reduced/><img className="weekly-preview-acorn" src={arcadeArt.acorn} alt=""/></>:<WaterPuzzle weekly board={waterBoard(Math.min(10,status.completed+1),62)} actions={[]} onMove={()=>{}} disabled reduced/>}
  </div>}
  <div className="weekly-game-ticket">{game==='acorn-pinball'?<><img src={arcadeArt.acorn} alt=""/>{tr('입장권 {0}장',{0:status.tickets})}</>:tr('{0}/{1}단계 완료',{0:status.completed,1:GARDEN_GAME_STAGES})}</div>
  <section className="weekly-game-loot" aria-label={tr('다음 단계 보상')}>
   <h2>{tr(game==='greenhouse-water'?'온실 완성 보상':displayed?.reward?'받은 보상':'이번 도전 보상')}</h2>
   <Reward reward={displayed?.reward??next}/>
   {game==='greenhouse-water'&&<div className="weekly-water-prizes">{Array.from({length:5},(_,i)=>Math.min(5,Math.floor(status.completed/5)*5)+i+1).map((stage,i)=><div key={stage} data-complete={status.completed>=stage}><img src={refinedEventArt.plants[i]} alt=""/>{status.completed>=stage&&<img className="weekly-water-check" src={eventDesignArt.attendanceCheck} alt=""/>}<b>{stage}</b><small><Icon id="coin" size={15}/>{gardenGameReward(game,stage,status.grandPrize).coins}</small></div>)}</div>}
  </section>
  {!attempt&&(status.canStart?<Button rasterFrame={false} className="weekly-scene-cta" onClick={()=>void start()} disabled={busy}>{tr(busy?'준비 중':game==='acorn-pinball'?'도전 시작':'물길 도전')}</Button>:status.completed<GARDEN_GAME_STAGES?<Button rasterFrame={false} className="weekly-scene-cta" onClick={onPuzzle}>{tr('퍼즐로 입장권 모으기')}</Button>:<Button rasterFrame={false} className="weekly-scene-cta" onClick={onPuzzle}>{tr('퍼즐 플레이')}</Button>)}
  {!attempt&&status.free&&status.completed<GARDEN_GAME_STAGES&&<small className="weekly-free-note">{tr('오늘 무료 도전 1회')}</small>}
  {attempt&&<span className="weekly-ongoing-label">{tr(game==='acorn-pinball'?'위쪽 숫자를 눌러 발사':'수로를 눌러 돌려요')}</span>}
  {message&&<p className="weekly-scene-error" role="alert">{message}</p>}
 </section>;
 return <section className="garden-game" data-game={game} aria-label={tr(GARDEN_GAME_TITLES[game])}>
  <header className="garden-game-head">
   <img src={arcadeIcons[game]} alt="" draggable={false}/><h2>{tr(GARDEN_GAME_TITLES[game])}</h2>
   <span>{attempt?tr('{0}단계',{0:attempt.stage}):tr('{0}/{1}단계 완료',{0:status.completed,1:GARDEN_GAME_STAGES})}</span>
  </header>
  {!attempt&&<ol className="garden-game-route" aria-label={tr('회차 진행률')}>{Array.from({length:GARDEN_GAME_STAGES},(_,i)=><li key={i} data-complete={i<status.completed} aria-current={i===status.completed?'step':undefined}><span>{i<status.completed?'✓':i+1}</span></li>)}</ol>}
  {attempt?<GardenGamePlay key={attempt.id} game={game} attempt={attempt} busy={busy} reduced={player.settings.reducedMotion} onFinish={finish}/>:<>
   <div className="garden-game-hero" style={{'--arcade-scene':`url(${game==='acorn-pinball'?arcadeArt.cabinet:arcadeArt.workbench})`} as CSSProperties}>
    <img src={WORLD_ART[status.grandPrize]} alt="" className="garden-game-prize-art"/>
    <div><span>{tr('완주 보상')}</span><strong>{prizeName(status.grandPrize)}</strong><p>{tr(help[game])}</p></div>
   </div>
   {displayed&&<div className="garden-game-result" role="status"><strong>{tr(displayed.won?'{0}단계 성공':'{0}단계 도전 종료',{0:displayed.stage})}</strong>{displayed.reward&&<><Reward reward={displayed.reward}/>{displayed.reward.decoration&&<small>{tr('정원 보관함에서 설치할 수 있어요.')}</small>}</>}</div>}
   {status.completed<GARDEN_GAME_STAGES&&<div className="garden-game-next"><span>{tr('다음 단계 보상')}</span><Reward reward={next}/></div>}
   {status.available&&status.completed<GARDEN_GAME_STAGES&&<div className="garden-game-entry"><span>{tr('입장권 {0}장',{0:status.tickets})}</span><span>{status.free?tr('오늘 무료 도전 1회'):tr('무료 도전까지 {0}',{0:duration(status.nextReset-serverNow())})}</span></div>}
   {status.canStart?<Button onClick={()=>void start()} disabled={busy}>{tr(status.free?'무료 도전':'입장권 1장으로 도전')}</Button>:
    status.available&&status.completed<GARDEN_GAME_STAGES?<Button onClick={onPuzzle} tone="blue">{tr('퍼즐로 입장권 모으기')}</Button>:null}
  </>}
  {message&&<p className="garden-game-error" role="alert">{message}</p>}
 </section>;
}

function GardenGamePlay({game,attempt,busy,reduced,onFinish,weekly=false}:{game:GardenGameId;attempt:GardenGameAttempt;busy:boolean;reduced:boolean;onFinish:(attempt:GardenGameAttempt,actions:number[])=>void;weekly?:boolean}){
 const pinball=useMemo(()=>game==='acorn-pinball'?pinballBoard(attempt.stage,attempt.seed,attempt.pinballPhysics):null,[game,attempt]);
 const water=useMemo(()=>game==='greenhouse-water'?waterBoard(attempt.stage,attempt.seed):null,[game,attempt]);
 const replay=(actions:readonly number[])=>pinball?replayPinball(pinball,actions):replayWater(water!,actions);
 const [actions,setActions]=useState(()=>{const saved=readDraft(attempt.id);return replay(saved).status==='invalid'?[]:saved;});
 const status=replay(actions).status,terminal=status==='won'||status==='lost';
 const pending=useRef(actions);
 function move(next:number){
  if(busy||terminal)return;
  const steps=[...pending.current,next],updated=replay(steps).status;
  if(updated==='invalid')return;
  pending.current=steps;setActions(steps);
  try{localStorage.setItem(draftKey(attempt.id),JSON.stringify(steps));}catch{/* The server still retains the attempt. */}
  if(updated==='won'||updated==='lost')onFinish(attempt,steps);
 }
 return <>
  {pinball?<Pinball weekly={weekly} board={pinball} actions={actions} disabled={busy||terminal} reduced={reduced} onMove={move}/>:<WaterPuzzle weekly={weekly} board={water!} actions={actions} disabled={busy||terminal} reduced={reduced} onMove={move}/>}
  {!weekly&&<p className="garden-game-help">{tr(help[game])}</p>}
  {terminal&&<Button disabled={busy} onClick={()=>onFinish(attempt,actions)}>{tr(busy?'결과 확인 중':'결과 확인')}</Button>}
 </>;
}

const pct=(value:number,size:number)=>value/size*100+'%';
export function Pinball({board,actions,onMove,disabled,reduced,weekly=false}:{board:PinballBoard;actions:number[];onMove:(slot:number)=>void;disabled:boolean;reduced:boolean;weekly?:boolean}){
 // Artwork leaves a taller pocket region. Apply the same display projection to pegs and ball;
 // physics, collision coordinates and the replay log remain unchanged.
 const displayY=(y:number)=>pct(pinballDisplayY(y,weekly),PINBALL_HEIGHT);
 const result=useMemo(()=>replayPinball(board,actions),[board,actions]);
 const [flight,setFlight]=useState<{shot:PinballShot;slot:number;landed:boolean}|null>(null);
 const boardHost=useRef<HTMLDivElement>(null),ball=useRef<HTMLImageElement>(null),pegs=useRef<Array<HTMLImageElement|null>>([]);
 const frame=useRef(0),launching=useRef(false),animation=useRef<Animation|null>(null);
 const active=useRef<PinballShot|null>(null),lit=useRef(new Set<number>()),move=useRef(onMove),weeklyRef=useRef(weekly);move.current=onMove;weeklyRef.current=weekly;
 function glow(next:Set<number>){
  for(const at of lit.current)if(!next.has(at))pegs.current[at]?.removeAttribute('data-lit');
  for(const at of next)if(!lit.current.has(at))pegs.current[at]?.setAttribute('data-lit','');
  lit.current=next;
 }
 useEffect(()=>{
  const element=boardHost.current;
  const observer=new ResizeObserver(()=>{
   if(active.current&&element&&animation.current?.effect&&ball.current)(animation.current.effect as KeyframeEffect).setKeyframes(pinballFlightFrames(active.current,element.clientWidth,element.clientHeight,weeklyRef.current));
  });
  if(element)observer.observe(element);
  return()=>{observer.disconnect();cancelAnimationFrame(frame.current);animation.current?.cancel();active.current=null;};
 },[]);
 function fire(slot:number){
  if(disabled||launching.current)return;
  sound('button');
  if(reduced){move.current(slot);return;}
  launching.current=true;animation.current?.cancel();animation.current=null;glow(new Set());
  const shot=launchAcorn(board,slot),duration=pinballFlightDuration(shot);
  active.current=shot;let start:number|undefined,landed=false;
  const advance=(now:number)=>{
   const element=ball.current,field=boardHost.current;
   if(!element||!field){frame.current=requestAnimationFrame(advance);return;}
   if(start===undefined){
    start=now;animation.current=element.animate(pinballFlightFrames(shot,field.clientWidth,field.clientHeight,weeklyRef.current),{duration,easing:'linear',fill:'forwards'});
    animation.current.startTime=now;element.style.visibility='visible';
   }
   const elapsed=now-start,tick=Math.min(shot.path.length-1,elapsed/PINBALL_STEP_MS);
   if(!landed)glow(new Set(shot.hits.filter(hit=>tick>=hit.tick&&tick-hit.tick<12).map(hit=>hit.peg)));
   if(elapsed>=duration&&!landed){landed=true;setFlight({shot,slot,landed:true});glow(new Set());}
   if(elapsed<duration+240){frame.current=requestAnimationFrame(advance);return;}
   active.current=null;launching.current=false;setFlight(null);move.current(slot);
  };
  setFlight({shot,slot,landed:false});frame.current=requestAnimationFrame(advance);
 }
 const remaining=PINBALL_BALLS-actions.length-Number(!!flight);
 return <div className="acorn-pinball arcade-machine">
  <img className="arcade-machine-art" src={arcadeArt.cabinet} alt="" draggable={false}/>
  <div className="pinball-meter" role="status">
   <span className="sr-only">{tr('도토리 {0}개 남음',{0:remaining})}</span>
   <span className="pinball-stock" aria-hidden="true">{Array.from({length:PINBALL_BALLS},(_,i)=><img key={i} data-used={i>=remaining} src={arcadeArt.acorn} alt="" draggable={false}/>)}</span>
   <strong>{tr('{0}점',{0:result.score})}</strong>
  </div>
  <div ref={boardHost} className="pinball-board" role="group" aria-label={tr('도토리 발사판')}>
   <div className="pinball-launch-rail" aria-hidden="true"/>
   {PINBALL_LAUNCHES.map((x,slot)=><button key={slot} className="pinball-launch" data-selected={flight?.slot===slot} style={{left:pct(x,PINBALL_WIDTH)}} onClick={()=>fire(slot)} disabled={disabled||!!flight} aria-label={tr('{0}번 위치에서 발사',{0:slot+1})}><span className="pinball-launch-number" aria-hidden="true">{slot+1}</span><img src={arcadeArt.launch} alt="" draggable={false}/></button>)}
   {board.pegs.map((peg,i)=><img key={i} src={weekly?eventDesignArt.goldPeg:arcadeArt.bumper} alt="" draggable={false} ref={element=>{pegs.current[i]=element;}} className="pinball-peg" style={{left:pct(peg.x,PINBALL_WIDTH),top:displayY(peg.y),width:pct(peg.r*2*(weekly?1.7:1),PINBALL_WIDTH)}}/>)}
   <div className="pinball-pockets" aria-hidden="true">{Array.from({length:PINBALL_POCKETS},(_,i)=>{
    const target=board.targets.includes(i),hit=result.reached.has(i),catching=flight?.landed&&flight.shot.pocket===i;
    return <div key={i} className="pinball-pocket" data-target={target} data-hit={hit} data-catching={catching||undefined}>
     <img src={arcadeArt.pocket} className="pinball-pocket-body" alt="" draggable={false}/>
     {(target||hit)&&<span>{hit?<img src={arcadeArt.acorn} alt="" draggable={false}/>:<Icon id="coin" size={21}/>}</span>}
     {weekly&&<b className="weekly-pocket-score">{tr('{0}점',{0:'+'+(target?50:5)})}</b>}
    </div>;
   })}</div>
   {flight&&<img ref={ball} className="pinball-ball" data-landed={flight.landed} src={arcadeArt.acorn} alt="" draggable={false} style={{left:0,top:0,visibility:'hidden'}}/>}
  </div>
 </div>;
}

export function WaterPuzzle({board,actions,onMove,disabled,reduced,weekly=false}:{board:WaterBoard;actions:number[];onMove:(at:number)=>void;disabled:boolean;reduced:boolean;weekly?:boolean}){
 const {wet}=useMemo(()=>replayWater(board,actions),[board,actions]);
 const turns=Array<number>(board.pipes.length).fill(0);
 for(const at of actions)turns[at]=turns[at]!+1;
 return <>
  <p className="water-meter" role="status">
   <span>{weekly&&<Icon id="shuffle" size={17}/>} {tr('남은 회전 {0}회',{0:board.moves-actions.length})}</span>
   <span>{weekly&&<img src={arcadeArt.flower} alt=""/>} {tr('물 준 화분 {0}/{1}',{0:board.targets.filter(at=>wet.has(at)).length,1:board.targets.length})}</span>
  </p>
  <div className="greenhouse-water arcade-machine" data-reduced={reduced}>
   <img className="arcade-machine-art" src={arcadeArt.workbench} alt="" draggable={false}/>
   <div className="water-grid" role="group" aria-label={tr('온실 수로')} style={{'--columns':WATER_WIDTH} as CSSProperties}>
    {board.pipes.map((mask,at)=>{
     const source=at===board.source,target=board.targets.includes(at),flowing=wet.has(at);
     const cellName=source?'수원':target?'화분':'수로';
     const position=tr('{0}행 {1}열',{0:Math.floor(at/WATER_WIDTH)+1,1:at%WATER_WIDTH+1});
     return <button className="water-cell" data-wet={flowing} data-endpoint={source||target} key={at} disabled={disabled||source||target} onClick={()=>{sound('button');onMove(at);}} aria-label={`${position} ${tr(cellName)}${flowing?' · '+tr('물길 연결됨'):''}`}>
      <img className="water-tile" src={weekly?eventDesignArt.waterTile:arcadeArt.tile} alt="" draggable={false}/>
      <span className="water-pipes" style={{transform:`rotate(${turns[at]!*90}deg)`}} aria-hidden="true">
       {[1,2,4,8].map((bit,i)=>mask&bit?<span key={bit} className="water-arm" style={{transform:`rotate(${i*90}deg)`}}><img src={weekly?(flowing?eventDesignArt.waterArmWet:eventDesignArt.waterArmDry):arcadeArt.pipe} alt="" draggable={false}/></span>:null)}
       <img className="water-joint" src={weekly?(flowing?eventDesignArt.waterJointWet:eventDesignArt.waterJointDry):arcadeArt.joint} alt="" draggable={false}/>
      </span>
      {source?<Icon className="water-source" id="stage_spring_v33" size={44}/>:target?<img className="water-flower" src={weekly?refinedEventArt.plants[4]:arcadeArt.flower} alt="" draggable={false}/>:null}
     </button>;
    })}
   </div>
  </div>
 </>;
}

import {useRef,useState} from 'react';
import type {Action,ExpeditionAnimal} from '@garden/contracts';
import {actionWithFrames,createGame,legalActions} from '@garden/core';
import type {WeeklyEventId} from '../../../packages/contracts/src/weekly-events';
import {PINBALL_PHYSICS_VERSION} from '../../../packages/contracts/src/garden-games';
import {animalExpeditionLevel,EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import {pinballBoard,replayPinball} from '../../../packages/content/src/acorn-pinball';
import {waterBoard,replayWater} from '../../../packages/content/src/greenhouse-water';
import {Pinball,WaterPuzzle} from './GardenGameMenu';
import Board from './CascadeBoard';
import {Button,Icon,Modal} from './ui';
import {tr} from './i18n';
import {WORLD_ART} from './garden-world/assets';
import {arcadeArt} from './garden-arcade-art';
import {eventDesignArt} from './event-design-art';
import './weekly-event-guide.css';

const titles={'acorn-pinball':'도토리 핀볼 안내','greenhouse-water':'온실 물길 안내','animal-expedition':'동물 구출 원정 안내'};
interface Props {event:WeeklyEventId;animal:ExpeditionAnimal;dailyLimit:number;ticketCap:number;reduced:boolean;onClose:()=>void}

function MiniGamePractice({game,reduced}:{game:'acorn-pinball'|'greenhouse-water';reduced:boolean}){
 const [actions,setActions]=useState<number[]>([]),[revision,setRevision]=useState(0);
 const pinball=useRef(pinballBoard(1,62,PINBALL_PHYSICS_VERSION)),water=useRef(waterBoard(1,62));
 const watered=game==='greenhouse-water'?replayWater(water.current,actions):undefined;
 const status=watered?.status??replayPinball(pinball.current,actions).status;
 return <div className="weekly-guide-practice">
  {watered&&<p className="weekly-guide-live-stats" role="status">{tr('남은 회전 {0}회',{0:water.current.moves-actions.length})} · {tr('물 준 화분 {0}/{1}',{0:water.current.targets.filter(at=>watered.wet.has(at)).length,1:water.current.targets.length})}</p>}
  <div className="weekly-guide-scene" data-demo-game={game}><div className="weekly-guide-mini-stage">
   <img className="weekly-guide-scene-art" src={game==='acorn-pinball'?eventDesignArt.pinball:eventDesignArt.water} alt=""/>
   <div className="weekly-game-layout" data-game={game} data-playing="true">
    {game==='acorn-pinball'?<Pinball weekly key={revision} board={pinball.current} actions={actions} onMove={at=>setActions(old=>[...old,at])} disabled={status!=='playing'} reduced={reduced}/>:<WaterPuzzle weekly key={revision} board={water.current} actions={actions} onMove={at=>setActions(old=>[...old,at])} disabled={status!=='playing'} reduced={reduced}/>}
   </div>
  </div>
  </div>
  <div className="weekly-guide-practice-controls"><span role="status">{tr(status==='won'?'연습 성공!':status==='lost'?'다시 연습해 보세요.':game==='acorn-pinball'?'번호를 눌러 도토리를 떨어뜨려 보세요.':'수로를 눌러 물을 연결해 보세요.')}</span><Button secondary onClick={()=>{setActions([]);setRevision(n=>n+1);}}>{tr('다시 연습')}</Button></div>
 </div>;
}

function RescuePractice({animal,reduced}:{animal:ExpeditionAnimal;reduced:boolean}){
 const initial=()=>({state:createGame(animalExpeditionLevel(1)),events:[],frames:[],action:undefined} as {state:ReturnType<typeof createGame>;events:ReturnType<typeof actionWithFrames>['events'];frames:ReturnType<typeof actionWithFrames>['frames'];action:Action|undefined});
 const [shown,setShown]=useState(initial),[locked,setLocked]=useState(false),busy=useRef(false);
 function act(action:Action){
  if(busy.current||shown.state.status!=='playing')return;
  const next=actionWithFrames(shown.state,action);if(!next.accepted)return;
  busy.current=true;setLocked(true);setShown({state:next.state,events:next.events,frames:next.frames,action});
 }
 return <div className="weekly-guide-practice">
  <div className="weekly-guide-rescue-board"><Board animal={animal} state={shown.state} events={shown.events} frames={shown.frames} action={shown.action} locked={locked} tool={null} reduced={reduced} onAction={act} onVisualSettled={()=>{busy.current=false;setLocked(false);}}/></div>
  <div className="weekly-guide-practice-controls"><span>{tr('길을 막은 장애물을 치워 보세요.')}</span><Button secondary disabled={locked} onClick={()=>{const next=legalActions(shown.state)[0];if(next)act(next);else{busy.current=false;setShown(initial());}}}>{tr('한 수 보기')}</Button></div>
 </div>;
}

export default function WeeklyEventGuide(p:Props){
 const [step,setStep]=useState(0),rescue=p.event==='animal-expedition',pinball=p.event==='acorn-pinball';
 const headings=rescue?['매일 무료로 구출해요','길을 열어 친구를 구해요','끝까지 구하면 정원으로!']:pinball?['입장권은 퍼즐에서 모아요','위쪽 번호를 눌러 발사!','코인 표시 칸을 모두 맞혀요']:['입장권은 퍼즐에서 모아요','수로를 돌려 물을 이어요','모든 화분에 물을 주세요'];
 const instructions=rescue?[
  tr('하트와 보유 도구를 쓰지 않고 하루 {0}회 도전해요. 진행 중인 원정은 이어 해도 횟수가 줄지 않아요.',{0:p.dailyLimit}),
  tr('같은 색 타일을 3개 이상 맞추거나 아이템으로 장애물을 치워요. 길이 이어지면 동물 친구가 앞으로 이동해요.'),
  tr('10개 코스를 차례로 완료해요. 단계 보상을 받고 마지막에는 동물 친구를 정원에 초대할 수 있어요.'),
 ]:[
  tr('매일 첫 도전은 무료예요. 새 퍼즐을 클리어하면 입장권 1장을 받아요. 무료 도전 후에는 입장권 1장을 사용해요.'),
  tr(pinball?'위쪽의 1~7번 발사 위치를 눌러요. 도토리가 핀에 부딪히며 아래로 떨어져요.':'수로를 누르면 시계 방향으로 돌아가요. 물이 이어진 수로는 파랗게 보여요.'),
  tr(pinball?'코인 표시는 목표 칸이에요. 도토리 3개 안에 목표 칸을 모두 맞히면 아래에 표시된 코인 보상을 받아요. +50·+5는 코인이 아닌 점수예요.':'남은 회전 안에 화분 세 곳에 물을 모두 보내면 성공! 10단계를 완료하면 정원 장식도 받을 수 있어요.'),
 ];
 return <Modal title={tr(titles[p.event])} theme="sky" className="weekly-event-guide" onClose={p.onClose} footer={<div className="weekly-guide-footer">
  {step>0&&<Button secondary onClick={()=>setStep(n=>n-1)}>{tr('이전')}</Button>}<Button tone="green" onClick={()=>step<2?setStep(n=>n+1):p.onClose()}>{tr(step<2?'다음':'알겠어요!')}</Button>
 </div>}>
  <div className="weekly-guide-step" aria-label={tr('안내 단계')}><span>{step+1} / 3</span><div aria-hidden="true">{[0,1,2].map(n=><i key={n} data-current={n===step}/>)}</div></div>
  <h3 className="weekly-guide-heading">{tr(headings[step])}</h3><p className="weekly-guide-copy">{instructions[step]}</p>
  {step===1?<>{rescue?<RescuePractice animal={p.animal} reduced={p.reduced}/>:<MiniGamePractice game={p.event as 'acorn-pinball'|'greenhouse-water'} reduced={p.reduced}/>}<p className="weekly-guide-demo-note">{tr('연습 화면이에요. 입장권과 보상은 변하지 않아요.')}</p></>:<div className="weekly-guide-illustration">
   <Icon id="lumi_happy" size={100}/><div className="weekly-guide-pictures">
    {rescue?<><img src={WORLD_ART[EXPEDITION_ANIMALS[p.animal].itemId]} alt={tr(EXPEDITION_ANIMALS[p.animal].name)}/><Icon id={step===0?'heart':'coin'} size={58}/></>:pinball?<><img src={arcadeArt.acorn} alt={tr('도토리')}/><Icon id="coin" size={58}/></>:<><img src={arcadeArt.flower} alt={tr('화분')}/><img src={arcadeArt.joint} alt={tr('수로')}/></>}
   </div><strong>{tr(rescue?(step===0?'하루 {0}회 도전':'10코스 완료 → 동물 친구 초대'):(step===0?'새 퍼즐 클리어 → 입장권 +1':pinball?'핀 +10점 · 목표 +50점 · 일반 +5점':'화분 3곳 연결 → 성공'),{0:p.dailyLimit})}</strong>
  </div>}
  {step===0&&!rescue&&<p className="weekly-guide-cap">{tr('입장권은 최대 {0}장까지 보관해요.',{0:p.ticketCap})}</p>}
 </Modal>;
}

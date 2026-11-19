import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,applyAction,legalActions} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,GameEvent} from '@garden/contracts';
import Board from '../apps/client/src/Board';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import '../apps/client/src/style.css';
import '../apps/client/src/fonts.css';
const level=getLevel(2);
function Harness(){
 const [state,setState]=useState(()=>createGame(level)),[events,setEvents]=useState<GameEvent[]>([]),[tutorial,setTutorial]=useState(true),[locked,setLocked]=useState(false),[epoch,setEpoch]=useState(0);
 const guard=useRef(false),barrier=useRef(false);
 const settled=()=>{guard.current=false;barrier.current=false;setLocked(false)};
 const action=(input:Action)=>{if(guard.current||barrier.current)return;guard.current=true;barrier.current=true;setLocked(true);const result=applyAction(state,input);setState(result.state);setEvents(result.events);if(result.accepted)setTutorial(false);};
 return <main className={'game-shell playing'+(tutorial?' has-tutorial':'')}>
  <header className="play-hud"><p>튜토리얼 전환 검사</p></header>
  <output data-guard={String(guard.current)} data-barrier={String(barrier.current)} data-turn={state.turn} data-locked={String(locked)}>{JSON.stringify({turn:state.turn,guard:guard.current,barrier:barrier.current,next:legalActions(state)[0]})}</output>
  <div className="board-area"><Board key={epoch} state={state} events={events} locked={false} tool={null} reduced={false} tutorial={tutorial?level.tutorial:undefined} onAction={action} onVisualStart={()=>{barrier.current=true;setLocked(true)}} onVisualSettled={settled}/>{tutorial&&<p className="tutorial-bubble">4개를 맞추세요</p>}</div>
  <footer><button onClick={()=>action(legalActions(state)[0]!)}>다음 유효 교환</button><button onClick={()=>{action(legalActions(state)[0]!);setEpoch(v=>v+1)}}>교환 중 보드 다시 표시</button><button onClick={()=>{settled();setTutorial(true);setEvents([]);setState(createGame(level));setEpoch(v=>v+1)}}>초기화</button></footer>
 </main>;
}
await prepareAssets(()=>{});configureSound(false,false,false);createRoot(document.getElementById('root')!).render(<Harness/>);

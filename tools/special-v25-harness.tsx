import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,applyAction,stateHash} from '@garden/core';
import {COLORS,type Action,type GameEvent,type LevelDefinition,type Tile} from '@garden/contracts';
import {getLevel} from '@garden/content';
import Board from '../apps/client/src/Board';
import ArtSurface from '../apps/client/src/ArtSurface';
import {Icon} from '../apps/client/src/ui';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v3.css';import '../apps/client/src/ui-v4.css';import '../apps/client/src/ui-v5.css';import '../apps/client/src/ui-v6.css';import '../apps/client/src/ui-v7.css';import '../apps/client/src/ui-v8.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';
const query=new URLSearchParams(location.search);
function board(combined=false,corner=false){
 const initial:Tile[]=Array.from({length:81},(_,i)=>({id:i+1,kind:'normal',color:COLORS[(i%9+Math.floor(i/9)*2)%4]!}));
 initial[30]={id:31,kind:'wind-row'};initial[32]={id:33,kind:'wind-column'};initial[corner?0:40]={id:(corner?0:40)+1,kind:'rainbow'};if(combined)initial[41]={id:42,kind:'rainbow'};
 if(query.has('size'))for(const [at,kind]of [[0,'glider'],[8,'bomb'],[72,'wind-column'],[74,'rainbow'],[76,'wind-row'],[78,'glider'],[80,'bomb']] as const)initial[at]={id:at+1,kind};
 const level:LevelDefinition={...getLevel(1),width:9,height:9,colors:[...COLORS],shape:Array(81).fill(true),initial,obstacles:[],frost:{},exits:[],inlets:Array.from({length:9},(_,i)=>i),gravity:undefined,moves:30,goals:[{kind:'berry',count:999,remaining:999}],tutorial:undefined};return createGame(level);
}
function Fixture(){
 const [state,setState]=useState(()=>board(query.has('combo'),query.has('corner'))),[events,setEvents]=useState<GameEvent[]>([]),[lastAction,setLastAction]=useState<Action>(),[reduced,setReduced]=useState(false),[locked,setLocked]=useState(false),[duration,setDuration]=useState(0),[actions,setActions]=useState(0);
 const current=useRef(state);current.current=state;
 const reset=(combined=false)=>{setState(board(combined));setEvents([]);setLastAction(undefined);setActions(0);};
 const action=(input:Action)=>{const result=applyAction(current.current,input);if(!result.accepted)throw new Error(result.reason);setActions(value=>value+1);setLastAction(input);setEvents(result.events);setState(result.state);};
 return <main className="game-shell" data-art-root data-actions={actions} data-state-hash={stateHash(state)} data-duration={duration} data-status={state.status}>
  <ArtSurface scene="play"/><header className="play-hud" data-frame="hud_band"><div className="target-panel" data-frame="hud_goal"><small>목표</small><div><Icon id="tile_berry" size={32}/><strong>{state.goals[0]!.remaining}</strong></div></div><Icon id="lumi" size={65}/><div className="moves-panel" data-frame="hud_moves"><small>이동 횟수</small><strong>{state.moves}</strong></div></header>
  <section className="board-area" style={{marginTop:70}}><div className="level-ribbon">아이템 연출 검수</div><Board state={state} events={events} action={lastAction} locked={locked} tool={null} onAction={action} onVisualStart={ms=>{setDuration(ms);setLocked(true);}} onVisualSettled={()=>setLocked(false)} reduced={reduced}/></section>
  <div style={{position:'absolute',bottom:65,left:12,right:12,color:'white',textAlign:'center',fontSize:14}}>가로 · 세로 폭탄 / 무지개등을 눌러 보세요</div>
  <div style={{position:'absolute',bottom:14,left:12,right:12,display:'flex',gap:8,justifyContent:'center'}}><button onClick={()=>reset()}>처음으로</button><button onClick={()=>reset(true)}>무지개 2개</button><label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>연출 줄이기</label></div>
 </main>;
}
setLocale('ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('18px Jua');await document.fonts.load('18px "Lilita One"');const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Fixture/>);

import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,applyAction,stateHash} from '@garden/core';
import {COLORS,type Action,type GameEvent,type LevelDefinition,type Tile,type Special} from '@garden/contracts';
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
const partner=(query.get('partner')||'bomb') as Special,stop=Number(query.get('stop'))||Infinity,realNow=performance.now.bind(performance);let animationAt=Infinity;
if(Number.isFinite(stop))Object.defineProperty(performance,'now',{configurable:true,value:()=>Math.min(realNow(),animationAt+stop)});
function board(combined=false,corner=false){
 const initial:Tile[]=Array.from({length:81},(_,i)=>({id:i+1,kind:'normal',color:COLORS[(i%9+Math.floor(i/9)*2)%4]!}));
 initial[corner?0:40]={id:(corner?0:40)+1,kind:'rainbow'};if(combined)initial[corner?1:41]={id:(corner?1:41)+1,kind:partner};
 if(query.has('size'))for(const [at,kind]of [[0,'glider'],[8,'bomb'],[72,'wind-column'],[74,'rainbow'],[76,'wind-row'],[78,'glider'],[80,'bomb']] as const)initial[at]={id:at+1,kind};
 const level:LevelDefinition={...getLevel(1),width:9,height:9,colors:[...COLORS],shape:Array(81).fill(true),initial,obstacles:[],frost:{},exits:[],inlets:Array.from({length:9},(_,i)=>i),gravity:undefined,moves:30,goals:[{kind:'berry',count:999,remaining:999}],tutorial:undefined};return createGame(level);
}
function Fixture(){
 const [state,setState]=useState(()=>board(!query.has('single'),query.has('corner'))),[events,setEvents]=useState<GameEvent[]>([]),[lastAction,setLastAction]=useState<Action>(),[locked,setLocked]=useState(false),[duration,setDuration]=useState(0),[actions,setActions]=useState(0);
 const current=useRef(state);current.current=state;
 const reset=()=>location.reload();
 const action=(input:Action)=>{const result=applyAction(current.current,input);if(!result.accepted)throw new Error(result.reason);setActions(value=>value+1);setLastAction(input);setEvents(result.events);setState(result.state);};
 return <main className="game-shell" data-art-root data-actions={actions} data-state-hash={stateHash(state)} data-duration={duration} data-status={state.status}>
  <ArtSurface scene="play"/><header className="play-hud" data-frame="hud_band"><div className="target-panel" data-frame="hud_goal"><small>목표</small><div><Icon id="tile_berry" size={32}/><strong>{state.goals[0]!.remaining}</strong></div></div><Icon id="lumi" size={65}/><div className="moves-panel" data-frame="hud_moves"><small>이동 횟수</small><strong>{state.moves}</strong></div></header>
  <section className="board-area" style={{marginTop:70}}><div className="level-ribbon">조합 검수</div><Board state={state} events={events} action={lastAction} locked={locked} tool={null} onAction={action} onVisualStart={ms=>{if(!Number.isFinite(animationAt)){animationAt=realNow();if(Number.isFinite(stop))setTimeout(()=>requestAnimationFrame(()=>{document.getElementById('root')!.dataset.clockFrozen='true';}),stop+30);}setDuration(ms);setLocked(true);}} onVisualSettled={()=>setLocked(false)} reduced={false}/></section>
  <div style={{position:'absolute',bottom:65,left:12,right:12,color:'white',textAlign:'center',fontSize:14}}>타일 변환 후 조합 아이템이 함께 발동합니다</div>
  <div style={{position:'absolute',bottom:14,left:12,right:12,display:'flex',gap:8,justifyContent:'center'}}><button onClick={()=>reset()}>처음으로</button><button disabled={locked} onClick={()=>action(query.has('single')?{type:'tap',at:query.has('corner')?0:40}:{type:'swap',from:query.has('corner')?0:40,to:query.has('corner')?1:41})}>조합 실행</button></div>
 </main>;
}
setLocale('ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('18px Jua');await document.fonts.load('18px "Lilita One"');const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Fixture/>);

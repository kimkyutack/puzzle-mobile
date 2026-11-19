import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {BEEHIVE_ENGINE_VERSION,COLORS,type Action,type GameState,type GameEvent,type Special} from '@garden/contracts';
import Board from '../apps/client/src/Board';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {effectTiming} from '../apps/client/src/visual-timing';
import '../apps/client/src/style.css';
import '../apps/client/src/fonts.css';
type Scenario='생성'|'기본'|'가로 로켓'|'세로 로켓'|'폭탄'|'프로펠러'|'무지개등'|'꿀벌집';
const partners:Partial<Record<Scenario,Special>>={'가로 로켓':'wind-row','세로 로켓':'wind-column','폭탄':'bomb','프로펠러':'glider','무지개등':'rainbow','꿀벌집':'beehive'};
function setup(name:Scenario){
 const s=createGame(getLevel(1,BEEHIVE_ENGINE_VERSION));s.cells.forEach((cell,i)=>{cell.tile={id:1000+i,kind:'normal',color:COLORS[(i%7+Math.floor(i/7)*2)%6]!};});s.nextTileId=2000;s.goals=[{kind:'crate',count:2,remaining:2}];s.moves=30;
 if(name==='생성'){for(const at of [15,16,24])s.cells[at]!.tile={id:1000+at,kind:'normal',color:'berry'};for(const at of [17,22,23])s.cells[at]!.tile={id:1000+at,kind:'normal',color:'drop'};}
 else{s.cells[24]!.tile={id:1024,kind:'beehive'};const partner=partners[name];if(partner)s.cells[25]!.tile={id:1025,kind:partner};}
 for(const [at,hp]of [[0,5],[6,4]]){const id='crate-'+at;s.obstacles[id]={id,kind:'crate',anchor:at,footprint:[at],hp,maxHp:hp};s.cells[at]!.obstacleId=id;s.cells[at]!.tile=null;}return s;
}
function Harness(){
 const [snap,setSnap]=useState<{scenario:Scenario;key:number;state:GameState;events:GameEvent[];action?:Action;busy:boolean;duration:number;actions:number}>({scenario:'생성',key:0,state:setup('생성'),events:[],busy:false,duration:0,actions:0}),latest=useRef(snap);latest.current=snap;
 function load(scenario:Scenario){setSnap(old=>({...old,scenario,key:old.key+1,state:setup(scenario),events:[],action:undefined,busy:false,duration:0,actions:0}));}
 function act(action:Action){if(latest.current.busy)return;const result=applyAction(latest.current.state,action);setSnap(old=>({...old,state:result.state,events:result.events,action,busy:true,actions:old.actions+1}));}
 const bees=snap.events.filter(e=>e.kind==='bee-flight'),plan=effectTiming(snap.events,snap.state,snap.action);
 return <main className="game-shell" data-scenario={snap.scenario}><h1>꿀벌집 생성·조합 검사</h1><div className="fixture-controls">{(['생성','기본','가로 로켓','세로 로켓','폭탄','프로펠러','무지개등','꿀벌집'] as const).map(name=><button key={name} onClick={()=>load(name)}>{name}</button>)}</div><p>{snap.scenario==='생성'?'4행 4열 빨강 → 3행 4열 파랑으로 교환':snap.scenario==='기본'?'4행 4열 꿀벌집을 눌러 사용':'4행 4열 꿀벌집 → 4행 5열 아이템으로 교환'}</p><Board key={snap.key} state={snap.state} events={snap.events} action={snap.action} locked={false} tool={null} onAction={act} reduced={false} onVisualStart={duration=>setSnap(old=>({...old,busy:true,duration}))} onVisualSettled={()=>setSnap(old=>({...old,busy:false}))}/><output className="fixture-probe" data-testid="bee-probe">{JSON.stringify({scenario:snap.scenario,engine:snap.state.engineVersion,busy:snap.busy,actions:snap.actions,moves:snap.state.moves,hash:stateHash(snap.state),status:snap.state.status,duration:snap.duration,bees:bees.map(e=>({from:e.from,to:e.to,payload:e.payload})),impacts:snap.events.flatMap((e,i)=>e.kind==='bee-flight'?[plan.delays[i]!+720]:[]),obstacles:Object.fromEntries(Object.entries(snap.state.obstacles).map(([id,o])=>[id,o.hp])),hiveSpawns:snap.events.filter(e=>e.type==='spawn'&&e.kind==='beehive').map(e=>e.cells)})}</output></main>;
}
const actualFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.pathname.includes('/api/'))throw Error('Fixture blocks all API requests');return actualFetch(input,init);};
await prepareAssets(()=>{});configureSound(false,false,false);await document.fonts.load('16px "Lilita One"');createRoot(document.getElementById('root')!).render(<Harness/>);

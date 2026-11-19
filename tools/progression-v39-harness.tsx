// Isolated renderer: no real account, API, inventory or server requests.
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {getLevel} from '@garden/content';
import {createGame,actionWithFrames,stateHash,type CascadeFrame} from '@garden/core';
import type {Action,GameEvent,GameState} from '@garden/contracts';
import {progressiveLevel,progressionSelection} from '../packages/content/src/progressive';
import {ENGINE_VERSION} from '@garden/contracts';
import {publishedLevel} from '../apps/api/src/level-content';
import proofsJson from '../packages/content/src/progressive-proofs.json';
import CascadeBoard from '../apps/client/src/CascadeBoard';
import PlayHud from '../apps/client/src/PlayHud';
import ArtSurface from '../apps/client/src/ArtSurface';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';
const query=new URLSearchParams(location.search),id=Number(query.get('level')||104),base=getLevel(id),published=query.has('published'),level=published?publishedLevel(id,query.get('engine')??ENGINE_VERSION):progressiveLevel(base),profile=progressionSelection(base);
const proof=published?undefined:(proofsJson as Record<string,{actions:Action[]}>)[id<=100?'early/'+id:profile?.key??''];
function Fixture(){
 const [state,setState]=useState(()=>createGame(level)),[shown,setShown]=useState<GameState>(state),[events,setEvents]=useState<GameEvent[]>([]),[frames,setFrames]=useState<CascadeFrame[]>([]),[action,setAction]=useState<Action>(),[locked,setLocked]=useState(false),[step,setStep]=useState(0),guard=useRef(false);
 const rail=Object.values(state.obstacles).find(o=>o.endOnly);
 const act=(input:Action)=>{if(guard.current)return;const result=actionWithFrames(state,input);setAction(input);setState(result.state);setEvents(result.events);setFrames(result.frames);setStep(v=>v+1);guard.current=true;setLocked(true);};
 return <main className="game-shell playing" style={{width:390,height:820,maxWidth:'100%',minHeight:820,margin:'0 auto'}} data-art-root data-game-status={state.status} data-turn={state.turn} data-state-hash={stateHash(state)}>
  <ArtSurface scene="play"/><PlayHud state={shown} moves={state.moves} tool={null} locked={locked} onCancelTool={()=>{}}/>
  <section className="board-area"><div className="level-ribbon" data-frame="event_sky_v9" data-frame-scale="0.1"><span>레벨 {id}</span></div><CascadeBoard state={state} events={events} action={action} frames={frames} locked={locked} tool={null} reduced={false} onAction={act} onStateShown={setShown} onVisualStart={()=>{guard.current=true;setLocked(true)}} onVisualSettled={()=>{guard.current=false;setLocked(false)}}/></section>
  <footer className="play-footer" data-frame="dock_v3" style={{padding:12,display:'flex',flexWrap:'wrap',gap:8,alignContent:'center'}}>{proof&&<button disabled={locked||state.status!=='playing'} onClick={()=>{const next=proof.actions[step];if(next)act(next);}}>검증된 다음 이동</button>}<span>{state.status} · {step}수</span>{rail&&<><output aria-label="남은 관 길이">{rail.footprint.length}</output><button disabled={locked} onClick={()=>act({type:'booster',item:'hammer',at:rail.footprint[0]})}>앞 끝 타격</button><button disabled={locked} onClick={()=>act({type:'booster',item:'hammer',at:rail.footprint.at(-1)})}>뒤 끝 타격</button><button disabled={locked||rail.footprint.length<3} onClick={()=>act({type:'booster',item:'hammer',at:rail.footprint[1]})}>몸통 타격</button></>}</footer>
 </main>;
}
setLocale('ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('18px Jua');const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Fixture/>);

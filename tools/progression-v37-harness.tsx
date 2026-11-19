// Isolated renderer: no real account, API, inventory or server requests.
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {getLevel} from '@garden/content';
import {createGame,actionWithFrames,stateHash,type CascadeFrame} from '@garden/core';
import type {Action,GameEvent,GameState} from '@garden/contracts';
import {progressiveLevel,progressionLayout} from '../packages/content/src/progressive';
import proofsJson from '../packages/content/src/progressive-proofs.json';
import CascadeBoard from '../apps/client/src/CascadeBoard';
import PlayHud from '../apps/client/src/PlayHud';
import ArtSurface from '../apps/client/src/ArtSurface';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';
const query=new URLSearchParams(location.search),id=Number(query.get('level')||104),base=getLevel(id),level=progressiveLevel(base),profile=progressionLayout(id,base.campaign!.beat);
const proof=(proofsJson as Record<string,{actions:Action[]}>)[id<=100?'early/'+id:profile!.key];
function Fixture(){
 const [state,setState]=useState(()=>createGame(level)),[shown,setShown]=useState<GameState>(state),[events,setEvents]=useState<GameEvent[]>([]),[frames,setFrames]=useState<CascadeFrame[]>([]),[action,setAction]=useState<Action>(),[locked,setLocked]=useState(false),[step,setStep]=useState(0),guard=useRef(false);
 const act=(input:Action)=>{if(guard.current)return;const result=actionWithFrames(state,input);setAction(input);setState(result.state);setEvents(result.events);setFrames(result.frames);setStep(v=>v+1);guard.current=true;setLocked(true);};
 return <main className="game-shell playing" style={{width:390,height:844,maxWidth:'100%',minHeight:844,margin:'0 auto'}} data-art-root data-game-status={state.status} data-turn={state.turn} data-state-hash={stateHash(state)}>
  <ArtSurface scene="play"/><PlayHud state={shown} moves={state.moves} tool={null} locked={locked} onCancelTool={()=>{}}/>
  <section className="board-area"><div className="level-ribbon" data-frame="event_sky_v9" data-frame-scale="0.1"><span>레벨 {id}</span></div><CascadeBoard state={state} events={events} action={action} frames={frames} locked={locked} tool={null} reduced={false} onAction={act} onStateShown={setShown} onVisualStart={()=>{guard.current=true;setLocked(true)}} onVisualSettled={()=>{guard.current=false;setLocked(false)}}/></section>
  <footer className="play-footer" data-frame="dock_v3" style={{padding:12}}><button disabled={locked||state.status!=='playing'} onClick={()=>{const next=proof.actions[step];if(next)act(next);}}>검증된 다음 이동</button><span>{state.status} · {step}수</span></footer>
 </main>;
}
setLocale('ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('18px Jua');const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Fixture/>);

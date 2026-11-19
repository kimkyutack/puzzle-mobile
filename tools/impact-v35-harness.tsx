import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {getLevel} from '@garden/content';
import {actionWithFrames,createGame,stateHash,legalActions,applyAction,type CascadeFrame} from '@garden/core';
import type {Action,GameEvent,GameState,Special} from '@garden/contracts';
import CascadeBoard from '../apps/client/src/CascadeBoard';
import LegacyBoard from '../apps/client/src/Board';
import PlayHud from '../apps/client/src/PlayHud';
import ArtSurface from '../apps/client/src/ArtSurface';
import {Icon,names} from '../apps/client/src/ui';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';
const params=new URLSearchParams(location.search),mode=params.get('mode')||'match',level=getLevel(Number(params.get('level')||31)),legacy=params.has('legacy');
function initial(){const state=createGame(level);if(mode==='rocket'||mode==='rainbow'){state.cells[40]!.tile={id:90000,kind:mode==='rocket'?'wind-column':'rainbow'};state.nextTileId=90001;if(params.has('partner')){state.cells[41]!.tile={id:90001,kind:params.get('partner') as Special};state.nextTileId=90002;}}return state;}
const timeline:Array<Record<string,unknown>>=[];
function Fixture(){
 const [state,setState]=useState(initial),[shown,setShown]=useState<GameState>(state),[events,setEvents]=useState<GameEvent[]>([]),[frames,setFrames]=useState<CascadeFrame[]>([]),[action,setAction]=useState<Action>(),[locked,setLocked]=useState(false),[epoch,setEpoch]=useState(0),current=useRef(state),guard=useRef(false);current.current=state;
 function act(input:Action){if(guard.current)return;const before=current.current,result=actionWithFrames(before,input);guard.current=true;setLocked(true);setState(result.state);if(legacy)setShown(result.state);setAction(input);setEvents(result.events);setFrames(result.frames);timeline.push({at:performance.now(),kind:'action',input,frames:result.frames.length,accepted:result.accepted,hash:stateHash(result.state)});}
 useEffect(()=>{if(!params.has('auto'))return;const timer=setTimeout(()=>act(mode==='match'?{type:'swap',from:23,to:32}:params.has('partner')?{type:'swap',from:40,to:41}:{type:'tap',at:40}),800);return()=>clearTimeout(timer);},[epoch]);
 const settle=()=>{guard.current=false;setLocked(false);timeline.push({at:performance.now(),kind:'idle'});};
 const common={state,events,action,locked:false,tool:null,onAction:act,reduced:params.has('reduced'),onVisualStart:()=>{guard.current=true;setLocked(true)},onVisualSettled:settle};
 return <main className="game-shell playing" data-art-root data-state-hash={stateHash(state)} data-locked={locked} data-turn={state.turn}>
  <ArtSurface scene="play"/><PlayHud moves={state.moves} state={shown} tool={null} locked={locked} onCancelTool={()=>{}}/>
  <section className="board-area"><div className="level-ribbon" data-frame="event_sky_v9" data-frame-scale="0.1"><span>레벨 {level.id}</span></div>{legacy?<LegacyBoard key={epoch} {...common}/>:<CascadeBoard key={epoch} {...common} frames={frames} onStateShown={s=>{setShown(s);timeline.push({at:performance.now(),kind:'shown',hash:stateHash(s),goals:s.goals.map(g=>g.remaining)});}}/>}</section>
  <footer className="play-footer" data-frame="dock_v3" data-frame-bleed="8"><div className="booster-toolbar">{['hammer','sweep-row','sweep-column','shuffle','world-bomb','settings'].map(id=><button key={id} disabled={locked} aria-label={id}><span className="booster-socket"><Icon id="booster_socket" size={68}/><Icon id={id} size={51}/></span><small>{id==='settings'?'설정':names[id]}</small></button>)}</div></footer>
  {!params.has('clean')&&<aside style={{position:'fixed',bottom:0,left:0,right:0,zIndex:2000,background:'#15334a',color:'white',fontSize:10}}><button disabled={locked} onClick={()=>act(mode==='match'?{type:'swap',from:23,to:32}:params.has('partner')?{type:'swap',from:40,to:41}:{type:'tap',at:40})}>참고 동작 실행</button><button disabled={locked} onClick={()=>act(legalActions(current.current)[0]!)}>다음 이동</button><button onClick={()=>{const synced=applyAction(current.current,legalActions(current.current)[0]!);setState(synced.state);timeline.push({at:performance.now(),kind:'authoritative',hash:stateHash(synced.state)});}}>동기화 상태 다시 표시</button><button onClick={()=>{guard.current=false;setLocked(false);setState(initial());setShown(initial());setEvents([]);setFrames([]);setEpoch(v=>v+1)}}>초기화</button><output id="motion-qa">{JSON.stringify({turn:state.turn,hash:stateHash(state),locked,frames:frames.length})}</output></aside>}
 </main>;
}
const observer=new MutationObserver(()=>{const probe=document.querySelector('.cascade-playback');if(probe){probe.setAttribute('data-qa-timeline',JSON.stringify(timeline));}});observer.observe(document.getElementById('root')!,{subtree:true,childList:true,attributes:true,attributeFilter:['data-cascade-wave','data-cascade-playing']});
setLocale('ko');configureSound(params.has('sound'),false,false);await prepareAssets(()=>{});await document.fonts.load('18px Jua');await document.fonts.load('18px "Lilita One"');const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Fixture/>);

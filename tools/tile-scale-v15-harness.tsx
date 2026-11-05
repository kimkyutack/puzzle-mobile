// Renderer-only QA: no session, inventory, authentication or API requests.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import {ENGINE_VERSION,type Action,type GameEvent} from '@garden/contracts';
import Board from '../apps/client/src/Board';
import ArtSurface from '../apps/client/src/ArtSurface';
import {prepareAssets,art,goalArt} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import {Icon,names} from '../apps/client/src/ui';
import '../apps/client/src/style.css';
import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v3.css';
import '../apps/client/src/ui-v4.css';
import '../apps/client/src/ui-v5.css';
import '../apps/client/src/ui-v6.css';
import '../apps/client/src/ui-v7.css';
import '../apps/client/src/ui-v8.css';
import '../apps/client/src/ui-v9.css';
import '../apps/client/src/context-v9.css';

function Fixture(){
 const query=new URLSearchParams(location.search),initial=Number(query.get('level')||1),reduced=query.get('reduced')==='1';
 function preview(id:number){let state=createGame(getLevel(id,ENGINE_VERSION));if(query.get('frost')==='last'){for(let i=0;i<state.cells.length&&state.cells.filter(cell=>cell.frost>0).length>1;i++){const at=state.cells.findIndex(cell=>cell.frost>0),result=applyAction(state,{type:'booster',item:'hammer',at});if(!result.accepted)break;state=result.state;}}return state;}
 const [levelId,setLevelId]=useState(initial),[state,setState]=useState(()=>preview(initial)),[events,setEvents]=useState<GameEvent[]>([]),[action,setAction]=useState<Action>(),[visual,setVisual]=useState(false),[lastInput,setLastInput]=useState(''),[tool,setTool]=useState<'hammer'|null>(null);
 function choose(id:number){setLevelId(id);setState(preview(id));setEvents([]);setAction(undefined);setLastInput('');setVisual(false);setTool(null);}
 function act(input:Action){const result=applyAction(state,input);setLastInput(JSON.stringify({input,accepted:result.accepted}));setState(result.state);setEvents(result.events);setAction(input);setTool(null);}
 return <main className="game-shell playing" data-art-root>
  <ArtSurface scene="play"/>
  <header className="play-hud" data-frame="hud_band">
   <div className={'target-panel goal-count-'+state.goals.length} data-frame="hud_goal"><span className="hud-label">목표</span><div className="targets">{state.goals.map(goal=><div key={goal.kind}><Icon id={goalArt(goal.kind)} size={40}/><strong>{goal.remaining}</strong></div>)}</div></div>
   <div className="lumi-hud"><Icon id="portrait_frame" size={84}/><img src={art('lumi')} alt="루미"/></div>
   <div className="moves-panel" data-frame="hud_moves"><span className="hud-label">이동 횟수</span><strong>{state.moves}</strong></div>
  </header>
  <nav className="tile-test-controls" aria-label="격리된 화면 검사">{[[7,1],[8,9],[9,38]].map(([cols,id])=><button key={id} onClick={()=>choose(id!)} aria-pressed={state.width===cols}>{cols}열</button>)}</nav>
  <div className="board-area"><div className="level-ribbon" data-frame="event_sky_v9" data-frame-scale="0.1"><span>레벨 {levelId}</span></div><Board key={levelId} state={state} events={events} action={action} locked={visual} tool={tool} onAction={act} onVisualStart={()=>setVisual(true)} onVisualSettled={()=>setVisual(false)} reduced={reduced}/></div>
  <output className="tile-test-result" data-testid="last-input">{lastInput}</output>
  <footer className="play-footer" data-frame="dock_v3" data-frame-bleed="8"><div className="booster-toolbar">{['hammer','sweep-row','sweep-column','shuffle','bundle_tools_v7','settings'].map(id=><button key={id} disabled={visual} aria-label={names[id]||id} aria-pressed={id==='hammer'&&tool==='hammer'} onClick={()=>{if(id==='hammer')setTool(tool?null:'hammer')}}><span className="booster-socket"><Icon id="booster_socket" size={68}/><Icon id={id} size={51}/></span><small>{names[id]||({bundle_tools_v7:'도구 가방',settings:'설정'} as Record<string,string>)[id]}</small></button>)}</div></footer>
 </main>;
}
setLocale('ko');configureSound(false,false,false);
await prepareAssets(()=>{});await document.fonts.load('16px Jua');await document.fonts.load('18px "Lilita One"');
const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Fixture/>);

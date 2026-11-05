// Renderer-only QA: no session, inventory, authentication or API requests.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import {ENGINE_VERSION,type Action,type GameEvent} from '@garden/contracts';
import proofs from '../packages/content/src/campaign-solutions.json';
import bulkCatalogue from '../packages/content/src/bulk-catalogue.json';
import bulkProofs from '../packages/content/src/bulk-proofs.json';
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
 const query=new URLSearchParams(location.search),initial=Number(query.get('level')||201),reduced=query.get('reduced')==='1';
 function preview(id:number){let state=createGame(getLevel(id,ENGINE_VERSION));if(query.get('frost')==='last'){for(let i=0;i<state.cells.length&&state.cells.filter(cell=>cell.frost>0).length>1;i++){const at=state.cells.findIndex(cell=>cell.frost>0),result=applyAction(state,{type:'booster',item:'hammer',at});if(!result.accepted)break;state=result.state;}}return state;}
 const controls:Array<[number,string]>=query.get('bulk')==='1'?[[1000,'1천'],[3000,'3천'],[6000,'6천'],[9998,'고난도'],[10000,'1만']]:query.get('pack')==='6'?[[251,'물관'],[261,'차양'],[271,'화분'],[281,'온실'],[298,'종합']]:[[201,'물관'],[211,'꽃봉오리'],[221,'화분대'],[231,'차양']];
 const actionsFor=(id:number):Action[]=>id<=300?(proofs as Record<string,{actions:Action[]}>)[id]!.actions:(bulkProofs.templates[bulkCatalogue.entries[id-301]![0]!]!.actions as Action[]);
 const [levelId,setLevelId]=useState(initial),[state,setState]=useState(()=>preview(initial)),[events,setEvents]=useState<GameEvent[]>([]),[action,setAction]=useState<Action>(),[visual,setVisual]=useState(false),[lastInput,setLastInput]=useState(''),[tool,setTool]=useState<'hammer'|null>(null),[step,setStep]=useState(0);
 function choose(id:number){setStep(0);setLevelId(id);setState(preview(id));setEvents([]);setAction(undefined);setLastInput('');setVisual(false);setTool(null);}
 function act(input:Action){const result=applyAction(state,input);setLastInput(JSON.stringify({input,accepted:result.accepted}));setState(result.state);setEvents(result.events);setAction(input);setTool(null);}
 return <main className="game-shell playing" data-art-root>
  <ArtSurface scene="play"/>
  <header className={"play-hud"+(state.goals.length>3?" has-dense-goals":"")} data-frame="dock_v3">
   <div className={'target-panel goal-count-'+state.goals.length+(state.goals.length>2?' has-many-goals':'')} data-frame="resource_pearl_v9"><span className="hud-label">목표</span><div className="targets">{state.goals.map(goal=><div key={goal.kind}><Icon id={goalArt(goal.kind)} size={34}/><strong>{goal.remaining}</strong></div>)}</div></div>
   <div className="lumi-hud"><Icon id="portrait_frame" size={84}/><img src={art('lumi')} alt="루미"/></div>
   <div className="moves-panel" data-frame="hud_moves"><span className="hud-label">이동 횟수</span><strong>{state.moves}</strong></div>
  </header>
  <nav className="tile-test-controls" aria-label="새 기믹 검증">{controls.map(([id,label])=><button key={id} onClick={()=>choose(Number(id))}>{label}</button>)}</nav>
  <div className="board-area"><div className="level-ribbon" data-frame="event_sky_v9" data-frame-scale="0.1"><span>레벨 {levelId}</span></div><Board key={levelId} state={state} events={events} action={action} locked={visual} tool={tool} onAction={act} onVisualStart={()=>setVisual(true)} onVisualSettled={()=>setVisual(false)} reduced={reduced}/></div>
  <output className="tile-test-result" data-testid="last-input" data-game-status={state.status} data-proof-step={step} data-obstacles={JSON.stringify(state.obstacles)}>{lastInput}</output>
  <footer className="play-footer" data-frame="dock_v3" data-frame-bleed="8"><button className="qa-step" disabled={visual||state.status!=='playing'} onClick={()=>{const action=actionsFor(levelId)[step];if(action){act(action);setStep(step+1);}}}>한 수 진행</button><p className="qa-state">{state.status} · {step}수 · {visual?'연출 중':'입력 가능'}</p></footer>
 </main>;
}
setLocale('ko');configureSound(false,false,false);
await prepareAssets(()=>{});await document.fonts.load('16px Jua');await document.fonts.load('18px "Lilita One"');
const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Fixture/>);

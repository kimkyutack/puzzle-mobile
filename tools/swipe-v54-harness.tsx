import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,actionWithFrames,stateHash,type CascadeFrame} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,GameEvent,Special} from '@garden/contracts';
import CascadeBoard from '../apps/client/src/CascadeBoard';
import CurrentBoard from '../apps/client/src/Board';
import {readInputTraces,type InputTrace} from '../apps/client/src/input-diagnostics';
import {SupportCenter} from '../apps/client/src/OperationsUI';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import '../apps/client/src/style.css';
import '../apps/client/src/fonts.css';
const params=new URLSearchParams(location.search);
const Board=params.has('before')?(await import(/* @vite-ignore */ '/@fs/Users/kimkyutack/Desktop/puzzle-mobile/output/verification/swipe-direction-v54/Board.browser-before.tsx')).default as typeof CurrentBoard:CurrentBoard;
const originalFetch=fetch.bind(globalThis);globalThis.fetch=async(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.pathname.includes('/api/')){if(url.pathname.endsWith('/support')&&(!init?.method||init.method==='GET'))return Response.json({data:{tickets:[]},serverNow:Date.now()});throw Error('QA blocks API mutations');}return originalFetch(input,init);};
const kinds=['wind-row','wind-column','bomb','glider','rainbow','beehive'] as const;
function initial(kind:Special){const s=createGame(getLevel(31));s.moves=99;s.goals=[{kind:'color',color:s.colors[0],count:999,remaining:999}];s.cells[40]!.tile={id:s.nextTileId++,kind};if(params.has('formation')){for(const at of [36,37,38,40])s.cells[at]!.tile={id:s.nextTileId++,kind:'normal',color:'sun'};s.cells[39]!.tile={id:s.nextTileId++,kind:'normal',color:'drop'};s.cells[41]!.tile={id:s.nextTileId++,kind:'normal',color:'sprout'};}if(params.has('combo'))for(const at of [31,39,41,49])s.cells[at]!.tile={id:s.nextTileId++,kind:'bomb'};return s;}
const paths={'late-left':[[0,16],[-36,16]],'late-right':[[0,16],[36,16]],'late-up':[[16,0],[16,-36]],'late-down':[[16,0],[16,36]],'release-opposite':[[-30,0],[30,0]],'release-orthogonal':[[-30,0],[0,-36]],'intentional-reverse':[[-30,0],[30,0]],layout:[[-30,0],[-36,0]],second:[[-30,0],[-36,0]],fast:[[0,0],[-36,0]],tap:[[0,0],[0,0]],left:[[1,5],[-30,14]],right:[[1,5],[30,14]],up:[[5,1],[14,-30]],down:[[5,1],[14,30]],reverse:[[-25,1],[30,1]],cancel:[[1,5],[0,0]]} as const;
function gesture(name:keyof typeof paths){
 const board=document.querySelector<HTMLElement>('.board')!,canvas=board.querySelector('canvas')!,rect=canvas.getBoundingClientRect(),g=JSON.parse(board.dataset.boardGeometry!),x=rect.x+(g.face.x+4.5*g.cell)*rect.width/g.width,y=rect.y+(g.face.y+4.5*g.cell)*rect.height/g.height;
 const fire=(type:string,dx=0,dy=0)=>canvas.dispatchEvent(new PointerEvent(type==='second'?'pointerdown':type,{bubbles:true,cancelable:true,pointerId:type==='second'?54:53,pointerType:'touch',isPrimary:type!=='second',button:0,buttons:type==='pointerup'?0:1,clientX:x+dx,clientY:y+dy}));
 fire('pointerdown');const path=paths[name];if(name!=='fast'&&name!=='tap')fire('pointermove',...path[0]);if(name==='second')fire('second');if(name==='layout')canvas.style.transform='translateX(30px)';if(!['reverse','release-opposite','release-orthogonal','fast','tap'].includes(name))fire('pointermove',...path[1]);
 const preview={from:board.dataset.dragFrom,to:board.dataset.dragTo,x:board.dataset.dragX,y:board.dataset.dragY};fire('pointerup',...path[1]);board.dataset.qaPreview=JSON.stringify(preview);canvas.style.transform='';
}
function Harness(){
 const [support,setSupport]=useState(false),[diagnostic,setDiagnostic]=useState<InputTrace[]>([]);
 const [kind,setKind]=useState<Special>('wind-row'),[state,setState]=useState(()=>initial('wind-row')),[events,setEvents]=useState<GameEvent[]>([]),[frames,setFrames]=useState<CascadeFrame[]>([]),[action,setAction]=useState<Action>(),[epoch,setEpoch]=useState(0),[locked,setLocked]=useState(false),[log,setLog]=useState<unknown[]>([]),guard=useRef(false);
 function act(input:Action){const denied=guard.current,result=actionWithFrames(state,input);setLog(values=>[...values,{input,denied,accepted:result.accepted,before:stateHash(state),after:stateHash(result.state)}]);if(denied)return;guard.current=true;setLocked(true);setAction(input);setState(result.state);setEvents(result.events);setFrames(result.frames);}
 const props={state,events,action,locked,tool:null,onAction:act,reduced:params.has('reduced'),onVisualStart:()=>{guard.current=true;setLocked(true)},onVisualSettled:()=>{guard.current=false;setLocked(false)}};
 if(support)return <main style={{maxWidth:420,margin:"0 auto",color:"white",background:"#123b66",minHeight:"100vh",padding:12}} data-art-root><button onClick={()=>setSupport(false)}>보드로</button><SupportCenter/></main>;
 return <main className="game-shell playing" data-turn={state.turn} data-locked={locked} data-created={JSON.stringify(events.filter(e=>e.type==='spawn'&&e.kind!=='normal'))}>
  <header className="play-hud" style={{height:105,display:'block',fontSize:13,color:'#fff',padding:12,lineHeight:1.4}}><strong>스와이프 방향 검증</strong><output id="swipe-log" style={{display:'block',overflowWrap:'anywhere'}}>{JSON.stringify(log)}</output></header>
  <section className="board-area"><div className="level-ribbon">{kind} · 중앙 40번</div>{params.has('before')?<Board key={epoch} {...props}/>:<CascadeBoard key={epoch} {...props} frames={frames}/>}</section>
  <footer className="swipe-controls" style={{minHeight:100}}><style>{`.swipe-controls button{color:white;background:#15529c;border:0;border-radius:5px;padding:6px;margin:2px;font-size:12px}`}</style>{kinds.map(value=><button key={value} onClick={()=>{guard.current=false;setLocked(false);setKind(value);setState(initial(value));setEvents([]);setFrames([]);setAction(undefined);setLog([]);setEpoch(n=>n+1)}}>{value}</button>)}<div>{Object.keys(paths).map(name=><button key={name} onClick={()=>gesture(name as keyof typeof paths)}>{name} 검사</button>)}<button onClick={()=>{gesture('left');gesture('right')}}>연속 입력 검사</button><button onClick={()=>setSupport(true)}>고객센터 검사</button><button onClick={()=>setDiagnostic(readInputTraces())}>기록 확인</button><output id="input-history" style={{display:"block",maxHeight:90,overflow:"auto",fontSize:9}}>{JSON.stringify(diagnostic)}</output></div></footer>
 </main>;
}
await prepareAssets(()=>{});configureSound(false,false,false);const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Harness/>);

import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {applyAction,stateHash} from '@garden/core';
import type {Action,GameEvent,GameState,Run} from '@garden/contracts';
import Board from '../../apps/client/src/Board';
import {prepareAssets} from '../../apps/client/src/assets';
import {request,key,setToken} from '../../apps/client/src/api';
import {setLocale} from '../../apps/client/src/i18n';
import '../../apps/client/src/style.css';
import '../../apps/client/src/fonts.css';
import '../../apps/client/src/ui-v3.css';
import '../../apps/client/src/ui-v4.css';
import '../../apps/client/src/ui-v5.css';
import '../../apps/client/src/ui-v9.css';

setLocale('ko');
setToken(sessionStorage.getItem('special-swap-test-access')||'');
function Fixture(){
 const [state,setState]=useState<GameState|null>(null),[events,setEvents]=useState<GameEvent[]>([]),[busy,setBusy]=useState(false),[visual,setVisual]=useState(false),[status,setStatus]=useState('그림을 준비하는 중…'),[error,setError]=useState('');
 useEffect(()=>{void Promise.all([prepareAssets(()=>{}),request<{run:Run}>('/runs/'+document.body.dataset.runId),document.fonts.load('18px Jua')]).then(([,r])=>{setState(r.run.state);setStatus('줄바람을 위쪽 물방울과 교환해 보세요.')},e=>setError(String(e)))},[]);
 async function act(action:Action){if(!state||busy)return;setBusy(true);const expected=applyAction(state,action);try{const r=await request<{run:Run;events:GameEvent[]}>('/runs/'+document.body.dataset.runId+'/actions',{key:key(),sequence:state.turn,actions:[action]});if(stateHash(r.run.state)!==stateHash(expected.state))throw new Error('Client/server mismatch');setEvents(r.events);setState(r.run.state);const first=r.events.findIndex(e=>e.type==='fall'||e.type==='spawn'&&e.kind==='normal'),phase=r.events.slice(0,first);setStatus(phase.some(e=>e.type==='spawn'&&e.kind==='glider'&&e.cells[0]===24)?'물방울 4개 매치 + 줄바람 발동 + 새 아이템 생성':'매치 확인 필요');}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <main style={{width:'min(100%,430px)',height:'100dvh',margin:'0 auto',display:'flex',flexDirection:'column',justifyContent:'center',padding:'28px 12px',gap:18,color:'#fff',background:'#203d62',boxSizing:'border-box'}}><h1 style={{fontSize:23,textAlign:'center'}}>아이템과 물방울 함께 터뜨리기</h1><p style={{fontSize:15,textAlign:'center',lineHeight:1.5}} role="status">{error||status}</p>{state&&<><div style={{display:'flex',justifyContent:'space-around',fontSize:19}}><span>물방울 {state.goals[0]!.remaining} / 4</span><span>이동 {state.moves}</span></div><Board state={state} events={events} locked={busy||visual} tool={null} onAction={action=>void act(action)} onVisualStart={()=>setVisual(true)} onVisualSettled={()=>setVisual(false)} reduced={false}/><p style={{fontSize:12,textAlign:'center'}}>실제 보드·서버 교환 처리 검수 · 별도 테스트 정원사</p></>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

// Isolated UI fixture. All administrator API requests stay in memory.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import GameEventSettings from '../apps/admin/src/GameEventSettings';
import StartBoosterSchedule from '../apps/admin/src/StartBoosterSchedule';
import {Context,type ConsoleContext} from '../apps/admin/src/context';
import {Button,Dialog,Field} from '../apps/admin/src/components';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';
import '../apps/admin/src/style.css';
let settings=defaultOperationsRuntime(),revision=0;
const readonly=new URLSearchParams(location.search).has('viewer');
globalThis.fetch=async(input,init)=>{
 const path=new URL(input instanceof Request?input.url:String(input),location.href).pathname;
 if(path!=='/api/admin/runtime')throw Error('Local administrator fixture blocked: '+path);
 if(init?.method==='PUT'){
  const body=JSON.parse(String(init.body));
  if(readonly)return Response.json({error:{code:'FORBIDDEN',message:'조회 권한입니다.'}},{status:403});
  if(body.revision!==revision)return Response.json({error:{code:'CONFLICT',message:'설정이 변경되었습니다. 다시 불러와 주세요.'}},{status:409});
  if(!body.reason?.trim()||!body.key)throw Error('A reviewed reason and operation key are required');
  settings=structuredClone(body.data);revision++;
  document.documentElement.dataset.fixtureLastSave=JSON.stringify(body);document.documentElement.dataset.fixtureRevision=String(revision);
 }
 return Response.json({data:structuredClone({settings,revision,basePrices:{}})});
};
function Fixture(){
 const [pending,setPending]=useState<{title:string;summary:string;action:(reason:string,key:string)=>Promise<void>}|null>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const context:ConsoleContext={admin:{id:'synthetic-owner',email:'qa@example.test',role:readonly?'viewer':'owner'},canWrite:!readonly,confirm:(title,summary,action)=>{setReason('');setError('');setPending({title,summary,action})},notify:setNotice,navigate:()=>{}};
 return <Context.Provider value={context}><main className="console-main" style={{margin:0,width:'100%',maxWidth:1400,padding:28}}><header className="section-toolbar"><h1>이벤트</h1><span>격리된 로컬 검증</span></header><GameEventSettings/><StartBoosterSchedule/>{notice&&<p role="status">{notice}</p>}
 {pending&&<Dialog title={pending.title} onClose={()=>{if(!busy)setPending(null)}}><form onSubmit={e=>{e.preventDefault();setBusy(true);void pending.action(reason,crypto.randomUUID()).then(()=>{setPending(null);setNotice('변경사항을 적용했습니다.')},e=>setError(String(e))).finally(()=>setBusy(false));}}><p style={{whiteSpace:'pre-line'}}>{pending.summary}</p><Field label="작업 사유"><textarea required minLength={2} value={reason} onChange={e=>setReason(e.target.value)}/></Field>{error&&<p role="alert">{error}</p>}<div className="dialog-actions"><Button onClick={()=>setPending(null)} disabled={busy}>취소</Button><Button type="submit" variant="primary" disabled={busy||reason.trim().length<2}>확인 후 적용</Button></div></form></Dialog>}
 </main></Context.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

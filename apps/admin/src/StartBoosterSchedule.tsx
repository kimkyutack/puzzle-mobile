import {useEffect,useState} from 'react';
import type {RuntimeSettings} from '../../../packages/contracts/src/operations';
import {startBoosterWindow} from '../../../packages/contracts/src/start-booster-rush';
import {api} from './api';
import {Badge,Button,Card,Field,Glyph,Switch} from './components';
import {useConsole} from './context';
import {useResource} from './use-resource';
export default function StartBoosterSchedule(){
 const {data,error,loading,reload}=useResource<{settings:RuntimeSettings;revision:number}>('/runtime',{settings:null as unknown as RuntimeSettings,revision:0});
 const [draft,setDraft]=useState<RuntimeSettings['startBoosterRush']|null>(null),{canWrite,confirm}=useConsole();
 useEffect(()=>{if(data.settings)setDraft(structuredClone(data.settings.startBoosterRush));},[data]);
 useEffect(()=>{const update=()=>reload();window.addEventListener('admin-runtime-updated',update);return()=>window.removeEventListener('admin-runtime-updated',update)},[]);
 if(error)return <p role="alert" className="error">{error}</p>;
 if(loading||!draft)return <p className="loading">이벤트 시간을 불러오는 중…</p>;
 const activeWindow=startBoosterWindow(draft,Date.now());
 return <Card className="start-rush-settings" title="시작 아이템 무제한" detail="지정한 시각부터 10분 동안 로켓·꽃폭탄·무지개등을 소모 없이 선택합니다." action={<Badge tone={activeWindow.active?'green':''}>{activeWindow.active?'진행 중':'10분 고정'}</Badge>}>
  <form onSubmit={event=>{event.preventDefault();confirm('시작 아이템 무제한 일정 적용',draft.enabled?`매일 한국 시간 ${draft.dailyTimes.join(', ')}부터 각각 10분간 적용합니다.`:'시작 아이템 무제한 이벤트를 중지합니다.',async(reason,key)=>{await api('/runtime',{key,reason,revision:data.revision,data:{...data.settings,startBoosterRush:{...draft,dailyTimes:[...draft.dailyTimes].sort()}}},'PUT');window.dispatchEvent(new Event('admin-runtime-updated'));},!draft.enabled);}}>
   <fieldset disabled={!canWrite}>
    <Switch checked={draft.enabled} label="시간 이벤트 활성화" detail="모든 사용자가 같은 한국 시간(UTC+9)을 기준으로 이용합니다." onChange={enabled=>setDraft({...draft,enabled})}/>
    <Field label="매일 시작 시간" hint="시간끼리는 10분 이상 간격을 두세요. 기간 안에 새로 시작하는 판에 적용되며, 인게임 도구는 기존대로 소모됩니다.">
     <div className="rush-time-list">{draft.dailyTimes.map((time,index)=><div key={index}><input aria-label={'시작 시간 '+(index+1)} type="time" step={60} required value={time} onInput={event=>{const time=event.currentTarget.value;setDraft(current=>current?{...current,dailyTimes:current.dailyTimes.map((value,i)=>i===index?time:value)}:current)}}/><button type="button" className="icon-btn" aria-label={'시작 시간 '+(index+1)+' 삭제'} onClick={()=>setDraft({...draft,dailyTimes:draft.dailyTimes.filter((_,i)=>i!==index)})}><Glyph name="close" size={16}/></button></div>)}</div>
    </Field>
    <div className="button-row"><Button disabled={draft.dailyTimes.length>=24} onClick={()=>setDraft({...draft,dailyTimes:[...draft.dailyTimes,'00:00']})}><Glyph name="plus" size={16}/>시간 추가</Button><Button onClick={()=>setDraft({...draft,dailyTimes:['00:00','03:00','06:00','09:00','12:00','15:00','18:00','21:00']})}>매 3시간</Button><Button type="submit" variant="primary">일정 검토</Button></div>
   </fieldset>
  </form>
 </Card>;
}

import {useState} from 'react';
import {ageBandAt,type AgeBand} from '../../../packages/contracts/src/age-access';
import {api} from './api';
import {Button,Field} from './components';
import {useConsole} from './context';

export interface UserAgeAccess {band:AgeBand|null;confirmed:boolean}

const labels:Record<AgeBand,string>={child:'만 14세 미만',teen:'만 14세 이상~19세 미만',adult:'만 19세 이상'};
export function ageAccessLabel(age:UserAgeAccess){
 if(!age.band)return '미확인';
 return labels[age.band]+(age.band==='child'?(age.confirmed?' · 보호자 동의 확인':' · 보호자 동의 필요'):'');
}

export default function BirthDateForm({id,nickname,age,onSaved}:{
 id:string;nickname:string;age:UserAgeAccess;onSaved:()=>void;
}){
 const [birthDate,setBirthDate]=useState('');
 const {confirm}=useConsole();
 const now=Date.now(),band=ageBandAt(birthDate,now);
 const today=new Date(now+9*3_600_000).toISOString().slice(0,10);
 const changingToChild=band==='child'&&age.band!=='child';
 const note=changingToChild?'보호자 동의가 필요하며, 닉네임이 초기화되고 친구·길드 연결이 해제됩니다.':'';

 return <form className="inline-form" onSubmit={event=>{
  event.preventDefault();
  if(!band)return;
  confirm('생년월일 정정',[`${nickname}의 연령 확인을 ‘${labels[band]}’로 정정합니다.`,note,'변경 사유에는 생년월일을 적지 마세요.'].filter(Boolean).join(' '),
   async(reason,key)=>{
    await api('/users/'+encodeURIComponent(id)+'/birth-date',{key,reason,birthDate,band,expected:age},'PUT');
    onSaved();
   },changingToChild);
 }}>
  <h3>생년월일 정정</h3>
  <Field label="정정할 생년월일" hint="입력한 날짜로 연령 구간을 계산합니다. 날짜 원문은 보관하지 않습니다.">
   <input type="date" required max={today} autoComplete="off" value={birthDate} onChange={event=>setBirthDate(event.target.value)}/>
  </Field>
  {birthDate&&<p role="status">{band?'적용할 연령 구간 · '+labels[band]:'올바른 생년월일을 입력해 주세요.'}</p>}
  <div className="dialog-actions"><Button type="submit" variant="primary" disabled={!band}>변경 검토</Button></div>
 </form>;
}

import {useState} from 'react';
import {api,fullDate} from './api';
import {Button,Card,Field,Table,type Row} from './components';
import {useConsole} from './context';

export default function RetainedRecords(){
 const {admin}=useConsole();
 const [reference,setReference]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [records,setRecords]=useState<{purchases:Row[];disputes:Row[]}|null>(null);
 if(admin.role!=='owner')return <p>법정 보관 기록은 소유자만 열람할 수 있습니다.</p>;
 return <>
  <Card title="법정 보관 기록" detail="스토어 거래 번호 또는 고객센터 문의 번호로 조회합니다.">
   <form onSubmit={event=>{
    event.preventDefault();setBusy(true);setError('');setRecords(null);
    void api<{purchases:Row[];disputes:Row[]}>('/privacy/retained-records',{reference}).then(setRecords,e=>setError(e.message)).finally(()=>setBusy(false));
   }}>
    <Field label="거래 번호 또는 문의 번호"><input value={reference} onChange={event=>setReference(event.target.value)} required maxLength={128}/></Field>
    <Button type="submit" variant="primary" disabled={busy||!reference.trim()}>조회</Button>
   </form>
   {error&&<p role="alert">{error}</p>}
  </Card>
  {records&&<>
   <Card title="거래 기록"><Table items={records.purchases} columns={[
    {key:'provider',label:'스토어'},{key:'product_id',label:'상품'},
    {key:'purchased_at',label:'결제',render:r=>fullDate(r.purchased_at)},
    {key:'supplied_at',label:'공급',render:r=>fullDate(r.supplied_at)},
    {key:'refunded_at',label:'환불',render:r=>fullDate(r.refunded_at)},
    {key:'expires_at',label:'파기 예정',render:r=>fullDate(r.expires_at)}
   ]}/></Card>
   <Card title="소비자 불만·분쟁"><Table items={records.disputes} columns={[
    {key:'summary',label:'처리 요약'},{key:'status',label:'상태'},
    {key:'filed_at',label:'접수',render:r=>fullDate(r.filed_at)},
    {key:'handled_at',label:'처리',render:r=>fullDate(r.handled_at)},
    {key:'expires_at',label:'파기 예정',render:r=>fullDate(r.expires_at)}
   ]}/></Card>
  </>}
 </>;
}

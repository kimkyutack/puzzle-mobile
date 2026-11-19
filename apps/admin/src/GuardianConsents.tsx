import { useState } from 'react';
import { api } from './api';
import { Badge, Button, Card, Field } from './components';
import { useConsole } from './context';
import { useResource } from './use-resource';
import {guardianConsentEmail,type GuardianMailStatus} from '../../../packages/content/src/guardian-consent-email';

interface GuardianRequest {
  id:string;
  guardian_name:string;
  guardian_email:string;
  requested_at:number;
  sent_at:number|null;
  expires_at:number;
  consent_version:string;
  mail_status:GuardianMailStatus|null;
}

const time = (value:number) => new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});

function notice(row:GuardianRequest) {
  const {subject,text}=guardianConsentEmail(row.id,row.consent_version,row.expires_at);
  return `mailto:${encodeURIComponent(row.guardian_email).replace('%40','@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

const statuses:Record<GuardianMailStatus,string>={
  queued:'자동 발송 대기',sending:'자동 발송 중',sent:'회신 대기',failed:'자동 발송 실패',unknown:'발송 여부 확인 필요',
};

export default function GuardianConsents() {
  const {admin,confirm}=useConsole();
  if(admin.role==='viewer')return <Card><p>보호자 동의 요청을 열람할 권한이 없습니다.</p></Card>;
  return <Requests confirm={confirm}/>;
}

function Requests({confirm}:{confirm:ReturnType<typeof useConsole>['confirm']}) {
  const load=useResource<{items:GuardianRequest[]}>('/guardian-consents',{items:[]});
  const [opened,setOpened]=useState<string[]>([]);
  const [withdrawalId,setWithdrawalId]=useState('');
  function review(row:GuardianRequest,action:'sent'|'approve'|'decline') {
    const title=action==='sent'?'동의 안내 발송 기록':action==='approve'?'보호자 동의 승인':'보호자 동의 거절';
    const explanation=action==='sent'?'공식 운영 메일에서 안내 전문과 요청 번호를 실제로 보낸 뒤 기록하세요.':'등록된 보호자 주소에서 회신이 왔는지, 요청 번호와 법정대리인 확인 문구 및 동의 의사가 일치하는지 확인하세요.';
    confirm(title,explanation,async(_reason,key)=>{await api('/guardian-consents/'+row.id,{action,key});load.reload();});
  }
  return <><Card title="보호자 동의 요청" detail="안내 메일은 새 요청을 접수하면 자동 발송됩니다. 등록된 보호자 주소에서 회신을 받은 뒤 처리합니다." action={<Button onClick={load.reload}>새로고침</Button>}>
    {load.loading&&<p>동의 요청을 불러오는 중입니다.</p>}
    {load.error&&<p role="alert">{load.error}</p>}
    {load.data?.items.length===0&&<p>처리할 요청이 없습니다.</p>}
    {load.data?.items.map(row=><Card key={row.id} title={row.guardian_name} detail={row.guardian_email} action={<Badge>{row.sent_at?'회신 대기':row.mail_status?statuses[row.mail_status]:'수동 발송 대기'}</Badge>}>
      <p>요청 번호 {row.id}</p><p>접수 {time(row.requested_at)} · 만료 {time(row.expires_at)}</p>
      {row.sent_at?<>
        <p>발송 {time(row.sent_at)}</p>
        <Button onClick={()=>review(row,'approve')}>회신 확인 후 승인</Button>{' '}
        <Button onClick={()=>review(row,'decline')}>거절 회신 기록</Button>
      </>:row.mail_status!=='queued'&&row.mail_status!=='sending'&&<>
        {row.mail_status==='unknown'&&<p>Cloudflare의 발송 기록을 확인한 뒤 필요하면 수동으로 보내세요.</p>}
        <a className="btn" href={notice(row)} onClick={()=>setOpened(old=>[...old,row.id])}>동의 안내 메일 작성</a>{' '}
        <Button disabled={!opened.includes(row.id)} onClick={()=>review(row,'sent')}>발송 완료 기록</Button>
      </>}
    </Card>)}
  </Card><Card title="동의 철회" detail="기존 회신으로 법정대리인과 요청 번호를 확인한 뒤 처리합니다.">
    <form onSubmit={event=>{
      event.preventDefault();
      confirm('보호자 동의 철회','동의를 철회하면 다시 보호자 동의가 확인될 때까지 해당 계정의 게임 이용이 중지됩니다.',async(_reason,key)=>{
        await api('/guardian-consents/withdraw',{requestId:withdrawalId.trim(),key});setWithdrawalId('');load.reload();
      },true);
    }}>
      <Field label="요청 번호"><input value={withdrawalId} onChange={e=>setWithdrawalId(e.target.value)} required maxLength={36}/></Field>
      <Button type="submit" variant="danger">동의 철회</Button>
    </form>
  </Card></>;
}

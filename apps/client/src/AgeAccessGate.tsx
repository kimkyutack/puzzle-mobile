import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { ageBandAt, type AgeAdmission, type AgeBand } from '../../../packages/contracts/src/age-access';
import { ApiFailure, clearSession, guest, request, serverNow, setToken } from './api';
import { ageAdmissionStorage, tokenStorage } from './platform/storage';
import { setAccountAge } from './platform/account-age';
import { getLocale, tr, useI18n } from './i18n';
import StartupPoster from './StartupPoster';
import BrandLogo from './BrandLogo';
import { Button, Modal } from './ui';
import './age-access.css';

type PendingAdmission = AgeAdmission & {token:string};
const policyUrl=(page:'privacy'|'account-deletion')=>`https://hiddenstage.app/official${getLocale()==='ko'?'':'/'+getLocale()}/${page}`;

export default function AgeAccessGate({children}:{children:ReactNode}) {
  useI18n();
  const [ready,setReady]=useState(false),[booting,setBooting]=useState(true),[retry,setRetry]=useState(0);
  const [savedSession,setSavedSession]=useState(false),[pending,setPending]=useState<PendingAdmission|null>(null);
  const [editingBirthday,setEditingBirthday]=useState(false);
  const [birthday,setBirthday]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[permission,setPermission]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const working=useRef(false),sessionFound=useRef(false);

  useEffect(()=>{
    const reopen=()=>{setAccountAge(null);setPending(null);setEditingBirthday(false);setBooting(true);setReady(false);setRetry(n=>n+1);};
    window.addEventListener('garden:age-access-required',reopen);
    return ()=>window.removeEventListener('garden:age-access-required',reopen);
  },[]);

  async function saveAdmission(value:PendingAdmission) {
    await ageAdmissionStorage.set(value.token);
    setPending(value);
  }
  async function finish(value:PendingAdmission) {
    const band=sessionFound.current
      ? (await request<{band:AgeBand}>('/age/complete',{token:value.token})).band
      : await guest(value.token).then(()=>value.band);
    setAccountAge(band);
    await ageAdmissionStorage.clear().catch(()=>{});
    setReady(true);
  }
  async function check(token:string) {
    const status=await request<AgeAdmission>('/age/status',{token});
    const value={...status,token};
    setPending(value);
    if(status.state==='approved')await finish(value);
  }
  function perform(work:()=>Promise<void>) {
    if(working.current)return;
    working.current=true;setBusy(true);setError('');
    void work().catch(e=>setError(e instanceof Error?e.message:tr('연결을 확인해 주세요.'))).finally(()=>{working.current=false;setBusy(false);});
  }
  useEffect(()=>{
    let current=true;
    async function load() {
      try {
        const tokens=await tokenStorage.get();
        if(!current)return;
        setSavedSession(!!tokens);sessionFound.current=!!tokens;
        if(tokens){
          setToken(tokens.accessToken);
          try {
            const age=await request<{band:AgeBand|null;confirmed:boolean}>('/age/account');
            if(!current)return;
            if(age.confirmed&&age.band){setAccountAge(age.band);await ageAdmissionStorage.clear().catch(()=>{});setReady(true);return;}
          }catch(e){
            if(!(e instanceof ApiFailure)||!['UNAUTHORIZED','SESSION_EXPIRED','ACCOUNT_NOT_FOUND'].includes(e.code))throw e;
            // Keep the saved token until the player chooses to recover the old garden.
            setToken('');sessionFound.current=false;
          }
        }
        if(tokens&&!sessionFound.current)return;
        const token=await ageAdmissionStorage.get();
        if(current&&token){
          try{await check(token);}catch(e){
            if(!(e instanceof ApiFailure)||e.code!=='AGE_REQUEST_NOT_FOUND')throw e;
            await ageAdmissionStorage.clear();
          }
        }
      }catch(e){if(current)setError(e instanceof Error?e.message:tr('연결을 확인해 주세요.'));}
      finally{if(current)setBooting(false);}
    }
    setBooting(true);setError('');void load();
    return ()=>{current=false;};
  },[retry]);

  function submitBirthday(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!ageBandAt(birthday,serverNow())){setError(tr('생년월일을 확인해 주세요.'));return;}
    perform(async()=>{
      const correctionToken=editingBirthday?pending?.token:undefined;
      const admission=await request<PendingAdmission>('/age/admission',{birthDate:birthday,correctionToken});
      await saveAdmission(admission);
      setBirthday('');setEditingBirthday(false);
      if(admission.state==='approved')await finish(admission);
    });
  }
  function submitGuardian(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!pending)return;
    perform(async()=>{
      try {
        const result=await request<AgeAdmission>('/age/guardian',{token:pending.token,guardianName:name,guardianEmail:email,contactPermission:permission});
        setPending({...result,token:pending.token});
      } catch (error) {
        if(!(error instanceof ApiFailure)||error.code!=='GUARDIAN_REQUEST_CLOSED')throw error;
        await check(pending.token);
      }
      setName('');setEmail('');setPermission(false);
    });
  }

  if(ready)return children;
  const recovery=savedSession&&!sessionFound.current;
  const canEditBirthday=pending?.band==='child'&&(pending.state==='contact'||pending.state==='waiting');
  const policyLink=(page:'privacy'|'account-deletion',label:string)=><a href={policyUrl(page)} target="_blank" rel="noreferrer" onClick={event=>{
    if(!Capacitor.isNativePlatform())return;
    event.preventDefault();void Browser.open({url:policyUrl(page)}).catch(()=>setError(tr('안내 페이지를 열지 못했어요. 잠시 후 다시 시도해 주세요.')));
  }}>{tr(label)}</a>;
  return <main className="age-access">
    <StartupPoster/>
    <Modal title={!editingBirthday&&pending?.band==='child'?'보호자 동의':'연령 확인'}>
      <div className="age-access-content">
        <div className="brand-heading"><BrandLogo/></div>
        {booting?<p role="status">{tr('불러오는 중…')}</p>:recovery?
          <>
            <p>{tr('이 기기에 저장된 세션이 만료됐어요. 다시 연결해 보거나 계정 복구를 시작해 주세요.')}</p>
            <Button onClick={()=>setRetry(n=>n+1)}>{tr('다시 연결')}</Button>
            <Button secondary disabled={busy} onClick={()=>perform(async()=>{await clearSession();await ageAdmissionStorage.clear();sessionStorage.setItem('garden-recover-account','1');setSavedSession(false);sessionFound.current=false;})}>{tr('계정 복구 시작')}</Button>
          </>:!editingBirthday&&pending?.state==='contact'?
          <form onSubmit={submitGuardian}>
            <p>{tr('보호자에게 이 화면을 보여 주세요. 보호자 성명과 이메일은 동의 요청에만 사용됩니다.')}</p>
            <div className="age-field">
              <label htmlFor="guardian-name">{tr('보호자 성명')}</label>
              <div className="input-frame" data-frame="panel">
                <input id="guardian-name" required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} autoComplete="off"/>
              </div>
            </div>
            <div className="age-field">
              <label htmlFor="guardian-email">{tr('보호자 이메일')}</label>
              <div className="input-frame" data-frame="panel">
                <input id="guardian-email" required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off"/>
              </div>
            </div>
            <label className="age-check">
              <input type="checkbox" required checked={permission} onChange={e=>setPermission(e.target.checked)}/>
              <span>{tr('보호자 동의 안내를 보내기 위해 위 연락처를 사용하는 데 동의합니다.')}</span>
            </label>
            <Button type="submit" disabled={busy}>{tr('동의 요청 접수')}</Button>
          </form>:!editingBirthday&&pending?
          <>
            <p>{tr(pending.state==='waiting'?'보호자 동의 요청을 접수했어요. 운영팀이 안내 메일을 보내면 보호자가 메일에 회신해 주세요.':pending.state==='approved'?'확인된 요청으로 계속할 수 있어요.':pending.state==='declined'?'보호자가 동의하지 않아 게임을 시작할 수 없어요.':'연령 확인 요청의 유효 기간이 지났어요.')}</p>
            <Button disabled={busy} onClick={()=>perform(async()=>{
              if(pending.state==='expired'||pending.state==='declined'){
                if(pending.band==='child')await saveAdmission(await request<PendingAdmission>('/age/restart',{token:pending.token}));
                else{await ageAdmissionStorage.clear();setPending(null);}
              }else await check(pending.token);
            })}>{tr(pending.state==='expired'||pending.state==='declined'?'다시 요청하기':'동의 상태 확인')}</Button>
          </>:
          <form onSubmit={submitBirthday}>
            <p>{tr('서비스 이용에 필요한 연령 구간을 확인합니다. 입력한 생년월일은 저장하지 않아요.')}</p>
            <div className="age-field">
              <label htmlFor="age-birthday">{tr('생년월일')}</label>
              <div className="input-frame" data-frame="panel">
                <input id="age-birthday" required type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} autoComplete="off"/>
              </div>
            </div>
            <Button type="submit" disabled={busy}>{tr('계속')}</Button>
          </form>}
        {!booting&&!recovery&&canEditBirthday&&<Button secondary disabled={busy} onClick={()=>{
          setBirthday('');setError('');setEditingBirthday(value=>!value);
        }}>{tr(editingBirthday?'보호자 동의로 돌아가기':'생년월일 다시 입력')}</Button>}
        {error&&<p className="age-error" role="alert">{error}</p>}
        {!booting&&error&&!pending&&!recovery&&<Button secondary disabled={busy} onClick={()=>setRetry(n=>n+1)}>{tr('다시 연결')}</Button>}
        <nav className="age-access-links" aria-label={tr('약관 및 개인정보')}>
          {policyLink('privacy','개인정보처리방침')}
          {savedSession&&policyLink('account-deletion','계정 삭제 안내')}
        </nav>
      </div>
    </Modal>
  </main>;
}

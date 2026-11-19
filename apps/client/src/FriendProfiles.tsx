import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {FriendProfile,FriendRelation} from '@garden/contracts';
import {key,request} from './api';
import {tr} from './i18n';
import {Button} from './ui';
import {GardenerCard} from './GardenerProfile';
import CommerceDialog from './CommerceDialog';
import GardenVisit from './garden-world/GardenVisit';
import './friends.css';

const Context=createContext({openProfile:(_id:string)=>{},revision:0,changed:()=>{}});
export const useFriendProfiles=()=>useContext(Context);
export function FriendProfiles({children,userId,notify,reducedMotion=false}:{children:ReactNode;userId:string;notify:(message:string)=>void;reducedMotion?:boolean}){
 const [selected,setSelected]=useState(''),[profile,setProfile]=useState<FriendProfile|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const guard=useRef(false),selection=useRef('');
 const [visiting,setVisiting]=useState(false);
 const changed=useCallback(()=>{setRevision(n=>n+1);window.dispatchEvent(new Event('garden:activity-changed'));},[]);
 const openProfile=useCallback((id:string)=>{selection.current=id;setSelected(id);setProfile(null);setError('');setVisiting(false);},[]);
 useEffect(()=>{setSelected('');selection.current='';setVisiting(false);},[userId]);
 useEffect(()=>{const close=()=>{selection.current='';setSelected('');setVisiting(false);};window.addEventListener('popstate',close);return()=>window.removeEventListener('popstate',close);},[]);
 useEffect(()=>{if(!selected)return;let live=true;void request<{profile:FriendProfile}>('/players/'+encodeURIComponent(selected)+'/profile').then(r=>{if(live)setProfile(r.profile)},e=>{if(live)setError(e instanceof Error?e.message:tr('프로필을 불러오지 못했어요.'))});return()=>{live=false}},[selected,revision]);
 async function add(){
  if(!profile||guard.current||!['none','incoming'].includes(profile.relation))return;
  const target=profile.userId;guard.current=true;setBusy(true);setError('');
  try{const result=await request<{relation:FriendRelation}>(profile.relation==='incoming'?'/friends/respond':'/friends/requests',{key:key(),userId:target,...(profile.relation==='incoming'?{accept:true}:{})});if(selection.current===target)setProfile(p=>p?{...p,relation:result.relation}:p);changed();notify(result.relation==='friend'?tr('친구가 되었어요!'):tr('친구 요청을 보냈어요.'));}
  catch(e){if(selection.current===target)setError(e instanceof Error?e.message:tr('친구 요청을 보내지 못했어요.'));}
  finally{guard.current=false;setBusy(false);}
 }
 return <Context.Provider value={{openProfile,revision,changed}}>{children}{selected&&(visiting?<GardenVisit key={userId+':'+selected} userId={selected} reducedMotion={reducedMotion} onClose={()=>setVisiting(false)}/>:<CommerceDialog title={tr('정원사 프로필')} onClose={()=>{selection.current='';setSelected('')}}><div className="friend-profile">
  {profile?<><GardenerCard nickname={profile.nickname} level={profile.level} highestClear={profile.highestClear} appearance={profile.profileAppearance} guild={profile.guildName}/>
   <Button className="friend-profile-request" icon="guild" tone="green" disabled={busy||!['none','incoming'].includes(profile.relation)} onClick={()=>void add()}>{busy?tr('보내는 중…'):profile.relation==='friend'?tr('이미 친구예요'):profile.relation==='outgoing'?tr('친구 요청 중'):profile.relation==='self'?tr('내 프로필'):profile.relation==='incoming'?tr('친구 수락'):tr('친구 추가')}</Button>
  </>:!error&&<p role="status">{tr('프로필을 불러오는 중…')}</p>}
  {profile&&profile.userId!==userId&&<Button icon="home" tone="gold" onClick={()=>setVisiting(true)}>{tr('정원 방문')}</Button>}
  {error&&<p role="alert">{error}</p>}{!profile&&error&&<Button secondary onClick={changed}>{tr('다시 불러오기')}</Button>}
 </div></CommerceDialog>)}</Context.Provider>;
}

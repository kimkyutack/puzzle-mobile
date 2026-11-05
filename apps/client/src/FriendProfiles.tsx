import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {FriendProfile,FriendRelation} from '@garden/contracts';
import {key,request} from './api';
import {tr} from './i18n';
import {Button,Card,Icon} from './ui';
import CommerceDialog from './CommerceDialog';
import './friends.css';

const Context=createContext({openProfile:(_id:string)=>{},revision:0,changed:()=>{}});
export const useFriendProfiles=()=>useContext(Context);
export function FriendProfiles({children,userId,notify}:{children:ReactNode;userId:string;notify:(message:string)=>void}){
 const [selected,setSelected]=useState(''),[profile,setProfile]=useState<FriendProfile|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const guard=useRef(false),selection=useRef('');
 const changed=useCallback(()=>setRevision(n=>n+1),[]);
 const openProfile=useCallback((id:string)=>{selection.current=id;setSelected(id);setProfile(null);setError('');},[]);
 useEffect(()=>{setSelected('');selection.current='';},[userId]);
 useEffect(()=>{if(!selected)return;let live=true;void request<{profile:FriendProfile}>('/players/'+encodeURIComponent(selected)+'/profile').then(r=>{if(live)setProfile(r.profile)},e=>{if(live)setError(e instanceof Error?e.message:tr('프로필을 불러오지 못했어요.'))});return()=>{live=false}},[selected,revision]);
 async function add(){
  if(!profile||guard.current||!['none','incoming'].includes(profile.relation))return;
  const target=profile.userId;guard.current=true;setBusy(true);setError('');
  try{const result=await request<{relation:FriendRelation}>(profile.relation==='incoming'?'/friends/respond':'/friends/requests',{key:key(),userId:target,...(profile.relation==='incoming'?{accept:true}:{})});if(selection.current===target)setProfile(p=>p?{...p,relation:result.relation}:p);changed();notify(result.relation==='friend'?tr('친구가 되었어요!'):tr('친구 요청을 보냈어요.'));}
  catch(e){if(selection.current===target)setError(e instanceof Error?e.message:tr('친구 요청을 보내지 못했어요.'));}
  finally{guard.current=false;setBusy(false);}
 }
 return <Context.Provider value={{openProfile,revision,changed}}>{children}{selected&&<CommerceDialog title={tr('정원사 프로필')} onClose={()=>{selection.current='';setSelected('')}}><div className="friend-profile">
  {profile?<><Card tone="blue"><Icon id="lumi_happy" size={120}/><h3>{profile.nickname}</h3><p>{tr('레벨')} {profile.level}</p>{profile.guildName&&<p className="friend-profile-guild"><Icon id="guild" size={30}/>{profile.guildName}</p>}</Card><Card tone="gold"><div className="friend-profile-record"><Icon id="star" size={42}/><span>{tr('최고 클리어 레벨')}<strong>{profile.highestClear}</strong></span></div></Card><Button icon="guild" tone="green" disabled={busy||!['none','incoming'].includes(profile.relation)} onClick={()=>void add()}>{busy?tr('확인 중…'):profile.relation==='friend'?tr('이미 친구예요'):profile.relation==='outgoing'?tr('친구 요청 중'):profile.relation==='self'?tr('내 프로필'):profile.relation==='incoming'?tr('친구 수락'):tr('친구 추가')}</Button></>:!error&&<p role="status">{tr('프로필을 불러오는 중…')}</p>}
  {error&&<p role="alert">{error}</p>}{!profile&&error&&<Button secondary onClick={changed}>{tr('다시 불러오기')}</Button>}
 </div></CommerceDialog>}</Context.Provider>;
}

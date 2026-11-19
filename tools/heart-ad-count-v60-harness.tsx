// Local browser QA: no production accounts, requests, ad playback or rewards.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {RewardIntent} from '@garden/contracts';
import {newPlayer} from '../apps/api/src/db';
import Menus from '../apps/client/src/Menus';
import {Modal} from '../apps/client/src/ui';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import {rewardedAds} from '../apps/client/src/platform';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v3.css';import '../apps/client/src/ui-v4.css';import '../apps/client/src/ui-v5.css';import '../apps/client/src/ui-v6.css';import '../apps/client/src/ui-v7.css';import '../apps/client/src/ui-v8.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';
const params=new URLSearchParams(location.search),mode=params.get('mode')??'success';
let remaining=Number(params.get('remaining')??5),intent:RewardIntent|null=null,deadline=Date.now()+(params.has('midnight')?1800:86400000),initialRead=true,reads=0;
let player=newPlayer('heart-count-local-qa',Date.now());player.level=10;player.hearts=1;player.heartAt=Date.now();player.settings={...player.settings,sound:false,music:false,haptics:false};
const actualFetch=fetch.bind(globalThis),needed=new Set(['heart','coin','lumi_happy','guild','mail','poster_hearts_v5','panel_guild_v3','card_lavender_v9','button_play','button_play_disabled','close','resource_pearl_v9','event_badge']);
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(url.pathname==='/assets/asset-manifest.json'){const response=await actualFetch(input,init),pack=await response.json();return Response.json({...pack,assets:pack.assets.filter((asset:{id:string})=>needed.has(asset.id)),sequences:[]});}
 if(!url.pathname.includes('/api/'))return actualFetch(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),method=init?.method??'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(Date.now()>=deadline){remaining=5;deadline+=86400000;}
 const envelope=(data:unknown)=>Response.json({data,serverNow:Date.now()});
 const quotas=()=>({heart:{limit:5,remaining,resetsAt:deadline},coin_bonus:{limit:10,remaining:10,resetsAt:deadline}});
 if(path==='/local/features')return envelope({freeHeartRefill:false});
 if(path==='/ads/reward-intents'&&method==='GET'){
  reads++;const data={intents:intent?[structuredClone(intent)]:[],quotas:quotas()};
  if(params.has('read-error'))return Response.json({error:{code:'NETWORK',message:'Local read failure'}},{status:503});
  if(initialRead&&params.has('slow')){initialRead=false;await new Promise(resolve=>setTimeout(resolve,1500));document.documentElement.dataset.initialReadComplete='true';}
  return envelope(data);
 }
 if(path==='/ads/reward-intents'&&method==='POST'){
  remaining=Math.max(0,remaining-1);intent={id:crypto.randomUUID(),placement:'heart',amount:1,status:'reserved',adUnit:'local-qa-only',expiresAt:Date.now()+1800000};return envelope({intent:structuredClone(intent)});
 }
 if(intent&&path.startsWith('/ads/reward-intents/'+intent.id)){
  if(method==='GET')return envelope({intent:structuredClone(intent),quotas:quotas()});
  if(path.endsWith('/cancel')||body.status==='cancelled'){if(intent.status!=='cancelled'&&intent.status!=='granted'){remaining++;intent.status='cancelled';}}
  else if(intent.status!=='granted')intent.status=body.status;
  return envelope({intent:structuredClone(intent)});
 }
 throw Error('Local heart fixture blocked unexpected API request: '+path);
};
rewardedAds.available=()=>true;
rewardedAds.show=async(_intent,_user,onState)=>{
 onState('loading');await new Promise(resolve=>setTimeout(resolve,100));
 if(mode==='no-fill'){onState('no-fill');throw Error('No ad available (local fixture)');}
 if(mode==='cancel'){onState('cancelled');return{earnedCallback:false,status:'cancelled'};}
 const grant=()=>{if(intent){intent.status='granted';player={...player,hearts:player.hearts+1,version:player.version+1};}};
 if(mode==='pending')setTimeout(grant,800);else grant();
 onState('pending');return{earnedCallback:true,status:'pending'};
};
function Fixture(){const[current,setCurrent]=useState(player),[message,setMessage]=useState('');return <main className="game-shell" data-art-root><Modal title="하트 충전" onClose={()=>{}}><Menus page="hearts" player={current} mutate={async()=>{}} refresh={async()=>setCurrent({...player})} notify={setMessage} onPage={()=>{}} onLogout={()=>{}}/>{message&&<output role="alert">{message}</output>}<output hidden data-fixture-reads={reads}/></Modal></main>;}
setLocale(params.get('lang')==='en'?'en':'ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('16px Jua');createRoot(document.getElementById('root')!).render(<Fixture/>);

// Browser checks use local fixtures only. Unexpected API calls fail closed.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {newPlayer} from '../apps/api/src/db';
import {RESTORATIONS} from '@garden/content';
import {projectLiveGarden} from '../packages/garden-world/src/live';
import {gardenVisitWorld} from '../packages/garden-world/src';
import {FriendProfiles,useFriendProfiles} from '../apps/client/src/FriendProfiles';
import RankingMenu from '../apps/client/src/RankingMenu';
import {Modal} from '../apps/client/src/ui';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v3.css';import '../apps/client/src/ui-v4.css';import '../apps/client/src/ui-v5.css';import '../apps/client/src/ui-v6.css';import '../apps/client/src/ui-v7.css';import '../apps/client/src/ui-v8.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';
const params=new URLSearchParams(location.search),mode=params.get('mode')??'normal';
const player=newPlayer('local-viewer',Date.now()),target=newPlayer('local-garden-owner',Date.now());
player.nickname='나의 정원';target.nickname=params.has('long')?'아주 긴 이름을 가진 정원사입니다':'루미의 이웃';target.level=33;target.restored=mode==='empty'?[]:RESTORATIONS.slice(0,15).map(t=>t.id);
const world=gardenVisitWorld(projectLiveGarden(target));
let failures=0;
const actualFetch=fetch.bind(globalThis),needed=new Set(['lumi','lumi_happy','guild','home','ranking_trophy_v51','event_sky_v9','close','card_ice_v9','card_lavender_v9','card_peach_v9','card_gold_v4','card_sage_v6','card_green_v4','button_play','button_secondary','button_gold','panel_shop_v3','panel_guild_v3']);
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(url.pathname==='/assets/asset-manifest.json'){const response=await actualFetch(input,init),pack=await response.json();return Response.json({...pack,assets:pack.assets.filter((asset:{id:string})=>needed.has(asset.id)),sequences:[]});}
 if(!url.pathname.includes('/api/'))return actualFetch(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),method=init?.method??'GET';
 document.documentElement.dataset.lastFixtureRequest=method+' '+path;
 if(method!=='GET')throw Error('Read-only visit attempted a mutation: '+method+' '+path);
 const envelope=(data:unknown)=>Response.json({data,serverNow:Date.now()});
 if(path==='/rankings')return envelope({scope:'players',metric:'highest_clear',entries:[{id:target.id,name:target.nickname,score:32,rank:1,tied:false},{id:player.id,name:player.nickname,score:1,rank:2,tied:false,isMine:true}],me:{id:player.id,name:player.nickname,score:1,rank:2,tied:false,isMine:true},participants:2,limit:50});
 if(path.startsWith('/players/')&&path.endsWith('/profile')){const own=path.includes(player.id);return envelope({profile:{userId:own?player.id:target.id,nickname:own?player.nickname:target.nickname,level:own?player.level:target.level,highestClear:own?0:32,guildName:null,relation:own?'self':'none'}});}
 if(path.startsWith('/garden/visits/')){
  if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,1800));
  if(mode==='error'&&failures++===0)return Response.json({error:{code:'TEMPORARY_ERROR',message:'정원을 불러오지 못했어요.'}},{status:503});
  return envelope({owner:{userId:target.id,nickname:target.nickname,level:target.level},world});
 }
 throw Error('Local visit fixture blocked unexpected API request: '+path);
};
function Content(){const {openProfile}=useFriendProfiles();return <><Modal title="순위표" onClose={()=>{}}><RankingMenu player={player}/></Modal><button hidden onClick={()=>openProfile(target.id)}>Fixture profile</button></>;}
function Fixture(){const [message,setMessage]=useState('');return <FriendProfiles userId={player.id} notify={setMessage}><main className="game-shell" data-art-root><Content/>{message&&<output>{message}</output>}</main></FriendProfiles>;}
setLocale(params.get('lang')==='en'?'en':'ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('16px Jua');createRoot(document.getElementById('root')!).render(<Fixture/>);

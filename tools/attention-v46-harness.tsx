// The actual App with isolated synthetic API responses. Unknown API calls are blocked.
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS} from '@garden/contracts';
import type {EventRewardState,Player,ProgressionResponse,FriendsResponse} from '@garden/contracts';
import type {OperationsSnapshot} from '../packages/contracts/src/operations';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';
import {MISSIONS,missionPeriod} from '../packages/content/src/missions';
import {emptyPowerUses} from '../packages/content/src/power-festival';
import {FLOWERLIGHT_ID} from '../packages/content/src/flowerlight';
import {saveLanguagePreference} from '../apps/client/src/locale-preference';
import dataSource from './fold-layout-data.json';

const data:Record<string,unknown>=structuredClone(dataSource),params=new URLSearchParams(location.search),mode=params.get('mode')??'complete',now=Date.now();
const player=(data['/me'] as {player:Player}).player;player.level=84;player.hearts=5;player.heartAt=0;player.settings={...player.settings,sound:false,music:false,haptics:false,reducedMotion:true,language:'ko'};
player.flowerFestival={id:FLOWERLIGHT_ID,startedAt:now-86400000,endsAt:now+86400000,petals:20,restoredStages:5};player.animalExpedition={completedStages:10,completedAttempts:[]};player.powerFestival={id:'finished',day:missionPeriod('daily',now).id,startedAt:now-3600000,endsAt:now-1,counts:emptyPowerUses(),claimedStages:5};
const events=data['/events'] as EventRewardState;events.season={id:'attention-season',ends_at:now+86400000};events.daily={available:false,coins:50,nextReset:now+86400000};events.personal={progress:10,target:10,coins:300,claimed:true};events.guild={progress:30,target:30,coins:100,claimed:true};events.pass.guildGifts=[];events.pass.premium=false;events.pass.tiers.forEach(tier=>{tier.freeClaimed=true;tier.premiumClaimed=false});
const progression=data['/progression'] as ProgressionResponse;progression.daily.missions=MISSIONS.filter(m=>m.period==='daily').map(m=>({...m,progress:m.target,claimed:true,claimable:false}));progression.weekly.missions=MISSIONS.filter(m=>m.period==='weekly').map(m=>({...m,progress:m.target,claimed:true,claimable:false}));progression.player=player;progression.eventRewards=events;progression.giftCounts={hearts:0,items:0};progression.minigame={remaining:0,maximum:3,nextReset:now+86400000,active:null};progression.daily.endsAt=now+86400000;progression.weekly.endsAt=now+86400000;[...progression.daily.missions,...progression.weekly.missions].forEach(mission=>{mission.claimed=true;mission.claimable=false});
progression.notifications={missions:99,events:99,pass:99,gifts:99,minigame:99,flowerlight:99,expedition:99,festival:99,shop:99,friends:0,guild:0};
const operations:OperationsSnapshot={settings:defaultOperationsRuntime(),maintenanceActive:false,revision:1,serverNow:now,notices:[],events:[],supportUnread:0};operations.settings.startBoosterRush.enabled=false;
data['/gifts']={gifts:[]};const friends=data['/friends'] as FriendsResponse;friends.incoming=[];friends.gifts=[];
const guild=data['/guild'] as {applications:unknown[]};const application=structuredClone(guild.applications[0]);guild.applications=[];
const story=data['/story'] as {unlocked:string[];seen:string[];completedEpisodes:string[]};story.seen=[...story.unlocked];story.completedEpisodes=['bridge-v1'];
if(mode==='playable'){progression.minigame.remaining=2;player.animalExpedition!.completedStages=2;player.flowerFestival!.restoredStages=0;player.flowerFestival!.petals=0;player.powerFestival=undefined;}
if(mode==='rewards'||mode==='race'){
 events.daily.available=true;events.personal.claimed=false;events.pass.tiers[0]!.freeClaimed=false;progression.daily.missions[0]!.claimed=false;progression.daily.missions[0]!.progress=progression.daily.missions[0]!.target;progression.daily.missions[0]!.claimable=true;
 data['/gifts']={gifts:[{id:'tool-gift',senderName:'검증 친구',kind:'hammer',quantity:1,bound:true,createdAt:now}]};progression.giftCounts.items=1;
}
if(mode==='hearts'){data['/gifts']={gifts:[{id:'heart-gift',senderName:'검증 친구',kind:'heart',quantity:1,bound:true,createdAt:now}]};progression.giftCounts.hearts=1;}
if(mode==='requests'){
 friends.incoming=[{userId:'incoming',nickname:'검증 친구',level:30,highestClear:29,guildName:null,relation:'incoming'}];progression.notifications.friends=1;guild.applications=[application];progression.notifications.guild=1;
}
if(mode==='ops'){
 operations.notices=[{id:'notice-v46',title:'새로운 정원 소식',body:'알림 검증 공지입니다.',status:'published',startsAt:now-1000,endsAt:now+86400000,popup:false,pinned:false,revision:1}];
 operations.events=[{id:'reward-v46',title:'정원 감사 선물',description:'보상 수령 알림 검증',kind:'reward',status:'published',startsAt:now-1000,endsAt:now+86400000,imageUrl:'',reward:{coins:50,stars:0,hearts:0,items:{}},revision:1,claimed:false}];
}
if(mode==='disabled'){
 events.daily.available=true;progression.minigame.remaining=3;player.powerFestival=undefined;player.animalExpedition=undefined;player.flowerFestival=undefined;events.pass.tiers[0]!.freeClaimed=false;
 for(const id of Object.keys(operations.settings.features) as Array<keyof typeof operations.settings.features>)operations.settings.features[id]=false;
}
const envelope=(value:unknown)=>Response.json({data:structuredClone(value),serverNow:Date.now(),stateVersion:player.version});
const bump=()=>{player.version++;return {player:structuredClone(player)}};
let delayed=false,progressionCalls=0;
document.getElementById('qa-race')!.onclick=()=>{delayed=true;window.dispatchEvent(new Event('garden:activity-changed'))};
document.getElementById('qa-hide')!.onclick=()=>{document.getElementById('qa-tools')!.hidden=true};
const originalFetch=fetch.bind(globalThis);
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return originalFetch(input,init);
 url.searchParams.delete('gardenArt');const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),method=init?.method??'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(path==='/health')return envelope({ok:true,engineVersion:ENGINE_VERSION,latestEngineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS});
 if(path==='/operations'||path==='/operations/bootstrap')return envelope(operations);
 if(path==='/auth/guest'||path==='/me'&&method==='GET')return envelope({player,activeRun:null,accessToken:'fixture-only',refreshToken:'fixture-only'});
 if(path==='/progression'){
  progressionCalls++;const snapshot=structuredClone(progression);if(params.get('old-server')==='1')delete snapshot.eventRewards;
  const response=envelope(snapshot);document.getElementById('qa-status')!.textContent='조회 '+progressionCalls;
  if(delayed){delayed=false;document.getElementById('qa-status')!.textContent='이전 조회 대기';await new Promise(resolve=>setTimeout(resolve,1500));document.getElementById('qa-status')!.setAttribute('data-stale-returned','true');}return response;
 }
 if(path==='/events/daily'){events.daily.available=false;return envelope(bump());}
 if(path==='/events/claim'){events[body.kind as 'personal'|'guild'].claimed=true;return envelope(bump());}
 if(path==='/missions/claim'){
  const window=progression[body.period as 'daily'|'weekly'],claimed=window.missions.filter(m=>!m.claimed&&m.progress>=m.target&&(!body.ids||body.ids.includes(m.id))).map(m=>m.id);window.missions.forEach(m=>{if(claimed.includes(m.id)){m.claimed=true;m.claimable=false}});return envelope({...bump(),claimed});
 }
 if(path==='/pass/claim-all'){const claimed=events.pass.tiers.filter(t=>t.points<=events.pass.points&&!t.freeClaimed).map(t=>({tier:t.tier,track:'free'}));events.pass.tiers.forEach(t=>{if(t.points<=events.pass.points)t.freeClaimed=true});return envelope({...bump(),claimed,seasonId:events.season!.id,reason:'CLAIMED'});}
 if(path.startsWith('/gifts/')&&path.endsWith('/claim')){data['/gifts']={gifts:[]};progression.giftCounts={hearts:0,items:0};return envelope(bump());}
 if(path==='/friends/respond'){friends.incoming=[];progression.notifications.friends=0;return envelope({...bump(),relation:'friend'});}
 if((path==='/guild/approve'||path.startsWith('/guild/applications/'))&&method!=='GET'){guild.applications=[];progression.notifications.guild=0;return envelope(bump());}
 if(path==='/operations/events/reward-v46/claim'){operations.events[0]!.claimed=true;return envelope(bump());}
 if(method==='GET'&&path in data)return envelope(data[path]);
 document.getElementById('qa-status')!.textContent='차단 '+path;return Response.json({error:{code:'QA_BLOCKED',message:'격리 검사에서 외부 API 호출을 차단했습니다.'}},{status:404});
};
saveLanguagePreference('ko',false,player.id);await import('../apps/client/src/main');

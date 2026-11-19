// Isolated visual fixture with synthetic state and transport. Never calls a live account/API.
import React,{useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {newPlayer} from '../apps/api/src/db';
import {FlowerlightFestival,ContentEventCards} from '../apps/client/src/ContentEvents';
import AnimalExpedition from '../apps/client/src/AnimalExpedition';
import {FLOWERLIGHT_ID,FLOWERLIGHT_DURATION} from '../packages/content/src/flowerlight';
import {animalExpeditionLevel} from '../packages/content/src/animal-expedition';
import {replay} from '@garden/core';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import ArtSurface from '../apps/client/src/ArtSurface';
import HubNavigation from '../apps/client/src/HubNavigation';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';import '../apps/client/src/ui-v3.css';import '../apps/client/src/ui-v4.css';import '../apps/client/src/ui-v5.css';import '../apps/client/src/ui-v6.css';import '../apps/client/src/ui-v7.css';import '../apps/client/src/ui-v8.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';import '../apps/client/src/home-hub.css';import '../apps/client/src/friends.css';
const params=new URLSearchParams(location.search);let player=newPlayer('content-events-local-qa',Date.now());player.level=Number(params.get('level')??20);player.settings.sound=false;player.settings.music=false;
const stage=params.get('stage');if(stage!==null)player.flowerFestival={id:FLOWERLIGHT_ID,startedAt:Date.now()-60000,endsAt:Date.now()+FLOWERLIGHT_DURATION,petals:Number(params.get('petals')??20),restoredStages:Number(stage)};
const course=params.get('course');if(course)player.animalExpedition={completedStages:Number(course)-1,completedAttempts:[],attempt:{id:'visual-attempt-v2-'+course,stage:Number(course),startedAt:Date.now(),level:animalExpeditionLevel(Number(course))}};
let joinCalls=0;
const original=fetch.bind(globalThis);globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return original(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(path==='/flowerlight/start'){
  joinCalls++;
  if(joinCalls===1&&params.get('failure')==='missing')return Response.json({error:{code:'NOT_FOUND',message:'Unknown route'},serverNow:Date.now()},{status:404});
  if(joinCalls===1&&params.get('failure')==='noack')return Response.json({data:{player:structuredClone(player)},serverNow:Date.now()});
  if(joinCalls===1&&params.get('failure')==='timeout')await new Promise((_,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})});
  player=structuredClone(player);player.flowerFestival??={id:FLOWERLIGHT_ID,startedAt:Date.now(),endsAt:Date.now()+FLOWERLIGHT_DURATION,petals:0,restoredStages:0};
 }
 else if(path==='/flowerlight/restore'){if(player.flowerFestival)player.flowerFestival.restoredStages=body.stage;}
 else if(path==='/animal-expedition/start'){player.animalExpedition??={completedStages:0,completedAttempts:[]};const n=player.animalExpedition.completedStages+1;player.animalExpedition.attempt={id:crypto.randomUUID(),stage:n,startedAt:Date.now(),level:animalExpeditionLevel(n)};}
 else if(path==='/animal-expedition/finish'){const p=player.animalExpedition!,attempt=p.attempt!;if(replay(attempt.level,body.actions).state.status!=='won')throw Error('No winning proof');p.completedStages=attempt.stage;p.completedAttempts.push(attempt.id);delete p.attempt;}
 else if(path==='/operations'||path==='/operations/bootstrap')return Response.json({data:{settings:defaultOperationsRuntime(),events:[],notices:[],revision:0},serverNow:Date.now()});
 else throw Error('Visual fixture blocked an unknown API call: '+path);
 player.version++;return Response.json({data:{player:structuredClone(player),granted:true},serverNow:Date.now()});
};
function Fixture(){const[p,setPlayer]=useState(player),[page,setPage]=useState(params.get('page')??'');return <main className="game-shell" data-art-root data-fixture-join-calls={joinCalls}><ArtSurface scene="pages_v9"/><div style={{position:'absolute',inset:'0 0 85px',overflow:'auto',padding:15}}><h1 style={{color:'white',textAlign:'center',margin:'10px 0 16px'}}>이벤트</h1><ContentEventCards player={p} onPage={setPage}/>{!params.has('clean')&&<div aria-label="검증 도구" style={{display:'flex',gap:10,flexWrap:'wrap',padding:10,background:'#fff',color:'#123'}}><button onClick={()=>{const next=structuredClone(p);next.level=next.level===19?20:19;player=next;setPlayer(next)}}>레벨 전환 {p.level}</button><button onClick={()=>{const next=structuredClone(p);if(next.flowerFestival)next.flowerFestival.petals++;player=next;setPlayer(next)}}>꽃잎 추가</button></div>}</div><HubNavigation active="events" onTab={()=>{}}/>{page==='flowerlight'&&<FlowerlightFestival player={p} onPlayer={setPlayer} onClose={()=>setPage('')} onPage={setPage} onPlay={()=>setPage('')}/>} {page==='animal-expedition'&&<AnimalExpedition player={p} onPlayer={setPlayer} onClose={()=>setPage('')} onPage={setPage}/>} {page==='garden-bag'&&<div role="status" style={{position:'absolute',inset:'30%',background:'white',zIndex:100}}>정원 보관함으로 이동 확인</div>}</main>}
let disposed=false;import.meta.hot?.dispose(()=>{disposed=true});
setLocale(params.get('lang')==='en'?'en':'ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('18px Jua');await document.fonts.load('18px "Lilita One"');const host=document.getElementById('root')! as HTMLElement&{contentEventRoot?:Root};const root=host.contentEventRoot??=createRoot(host);if(!disposed)root.render(<Fixture/>);

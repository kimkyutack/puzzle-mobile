// Real HTTP validation against the isolated local Worker; never production.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Player,type Run} from '@garden/contracts';
import {replay} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import proofs from '../packages/content/src/garden-stage-proofs-v3.json';
import expeditionProofs from '../packages/content/src/animal-expedition-proofs.json';
import type {RuntimeSettings} from '../packages/contracts/src/operations';
import {ANIMAL_EXPEDITION_STAGES,ANIMAL_EXPEDITION_DOG_GRANT_ID} from '../packages/content/src/animal-expedition';
import type {Action} from '@garden/contracts';
const origin='http://127.0.0.1:8798';
async function call<T>(path:string,body?:unknown,headers:Record<string,string>={},method=body?'POST':'GET',expected=200){
 const target=path.startsWith('/garden/')&&!path.includes('gardenArt=')?path+(path.includes('?')?'&':'?')+'gardenArt=flowerlight-v42':path;
 const response=await fetch(origin+'/api'+target,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),value=await response.json() as {data:T;error?:{code:string;message:string}};
 assert.equal(response.status,expected,path+': '+JSON.stringify(value.error));return {data:value.data,response,error:value.error};
}
const login=await call<{csrf:string}>('/admin/auth/login',{email:'qa@example.test',password:'Admin-QA-Only-2026!'}),admin={Cookie:login.response.headers.get('set-cookie')!.split(';')[0]!,'X-Admin-CSRF':login.data.csrf};
const guest=await call<{player:Player;accessToken:string}>('/auth/guest',{}),userId=guest.data.player.id,auth={Authorization:'Bearer '+guest.data.accessToken},key=()=>crypto.randomUUID();
async function level(value:number){await call('/admin/users/'+userId+'/profile',{key:key(),reason:'격리된 로컬 이벤트와 레벨 20 해금 검증',nickname:'콘텐츠 이벤트 QA',level:value},admin,'PUT');}
await level(19);const locked=await call('/animal-expedition/start',{key:key()},auth,'POST',409);assert.equal(locked.error?.code,'EXPEDITION_LOCKED');
await level(20);let player=(await call<{player:Player}>('/flowerlight/start',{key:key()},auth)).data.player;
const event=player.flowerFestival!;assert.equal(event.endsAt-event.startedAt,7*86400000);
const originalRuntime=(await call<{settings:RuntimeSettings;revision:number}>('/admin/runtime',undefined,admin)).data;await call('/admin/runtime',{key:key(),reason:'격리된 로컬 10단계 완주 검증용 횟수',revision:originalRuntime.revision,data:{...originalRuntime.settings,gameEvents:{...originalRuntime.settings.gameEvents,animalExpedition:{...originalRuntime.settings.gameEvents.animalExpedition,dailyLimit:20}}}},admin,'PUT');
try{for(let course=1;course<=ANIMAL_EXPEDITION_STAGES.length;course++){
 const started=await call<{player:Player}>('/animal-expedition/start',{key:key()},auth),attempt=started.data.player.animalExpedition!.attempt!,actions=expeditionProofs.find(p=>p.stage===course&&p.variant===(attempt.variant??0))!.actions;
 assert.equal(attempt.stage,course);const finished=await call<{player:Player;granted:boolean}>('/animal-expedition/finish',{key:key(),attemptId:attempt.id,actions},auth);player=finished.data.player;assert.equal(player.hearts,5);assert.equal(player.level,20);
 const duplicate=await call<{granted:boolean}>('/animal-expedition/finish',{key:key(),attemptId:attempt.id,actions},auth);assert.equal(duplicate.data.granted,false);
}
}finally{const current=(await call<{revision:number}>('/admin/runtime',undefined,admin)).data;await call('/admin/runtime',{key:key(),reason:'격리된 검증 후 기존 이벤트 설정 복원',revision:current.revision,data:originalRuntime.settings},admin,'PUT');}
assert.equal(player.animalExpedition!.completedStages,10);assert.equal(player.flowerFestival!.petals,0);
let restored=0;
for(let clear=0;clear<20;clear++){
 const variant=clear%5,id=20*(Math.floor(clear/5)*12+variant+1),actions=proofs.find(p=>p.kind==='animal'&&p.variant===variant)!.actions as Action[];
 assert.equal(replay(publishedLevel(id,ENGINE_VERSION),actions).state.status,'won');await level(id);
 const started=await call<{run:Run}>('/runs/start',{idempotencyKey:key(),preBoosters:[],engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,randomStart:false},auth);
 const run=started.data.run;await call('/runs/'+run.id+'/actions',{idempotencyKey:key(),sequence:0,actions},auth);
 const finished=await call<{player:Player;run:Run}>('/runs/'+run.id+'/finish',{key:key()},auth);player=finished.data.player;assert.equal(player.flowerFestival!.petals,clear+1);assert.equal(finished.data.run.reward!.flowerPetals,1);
 if([2,5,9,14,20].includes(clear+1)){restored++;const result=await call<{player:Player;granted:boolean}>('/flowerlight/restore',{key:key(),stage:restored},auth);player=result.data.player;assert.equal(result.data.granted,true);}
}
const duplicate=await call<{granted:boolean}>('/flowerlight/restore',{key:key(),stage:5},auth);assert.equal(duplicate.data.granted,false);
const world=(await call<{world:{revision:number;owned:Record<string,{itemId:string}>;placements:Record<string,unknown>}}>('/garden/world',undefined,auth)).data.world;
assert.equal(world.owned['flowerlight-invitation-v1']!.itemId,'garden-flowerlight-fountain');assert.equal(world.owned[ANIMAL_EXPEDITION_DOG_GRANT_ID]!.itemId,'animal-dog');
const legacy=(await call<{world:typeof world}>('/garden/world?gardenArt=legacy',undefined,auth)).data.world;assert.equal(legacy.owned['flowerlight-invitation-v1']!.itemId,'garden-fountain');assert.equal(legacy.revision,world.revision);
const place=await call<{world:{placements:Record<string,unknown>}}>('/garden/world/commands',{key:key(),type:'place',instanceId:'flowerlight-invitation-v1',expectedRevision:world.revision,x:12,y:12,rotation:180},auth);assert(place.data.world.placements['flowerlight-invitation-v1']);
const result={unlock19Rejected:true,unlock20Accepted:true,expeditionCourses:10,normalLevelsChangedByExpedition:false,normalClears:20,flowerlightRestorations:5,duplicateRewardsRejected:true,permanentRewards:['garden-flowerlight-fountain','animal-dog'],fountainPlacedAt180Degrees:true,legacyGardenFallback:true,heartsSpent:0};
await writeFile('output/verification/content-events-v42/local-api-proof.json',JSON.stringify(result,null,2));console.log(result);

import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import type {AuthResponse,Player,Run,Envelope} from '@garden/contracts';
import type {GardenWorldState} from '../packages/garden-world/src';
import deployment from '../config/deployment.json';

// This check only uses a fresh disposable guest created below. No installed session or direct DB writes.
const base=deployment.apiUrl,checks:string[]=[],calls:Array<Record<string,unknown>>=[],key=()=>crypto.randomUUID();
const proofs=JSON.parse(await readFile('packages/content/src/legacy-solutions-v12.json','utf8')) as Record<string,{actions:unknown[]}>;
let user:AuthResponse|undefined,passed=false,cleaned=false,failure:string|undefined;
async function call<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST',authenticated=true){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(authenticated&&user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
 calls.push({path,method,status:response.status,placement:response.headers.get('cf-placement'),timing:response.headers.get('server-timing')});
 return {status:response.status,headers:response.headers,...result};
}
async function ok<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST',authenticated=true){const response=await call<T>(path,body,method,authenticated);assert.equal(response.status,200,path+': '+JSON.stringify(response.error));return response.data;}
const record=(message:string)=>{checks.push(message);console.log('PASS '+message)};
try{
 const health=await call<{ok:boolean;engineVersion:string}>('/health',undefined,'GET',false);assert.equal(health.status,200);assert.equal(health.data.engineVersion,'1.2.0');assert.equal(health.headers.get('access-control-allow-origin'),'capacitor://localhost');record('health and native CORS are correct; deployed gameplay engine remains 1.2.0');
 user=await ok<AuthResponse>('/auth/guest',{},'POST',false);
 let player=user.player;
 for(let level=1;level<=4;level++){
  const started=await ok<{run:Run}>('/runs/start',{key:key(),engineVersion:'1.2.0',preBoosters:[]});assert.equal(started.run.level.id,level);
  const resolved=await ok<{run:Run}>('/runs/'+started.run.id+'/actions',{key:key(),sequence:0,actions:proofs[String(level)]!.actions});assert.equal(resolved.run.state.status,'won');
  const finished=await ok<{player:Player}>('/runs/'+started.run.id+'/finish',{key:'garden-smoke-finish-'+started.run.id});player=finished.player;
 }
 assert.equal(player.level,5);assert.equal(player.hearts,5);record('fresh guest clears four approved legacy puzzles and unlocks the garden shop without losing hearts');
 let world=(await ok<{world:GardenWorldState}>('/garden/world')).world;assert.equal(Object.keys(world.owned).length,0);
 const startingCoins=player.coins+player.boundCoins,purchase={key:key(),itemId:'garden-path-stone',quantity:10};
 const bought=await ok<{world:GardenWorldState;player:Player;instanceIds:string[];cost:number}>('/garden/shop/buy',purchase);world=bought.world;player=bought.player;assert.equal(bought.instanceIds.length,10);assert.equal(bought.cost,200);assert.equal(player.coins+player.boundCoins,startingCoins-200);
 const retry=await ok<typeof bought>('/garden/shop/buy',purchase);assert.deepEqual(retry,bought);record('ten-copy purchase commits one charge and an identical retry returns the original copies');
 const bench=await ok<{world:GardenWorldState;player:Player;instanceId:string}>('/garden/shop/buy',{key:key(),itemId:'garden-bench'});world=bench.world;player=bench.player;
 for(const rotation of [0,90,180,270]){
  world=(await ok<{world:GardenWorldState}>('/garden/world/commands',{key:key(),type:rotation===0?'place':'move',instanceId:bench.instanceId,x:12,y:12,rotation,expectedRevision:world.revision})).world;
  assert.equal((await ok<{world:GardenWorldState}>('/garden/world')).world.placements[bench.instanceId]!.rotation,rotation);
 }
 record('all four bench directions save and reload through the production API');
 const invalid=await call('/garden/world/commands',{key:key(),type:'move',instanceId:bench.instanceId,x:12,y:12,rotation:45,expectedRevision:world.revision});assert.equal(invalid.status,400);
 const conflict=await call('/garden/world/commands',{key:key(),type:'paint',expectedRevision:world.revision,placements:bought.instanceIds.slice(0,2).map((instanceId,i)=>({instanceId,x:10,y:10,rotation:i?270:180}))});assert.equal(conflict.error?.code,'OCCUPIED');assert.deepEqual((await ok<{world:GardenWorldState}>('/garden/world')).world,world);record('invalid angles and conflicting brush batches leave the saved layout unchanged');
 const placements=bought.instanceIds.map((instanceId,i)=>({instanceId,x:10+i,y:10,rotation:[0,90,180,270][i%4]!})),paint={key:key(),type:'paint',placements,expectedRevision:world.revision};
 const painted=await ok<{world:GardenWorldState}>('/garden/world/commands',paint);assert.equal(painted.world.revision,world.revision+1);assert.deepEqual(await ok('/garden/world/commands',paint),painted);
 const loaded=(await ok<{world:GardenWorldState}>('/garden/world')).world;for(const placed of placements)assert.deepEqual(loaded.placements[placed.instanceId],placed);
 const finalPlayer=(await ok<{player:Player}>('/me')).player;assert.equal(finalPlayer.coins+finalPlayer.boundCoins,player.coins+player.boundCoins);assert.equal(finalPlayer.version,player.version);record('ten-cell mixed-direction brush placement persists atomically and layout changes do not charge coins');
 passed=true;
}catch(error){failure=error instanceof Error?error.message:String(error)}finally{
 if(user){try{await ok('/account',{confirmation:'DELETE'},'DELETE');cleaned=true;record('the disposable production test account and its private garden are cleaned up')}catch(error){failure??='Disposable account cleanup failed: '+(error instanceof Error?error.message:String(error))}}
 const report={at:new Date().toISOString(),base,passed:passed&&cleaned&&!failure,cleaned,checks,calls,...(failure?{failure}:{}),scope:'Only one freshly created disposable production guest. No installed user token, existing account, seeded level or direct DB modification.'};
 await mkdir('output/verification/garden-directions-v24',{recursive:true});await writeFile('output/verification/garden-directions-v24/production-smoke.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,cleaned,checks:checks.length,...(failure?{failure}:{})}));
}
if(failure)throw Error(failure);

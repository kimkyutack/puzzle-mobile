import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import type {AuthResponse,Envelope,Player,Run} from '@garden/contracts';
import {gardenExpansionOptions,gardenLandCells,type GardenWorldState} from '../packages/garden-world/src';
import deployment from '../config/deployment.json';
// Only the fresh guest below. Never use installed credentials or change the production DB directly.
const base=deployment.apiUrl,proofs=JSON.parse(await readFile('packages/content/src/legacy-solutions-v12.json','utf8')) as Record<string,{actions:unknown[]}>;
const checks:string[]=[],calls:Array<Record<string,unknown>>=[],key=()=>crypto.randomUUID();let guest:AuthResponse|undefined,passed=false,cleaned=false,failure:string|undefined;
async function call<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const at=performance.now(),response=await fetch(base+path,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(guest?{Authorization:'Bearer '+guest.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),result=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
 calls.push({path,method,status:response.status,ms:Math.round(performance.now()-at),...(result.error?{code:result.error.code}:{})});if(!response.ok||result.error)throw Object.assign(new Error(result.error?.message||'HTTP '+response.status),{code:result.error?.code});return result.data;
}
try{
 assert.equal((await call<{engineVersion:string}>('/health')).engineVersion,'1.2.0');checks.push('The existing production puzzle engine remains 1.2.0');guest=await call<AuthResponse>('/auth/guest',{});let player=guest.player;
 for(let id=1;id<=13;id++){
  const {run}=await call<{run:Run}>('/runs/start',{key:key(),engineVersion:'1.2.0',preBoosters:[]}),solved=await call<{run:Run}>('/runs/'+run.id+'/actions',{key:key(),sequence:0,actions:proofs[String(id)]!.actions});assert.equal(solved.run.state.status,'won');player=(await call<{player:Player}>('/runs/'+run.id+'/finish',{key:'land-finish-'+run.id})).player;
  if(id%5===0)console.log('Cleared '+id+' approved puzzles for the disposable QA guest');
 }
 const purchased=await call<{world:GardenWorldState;player:Player;instanceId:string}>('/garden/shop/buy',{itemId:'garden-path-stone',key:key()});player=purchased.player;
 const initial=await call<{world:GardenWorldState;land:{cost:number;tiles:number}}>('/garden/world');assert.deepEqual(initial.land,{cost:1000,tiles:20});const plot=gardenExpansionOptions(initial.world)[0]!,beforeCoins=player.coins+player.boundCoins,body={key:key(),plotId:plot.id,expectedRevision:initial.world.revision};
 const expanded=await call<{world:GardenWorldState;player:Player;cost:number;cellsAdded:number}>('/garden/world/expand',body);assert.equal(expanded.player.coins+expanded.player.boundCoins,beforeCoins-1000);assert.equal(expanded.cellsAdded,20);assert.equal(gardenLandCells(expanded.world).size,gardenLandCells(initial.world).size+20);assert.deepEqual(expanded.world.owned,initial.world.owned);assert.deepEqual(expanded.world.placements,initial.world.placements);assert.equal(expanded.player.hearts,5);checks.push('Exactly 1000 coins unlock exactly twenty additional cells while existing inventory, placement and hearts are preserved');
 assert.deepEqual(await call('/garden/world/expand',body),expanded);checks.push('Same-key retry returns the original purchase without an additional debit');
 let world=(await call<{world:GardenWorldState}>('/garden/world/commands',{type:'place',key:key(),instanceId:purchased.instanceId,x:plot.x,y:plot.y,rotation:270,expectedRevision:expanded.world.revision})).world;
 const reloaded=(await call<{world:GardenWorldState}>('/garden/world')).world;assert.deepEqual(reloaded,world);assert.equal(reloaded.placements[purchased.instanceId]!.rotation,270);assert.equal(gardenLandCells(reloaded).size,164);checks.push('A decoration can immediately be saved on the purchased land; land and four-direction placement survive reload');
 const remaining=await call<{player:Player}>('/me');assert.equal(remaining.player.coins+remaining.player.boundCoins,beforeCoins-1000);const next=gardenExpansionOptions(world)[0]!;await assert.rejects(call('/garden/world/expand',{key:key(),plotId:next.id,expectedRevision:world.revision}),{code:'COINS_EMPTY'});assert.deepEqual((await call<{world:GardenWorldState}>('/garden/world')).world,world);checks.push('Insufficient coins do not unlock the next plot or modify the saved garden');passed=true;
}catch(error){failure=error instanceof Error?error.message:String(error);}finally{
 if(guest)try{await call('/account',{confirmation:'DELETE'},'DELETE');cleaned=true;}catch(error){failure??='Disposable guest cleanup failed: '+String(error);}
 await mkdir('output/verification/garden-land-v28',{recursive:true});const report={at:new Date().toISOString(),base,passed:passed&&cleaned&&!failure,cleaned,checks,calls,...(failure?{failure}:{})};await writeFile('output/verification/garden-land-v28/production.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cleaned,checks,...(failure?{failure}:{})}));
}if(failure)throw new Error(failure);

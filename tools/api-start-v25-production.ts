import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import type {AuthResponse,Envelope,Player,Run} from '@garden/contracts';
import {createRunGateway} from '../apps/client/src/run-gateway';
import {getLevel} from '@garden/content';
import deployment from '../config/deployment.json';
// One new disposable guest only. No installed credentials, account seeding or direct DB writes.
const proofs=JSON.parse(await readFile('packages/content/src/legacy-solutions-v12.json','utf8')) as Record<string,{actions:unknown[]}>;
const calls:Array<Record<string,unknown>>=[],checks:string[]=[],base=deployment.apiUrl;
let guest:AuthResponse|undefined,cleaned=false,passed=false,failure:string|undefined;
async function call<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const start=performance.now(),response=await fetch(base+path,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(guest?{Authorization:'Bearer '+guest.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
 calls.push({path,method,status:response.status,ms:Math.round(performance.now()-start),...(path==='/runs/start'?{engineVersion:(body as {engineVersion?:string}).engineVersion}:{}),...(result.error?{code:result.error.code}:{})});
 if(!response.ok||result.error)throw Object.assign(new Error(result.error?.message||'HTTP '+response.status),{code:result.error?.code});return result.data;
}
try{
 guest=await call<AuthResponse>('/auth/guest',{});
 await assert.rejects(call('/runs/start',{engineVersion:'1.3.0',idempotencyKey:crypto.randomUUID(),preBoosters:[]}),{code:'INVALID_INPUT'});
 assert.equal((await call<{player:Player}>('/me')).player.hearts,5);checks.push('Reproduced the reported 1.3.0 start rejection without spending hearts or boosters');
 const gateway=createRunGateway(call);assert.equal(await gateway.resolveEngine(),'1.2.0');
 for(let level=1;level<=20;level++){
  const input={idempotencyKey:crypto.randomUUID(),preBoosters:[]},started=await gateway.start(input);assert.equal(started.run.level.id,level);assert.equal(started.run.state.engineVersion,'1.2.0');assert.deepEqual(started.run.level,getLevel(level,'1.2.0'));
  if(level===20){assert.deepEqual(await gateway.start(input),started);assert.equal(started.player.hearts,5);checks.push('Level 20 starts and its objectives exactly match the negotiated preview; same-key retry preserves the run and hearts');break;}
  const solved=await call<{run:Run}>('/runs/'+started.run.id+'/actions',{key:crypto.randomUUID(),sequence:0,actions:proofs[String(level)]!.actions});assert.equal(solved.run.state.status,'won');
  await call('/runs/'+started.run.id+'/finish',{key:'v25-finish-'+started.run.id});
  if(level%5===0)console.log('Verified approved clears through level '+level);
 }
 assert.equal(calls.filter(call=>call.path==='/health').length,1);checks.push('One cached engine discovery across 20 starts; all actions execute from certified legacy solutions');passed=true;
}catch(error){failure=error instanceof Error?error.message:String(error);}finally{
 if(guest)try{await call('/account',{confirmation:'DELETE'},'DELETE');cleaned=true;}catch(error){failure??='Disposable guest cleanup failed: '+String(error);}
 await mkdir('output/verification/special-v25',{recursive:true});await writeFile('output/verification/special-v25/production-start.json',JSON.stringify({at:new Date().toISOString(),base,passed:passed&&cleaned&&!failure,cleaned,checks,calls,...(failure?{failure}:{})},null,2));console.log(JSON.stringify({passed:passed&&cleaned&&!failure,cleaned,checks,...(failure?{failure}:{})}));
}
if(failure)throw new Error(failure);

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ENGINE_VERSION,type AuthResponse,type Envelope,type Player,type Run} from '@garden/contracts';
import deployment from '../config/deployment.json';
import solutions from '../packages/content/src/solutions.json';

// Dedicated disposable guest only. Never read local tokens or a local D1 database.
const base=deployment.apiUrl,checks:string[]=[];
let user:AuthResponse|undefined;
const check=(message:string)=>{checks.push(message);console.log('PASS '+message);};
async function call<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST',authorized=true){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(authorized&&user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
 assert.equal(response.headers.get('access-control-allow-origin'),'capacitor://localhost',path+' CORS');
 return {status:response.status,json};
}
async function ok<T>(path:string,body?:unknown,method?:string,authorized=true){const result=await call<T>(path,body,method,authorized);assert.equal(result.status,200,`${path}: ${JSON.stringify(result.json.error)}`);return result.json.data;}
try{
 assert.equal((await ok<{ok:boolean}>('/health',undefined,undefined,false)).ok,true);check('deployed Worker health');
 for(const origin of ['capacitor://localhost','http://localhost','https://localhost','http://127.0.0.1:5173']){
  const response=await fetch(base+'/me',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),origin);
 }
 const rejected=await fetch(base+'/me',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}});assert.equal(rejected.status,403);assert.equal(rejected.headers.get('access-control-allow-origin'),null);check('iOS, Android, browser CORS and foreign-origin rejection');
 assert.equal((await call('/me',undefined,undefined,false)).status,401);
 user=await ok<AuthResponse>('/auth/guest',{},undefined,false);check('remote D1 guest and authenticated profile');
 assert.equal((await ok<{player:Player}>('/me')).player.id,user.player.id);
 const first=await ok<{run:Run}>('/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION,preBoosters:[]});
 const actions=solutions[String(first.run.level.id) as keyof typeof solutions].actions;
 const actionBody={key:crypto.randomUUID(),sequence:0,actions};
 const played=await ok<{run:Run}>(`/runs/${first.run.id}/actions`,actionBody);assert.equal(played.run.state.status,'won');
 const replay=await ok<{run:Run}>(`/runs/${first.run.id}/actions`,actionBody);assert.equal(replay.run.sequence,played.run.sequence);
 const finishBody={key:crypto.randomUUID()};
 const finished=await ok<{player:Player}>(`/runs/${first.run.id}/finish`,finishBody);
 const repeated=await ok<{player:Player}>(`/runs/${first.run.id}/finish`,finishBody);assert.equal(repeated.player.coins,finished.player.coins);check('server puzzle replay, level reward and duplicate protection');
 assert.equal((await ok<{freeHeartRefill:boolean}>('/local/features')).freeHeartRefill,false);
 assert.equal((await call('/local/hearts/refill',{key:crypto.randomUUID()})).status,404);check('local-only free hearts disabled remotely');
 user=await ok<AuthResponse>('/auth/refresh',{refreshToken:user.refreshToken},undefined,false);
 assert.equal((await ok<{player:Player}>('/me')).player.id,user.player.id);check('remote access and refresh sessions');
 await ok('/catalog');await ok('/offers');await ok('/events');await ok('/rankings?scope=players');await ok('/friends');await ok('/garden/world');await ok('/story');check('catalog, shop, events, rankings, friends, garden and story routes');
}finally{
 if(user){await ok('/account',{confirmation:'DELETE'},'DELETE');check('disposable verification account anonymized and revoked');}
 await mkdir('output/verification',{recursive:true});
 await writeFile('output/verification/cloudflare-api.json',JSON.stringify({at:new Date().toISOString(),apiUrl:base,checks,localProgressRead:false,credentialsRecorded:false},null,2));
}

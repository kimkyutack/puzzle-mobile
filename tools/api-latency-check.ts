import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ENGINE_VERSION,type AuthResponse,type Envelope,type Player,type Run} from '@garden/contracts';
import deployment from '../config/deployment.json';
import solutions from '../packages/content/src/solutions.json';

// Only accounts created in this process are used. Never load installed app tokens.
const label=process.argv[2]??'baseline',base=process.env.API_URL??deployment.apiUrl;
const count=Number(process.env.LATENCY_SAMPLES??3),samples:Array<Record<string,unknown>>=[];
assert(/^[a-z0-9-]+$/.test(label));assert(count>=1&&count<=5);
async function call<T>(name:string,path:string,token?:string,body?:unknown,method=body?'POST':'GET'){
 const start=performance.now(),response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),json=await response.json() as Envelope<T>&{error?:unknown};
 samples.push({name,ms:Math.round((performance.now()-start)*10)/10,status:response.status,headers:Object.fromEntries(['cf-ray','cf-placement','server-timing','x-worker-placement','x-d1-region','x-d1-calls','x-request-colo','cache-control'].flatMap(key=>{const value=response.headers.get(key);return value?[[key,value]]:[]}))});
 assert.equal(response.status,200,`${name}: ${JSON.stringify(json.error)}`);return json.data;
}
const checks:string[]=[];
try{
 for(let i=0;i<count;i++){
  await call('health','/health');
  const user=await call<AuthResponse>('guest','/auth/guest',undefined,{});
  try{
   const profile=await call<{player:Player}>('profile','/me',user.accessToken);assert.equal(profile.player.id,user.player.id);
   const {run}=await call<{run:Run}>('start','/runs/start',user.accessToken,{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION,preBoosters:[]});
   const body={key:crypto.randomUUID(),sequence:0,actions:solutions[String(run.level.id) as keyof typeof solutions].actions};
   const saved=await call<{run:Run}>('actions',`/runs/${run.id}/actions`,user.accessToken,body);assert.equal(saved.run.state.status,'won');
   const finishBody={key:'finish-'+run.id};
   const won=await call<{player:Player;run:Run}>('finish',`/runs/${run.id}/finish`,user.accessToken,finishBody);
   assert.equal(won.player.coins,550);assert.equal(won.player.level,2);assert.equal(won.player.hearts,5);
   const retry=await call<{player:Player;run:Run}>('finish-retry',`/runs/${run.id}/finish`,user.accessToken,finishBody);
   assert.deepEqual(retry,won);checks.push('fresh guest '+(i+1)+': real approved replay, clear, unchanged hearts, exact idempotent retry');
  }finally{
   await call('cleanup','/account',user.accessToken,{confirmation:'DELETE'},'DELETE');
  }
 }
}finally{
 const summary=[...new Set(samples.map(s=>String(s.name)))].map(name=>{const values=samples.filter(s=>s.name===name).map(s=>Number(s.ms)).sort((a,b)=>a-b);return {name,count:values.length,minMs:values[0],medianMs:values[Math.floor(values.length/2)],maxMs:values.at(-1)};});
 const report={at:new Date().toISOString(),base,label,notes:'Dedicated disposable guests; local KR network to live Worker. Client end-to-end includes network. No installed account or token used.',checks,samples,summary};
 await mkdir('output/verification',{recursive:true});await writeFile(`output/verification/api-latency-${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({label,checks,summary},null,2));
}

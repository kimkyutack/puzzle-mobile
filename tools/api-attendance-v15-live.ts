import assert from 'node:assert/strict';import {writeFile,unlink} from 'node:fs/promises';
import deployment from '../config/deployment.json';import type {AuthResponse,Player} from '@garden/contracts';
const file='/private/tmp/cloud-garden-attendance-v15-live.json',checks:string[]=[];let user:AuthResponse|undefined;
async function call(url:string,body?:unknown,method=body===undefined?'GET':'POST'){
 let last:unknown;for(let i=0;i<3;i++)try{const response=await fetch(deployment.apiUrl+url,{method,headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,json:await response.json() as {data:any;error?:{code:string}}};}catch(error){last=error;if(!(error instanceof TypeError))throw error;}throw last;
}
async function ok(url:string,body?:unknown,method?:string){const r=await call(url,body,method);assert.equal(r.status,200,url+': '+JSON.stringify(r.json.error));return r.json.data;}
try{
 user=await ok('/auth/guest',{});await writeFile(file,JSON.stringify(user),{mode:0o600});
 const before=(await ok('/me')).player as Player,status=await ok('/events');assert.equal(status.attendance.total,0);assert.equal(status.attendance.cycleDay,1);assert(status.daily.available);checks.push('deployed Worker exposes new seven-day attendance');
 const key=crypto.randomUUID(),reward=await ok('/events/daily',{key});assert.equal(reward.player.coins,before.coins+50);assert.equal(reward.player.hearts,before.hearts);assert.deepEqual(reward.attendanceReward,{coins:50,hammer:0});checks.push('live first check-in grants 50 coins without using hearts');
 await ok('/events/daily',{key});const duplicate=await call('/events/daily',{key:crypto.randomUUID()});assert.equal(duplicate.status,409);assert.equal(duplicate.json.error?.code,'ALREADY_CLAIMED');assert.equal(((await ok('/me')).player as Player).coins,before.coins+50);checks.push('live retry and duplicate claim cannot grant extra coins');
 const done=await ok('/events');assert(!done.daily.available);assert.equal(done.attendance.claimedDays,1);assert.equal(done.attendance.cycleDay,1);checks.push('live events response marks today as claimed');
}finally{if(user){await ok('/account',{confirmation:'DELETE'},'DELETE');await unlink(file);checks.push('dedicated verification account anonymized and credentials removed');}await writeFile('output/verification/attendance-v15-live.json',JSON.stringify({at:new Date().toISOString(),checks,realAccountsRead:false,credentialsRecorded:false},null,2));for(const check of checks)console.log('PASS '+check);}

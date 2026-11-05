import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import type {StateResponse} from '@garden/contracts';

const origin='http://127.0.0.1:5173',storageKey='cloud-garden-session-v1';
const report:{checks:Record<string,unknown>;errors:string[];expectedFaults:string[];failure?:string}={checks:{},errors:[],expectedFaults:[]};
await mkdir('output/verification/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
let phase:'normal'|'network'|'revoked'='normal',guestCalls=0,startCalls=0;
page.on('request',request=>{const path=new URL(request.url()).pathname;if(request.method()==='POST'&&path==='/api/auth/guest')guestCalls++;if(request.method()==='POST'&&path==='/api/runs/start')startCalls++;});
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()!=='error')return;const text=message.text().slice(0,350);if((phase==='network'&&/Failed to fetch|Failed to load resource|ERR_/.test(text))||(phase==='revoked'&&/401|Failed to load resource/.test(text)))report.expectedFaults.push(text);else report.errors.push(text);});
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
const stored=()=>page.evaluate(key=>localStorage.getItem(key),storageKey);
async function state(token:string):Promise<StateResponse>{const response=await context.request.get(origin+'/api/me',{headers:{Authorization:`Bearer ${token}`}});check(response.ok(),'Authenticated state read failed');return(await response.json() as {data:StateResponse}).data;}
try{
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:45000});
 const originalTokens=await stored();check(originalTokens,'Fresh guest has no stored session');const originalToken=(JSON.parse(originalTokens) as {accessToken:string}).accessToken;
 const original=await state(originalToken);check(original.activeRun&&original.player.hearts===4,'Fresh guest did not start one real run');const runKey=`cloud-garden-run-${original.player.id}`;
 const originalCache=await page.evaluate(key=>localStorage.getItem(key),runKey);check(originalCache,'Active run cache was not persisted');

 // A transient GET network failure must not be interpreted as revoked authentication.
 phase='network';let networkFaults=0;const guestsBeforeNetwork=guestCalls,startsBeforeNetwork=startCalls;
 await page.route('**/api/me',async route=>{networkFaults++;await route.abort('failed');},{times:1});await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'다시 연결',exact:true}).waitFor({timeout:45000});
 check(networkFaults===1&&await page.getByRole('button',{name:'계정 다시 연결',exact:true}).count()===0,'Network failure exposed terminal-session recovery');
 check(await stored()===originalTokens,'Network failure cleared or changed the stored session');check(guestCalls===guestsBeforeNetwork&&startCalls===startsBeforeNetwork,'Network failure silently created an account or run');
 check(await page.evaluate(key=>localStorage.getItem(key),runKey)===originalCache,'Network failure changed the saved run cache');
 await page.screenshot({path:'output/verification/screenshots/auth-network-token-preserved.png'});
 await page.getByRole('button',{name:'다시 연결',exact:true}).click();await page.locator('.board canvas').waitFor({timeout:45000});phase='normal';
 const recovered=await state(originalToken);check(recovered.activeRun?.id===original.activeRun.id&&recovered.player.hearts===4,'Network retry did not resume the same run');
 report.checks.transientNetwork={faultInjected:true,sessionPreserved:true,cachePreserved:true,noGuestCreated:true,noRunStarted:true,sameRunAfterRetry:true,heartDifference:0};

 // Revoke the actual session through the real server endpoint; do not fake an OAuth result.
 const logout=await context.request.post(origin+'/api/auth/logout',{headers:{Authorization:`Bearer ${originalToken}`,'Content-Type':'application/json'},data:{}});check(logout.ok(),'Real logout did not revoke the session');
 phase='revoked';await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'계정 다시 연결',exact:true}).waitFor({timeout:45000});
 check(await stored()===originalTokens,'Revocation discarded the old session before the explicit recovery action');
 await page.screenshot({path:'output/verification/screenshots/auth-reconnect-required.png'});const guestsBeforeReconnect=guestCalls,startsBeforeReconnect=startCalls;
 await page.getByRole('button',{name:'계정 다시 연결',exact:true}).click();await page.getByRole('dialog',{name:'나의 정원사',exact:true}).waitFor({timeout:20000});await page.waitForTimeout(700);phase='normal';
 const replacementTokens=await stored();check(replacementTokens&&replacementTokens!==originalTokens,'Recovery did not install a new session');const replacement=await state((JSON.parse(replacementTokens) as {accessToken:string}).accessToken);
 check(replacement.player.id!==original.player.id&&replacement.player.level===1,'Recovery did not create an isolated guest');check(replacement.activeRun===null&&replacement.player.hearts===5,'Recovery started a puzzle or spent a heart');check(guestCalls===guestsBeforeReconnect+1&&startCalls===startsBeforeReconnect,'Recovery created duplicate guests or started a run');
 check(await page.evaluate(key=>localStorage.getItem(key),runKey)===originalCache,'Recovery erased the old account run cache');
 await page.screenshot({path:'output/verification/screenshots/auth-reconnected-profile.png'});
 report.checks.revokedSession={realLogout:true,recoveryButtonShown:true,explicitRecovery:true,newGuest:true,profileOpened:true,activeRun:null,hearts:5,runStarts:0,oldAccountRunCachePreserved:true,oauthRecoveryTested:false};
 check(report.errors.length===0,`Unexpected browser errors: ${report.errors.join(' | ')}`);console.log(JSON.stringify(report.checks,null,2));
}catch(error){report.failure=error instanceof Error?error.stack:String(error);console.error(report.failure);process.exitCode=1;await page.screenshot({path:'output/verification/screenshots/auth-recovery-failure-debug.png'}).catch(()=>{});}
finally{await writeFile('output/verification/browser-auth-recovery.json',JSON.stringify(report,null,2));await browser.close();}

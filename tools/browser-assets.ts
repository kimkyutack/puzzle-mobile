import {chromium,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import type {StateResponse} from '@garden/contracts';

const origin='http://127.0.0.1:5173';
const report:{checks:Record<string,unknown>;errors:string[];expectedNetworkErrors:string[];failure?:string}={checks:{},errors:[],expectedNetworkErrors:[]};
await mkdir('output/verification/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
function observe(page:Page,allowNetworkFault=false){page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()!=='error')return;const text=message.text().slice(0,350);if(allowNetworkFault&&/Failed to fetch|Failed to load resource|ERR_/.test(text))report.expectedNetworkErrors.push(text);else report.errors.push(text);});}
try{
 // Inject one corrupt image into an empty browser profile; the real manifest hash remains unchanged.
 const fresh=await browser.newContext({viewport:{width:390,height:844}});const corrupt=await fresh.newPage();observe(corrupt);let guestCalls=0,startCalls=0,corruptions=0;
 corrupt.on('request',request=>{const path=new URL(request.url()).pathname;if(path==='/api/auth/guest')guestCalls++;if(path==='/api/runs/start')startCalls++;});
 await corrupt.route('**/assets/tile_berry.*.png',async route=>{const response=await route.fetch();const bytes=await response.body();bytes[bytes.length-1]=bytes[bytes.length-1]!^1;corruptions++;await route.fulfill({response,body:bytes});},{times:1});
 await corrupt.goto(origin,{waitUntil:'domcontentloaded'});await corrupt.getByText('이미지 버전이 달라요. 다시 연결해 주세요.',{exact:true}).waitFor({timeout:45000});await corrupt.waitForTimeout(700);
 check(corruptions===1&&guestCalls===0&&startCalls===0,'Corrupt initial pack allowed a guest/start or fault was not injected');
 const incompleteManifest=await corrupt.evaluate(async()=>!!await(await caches.open('cloud-garden-verified-v1')).match('garden-verified-manifest'));
 check(!incompleteManifest,'Incomplete pack became the verified manifest fallback');await corrupt.screenshot({path:'output/verification/screenshots/assets-corrupt-blocked.png'});
 report.checks.corruptFreshAsset={faultInjected:true,hashValidationBlocked:true,guestCalls,startCalls,unverifiedManifestCached:false};await fresh.close();

 // Populate verified browser cache through the real app, then lose the manifest request on reload.
 const cached=await browser.newContext({viewport:{width:390,height:844}});const page=await cached.newPage();observe(page,true);
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:45000});
 const accessToken=await page.evaluate(()=>JSON.parse(localStorage.getItem('cloud-garden-session-v1')!).accessToken as string);
 async function state():Promise<StateResponse>{const response=await cached.request.get(origin+'/api/me',{headers:{Authorization:`Bearer ${accessToken}`}});check(response.ok(),'Real state read failed');return(await response.json() as {data:StateResponse}).data;}
 const before=await state();check(before.activeRun,'Verified-cache fixture has no real active run');
 const cachedManifest=await page.evaluate(async()=>!!await(await caches.open('cloud-garden-verified-v1')).match('garden-verified-manifest'));check(cachedManifest,'Successful pack did not create verified manifest cache');
 let manifestFaults=0;await page.route('**/assets/asset-manifest.json',async route=>{manifestFaults++;await route.abort('failed');},{times:1});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:45000});const after=await state();
 check(manifestFaults===1&&after.activeRun?.id===before.activeRun.id&&after.player.hearts===before.player.hearts&&after.activeRun.sequence===before.activeRun.sequence,'Verified cache did not resume the same run without extra cost');
 await page.screenshot({path:'output/verification/screenshots/assets-cache-recovery.png'});report.checks.verifiedCacheRecovery={manifestNetworkFaultInjected:true,verifiedCacheUsed:true,sameRun:true,heartDifference:0,sequenceDifference:0};

 // Change only a GET response envelope; the server's actual stored run is never modified.
 let mismatched=0,actionsAfterMismatch=0,startsAfterMismatch=0;
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(/\/api\/runs\/[^/]+\/actions$/.test(path))actionsAfterMismatch++;if(path==='/api/runs/start')startsAfterMismatch++;});
 await page.route('**/api/me',async route=>{if(route.request().method()!=='GET'){await route.continue();return;}const response=await route.fetch();const envelope=await response.json() as {data:StateResponse};check(envelope.data.activeRun,'Version fixture lost active run');envelope.data.activeRun.state.engineVersion='999.0.0-test';envelope.data.activeRun.level.engineVersion='999.0.0-test';mismatched++;await route.fulfill({response,json:envelope});});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('dialog',{name:'업데이트가 필요해요',exact:true}).waitFor({timeout:45000});await page.getByRole('dialog',{name:'업데이트가 필요해요',exact:true}).getByRole('button',{name:'닫기',exact:true}).click();await page.waitForTimeout(600);
 check(await page.getByRole('dialog',{name:'업데이트가 필요해요',exact:true}).isVisible(),'Version warning could be dismissed to bypass the guard');check(mismatched>=1&&actionsAfterMismatch===0&&startsAfterMismatch===0,'Version mismatch submitted actions or started a new run');
 const actual=await state();check(actual.activeRun?.id===before.activeRun.id&&actual.activeRun.state.engineVersion!=='999.0.0-test'&&actual.player.hearts===before.player.hearts,'Fault fixture changed authoritative state');
 await page.screenshot({path:'output/verification/screenshots/assets-version-update-required.png'});report.checks.versionGuard={responseFaultInjected:true,updateShown:true,cannotDismiss:true,actions:actionsAfterMismatch,starts:startsAfterMismatch,serverStateUnchanged:true};
 await cached.close();check(report.errors.length===0,`Unexpected errors: ${report.errors.join(' | ')}`);console.log(JSON.stringify(report.checks,null,2));
}catch(error){report.failure=error instanceof Error?error.stack:String(error);console.error(report.failure);process.exitCode=1;}
finally{await writeFile('output/verification/browser-assets.json',JSON.stringify(report,null,2));await browser.close();}

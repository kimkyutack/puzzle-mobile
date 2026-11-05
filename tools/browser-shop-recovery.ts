import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import type {Action,Run,StateResponse} from '@garden/contracts';

const origin='http://127.0.0.1:5173';
const report:{checks:Record<string,unknown>;errors:string[];expectedFaults:string[];failure?:string}={checks:{},errors:[],expectedFaults:[]};
await mkdir('output/verification/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
let fault=false;const submitted:Array<{item:string;key:string}>=[];
page.on('request',request=>{if(new URL(request.url()).pathname==='/api/shop/buy'&&request.method()==='POST')submitted.push(request.postDataJSON() as {item:string;key:string});});
page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()!=='error')return;const text=message.text().slice(0,350);if(fault&&/Failed to fetch|Failed to load resource|ERR_/.test(text))report.expectedFaults.push(text);else report.errors.push(text);});
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
async function openShop(){await page.getByRole('button',{name:'정원으로',exact:true}).click();await page.getByRole('button',{name:'상점',exact:true}).click();await page.getByRole('dialog',{name:'정원 상점',exact:true}).waitFor();}
const hammerButton=()=>page.locator('.list-row').filter({has:page.locator('.row-title').filter({hasText:/^망치$/})}).getByRole('button',{name:'150',exact:true});
try{
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:45000});
 const token=await page.evaluate(()=>JSON.parse(localStorage.getItem('cloud-garden-session-v1')!).accessToken as string);
 async function state():Promise<StateResponse>{const response=await context.request.get(origin+'/api/me',{headers:{Authorization:`Bearer ${token}`}});check(response.ok(),'Actual state read failed');return(await response.json() as {data:StateResponse}).data;}
 const fresh=await state();check(fresh.activeRun&&fresh.player.coins===500,'Unexpected fresh guest state');
 const solutions=JSON.parse(await readFile('packages/content/src/solutions.json','utf8')) as Record<string,{actions:Action[]}>;
 async function post<T>(path:string,body:unknown):Promise<T>{const response=await context.request.post(origin+'/api'+path,{headers:{Authorization:`Bearer ${token}`},data:body});check(response.ok(),`Certified shop-unlock fixture failed: ${path}`);return(await response.json() as {data:T}).data;}
 let fixtureRun=fresh.activeRun;
 for(let level=1;level<=4;level++){
  if(level>1)fixtureRun=(await post<{run:Run}>('/runs/start',{key:crypto.randomUUID(),preBoosters:[]})).run;
  check(fixtureRun.level.id===level,'Certified unlock fixture selected the wrong level');
  await post(`/runs/${fixtureRun.id}/actions`,{key:crypto.randomUUID(),sequence:0,actions:solutions[String(level)]!.actions});await post(`/runs/${fixtureRun.id}/finish`,{key:crypto.randomUUID()});
 }
 await post('/runs/start',{key:crypto.randomUUID(),preBoosters:[]});await page.reload({waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:45000});
 const initial=await state();check(initial.activeRun&&initial.player.level===5,'Shop was not unlocked through real certified replays');const pendingKey=`garden-pending-mutations-${initial.player.id}`;
 const pending=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}') as Record<string,string>,pendingKey);
 const initialHammer=initial.player.inventory.hammer.normal+initial.player.inventory.hammer.bound;
 await openShop();let committed!:(result:{ok:boolean;status:number;code?:string})=>void;const didCommit=new Promise<{ok:boolean;status:number;code?:string}>(resolve=>{committed=resolve});
 fault=true;await page.route('**/api/shop/buy',async route=>{const response=await route.fetch();const body=await response.json() as {error?:{code:string}};const result={ok:response.ok(),status:response.status(),code:body.error?.code};if(response.ok())await route.abort('failed');else await route.fulfill({response});committed(result);},{times:1});
 await hammerButton().click();const firstResult=await didCommit;check(firstResult.ok,`Real shop purchase did not commit: ${firstResult.status} ${firstResult.code}`);await page.waitForTimeout(250);check(Object.keys(await pending()).length===1,'Ambiguous mutation did not retain its key');
 const first=await state();check(initial.player.coins-first.player.coins===150,'First purchase cost was not 150');check(first.player.inventory.hammer.normal+first.player.inventory.hammer.bound===initialHammer+1,'First purchase did not grant one hammer');
 await page.screenshot({path:'output/verification/screenshots/shop-lost-response-pending.png'});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:45000});fault=false;await openShop();
 const retryResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/shop/buy'&&response.request().method()==='POST');await hammerButton().click();check((await retryResponse).ok(),'Retry was not acknowledged');await page.waitForTimeout(250);
 const retry=await state();check(submitted.slice().length===2&&submitted[0]!.key===submitted[1]!.key,'Reload retry did not preserve the original command key');check(retry.player.coins===first.player.coins&&retry.player.inventory.hammer.normal+retry.player.inventory.hammer.bound===initialHammer+1,'Retry charged or granted twice');check(Object.keys(await pending()).length===0,'Acknowledged mutation key was not cleared');
 await page.screenshot({path:'output/verification/screenshots/shop-retry-acknowledged.png'});
 const nextResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/shop/buy'&&response.request().method()==='POST');await hammerButton().click();check((await nextResponse).ok(),'Next purchase failed');await page.waitForTimeout(250);
 const next=await state();check(submitted.length===3&&submitted[2]!.key!==submitted[1]!.key,'Acknowledged next intent did not create a new command key');check(initial.player.coins-next.player.coins===300&&next.player.inventory.hammer.normal+next.player.inventory.hammer.bound===initialHammer+2,'Two distinct purchases did not charge/grant exactly twice');check(Object.keys(await pending()).length===0,'Second acknowledged command was not cleared');check(next.player.hearts===initial.player.hearts&&next.activeRun?.id===initial.activeRun.id&&next.activeRun.sequence===initial.activeRun.sequence,'Shop recovery changed the active puzzle or hearts');
 await page.screenshot({path:'output/verification/screenshots/shop-new-intent-acknowledged.png'});
 report.checks={realGuestAndRun:true,shopUnlockedWithFourCertifiedServerReplays:true,realCoinPurchase:true,lostResponseInjectedAfterServerCommit:true,reloadRetrySameKey:true,afterRetry:{coinCost:150,hammerGranted:1},nextIntentNewKey:true,afterTwoIntents:{coinCost:300,hammerGranted:2},acknowledgedKeysCleared:true,heartDifference:0,sameRun:true,storeIapTested:false};
 check(report.errors.length===0,`Unexpected errors: ${report.errors.join(' | ')}`);console.log(JSON.stringify(report.checks,null,2));
}catch(error){report.failure=error instanceof Error?error.stack:String(error);console.error(report.failure);process.exitCode=1;await page.screenshot({path:'output/verification/screenshots/shop-recovery-failure-debug.png'}).catch(()=>{});}
finally{await writeFile('output/verification/browser-shop-recovery.json',JSON.stringify(report,null,2));await browser.close();}

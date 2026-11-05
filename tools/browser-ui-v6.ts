import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,type Page} from '@playwright/test';
import type {Action,AuthResponse,Player,Run,StateResponse} from '@garden/contracts';
import {loadMasks,scanGeometry} from './ui-audit/geometry';
import {captureContrast} from './ui-audit/contrast';
import {inspectGrouping} from './ui-audit/grouping';

// One private QA guest; never reads or changes the native user's session.
const api='http://127.0.0.1:8787/api',origin='http://127.0.0.1:5173';
const out=process.env.UI_QA_OUT||'output/verification/ui-v6';
const privateFile='.wrangler/ui-v6-session.json',ip='198.19.6.93';
const widths=process.env.UI_QA_WIDTHS?.split(',').map(Number),only=process.env.UI_QA_ONLY?.split(',');
const configs=[{width:360,height:800,safeTop:0,safeBottom:0},{width:390,height:844,safeTop:59,safeBottom:34},{width:430,height:932,safeTop:59,safeBottom:34}].filter(config=>(!process.env.UI_QA_FOCUSED||config.width===390)&&(!widths||widths.includes(config.width)));
const report:{at:string;environment:string;samples:unknown[];findings:unknown[];errors:string[];httpErrors:unknown[];reachability:unknown[];flows:unknown[];network:unknown[];prepared?:unknown;passed?:boolean;failure?:string}={at:new Date().toISOString(),environment:'Real local Worker/D1 and Chrome. Separate private QA guest, approved action logs, no native user/session access. Safe areas are CSS emulation.',samples:[],findings:[],errors:[],httpErrors:[],reachability:[],flows:[],network:[]};
await mkdir(out+'/screenshots',{recursive:true});await mkdir(out+'/backgrounds',{recursive:true});
let account:AuthResponse|undefined;
const uid=()=>crypto.randomUUID();
async function call<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const response=await fetch(api+path,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':ip,...(account?{Authorization:'Bearer '+account.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await response.json() as {data:T;error?:{code:string;message:string}};
 if(!response.ok)throw new Error(method+' '+path+' '+response.status+' '+json.error?.code+' '+json.error?.message);
 return json.data;
}
async function save(){await writeFile(privateFile,JSON.stringify(account),{mode:0o600});}
try{account=JSON.parse(await readFile(privateFile,'utf8')) as AuthResponse;try{await call('/me');}catch{account=await call<AuthResponse>('/auth/refresh',{refreshToken:account.refreshToken});await save();}}
catch{account=undefined;account=await call<AuthResponse>('/auth/guest',{});await save();}
const solutions=JSON.parse(await readFile('packages/content/src/solutions.json','utf8')) as Record<string,{actions:Action[]}>;
let state=await call<StateResponse>('/me');
if(state.activeRun)await call('/runs/'+state.activeRun.id+'/abandon',{key:uid()});
while(state.player.level<13){if(state.player.level>=5&&state.player.freeClaimAt<=Date.now())await call('/hearts/free',{key:uid()});const {run}=await call<{run:Run}>('/runs/start',{key:uid(),preBoosters:[]});const result=await call<{run:Run}>('/runs/'+run.id+'/actions',{key:uid(),sequence:run.sequence,actions:solutions[String(run.level.id)]!.actions});assert.equal(result.run.state.status,'won');await call('/runs/'+run.id+'/finish',{key:uid()});state=await call<StateResponse>('/me');}
await call('/me',{key:uid(),nickname:'여섯째 검수 정원사'},'PATCH');
state=await call<StateResponse>('/me');
const catalog=await call<{restorations:Array<{id:string;area:string;cost:number}>}>('/catalog');
for(const task of catalog.restorations.filter(task=>task.area==='sky'))if(!state.player.restored.includes(task.id)){await call('/garden/restore',{key:uid(),taskId:task.id});state=await call<StateResponse>('/me');}
report.prepared={level:state.player.level,restored:state.player.restored.length,preparation:'Dedicated guest, approved wins and normal star-priced sky restorations; no direct D1 edits or injected economy.'};
if(state.player.unlimitedUntil<=Date.now()&&state.player.hearts===0)await call('/local/hearts/refill',{key:uid()});

const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',extraHTTPHeaders:{'CF-Connecting-IP':ip}});
await context.addInitScript("globalThis.__name=(target,name)=>Object.defineProperty(target,'name',{value:name,configurable:true});");
await context.addInitScript(tokens=>localStorage.setItem('cloud-garden-session-v1',JSON.stringify(tokens)),{accessToken:account!.accessToken,refreshToken:account!.refreshToken});
const page:Page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',response=>{const url=new URL(response.url());if(url.origin===origin&&response.status()>=400)report.httpErrors.push({path:url.pathname,status:response.status()});});
const mutations:Array<{path:string;method:string}>=[];
page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/')&&['POST','PATCH','DELETE'].includes(request.method()))mutations.push({path:url.pathname,method:request.method()});});
const snapshot=(player:Player)=>({hearts:player.hearts,heartAt:player.heartAt,unlimitedUntil:player.unlimitedUntil,coins:player.coins,boundCoins:player.boundCoins,stars:player.stars,level:player.level,inventory:player.inventory,restored:player.restored});
async function settle(){await page.waitForFunction(()=>document.fonts.status==='loaded'&&[...document.images].filter(i=>i.getBoundingClientRect().width>0).every(i=>i.complete&&i.naturalWidth>0));await page.waitForTimeout(220);}
async function installAudit(){const ranked=await call<{entries:Array<{name:string}>}>('/rankings?scope=players');await page.evaluate(async({masks,names})=>{const path='/src/frame-layout.ts',helper=await import(path);Object.assign(window,{__uiQaMasks:masks,__uiQaDynamic:names,__uiQaFrameScale:helper.frameScale,__uiQaFrameBleed:helper.frameBleed});},{masks:await loadMasks(),names:[state.player.nickname,'여섯째 검수 정원사',...ranked.entries.map(entry=>entry.name)]});}
async function home(){await page.locator('.home-hub').waitFor({timeout:60000});await page.locator('.hub-main-actions').waitFor();await settle();}
async function close(){const dialog=page.getByRole('dialog');if(await dialog.count())await dialog.last().getByRole('button',{name:'닫기',exact:true}).click();await settle();}
async function openMenu(name:string){await close();await page.getByRole('button',{name,exact:true}).first().click();await page.getByRole('dialog').waitFor();await settle();}
async function startModal(){await close();await page.locator('.hub-main-actions>.hub-play').click();await page.getByRole('dialog').waitFor();await settle();}
async function capture(stateName:string,config:typeof configs[number],position='static',groups=true){
 await settle();const file=stateName+'-'+position+'-'+config.width+'-safe'+config.safeTop+'.png';
 const geometry=await scanGeometry(page,config.safeTop,config.safeBottom),grouping=await inspectGrouping(page,groups),contrast=await captureContrast(page,out+'/screenshots/'+file,out+'/backgrounds/'+file);
 const findings=[...geometry.findings,...grouping.findings,...contrast.failures];
 report.samples.push({state:stateName,position,...config,file,geometry,grouping,contrast});
 if(findings.length){report.findings.push({state:stateName,position,...config,file,findings});await writeFile(out+'/latest-findings.json',JSON.stringify({state:stateName,position,...config,file,findings},null,2));}
 await writeFile(out+'/progress.json',JSON.stringify({state:stateName,position,samples:report.samples.length,findingScreens:report.findings.length},null,2));
 console.log(stateName+' '+config.width+' '+position+': '+findings.length);
}
async function audit(name:string,setup:()=>Promise<void>,options:{groups?:boolean;bottom?:boolean}={}){
 if(only&&!only.includes(name))return;
 for(const config of configs){await page.setViewportSize(config);await page.evaluate(c=>{document.documentElement.style.setProperty('--safe-top',c.safeTop+'px');document.documentElement.style.setProperty('--safe-bottom',c.safeBottom+'px');},config);await setup();await settle();await capture(name,config,'top',options.groups??true);
  const viewport=page.locator('.modal-content').last();if(await viewport.count()){const maximum=await viewport.evaluate(el=>el.scrollHeight-el.clientHeight);if(maximum>30&&options.bottom!==false){await viewport.evaluate(el=>{el.scrollTop=el.scrollHeight;});await capture(name,config,'bottom',options.groups??true);const reach=await viewport.evaluate(el=>{const r=el.getBoundingClientRect(),items=[...el.querySelectorAll<HTMLElement>('button,p,small,input,textarea,select,summary')].filter(e=>e.checkVisibility()&&e.getClientRects().length&&e.getBoundingClientRect().height>0),last=items.at(-1);if(!last)return{reachable:true};const b=last.getBoundingClientRect();return{reachable:b.top>=r.top-.85&&b.bottom<=r.bottom+.85,text:last.innerText};});report.reachability.push({state:name,...config,...reach});if(!reach.reachable)report.findings.push({state:name,...config,findings:[{kind:'last-content-unreachable',...reach}]});}}
 }
}
try{
 await page.goto(origin);await home();await installAudit();
 if(!process.env.UI_QA_LAYOUT_ONLY){
 // Home -> start -> cancel must not begin a run or consume anything.
 const beforeHome=await call<StateResponse>('/me');mutations.length=0;await startModal();await close();await home();const afterHome=await call<StateResponse>('/me');assert.deepEqual(snapshot(afterHome.player),snapshot(beforeHome.player));assert.equal(afterHome.activeRun,null);assert(!mutations.some(m=>m.path==='/api/runs/start'));report.flows.push({name:'home-start-cancel',homeVisible:true,newRunRequests:0,economyUnchanged:true});
 // Use the real App start and finish path, with an approved server-validated win log.
 await startModal();await page.getByRole('button',{name:'플레이',exact:true}).click();await page.locator('.board').waitFor();let active=(await call<StateResponse>('/me')).activeRun;assert(active);for(let n=0;n<8;n++){const lesson=page.getByRole('button',{name:'좋아요!',exact:true});if(!await lesson.count())break;await lesson.last().click();await settle();}assert(!(await page.locator('.level-ribbon').allTextContents()).join(' ').match(/도전 레벨|어려운 레벨|구름정원/));assert.equal((await page.locator('.level-ribbon').innerText()).trim(),'레벨 '+active.level.id);await audit('play',async()=>{await settle();},{groups:false,bottom:false});const won=await call<{run:Run}>('/runs/'+active.id+'/actions',{key:uid(),sequence:active.sequence,actions:solutions[String(active.level.id)]!.actions});assert.equal(won.run.state.status,'won');await page.reload();await page.getByRole('button',{name:/^다음 (레벨|단계)$/}).waitFor({timeout:60000});
 const afterWin=await call<StateResponse>('/me');mutations.length=0;await page.getByRole('button',{name:/^다음 (레벨|단계)$/}).click();await page.getByRole('dialog').waitFor();assert((await page.getByRole('dialog').getAttribute('aria-label'))?.includes(String(afterWin.player.level)));await close();await home();const afterCancel=await call<StateResponse>('/me');assert.deepEqual(snapshot(afterCancel.player),snapshot(afterWin.player));assert.equal(afterCancel.activeRun,null);assert(!mutations.some(m=>m.path==='/api/runs/start'));assert.equal(await page.locator('.game-shell.playing').count(),0);report.flows.push({name:'win-next-start-cancel',homeVisible:true,newRunRequests:0,economyUnchanged:true,finishedLevel:active.level.id});await installAudit();
 await openMenu('내 프로필');for(const name of ['효과음','배경 음악','배경음악','진동'])assert.equal(await page.getByRole('switch',{name,exact:true}).count(),0);assert.equal(await page.getByRole('switch').count(),0);report.flows.push({name:'profile-has-no-play-preferences',switches:0});
 await openMenu('설정');const beforeSound=(await call<StateResponse>('/me')).player.settings.sound,toggle=page.getByRole('switch',{name:'효과음',exact:true});assert.equal(await toggle.count(),1);await toggle.click();await page.waitForFunction(expected=>document.querySelector('[role="switch"][aria-label="효과음"]')?.getAttribute('aria-checked')===String(expected),!beforeSound);assert.equal((await call<StateResponse>('/me')).player.settings.sound,!beforeSound);await toggle.click();await page.waitForFunction(expected=>document.querySelector('[role="switch"][aria-label="효과음"]')?.getAttribute('aria-checked')===String(expected),beforeSound);assert.equal((await call<StateResponse>('/me')).player.settings.sound,beforeSound);report.flows.push({name:'settings-sound-toggle',actualApiPersisted:true,restored:true});
 }
 await audit('home',async()=>{await close();await home();},{groups:false,bottom:false});
 await audit('start',startModal);
 await audit('profile',()=>openMenu('내 프로필'));
 await audit('settings',()=>openMenu('설정'));
 await audit('settings-expanded',async()=>{await openMenu('설정');const details=page.locator('details');for(const item of await details.all())if(!await item.evaluate(el=>(el as HTMLDetailsElement).open))await item.locator('summary').click();});
 await audit('hearts',()=>openMenu('하트 충전'));
 await audit('shop',()=>openMenu('상점'));
 await audit('offers',()=>openMenu('특별 패키지'));
 await audit('events',()=>openMenu('정원 활동 보상'));
 await audit('gifts',()=>openMenu('선물함'));
 await audit('pass',()=>openMenu('패스'));
 await audit('ranking',()=>openMenu('순위'));
 await close();await home();report.network=mutations.map(m=>({...m,path:m.path.replace(/\/runs\/[^/]+/,'/runs/:runId')}));
 report.passed=report.findings.length===0&&report.errors.length===0&&report.httpErrors.length===0;if(!report.passed)process.exitCode=1;
}catch(error){report.failure=error instanceof Error?error.stack:String(error);report.passed=false;process.exitCode=1;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(report.failure);}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({passed:report.passed,samples:report.samples.length,findingScreens:report.findings.length,errors:report.errors,httpErrors:report.httpErrors,flows:report.flows}));}

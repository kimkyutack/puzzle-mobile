import { chromium, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { applyAction, legalActions, stateHash } from '@garden/core';
import type { Action, Run, StateResponse } from '@garden/contracts';
const ORIGIN='http://127.0.0.1:5173',API='http://127.0.0.1:8787';
const evidenceRoot='output/verification/visual-v2';
const out=evidenceRoot+'/screenshots';await mkdir(out,{recursive:true});
const solutions=JSON.parse(await readFile('packages/content/src/solutions.json','utf8')) as Record<string,{actions:Action[]}>;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
let page:Page=await context.newPage();let accessToken='';let expectedNetworkFault=false;
const report:{checks:Record<string,unknown>;screenshots:unknown[];errors:string[];expectedNetworkErrors:string[];httpErrors:unknown[];failure?:string}={checks:{},screenshots:[],errors:[],expectedNetworkErrors:[],httpErrors:[]};
function bind(p:Page){p.on('pageerror',e=>report.errors.push(e.stack||e.message));p.on('console',m=>{if(m.type()==='error'){const text=m.text().slice(0,400)+' @ '+m.location().url;if(expectedNetworkFault&&/Failed to fetch|ERR_|Failed to load resource/.test(text))report.expectedNetworkErrors.push(text);else report.errors.push(text);}});p.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===ORIGIN)report.httpErrors.push({status:r.status(),path:new URL(r.url()).pathname});});}
async function open(){if(page.isClosed())page=await context.newPage();bind(page);await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});await page.locator('.game-shell').waitFor({timeout:45000});}
function check(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(message);}
async function api<T>(path:string,body?:unknown):Promise<T>{const r=await context.request.fetch(API+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},...(body===undefined?{}:{data:body})});const j=await r.json();if(!r.ok())throw new Error(`API ${path}: ${r.status()} ${j.error?.code}`);return j.data as T;}
async function state(){return api<StateResponse>('/me');}
async function dismissDiscovery(){for(let i=0;i<4;i++){const okay=page.getByRole('button',{name:'좋아요!',exact:true});if(await okay.count()){await okay.last().click();await page.waitForTimeout(100);}else break;}}
async function boardSnapshot(){return page.evaluate(()=>{const board=document.querySelector<HTMLElement>('.board'),tools=[...document.querySelectorAll<HTMLButtonElement>('.booster-toolbar > button')];return {phase:board?.dataset.inputPhase??null,activeEffects:Number(board?.dataset.activeEffects??0),toolbarCount:tools.length,enabled:tools.filter(button=>!button.disabled).length,dialogs:[...document.querySelectorAll('[role=dialog]')].map(dialog=>dialog.getAttribute('aria-label'))};});}
async function waitBoardReady(){
 const deadline=Date.now()+20000;
 while(Date.now()<deadline){
  await dismissDiscovery();const state=await boardSnapshot();
  if(state.phase==='idle'&&state.activeEffects===0&&state.toolbarCount===4&&state.enabled===4&&state.dialogs.length===0){
   // A late discovery effect may open immediately after the animation unlock render.
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   const stable=await boardSnapshot();if(stable.phase==='idle'&&stable.activeEffects===0&&stable.toolbarCount===4&&stable.enabled===4&&stable.dialogs.length===0)return;
  }
  await page.waitForTimeout(60);
 }
 throw new Error('Board input did not become ready: '+JSON.stringify(await boardSnapshot()));
}
async function waitBoardSettled(){await page.locator('.board[data-input-phase="idle"][data-active-effects="0"]').waitFor({timeout:20000});}
const capturedEffects=new Set<string>();
const effectScreenshots:string[]=[];
const effectSamples:Array<{file:string;families:string[];activeEffects:number;phase:string|null}>=[];
const sizes=[{width:360,height:800},{width:390,height:844},{width:430,height:932},{width:768,height:1024}];
async function shots(label:string,all=true){await dismissDiscovery();for(const size of all?sizes:[sizes[1]!]){await page.setViewportSize(size);await page.waitForTimeout(360);const name=`${label}-${size.width}x${size.height}.png`;await page.screenshot({path:`${out}/${name}`});const geometry=await page.evaluate(()=>{const b=document.querySelector('.board')?.getBoundingClientRect();return {scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth,board:b?{x:b.x,y:b.y,width:b.width,height:b.height}:null,brokenImages:[...document.images].filter(i=>!i.getAttribute('src')||!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')?.slice(0,50)||'<empty>')}});report.screenshots.push({file:name,...size,...geometry});check(geometry.scrollWidth<=size.width+1,`Horizontal overflow on ${name}`);check(geometry.brokenImages.length===0,`Broken images on ${name}`);}await page.setViewportSize(sizes[1]!);await page.waitForTimeout(350);}
async function pointer(action:Action,width=7){await waitBoardReady();const board=page.locator('.board');const b=await board.boundingBox();check(b,'Board has no geometry');const cell=b.width/width,point=(at:number)=>({x:b.x+(at%width+.5)*cell,y:b.y+(Math.floor(at/width)+.5)*cell});if(action.type==='swap'){const a=point(action.from),z=point(action.to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(z.x,z.y,{steps:8});await page.mouse.up();}else if(action.type==='tap'){const a=point(action.at);await page.mouse.click(a.x,a.y);}else throw new Error('Only actual board tap/swap allowed in pointer test');}
async function pointerAndConfirm(run:Run,action:Action){
 const local=applyAction(run.state,action);check(local.accepted,'Fixture action rejected');
 const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/runs/${run.id}/actions`&&r.request().method()==='POST',{timeout:20000});
 await pointer(action,run.state.width);
 if(run.level.id<=5){
  const families=['wind','bomb','glider','rainbow'].filter(kind=>!capturedEffects.has(kind)&&local.events.some(e=>e.type==='special'&&e.kind?.includes(kind)));
  if(families.length){await page.locator('.board[data-input-phase="settling"]').waitFor({timeout:5000});await page.waitForFunction(()=>Number(document.querySelector<HTMLElement>('.board')?.dataset.activeEffects)>0,{},{timeout:5000});await page.waitForTimeout(200);const sample=await boardSnapshot();check(sample.activeEffects>0&&sample.activeEffects<=180,'Effect pool was not active/bounded during VFX capture');const name=`gameplay-vfx-${families.join('-')}.png`;await page.screenshot({path:`${out}/${name}`});effectScreenshots.push(name);effectSamples.push({file:name,families,activeEffects:sample.activeEffects,phase:sample.phase});for(const kind of families)capturedEffects.add(kind);}
 }
 const r=await response;const data=await r.json();check(r.ok(),`Board action failed: ${data.error?.code}`);const next=data.data.run as Run;
 check(next.sequence===run.sequence+1,'Pointer input did not increment server sequence once');check(stateHash(local.state)===stateHash(next.state),'Client/server engine state mismatch after pointer');
 if(next.state.status==='playing')await waitBoardReady();else await waitBoardSettled();return next;
}
async function waitClear(level:number){await dismissDiscovery();await page.getByRole('dialog',{name:'정원이 활짝 피었어요!',exact:true}).waitFor({timeout:20000});await dismissDiscovery();const me=await state();check(me.player.level===level+1,`Progress not settled for ${level}`);check(me.player.stars===level,`First-clear star mismatch for ${level}`);return me;}
async function nextLevel(){
 await page.getByRole('dialog',{name:'정원이 활짝 피었어요!'}).getByRole('button',{name:'다음 레벨',exact:true}).click();
 await page.getByRole('button',{name:'플레이',exact:true}).click();
 await waitBoardReady();
 const me=await state();check(me.activeRun,'No active run after start');return me.activeRun;
}
async function closeModal(){await page.getByRole('dialog').last().getByRole('button',{name:'닫기',exact:true}).click();await page.waitForTimeout(200);}
try{
 await open();await page.locator('.board canvas').waitFor({timeout:30000});await waitBoardReady();accessToken=await page.evaluate(()=>JSON.parse(localStorage.getItem('cloud-garden-session-v1')!).accessToken);let me=await state();check(me.player.level===1&&me.player.hearts===4&&me.activeRun,'Guest did not start first run with one heart');let run=me.activeRun;report.checks.guest={level:1,hearts:4,noLoginRequired:true};report.checks.inputReadiness={boardPhase:'idle',toolbar:'all four controls enabled',fixedAnimationDelay:false};
 await shots('gameplay-first-play');
 // Actual server commits the pointer action, but the network drops its response.
 expectedNetworkFault=true;let intercepted:Run|undefined;let lostResponseSettled:()=>void=()=>{};const lostResponse=new Promise<void>(resolve=>{lostResponseSettled=resolve;});
 await page.route('**/api/runs/*/actions',async route=>{const response=await route.fetch();const json=await response.json();check(response.ok(),'Injected lost response did not commit');intercepted=json.data.run;await route.abort('failed');lostResponseSettled();},{times:1});
 await pointer(solutions['1']!.actions[0]!,run.state.width);await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('cloud-garden-run-')&&JSON.parse(localStorage.getItem(k)!).batch),{},{timeout:10000});await Promise.race([lostResponse,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Lost-response fixture did not commit')),10000))]);check(intercepted?.sequence===1,'Lost-response action was not committed on server');await page.reload({waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:30000});await page.waitForFunction(()=>Object.keys(localStorage).filter(k=>k.startsWith('cloud-garden-run-')&&!k.endsWith('-conflict')).every(k=>JSON.parse(localStorage.getItem(k)!).queue.length===0),{},{timeout:20000});expectedNetworkFault=false;me=await state();check(me.activeRun?.sequence===1&&me.player.hearts===4,'Lost-response reload duplicated a move or heart');run=me.activeRun;report.checks.lostResponse={sequence:1,hearts:4,recovered:true};
 for(const action of solutions['1']!.actions.slice(1))run=await pointerAndConfirm(run,action);await waitClear(1);await shots('gameplay-win');
 await page.getByRole('dialog',{name:'정원이 활짝 피었어요!'}).getByRole('button',{name:'다음 레벨',exact:true}).click();await shots('gameplay-start');await page.getByRole('button',{name:'플레이',exact:true}).click();await waitBoardReady();run=(await state()).activeRun!;
 // Save an actual offline move, close the page, then recover and submit its log after reopening.
 expectedNetworkFault=true;await context.setOffline(true);await pointer(solutions['2']!.actions[0]!,run.state.width);await page.waitForFunction(()=>Object.keys(localStorage).filter(k=>k.startsWith('cloud-garden-run-')&&!k.endsWith('-conflict')).some(k=>JSON.parse(localStorage.getItem(k)!).queue.length===1),{},{timeout:10000});await waitBoardReady();const queued=await page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('cloud-garden-run-')&&!k.endsWith('-conflict'))!;return JSON.parse(localStorage.getItem(k)!)});check(queued.queue.length===1,'Offline action was not stored');await page.screenshot({path:`${out}/gameplay-offline.png`});await page.close();await context.setOffline(false);await open();await page.locator('.board canvas').waitFor({timeout:30000});await page.waitForFunction(()=>Object.keys(localStorage).filter(k=>k.startsWith('cloud-garden-run-')&&!k.endsWith('-conflict')).every(k=>JSON.parse(localStorage.getItem(k)!).queue.length===0),{},{timeout:20000});expectedNetworkFault=false;me=await state();check(me.activeRun?.sequence===1&&me.player.hearts===3,'Offline reload did not resume exactly once');run=me.activeRun;report.checks.offlineQueue={queued:1,recoveredSequence:1,hearts:3};
 for(const action of solutions['2']!.actions.slice(1))run=await pointerAndConfirm(run,action);await waitClear(2);
 for(let id=3;id<=5;id++){run=await nextLevel();check(run.level.id===id,'Wrong next level');for(const action of solutions[id]!.actions)run=await pointerAndConfirm(run,action);await waitClear(id);console.log(`Pointer-cleared level ${id}`);}
 report.checks.firstFive={actualPointerPlay:true,completed:5,hearts:(await state()).player.hearts,stars:(await state()).player.stars};
 report.checks.visualEffects={observed:[...capturedEffects],midAnimationScreenshots:effectScreenshots,samples:effectSamples,effectPoolEmptyBeforeNextInput:true};check(capturedEffects.size===4,'First five did not exercise all four special VFX families');
 await page.getByRole('dialog',{name:'정원이 활짝 피었어요!'}).getByRole('button',{name:'정원으로',exact:true}).click();await shots('gameplay-home');
 await page.locator('.home-hud .currency').nth(1).click();await shots('gameplay-hearts');const freeResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/hearts/free'&&response.request().method()==='POST');await page.getByRole('button',{name:'무료 30분 무제한 받기',exact:true}).click();check((await freeResponse).ok(),'Free unlimited request rejected');me=await state();check(me.player.unlimitedUntil>Date.now()&&me.player.hearts===0,'Free unlimited incorrectly consumed heart or failed');report.checks.freeUnlimited={receivedWithoutAd:true,hearts:me.player.hearts};await closeModal();
 await page.getByRole('button',{name:'상점',exact:true}).click();await shots('gameplay-shop');await closeModal();
 await page.getByRole('button',{name:'길드',exact:true}).click();await shots('gameplay-guild');await closeModal();
 await page.locator('.restoration-link').click();const restoreResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/garden/restore'&&response.request().method()==='POST');await page.getByRole('button',{name:'별 1개',exact:true}).first().click();check((await restoreResponse).ok(),'Garden restoration request rejected');me=await state();check(me.player.restored.includes('sky-path')&&me.player.stars===4,'Garden restoration was not committed');report.checks.restoration={task:'sky-path',stars:4};await closeModal();await shots('gameplay-restored-home',false);
 // Reach a level with a certified losing legal trajectory through real APIs, never debug/progress mutation.
 for(const id of [6,7]){const start=await api<{run:Run}>('/runs/start',{key:crypto.randomUUID(),preBoosters:[]});check(start.run.level.id===id,'API progress seed level mismatch');await api(`/runs/${start.run.id}/actions`,{key:crypto.randomUUID(),sequence:0,actions:solutions[id]!.actions});await api(`/runs/${start.run.id}/finish`,{key:crypto.randomUUID()});}
 const eighth=await api<{run:Run}>('/runs/start',{key:crypto.randomUUID(),preBoosters:[]});run=eighth.run;check(run.level.id===8,'Did not reach real level 8');await page.reload({waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:30000});await waitBoardReady();
 while(run.state.status==='playing'){const options=legalActions(run.state).map(a=>({a,result:applyAction(run.state,a)})).sort((a,b)=>b.result.state.goals.reduce((sum,g)=>sum+g.remaining,0)-a.result.state.goals.reduce((sum,g)=>sum+g.remaining,0)||a.result.events.filter(e=>e.type==='remove').length-b.result.events.filter(e=>e.type==='remove').length);check(options.length,'No legal move in fail trajectory');run=await pointerAndConfirm(run,options[0]!.a);}
 check(run.state.status==='lost','Fail trajectory unexpectedly won');report.checks.failureFlow={level:8,moves:run.state.moves,sequence:run.sequence,source:'actual legal pointer actions'};await page.getByRole('dialog',{name:'조금만 더 가꿔볼까요?'}).waitFor();await shots('gameplay-fail');const beforeContinue=await state();const continuedResponse=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/runs/${run.id}/continue`&&response.request().method()==='POST');await page.getByRole('button',{name:'계속 플레이 · 300 코인',exact:true}).click();check((await continuedResponse).ok(),'Continue request rejected');await waitBoardReady();const continued=await state();check(continued.activeRun?.continues===1&&continued.activeRun.state.moves===5,'Continue did not add exactly five moves');check(beforeContinue.player.coins-continued.player.coins===300&&continued.player.hearts===beforeContinue.player.hearts,'Continue price/heart mutation wrong');report.checks.continue={moves:5,coinsSpent:300,heartDifference:0};await shots('gameplay-continued',false);
 check(report.errors.length===0,`Browser errors: ${report.errors.join(' | ')}`);check(report.httpErrors.length===0,`Unexpected HTTP errors: ${JSON.stringify(report.httpErrors)}`);console.log(JSON.stringify({checks:report.checks,screenshots:report.screenshots.length,errors:report.errors,httpErrors:report.httpErrors},null,2));
}catch(error){report.failure=error instanceof Error?error.stack:String(error);console.error(report.failure);if(page!&&!page.isClosed())await page.screenshot({path:`${out}/gameplay-failure-debug.png`}).catch(()=>{});process.exitCode=1;}
finally{await writeFile(evidenceRoot+'/browser-gameplay.json',JSON.stringify(report,null,2));await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import type {AuthResponse,StateResponse} from '@garden/contracts';
import {loadMasks,scanGeometry} from './ui-audit/geometry';
import {captureContrast} from './ui-audit/contrast';
import {inspectGrouping} from './ui-audit/grouping';

// A rendered compatibility-path check. This reuses only our private v6 QA guest.
const origin='http://127.0.0.1:5173',out=process.env.UI_QA_OUT||'output/verification/ui-v6/raster-113';
const tokens=JSON.parse(await readFile('.wrangler/ui-v6-session.json','utf8')) as AuthResponse;
const state=await fetch('http://127.0.0.1:8787/api/me',{headers:{Authorization:'Bearer '+tokens.accessToken,'CF-Connecting-IP':'198.19.6.93'}}).then(async response=>{assert(response.ok);return (await response.json() as {data:StateResponse}).data;});
const report:{at:string;environment:string;samples:unknown[];flows:unknown[];findings:unknown[];errors:string[];httpErrors:unknown[];passed?:boolean;failure?:string}={at:new Date().toISOString(),environment:'Chrome with Android Chrome113 user agent selecting real RasterSurface compatibility renderer; real local API, private QA guest; 390x844 CSS safe-area59/34. This is not a physical Android113 result.',samples:[],flows:[],findings:[],errors:[],httpErrors:[]};
await mkdir(out+'/screenshots',{recursive:true});await mkdir(out+'/backgrounds',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.5672.162 Mobile Safari/537.36',extraHTTPHeaders:{'CF-Connecting-IP':'198.19.6.93'}});
await context.addInitScript('globalThis.__name=(target,name)=>Object.defineProperty(target,\'name\',{value:name,configurable:true});');
await context.addInitScript(value=>localStorage.setItem('cloud-garden-session-v1',JSON.stringify(value)),{accessToken:tokens.accessToken,refreshToken:tokens.refreshToken});
const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));page.on('response',response=>{const url=new URL(response.url());if(url.origin===origin&&response.status()>=400)report.httpErrors.push({path:url.pathname,status:response.status()});});
async function settle(){await page.waitForFunction(()=>document.fonts.status==='loaded'&&[...document.images].filter(image=>image.getBoundingClientRect().width>0).every(image=>image.complete&&image.naturalWidth>0));await page.waitForTimeout(350);}
async function capture(name:string){await settle();const file=name+'.png',geometry=await scanGeometry(page,59,34),grouping=await inspectGrouping(page,true),contrast=await captureContrast(page,out+'/screenshots/'+file,out+'/backgrounds/'+file);const findings=[...geometry.findings,...grouping.findings,...contrast.failures];report.samples.push({state:name,file,geometry,grouping,contrast});if(findings.length)report.findings.push({state:name,file,findings});console.log(name+': '+findings.length);}
try{
 await page.goto(origin);await page.locator('.home-hub').waitFor({timeout:60000});await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-top','59px');document.documentElement.style.setProperty('--safe-bottom','34px');});await settle();
 await page.evaluate(async({masks,names})=>{const path='/src/frame-layout.ts',helper=await import(path);Object.assign(window,{__uiQaMasks:masks,__uiQaDynamic:names,__uiQaFrameScale:helper.frameScale,__uiQaFrameBleed:helper.frameBleed});},{masks:await loadMasks(),names:[state.player.nickname]});
 assert.equal(await page.locator('.game-shell>.art-surface[data-renderer="raster-compat"]').count(),1);
 for(const [name,label] of [['settings','설정'],['hearts','하트 충전']] as const){
  await page.getByRole('button',{name:label,exact:true}).first().click();const dialog=page.getByRole('dialog');await dialog.waitFor();await settle();const renderer=dialog.locator(':scope > .art-surface');assert.equal(await renderer.getAttribute('data-renderer'),'raster-compat');const count=()=>renderer.locator(':scope > div > div').count();const before=await count();await capture(name+'-collapsed-before');
  const disclosures=await dialog.locator('details').all();assert(disclosures.length>0);for(const item of disclosures)if(!await item.evaluate(element=>(element as HTMLDetailsElement).open))await item.locator('summary').click();await settle();const expanded=await count();assert(expanded>before);await capture(name+'-expanded-top');const scroll=dialog.locator('.modal-content');if(await scroll.evaluate(element=>element.scrollHeight-element.clientHeight>30)){await scroll.evaluate(element=>{element.scrollTop=element.scrollHeight;});await capture(name+'-expanded-bottom');}
  for(const item of [...disclosures].reverse())if(await item.evaluate(element=>(element as HTMLDetailsElement).open))await item.locator('summary').click();await scroll.evaluate(element=>{element.scrollTop=0;});await settle();const after=await count();assert.equal(after,before);await capture(name+'-collapsed-after');report.flows.push({name:name+'-disclosure-roundtrip',renderer:'raster-compat',framesBefore:before,framesExpanded:expanded,framesAfter:after,closedFrameCountRestored:true});await dialog.getByRole('button',{name:'닫기',exact:true}).click();await settle();
 }
 report.passed=report.findings.length===0&&report.errors.length===0&&report.httpErrors.length===0;if(!report.passed)process.exitCode=1;
}catch(error){report.failure=error instanceof Error?error.stack:String(error);report.passed=false;process.exitCode=1;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(report.failure);}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({passed:report.passed,samples:report.samples.length,findingScreens:report.findings.length,errors:report.errors,httpErrors:report.httpErrors,flows:report.flows}));}

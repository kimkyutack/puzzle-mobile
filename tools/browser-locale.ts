import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import type {StateResponse} from '@garden/contracts';

const origin='http://127.0.0.1:5173';
const report:{checks:Record<string,unknown>;errors:string[];screenshots:string[];failure?:string}={checks:{},errors:[],screenshots:[]};
await mkdir('output/verification/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text().slice(0,350));});
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
async function state():Promise<StateResponse>{const result=await page.evaluate(async()=>{const token=JSON.parse(localStorage.getItem('cloud-garden-session-v1')!).accessToken;const response=await fetch('/api/me',{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('State read failed');return(await response.json() as {data:StateResponse}).data;});return result;}
async function capture(name:string){await page.screenshot({path:`output/verification/screenshots/${name}.png`});report.screenshots.push(`${name}.png`);const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>!i.getAttribute('src')||!i.complete||!i.naturalWidth).length}));check(!geometry.overflow&&!geometry.broken,`Layout/image failure: ${name}`);}
try{
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'한국어',exact:true}).waitFor();check(await page.locator('.brand-logo').isVisible(),'Localized title image missing');await page.getByRole('button',{name:'한국어',exact:true}).click();await page.locator('.board canvas').waitFor({timeout:45000});await page.waitForTimeout(500);
 const before=await state();check(before.player.settings.language==='ko'&&before.activeRun,'Fresh guest did not start Korean first run');
 await page.getByRole('button',{name:'정원으로',exact:true}).click();await page.getByRole('button',{name:'설정',exact:true}).click();
 await page.getByRole('combobox',{name:'언어',exact:true}).selectOption('en');await page.getByRole('dialog',{name:'Settings',exact:true}).waitFor();await page.getByRole('combobox',{name:'Language',exact:true}).waitFor();
 check(await page.locator('html').getAttribute('lang')==='en','HTML lang was not updated');
 check(await page.title()==="Cloud Garden: Lumi's Invitation",'Localized document title missing');
 for(const size of [{width:360,height:800},{width:390,height:844},{width:768,height:1024}]){await page.setViewportSize(size);await page.waitForTimeout(250);await capture(`locale-settings-en-${size.width}x${size.height}`);}
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.board canvas').waitFor({timeout:45000});await page.getByText('Goals',{exact:true}).waitFor();await page.getByText('Moves',{exact:true}).waitFor();await page.getByText('Level 1',{exact:true}).waitFor();
 const after=await state();check(after.player.settings.language==='en','Saved language did not persist');check(after.activeRun?.id===before.activeRun.id&&after.activeRun?.sequence===before.activeRun.sequence&&after.player.hearts===before.player.hearts,'Changing language altered the active run or hearts');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await capture('locale-hud-en-390x844');
 report.checks={firstLanguageGate:true,localizedTitleImage:true,serverPersistence:true,reload:true,documentLang:'en',englishHud:true,sameRun:true,heartDifference:0,sequenceDifference:0};
 check(report.errors.length===0,`Console errors: ${report.errors.join(' | ')}`);console.log(JSON.stringify(report.checks));
}catch(error){report.failure=error instanceof Error?error.stack:String(error);console.error(report.failure);process.exitCode=1;await page.screenshot({path:'output/verification/screenshots/locale-failure-debug.png'}).catch(()=>{});}
finally{await writeFile('output/verification/browser-locale.json',JSON.stringify(report,null,2));await browser.close();}

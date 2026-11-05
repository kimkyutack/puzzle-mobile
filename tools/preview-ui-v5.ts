import {chromium} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const out='output/verification/visual-v5-preview';await mkdir(out,{recursive:true});
const fixture=JSON.parse(await readFile('.wrangler/ui-v3-fixture.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ko-KR'});
await context.addInitScript(tokens=>localStorage.setItem('cloud-garden-session-v1',JSON.stringify(tokens)),{accessToken:fixture.viewer.accessToken,refreshToken:fixture.viewer.refreshToken});
const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5173');await page.locator('.home-actions').waitFor({timeout:45000});
 await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-top','59px');document.documentElement.style.setProperty('--safe-bottom','34px')});
 const snap=async(name:string)=>{await page.waitForTimeout(400);await page.screenshot({path:out+'/'+name+'.png'});};
 const close=async()=>{const modal=page.getByRole('dialog');if(await modal.count())await modal.getByRole('button',{name:'닫기',exact:true}).click();};
 await snap('home');
 await page.locator('.restoration-link').click();await snap('garden');
 await page.getByRole('button',{name:'정원 꾸미기 닫기',exact:true}).click();
 for(const [name,selector]of [['shop','.bottom-nav button[aria-label="상점"]'],['hearts','.home-hud .currency.hearts'],['events','.home-events button:first-child'],['pass','.home-events.right button:first-child'],['ranking','.bottom-nav button[aria-label="순위표"]'],['settings','.home-hud button[aria-label="설정"]']]as const){await close();await page.locator(selector).first().click();await page.getByRole('dialog').waitFor();await snap(name);}
 await close();await page.locator('.home-actions .play-button').click();await snap('start');
 await writeFile(out+'/errors.json',JSON.stringify({errors},null,2));
}finally{await browser.close()}

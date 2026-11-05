import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('output/verification/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
await page.goto('http://127.0.0.1:5173');await page.waitForSelector('.board canvas',{timeout:30000}).catch(e=>errors.push(e.message));await page.screenshot({path:'output/verification/screenshots/first-play-390.png'});
console.log(await page.locator('body').innerText());console.log({errors});await writeFile('output/verification/browser-smoke.json',JSON.stringify({errors},null,2));await browser.close();

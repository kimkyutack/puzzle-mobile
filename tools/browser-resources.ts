import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844}});const problems:unknown[]=[];
page.on('console',m=>{if(m.type()==='error')problems.push({text:m.text(),location:m.location()})});page.on('response',r=>{if(r.status()>=400)problems.push({status:r.status(),url:new URL(r.url()).origin+new URL(r.url()).pathname})});
await page.goto('http://127.0.0.1:5173');await page.locator('.board canvas').waitFor({timeout:40000});await page.waitForTimeout(1000);console.log(JSON.stringify(problems,null,2));await writeFile('output/verification/browser-resources.json',JSON.stringify(problems,null,2));await browser.close();

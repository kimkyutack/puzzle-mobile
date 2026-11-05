import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const out=process.env.GARDEN_TEST_UA?'output/verification/visual-v2/legacy-android':'output/verification/visual-v2';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,userAgent:process.env.GARDEN_TEST_UA||undefined});const page=await context.newPage();
const report:{errors:string[];layouts:unknown[];overlay?:unknown;failure?:string}={errors:[],layouts:[]};
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
// tsx's keepNames helper is used by the nested browser-only geometry callback.
await page.addInitScript('window.__name = (fn) => fn;');
const check=(ok:unknown,msg:string)=>{if(!ok)throw new Error(msg)};
const sizes=[{width:360,height:800,safeTop:0,safeBottom:0},{width:390,height:844,safeTop:0,safeBottom:0},{width:430,height:932,safeTop:0,safeBottom:0},{width:390,height:844,safeTop:59,safeBottom:34}];
async function layout(scene:string,size:typeof sizes[number]){
 await page.setViewportSize({width:size.width,height:size.height});await page.evaluate(({safeTop,safeBottom})=>{document.documentElement.style.setProperty('--safe-area-inset-top',safeTop+'px');document.documentElement.style.setProperty('--safe-area-inset-bottom',safeBottom+'px')},size);await page.waitForTimeout(400);
 const geometry=await page.evaluate(()=>{const rect=(selector:string)=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};return {viewport:{width:innerWidth,height:innerHeight},root:rect('.game-shell'),footer:rect('.bottom-nav')||rect('.play-footer'),board:rect('.board'),hud:rect('.play-hud'),font:getComputedStyle(document.body).fontFamily,loaded:document.fonts.check('16px Jua')&&document.fonts.check('16px "Lilita One"'),scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(i=>!i.src||!i.complete||!i.naturalWidth).map(i=>i.className)}});
 const name=`layout-${scene}-${size.width}x${size.height}${size.safeTop?'-safe':''}.png`;await page.screenshot({path:`${out}/${name}`});
 check(geometry.loaded,'Game fonts not decoded');check(!geometry.brokenImages.length,'Missing visible art');check(geometry.scrollWidth===size.width,'Horizontal page overflow');check(geometry.root?.height===size.height,'Root not viewport height');check(geometry.footer&&geometry.footer.bottom>=size.height,'Footer does not reach viewport edge');
 if(geometry.board){check(geometry.board.y>=geometry.hud!.bottom,'Board overlaps HUD');check(geometry.board.bottom<=geometry.footer!.y,'Board overlaps footer');}
 report.layouts.push({scene,...size,...geometry,screenshot:name});
}
try{
 await page.goto('http://127.0.0.1:5173');await page.locator('.board canvas').waitFor({timeout:60000});await page.getByRole('button',{name:'건너뛰기',exact:true}).click();
 for(const size of sizes)await layout('play',size);
 await page.getByRole('button',{name:'정원으로',exact:true}).click();for(const size of sizes)await layout('home',size);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','0px');document.documentElement.style.setProperty('--safe-area-inset-bottom','0px')});await page.waitForTimeout(300);
 const base=await page.screenshot();await page.getByRole('button',{name:'상점',exact:true}).click();await page.waitForTimeout(350);const over=await page.screenshot({path:`${out}/overlay-shop.png`});
 const a=await sharp(base).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(over).ensureAlpha().raw().toBuffer();const samples=[];
 for(const y of [180,330,480,630]){const at=(y*a.info.width+5)*4,before=[...a.data.subarray(at,at+3)],after=[...b.subarray(at,at+3)],expected=before.map((v,i)=>Math.round(v*.34+[8,16,44][i]!*.66));check(after.every((v,i)=>Math.abs(v-expected[i]!)<=4),'Modal replaced scene instead of alpha-dimming it');samples.push({x:5,y,before,after,expected});}
 report.overlay={sameSceneAlphaCompositing:true,samples};
 for(let i=0;i<6;i++){await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await page.locator('.play-button').click();await page.locator('.board canvas').waitFor();await page.waitForTimeout(150);await page.getByRole('button',{name:'정원으로',exact:true}).click();await page.getByRole('button',{name:'상점',exact:true}).click();}
 check(report.errors.length===0,report.errors.join('\n'));
 console.log(JSON.stringify({layouts:report.layouts.length,overlay:report.overlay,errors:report.errors}));
}catch(e){report.failure=e instanceof Error?e.stack:String(e);console.error(report.failure);process.exitCode=1;}finally{await writeFile(`${out}/browser-layout.json`,JSON.stringify(report,null,2));await browser.close();}

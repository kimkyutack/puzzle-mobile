import {chromium} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const out='output/verification/visual-v5-preview';await mkdir(out,{recursive:true});
const fixture=JSON.parse(await readFile('.wrangler/ui-v3-fixture.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 await context.addInitScript("globalThis.__name=(target,name)=>Object.defineProperty(target,'name',{value:name,configurable:true});");
 await context.addInitScript(tokens=>localStorage.setItem('cloud-garden-session-v1',JSON.stringify(tokens)),{accessToken:fixture.viewer.accessToken,refreshToken:fixture.viewer.refreshToken});
 const page=await context.newPage();await page.goto('http://127.0.0.1:5173');await page.locator('.home-actions').waitFor({timeout:45000});
 const source=await(await page.request.get('http://127.0.0.1:5173/src/main.tsx')).text(),react=source.match(/["']([^"']*deps\/react\.js[^"']*)["']/)![1]!,dom=source.match(/["']([^"']*deps\/react-dom_client\.js[^"']*)["']/)![1]!;
 await page.evaluate(async({react,dom})=>{const React=(await import(react)).default,client=await import(dom),path='/src/ui.tsx',{Modal,Poster,Button,Amount}=await import(path),host=document.createElement('div');host.style.cssText='position:absolute;inset:0;z-index:100';document.querySelector('.game-shell')!.appendChild(host);(client.createRoot||client.default.createRoot)(host).render(React.createElement(Modal,{title:'계속할까요?',theme:'result',onClose:()=>{}},React.createElement(Poster,{id:'poster_continue_v5',className:'continue-poster',label:'황금 시계'},React.createElement('span',{className:'extra-moves'},'+5')),React.createElement('p',{className:'continue-description'},'이동 5회를 더해서 정원을 완성해요.'),React.createElement(Button,{tone:'green'},'계속 플레이 ',React.createElement(Amount,{kind:'coin',value:300}))));},{react,dom});
 await page.waitForTimeout(500);await page.screenshot({path:out+'/continue-poster.png'});
}finally{await browser.close()}

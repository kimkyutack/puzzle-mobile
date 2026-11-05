import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import type {Action,Run} from '@garden/contracts';

// Real first-level inputs only; this supplements the broad gameplay report with an unobscured effect frame.
const solutions=JSON.parse(await readFile('packages/content/src/solutions.json','utf8')) as Record<string,{actions:Action[]}>;
const browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844}});
const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text().slice(0,300));});
let failure:string|undefined;
async function dismiss(){for(let i=0;i<5;i++){const okay=page.getByRole('button',{name:'좋아요!',exact:true});if(!await okay.count())break;await okay.last().click();await page.waitForTimeout(15);}}
try{
 await page.goto('http://127.0.0.1:5173');await page.locator('.board canvas').waitFor({timeout:45000});await page.waitForTimeout(400);
 for(const [index,action] of solutions['1']!.actions.entries()){
  await dismiss();const box=await page.locator('.board').boundingBox();if(!box)throw new Error('No board');const point=(cell:number)=>({x:box.x+(cell%7+.5)*box.width/7,y:box.y+(Math.floor(cell/7)+.5)*box.width/7});
  const committed=page.waitForResponse(response=>/\/api\/runs\/[^/]+\/actions$/.test(new URL(response.url()).pathname));
  if(action.type==='swap'){const from=point(action.from),to=point(action.to);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();}else if(action.type==='tap'){const at=point(action.at);await page.mouse.click(at.x,at.y);}else throw new Error('Non-board action');
  await page.waitForTimeout(80);await dismiss();
  if(index===1){if(await page.locator('.modal-layer').count())throw new Error('Effect frame was obscured');await page.screenshot({path:'output/verification/screenshots/gameplay-vfx-rainbow.png'});}
  const response=await committed;if(!response.ok())throw new Error('Real pointer action rejected');const data=await response.json() as {data:{run:Run}};if(data.data.run.sequence!==index+1)throw new Error('Input sequence mismatch');await page.waitForTimeout(1400);
 }
 if(errors.length)throw new Error(errors.join(' | '));
 console.log('Unobscured rainbow effect captured after real pointer input.');
}catch(error){failure=error instanceof Error?error.stack:String(error);console.error(failure);process.exitCode=1;}
finally{await writeFile('output/verification/browser-vfx.json',JSON.stringify({actualPointerInputs:true,syntheticGameState:false,frame:'gameplay-vfx-rainbow.png',errors,failure},null,2));await browser.close();}

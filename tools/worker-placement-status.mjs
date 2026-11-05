import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
// Reuse the already-authorized Wrangler session without printing or persisting it.
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const profile=await readFile(join(homedir(),'Library/Preferences/.wrangler/config/default.toml'),'utf8');
const token=profile.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
if(!token)throw Error('Use the existing Wrangler login profile before checking placement.');
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/services/${config.name}`,{headers:{Authorization:'Bearer '+token}});
const data=await response.json();if(!response.ok||!data.success)throw Error('Placement status request failed: HTTP '+response.status);
const placement=[];
function visit(value,path='result'){
 if(!value||typeof value!=='object')return;
 for(const [key,child] of Object.entries(value)){if(/placement/i.test(key))placement.push({path:path+'.'+key,value:child});else if(typeof child==='object')visit(child,path+'.'+key);}
}
visit(data.result);
const report={at:new Date().toISOString(),worker:config.name,configured:config.placement,placement};
await mkdir('output/verification',{recursive:true});await writeFile('output/verification/worker-placement-status.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

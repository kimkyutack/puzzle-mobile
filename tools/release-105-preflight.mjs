import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8')),deployment=JSON.parse(await readFile('config/deployment.json','utf8'));
const profile=await readFile(join(homedir(),'Library/Preferences/.wrangler/config/default.toml'),'utf8');
const token=profile.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];if(!token)throw Error('Existing Wrangler login required.');
async function cf(path){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/${path}`,{headers:{Authorization:'Bearer '+token}});const result=await response.json();if(!response.ok||!result.success)throw Error('Cloudflare metadata request failed: '+response.status);return result.result;}
const [settings,deployments,healthResponse]=await Promise.all([cf(`scripts/${config.name}/settings`),cf(`scripts/${config.name}/deployments`),fetch(deployment.apiUrl+'/health')]);
const health=await healthResponse.json(),remoteVars=Object.fromEntries(settings.bindings.filter(b=>b.type==='plain_text'&&b.name in config.vars).map(b=>[b.name,b.text]));
const report={at:new Date().toISOString(),worker:config.name,account:config.account_id,health,deployments,placement:settings.placement,observability:settings.observability,bindingTypes:settings.bindings.map(({name,type})=>({name,type})),configuredVarsDifferent:Object.keys(remoteVars).filter(name=>remoteVars[name]!==config.vars[name]),remoteExtraVarNames:settings.bindings.filter(b=>b.type==='plain_text'&&!(b.name in config.vars)).map(b=>b.name)};
await mkdir('output/verification/release-105-6',{recursive:true});await writeFile('output/verification/release-105-6/remote-preflight.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({worker:report.worker,account:report.account,health:report.health,configuredVarsDifferent:report.configuredVarsDifferent,remoteExtraVarNames:report.remoteExtraVarNames,bindings:report.bindingTypes,placement:report.placement}));

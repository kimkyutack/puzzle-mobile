import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {readAdMobConfig,syncNativeAdMob} from './admob-config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2];
if(!['local','release'].includes(mode))throw new Error('Usage: node tools/native-build.mjs local|release');
const testAds=process.argv.includes('--test-ads');
if(testAds&&mode!=='local')throw Error('Ad test builds must use the local API. Use npm run native:ads-test.');
const adConfig=await readAdMobConfig(root);
if(mode==='release'&&adConfig.enabled&&adConfig.testMode)throw Error('Use testMode=false for release ads; native:ads-test keeps test traffic on the local API.');
const deployment=JSON.parse(await readFile(resolve(root,'config/deployment.json'),'utf8'));
const apiUrl=(process.env.VITE_API_URL||(mode==='local'?'http://localhost:8787/api':deployment.apiUrl)).replace(/\/+$/,'');
let parsed;
try{parsed=new URL(apiUrl);}catch{throw new Error('Set VITE_API_URL to an absolute API URL. Release requires a configured HTTPS endpoint.');}
const local=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
if(parsed.username||parsed.password||parsed.search||parsed.hash||!parsed.pathname.endsWith('/api'))throw new Error('VITE_API_URL must be a credential-free API base ending in /api.');
if(mode==='release'&&(parsed.protocol!=='https:'||local))throw new Error('Release requires a non-local HTTPS VITE_API_URL.');
if(mode==='local'&&(!local||parsed.protocol!=='http:'))throw new Error('Local debug requires http://localhost:<port>/api (Android uses adb reverse).');
const env={...process.env,VITE_API_URL:apiUrl};
env.VITE_ENABLE_ADS=String(mode==='release'?adConfig.enabled:testAds);
env.VITE_ADS_TEST_MODE=String(mode==='local'||adConfig.testMode);
env.VITE_LOCAL_DEV_TOOLS=mode==='local'?'enabled':'disabled';
if(mode==='local')env.VITE_ENABLE_PURCHASES='false';
function run(command,args){const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
await syncNativeAdMob(adConfig,root);
run('npm',['run','build']);
await writeFile(resolve(root,'apps/client/dist/native-build.json'),JSON.stringify({mode,apiUrl,localDevTools:env.VITE_LOCAL_DEV_TOOLS==='enabled',ads:{enabled:env.VITE_ENABLE_ADS==='true',testMode:env.VITE_ADS_TEST_MODE==='true'},builtAt:new Date().toISOString()},null,2));
run('npx',['cap','sync']);
console.log(`Native ${mode} web bundle synced: ${apiUrl}`);
if(mode==='local')console.log('Keep npm run dev:api running. Android: adb reverse tcp:8787 tcp:8787. iOS Simulator: localhost reaches this Mac.');

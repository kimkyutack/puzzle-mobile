import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const APP=/^ca-app-pub-(\d{16})~\d{10}$/;
const UNIT=/^ca-app-pub-(\d{16})\/\d{10}$/;
export async function readAdMobConfig(root=projectRoot,{requireLive=false}={}){
 const config=JSON.parse(await readFile(resolve(root,'config/admob.json'),'utf8'));
 if(typeof config.enabled!=='boolean'||typeof config.testMode!=='boolean'||config.rewardAmount!==1||typeof config.rewardItem!=='string'||!config.rewardItem.trim()||config.rewardItem.includes(','))throw Error('AdMob enabled/testMode/reward settings are invalid.');
 const publishers=new Set();
 for(const platform of ['android','ios']){
  const app=APP.exec(config[platform]?.appId??'');if(!app)throw Error(`Invalid ${platform} AdMob app ID`);publishers.add(app[1]);
  for(const key of ['heart','coinBonus']){const unit=UNIT.exec(config[platform]?.[key]??'');if(!unit||unit[1]!==app[1])throw Error(`Invalid ${platform} ${key} unit or publisher mismatch`);}
  if(config.enabled&&app[1]==='3940256099942544')throw Error('Live AdMob cannot use Google sample app IDs.');
 }
 if(publishers.size!==1||config.android.appId===config.ios.appId)throw Error('Confirm the platform apps and publisher in config/admob.json.');
 const deployment=JSON.parse(await readFile(resolve(root,'config/deployment.json'),'utf8'));
 const callback=new URL(config.ssvCallbackUrl);
 if(callback.protocol!=='https:'||callback.username||callback.password||callback.search||callback.hash||callback.href!==deployment.apiUrl.replace(/\/+$/,'')+'/ads/ssv')throw Error('AdMob SSV callback must match the production API /ads/ssv endpoint.');
 if(requireLive&&(!config.enabled||config.testMode))throw Error('Live AdMob must be enabled with testMode=false.');
 return config;
}
function replaceOne(source,pattern,value,label){let count=0;const result=source.replace(pattern,(_match,a,b)=>{count++;return a+value+b});if(count!==1)throw Error(`Expected one ${label}; configuration was not changed.`);return result;}
export async function syncNativeAdMob(config,root=projectRoot){
 const android=resolve(root,'android/app/src/main/res/values/strings.xml'),ios=resolve(root,'ios/App/App/Info.plist');
 const [a,b]=await Promise.all([readFile(android,'utf8'),readFile(ios,'utf8')]);
 const nextAndroid=replaceOne(a,/(<string name="admob_app_id">)[^<]*(<\/string>)/g,config.android.appId,'Android AdMob ID');
 const nextIos=replaceOne(b,/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/g,config.ios.appId,'iOS AdMob ID');
 if(a!==nextAndroid)await writeFile(android,nextAndroid);if(b!==nextIos)await writeFile(ios,nextIos);
}
export async function syncWorkerAdMob(config,root=projectRoot){
 const units=[config.android.heart,config.android.coinBonus,config.ios.heart,config.ios.coinBonus];
 const union=(old,values)=>[...new Set([...(old??'').split(',').map(v=>v.trim()).filter(Boolean),...values])].join(',');
 for(const name of ['wrangler.jsonc','apps/api/wrangler.jsonc']){
  const path=resolve(root,name),source=await readFile(path,'utf8'),document=JSON.parse(source),vars=document.vars??={};
  Object.assign(vars,{ADMOB_ENABLED:String(config.enabled&&!config.testMode),ADMOB_ANDROID_HEART_AD_UNIT:config.android.heart,ADMOB_ANDROID_COIN_AD_UNIT:config.android.coinBonus,ADMOB_IOS_HEART_AD_UNIT:config.ios.heart,ADMOB_IOS_COIN_AD_UNIT:config.ios.coinBonus,ADMOB_AD_UNITS:union(vars.ADMOB_AD_UNITS,units),ADMOB_REWARD_ITEMS:union(vars.ADMOB_REWARD_ITEMS,[config.rewardItem])});
  // Retain legacy shared-unit vars and old verification units/items for saved intents.
  const next=JSON.stringify(document,null,2)+'\n';if(next!==source)await writeFile(path,next);
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2]??'check',root=process.env.ADMOB_CONFIG_ROOT?resolve(process.env.ADMOB_CONFIG_ROOT):projectRoot;
 const config=await readAdMobConfig(root,{requireLive:process.argv.includes('--live')});
 if(mode==='sync'){await syncNativeAdMob(config,root);await syncWorkerAdMob(config,root);}else if(mode!=='check')throw Error('Usage: node tools/admob-config.mjs check|sync [--live]');
 console.log(JSON.stringify({enabled:config.enabled,testMode:config.testMode,platforms:['ios','android'],rewardAmount:config.rewardAmount,rewardItem:config.rewardItem,ssvCallbackUrl:config.ssvCallbackUrl,synced:mode==='sync'}));
}

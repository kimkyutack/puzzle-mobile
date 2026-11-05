import {supportsEngine,type Player,type PreBooster,type Run} from '@garden/contracts';
import {tr} from './i18n';

export interface RunStartInput {idempotencyKey:string;preBoosters:PreBooster[]}
type Transport=<T>(path:string,body?:unknown)=>Promise<T>;
/** Negotiate once per app session, rather than assuming the newest bundled engine is deployed. */
export function createRunGateway(request:Transport){
 let engine:Promise<string>|undefined;
 function resolveEngine(refresh=false):Promise<string>{
  if(refresh)engine=undefined;
  if(!engine){
   const pending=request<{ok:boolean;engineVersion:string}>('/health').then(health=>{
    if(!health.ok||!supportsEngine(health.engineVersion))throw Object.assign(new Error(tr('새로운 퍼즐 버전이 필요해요. 앱을 업데이트한 뒤 같은 판을 이어가세요.')),{code:'UPDATE_REQUIRED'});
    return health.engineVersion;
   });
   engine=pending;
   void pending.catch(()=>{if(engine===pending)engine=undefined;});
  }
  return engine;
 }
 async function start(input:RunStartInput){
  const version=await resolveEngine();
  const send=(engineVersion:string)=>request<{player:Player;run:Run}>('/runs/start',{...input,engineVersion});
  try{return await send(version);}catch(error){
   // A deployment can change while the app is open. Retry only a rejected version,
   // once, using the exact original purchase key and booster selection.
   if(!error||typeof error!=='object'||!('code' in error)||!['INVALID_INPUT','UPDATE_REQUIRED'].includes(String(error.code)))throw error;
   const updated=await resolveEngine(true);if(updated===version)throw error;
   return send(updated);
  }
 }
 return {resolveEngine,start};
}

import type {LocalFeatures} from '@garden/contracts';
import {ensure,mutate,operationKey,type ApiEnv} from './db';

export function localFeatures(env:ApiEnv,url:URL):LocalFeatures{
 const host=url.hostname.toLowerCase(),parts=host.split('.').map(Number);
 const ipv4=parts.length===4&&parts.every(part=>Number.isInteger(part)&&part>=0&&part<=255);
 const privateHost=['localhost','[::1]'].includes(host)||ipv4&&(parts[0]===127||parts[0]===10||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]!>=16&&parts[1]!<=31);
 return {freeHeartRefill:env.ENVIRONMENT==='development'&&env.LOCAL_DEV_TOOLS==='enabled'&&privateHost};
}
export async function refillLocalHearts(env:ApiEnv,url:URL,userId:string,body:Record<string,unknown>){
 ensure(localFeatures(env,url).freeHeartRefill,'NOT_FOUND','요청한 기능을 찾을 수 없습니다.',404);
 return mutate(env,userId,operationKey(body),'local:hearts:refill',tx=>{
  tx.player.hearts=5;tx.player.heartAt=0;return {player:tx.player};
 });
}

import {applyAction,createGame} from '@garden/core';
import {bridgeLevel} from '@garden/content';
import type {Action} from '@garden/contracts';
export const rescueCacheKey=(id:string)=>'garden-rescue-bridge-v1-'+id;
// The old one-time story cache is intentionally not used by daily challenges.
export const dailyRescueCacheKey=(id:string,periodId:string)=>'garden-rescue-daily-v1-'+id+'-'+periodId;
export function restoreRescue(raw:string|null){
 let state=createGame(bridgeLevel());const actions:Action[]=[];
 if(!raw)return {state,actions};
 try{const value:unknown=JSON.parse(raw);if(!Array.isArray(value)||value.length>80)throw Error();
 for(const action of value){if(!action||!['swap','tap'].includes(action.type))throw Error();const r=applyAction(state,action);if(!r.accepted||r.state.status==='error')throw Error();state=r.state;actions.push(action);}return {state,actions};
 }catch{return {state:createGame(bridgeLevel()),actions:[]};}
}

import type {Action,AnimalExpeditionAttempt,Player} from '@garden/contracts';
import {expeditionRound,expeditionRounds} from '../../../packages/content/src/animal-expedition';
import {createGame,applyAction} from '@garden/core';
export const expeditionCacheKey=(userId:string,attemptId:string)=>`animal-expedition-v1:${userId}:${attemptId}`;
/** Rebuild exclusively from server-authored level and legal local actions, never a saved state. */
export function restoreExpedition(attempt:AnimalExpeditionAttempt,raw:string|null){
 let state=createGame(attempt.level);const actions:Action[]=[];
 try{const saved:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(saved)||saved.length>120)throw Error();
  for(const action of saved){if(!action||!['swap','tap'].includes(action.type))throw Error();const result=applyAction(state,action);if(!result.accepted||result.state.status==='error')throw Error();state=result.state;actions.push(action);}
  return {state,actions};
 }catch{return {state:createGame(attempt.level),actions:[]};}
}
// Home/event attention updates every second. Replay only when the saved log changes.
const resumeCache=new Map<string,{raw:string|null;level:AnimalExpeditionAttempt['level'];resumable:boolean}>();
export function expeditionCanResume(player:Player,roundId?:string):boolean{
 if(!roundId)return expeditionRounds(player.animalExpedition).some(round=>!!round.attempt&&expeditionCanResume(player,round.roundId));
 const attempt=expeditionRound(player.animalExpedition,roundId)?.attempt;if(!attempt)return false;
 try{
  if(typeof localStorage==='undefined')return true;
  const key=expeditionCacheKey(player.id,attempt.id),raw=localStorage.getItem(key),cached=resumeCache.get(key);
  if(cached?.raw===raw&&cached.level===attempt.level)return cached.resumable;
  const state=restoreExpedition(attempt,raw).state,resumable=state.status==='playing'||state.status==='won';
  resumeCache.set(key,{raw,level:attempt.level,resumable});if(resumeCache.size>32)resumeCache.delete(resumeCache.keys().next().value!);
  return resumable;
 }catch{return true;}
}

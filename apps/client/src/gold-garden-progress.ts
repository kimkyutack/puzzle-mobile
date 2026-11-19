import type {Action} from '@garden/contracts';
import {createGame,replay} from '@garden/core';
import {GOLD_GARDEN_MOVES,GOLD_GARDEN_VERSION,LEGACY_GOLD_GARDEN_VERSION,REFILL_GOLD_GARDEN_VERSION,goldGardenLevel,type GoldGardenVersion} from '../../../packages/content/src/gold-garden';

export type RefillGoldGardenVersion=Exclude<GoldGardenVersion,typeof LEGACY_GOLD_GARDEN_VERSION>;
export const isRefillGoldGardenVersion=(version:unknown):version is RefillGoldGardenVersion=>
 version===REFILL_GOLD_GARDEN_VERSION||version===GOLD_GARDEN_VERSION;

type Move=Extract<Action,{type:'swap'|'tap'}>;
const index=(value:unknown,size:number)=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<size;
function isMove(value:unknown,size:number):value is Move{
 if(!value||typeof value!=='object'||!('type' in value))return false;
 return value.type==='tap'&&'at' in value&&index(value.at,size)||
  value.type==='swap'&&'from' in value&&'to' in value&&index(value.from,size)&&index(value.to,size);
}
export const goldGardenCacheKey=(playerId:string,milestone:number,version:GoldGardenVersion)=>`garden-gold-v${version}-${playerId}-${milestone}`;

export function restoreGoldGarden(milestone:number,raw:string|null,version:GoldGardenVersion=GOLD_GARDEN_VERSION){
 const level=goldGardenLevel(milestone,version);
 if(raw)try{
  const actions:unknown=JSON.parse(raw);
  if(Array.isArray(actions)&&actions.length<=GOLD_GARDEN_MOVES&&actions.every(action=>isMove(action,level.shape.length))){
   const result=replay(level,actions);
   if(result.accepted&&result.state.status!=='error')return {state:result.state,actions};
  }
 }catch{/* Ignore corrupt cache data. */}
 return {state:createGame(level),actions:[] as Move[]};
}

export function loadGoldGarden(milestone:number,version:RefillGoldGardenVersion,read:(version:RefillGoldGardenVersion)=>string|null):
 ReturnType<typeof restoreGoldGarden>&{version:RefillGoldGardenVersion}{
 for(const savedVersion of [GOLD_GARDEN_VERSION,REFILL_GOLD_GARDEN_VERSION] as const){
  if(savedVersion>version)continue;
  const raw=read(savedVersion);
  if(!raw)continue;
  const saved=restoreGoldGarden(milestone,raw,savedVersion);
  if(saved.actions.length)return {...saved,version:savedVersion};
 }
 return {...restoreGoldGarden(milestone,null,version),version};
}

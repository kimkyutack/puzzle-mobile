import type {Player} from '@garden/contracts';
import type {OperationsSnapshot} from '../../../packages/contracts/src/operations';
import {gameEventAvailable,gameEventConfig} from '../../../packages/contracts/src/operations';
import {FLOWERLIGHT_ID} from '../../../packages/content/src/flowerlight';
import {configuredExpeditionRound} from '../../../packages/content/src/animal-expedition';

/** Content identities stay stable across daily resets, reward claims and settings edits. */
export function eventIntroductionIds(player:Player|null,operations:OperationsSnapshot|null,now:number,season?:{id:string;ends_at:number}|null):string[]{
 if(!player||!operations)return [];
 const settings=operations.settings,ids:string[]=[];
 const available=(feature:'flowerlight'|'animalExpedition'|'powerFestival'|'treasure')=>player.level>=gameEventConfig(feature,settings).minLevel&&gameEventAvailable(feature,settings,now);
 if(available('flowerlight'))ids.push('flowerlight:'+FLOWERLIGHT_ID);
 if(available('animalExpedition'))ids.push('animal-expedition:'+configuredExpeditionRound(settings).roundId);
 if(available('powerFestival'))ids.push('power-festival:v1');
 if(available('treasure'))ids.push('treasure:v1');
 if(settings.startBoosterRush.enabled)ids.push('start-rush:v1');
 if(season&&now<season.ends_at)ids.push('season:'+season.id);
 for(const event of operations.events)if(event.kind==='reward'&&event.status==='published'&&event.startsAt<=now&&now<event.endsAt)ids.push('operations:'+event.id);
 return [...new Set(ids)].sort();
}

type DiscoveryStorage=Pick<Storage,'getItem'|'setItem'>;
const sessionSeen=new Map<string,string[]>();
export const eventDiscoveryKey=(userId:string)=>'cloud-garden-event-discovery-v1:'+encodeURIComponent(userId);
function deviceStorage(){try{return typeof localStorage==='undefined'?undefined:localStorage}catch{return undefined}}
export function readEventDiscovery(userId:string,storage:DiscoveryStorage|undefined=deviceStorage()):string[]{
 let persisted:string[]=[];
 try{const value:unknown=JSON.parse(storage?.getItem(eventDiscoveryKey(userId))??'[]');if(Array.isArray(value))persisted=value.filter((id):id is string=>typeof id==='string'&&id.length<=256);}catch{/* A damaged or unavailable device cache must not block the footer. */}
 return [...new Set([...persisted,...(sessionSeen.get(userId)??[])])];
}
export function markEventDiscoveryRead(userId:string,ids:readonly string[],storage:DiscoveryStorage|undefined=deviceStorage()):string[]{
 const seen=[...new Set([...readEventDiscovery(userId,storage),...ids])];sessionSeen.set(userId,seen);
 try{storage?.setItem(eventDiscoveryKey(userId),JSON.stringify(seen));}catch{/* Keep the acknowledgement for this app session when storage is unavailable. */}
 return seen;
}

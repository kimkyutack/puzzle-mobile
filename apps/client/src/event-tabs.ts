import type {Player} from '@garden/contracts';
import {GARDEN_GAMES,type GardenGameId} from '../../../packages/contracts/src/garden-games';
import {GARDEN_GAME_TITLES,gardenGameStatus} from '../../../packages/content/src/garden-games';
import {gameEventAvailable,gameEventConfig,type OpsFeature,type OpsEvent,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import {startBoosterWindow,type StartBoosterSchedule} from '../../../packages/contracts/src/start-booster-rush';
import {flowerlightAttention,expeditionAttention,powerFestivalAttention,seasonClaimable} from '../../../packages/content/src/attention';
export {flowerlightAttention,expeditionAttention} from '../../../packages/content/src/attention';

export type EventTabId='attendance'|'flowerlight'|'animal-expedition'|'treasure'|'power-festival'|'season'|'start-rush'|'live-events'|GardenGameId;
export interface EventTab {id:EventTabId;title:string;attention:boolean}
interface Progress {progress:number;target:number;claimed:boolean}
export interface EventTabInput {
 player:Player;now:number;dailyAvailable:boolean;treasureRemaining?:number;treasurePlaying?:boolean;
 season:{ends_at:number}|null;personal:Progress;guild:Progress;hasGuild:boolean;
 features?:Partial<Record<OpsFeature,boolean>>;startRush?:StartBoosterSchedule;rewards?:OpsEvent[];settings?:RuntimeSettings;expeditionCanResume?:boolean;
}
export function eventTabs(input:EventTabInput):EventTab[]{
 const {player,now,features}=input,enabled=(id:OpsFeature)=>(features?.[id]??input.settings?.features[id])!==false;
 const result:EventTab[]=[{id:'attendance',title:'출석 선물',attention:enabled('daily')&&input.dailyAvailable}];
 if((player.level>=gameEventConfig('flowerlight',input.settings).minLevel||!!player.flowerFestival)&&enabled('flowerlight')&&(gameEventAvailable('flowerlight',input.settings,now)||player.flowerFestival))result.push({id:'flowerlight',title:'꽃빛축제',attention:flowerlightAttention(player,now,input.settings)});
 if((player.level>=gameEventConfig('animalExpedition',input.settings).minLevel||!!player.animalExpedition)&&enabled('animalExpedition')&&(gameEventAvailable('animalExpedition',input.settings,now)||player.animalExpedition))result.push({id:'animal-expedition',title:'동물 구출 원정',attention:expeditionAttention(player,now,input.settings,input.expeditionCanResume)});
 if((player.level>=gameEventConfig('treasure',input.settings).minLevel||input.treasurePlaying)&&enabled('treasure')&&(gameEventAvailable('treasure',input.settings,now)||input.treasurePlaying))result.push({id:'treasure',title:'보물 카드',attention:!!input.treasurePlaying||gameEventAvailable('treasure',input.settings,now)&&(input.treasureRemaining??0)>0});
 for(const game of GARDEN_GAMES){
  if(!input.settings?.gameEvents?.[game]||!enabled(game))continue;
  const status=gardenGameStatus(game,player,now,input.settings);
  if(status.visible)result.push({id:game,title:GARDEN_GAME_TITLES[game],attention:status.canStart||!!status.attempt});
 }
 if((player.level>=gameEventConfig('powerFestival',input.settings).minLevel||!!player.powerFestival)&&enabled('powerFestival')&&(gameEventAvailable('powerFestival',input.settings,now)||player.powerFestival)){
  result.push({id:'power-festival',title:'도구 축제',attention:powerFestivalAttention(player,now,input.settings)});
 }
 result.push({id:'season',title:'시즌 이벤트',attention:seasonClaimable(input,input.hasGuild,now)>0});
 if(input.startRush?.enabled)result.push({id:'start-rush',title:'아이템 무제한',attention:startBoosterWindow(input.startRush,now).active});
 if(input.rewards?.length)result.push({id:'live-events',title:'이벤트 보상',attention:input.rewards.some(event=>event.status==='published'&&!event.claimed&&now>=event.startsAt&&now<event.endsAt&&(event.reward.coins+event.reward.stars+event.reward.hearts+Object.values(event.reward.items).reduce((sum,n)=>sum+n,0)>0))});
 return result;
}

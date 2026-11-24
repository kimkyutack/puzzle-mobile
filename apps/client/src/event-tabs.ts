import type {Player} from '@garden/contracts';
import type {GardenGameId} from '../../../packages/contracts/src/garden-games';
import {gameEventAvailable,gameEventConfig,type OpsFeature,type OpsEvent,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import {type StartBoosterSchedule} from '../../../packages/contracts/src/start-booster-rush';
import {flowerlightAttention,seasonClaimable} from '../../../packages/content/src/attention';
export {flowerlightAttention,expeditionAttention} from '../../../packages/content/src/attention';

export type EventTabId='attendance'|'flowerlight'|'animal-expedition'|'treasure'|'power-festival'|'season'|'garden-invite'|'live-events'|GardenGameId;
export interface EventTab {id:EventTabId;title:string;attention:boolean}
interface Progress {progress:number;target:number;claimed:boolean}
export interface EventTabInput {
 player:Player;now:number;dailyAvailable:boolean;treasureRemaining?:number;treasurePlaying?:boolean;
 season:{ends_at:number}|null;personal:Progress;guild:Progress;hasGuild:boolean;
 features?:Partial<Record<OpsFeature,boolean>>;startRush?:StartBoosterSchedule;rewards?:OpsEvent[];settings?:RuntimeSettings;expeditionCanResume?:boolean;socialAllowed?:boolean;invitationClaimable?:boolean;
}
export function eventTabs(input:Omit<EventTabInput,'personal'|'guild'>&Partial<Pick<EventTabInput,'personal'|'guild'>>):EventTab[]{
 const {player,now,features}=input,enabled=(id:OpsFeature)=>(features?.[id]??input.settings?.features[id])!==false;
 const result:EventTab[]=[{id:'attendance',title:'출석 선물',attention:enabled('daily')&&input.dailyAvailable}];
 if((player.level>=gameEventConfig('flowerlight',input.settings).minLevel||!!player.flowerFestival)&&enabled('flowerlight')&&(gameEventAvailable('flowerlight',input.settings,now)||player.flowerFestival))result.push({id:'flowerlight',title:'꽃빛축제',attention:flowerlightAttention(player,now,input.settings)});
 if((player.level>=gameEventConfig('treasure',input.settings).minLevel||input.treasurePlaying)&&enabled('treasure')&&(gameEventAvailable('treasure',input.settings,now)||input.treasurePlaying))result.push({id:'treasure',title:'보물 카드',attention:!!input.treasurePlaying||gameEventAvailable('treasure',input.settings,now)&&(input.treasureRemaining??0)>0});

 result.push({id:'season',title:'시즌 이벤트',attention:!!input.personal&&!!input.guild&&seasonClaimable({season:input.season,personal:input.personal,guild:input.guild},input.hasGuild,now)>0});
 if(player.level>=5&&input.socialAllowed!==false&&enabled('guild'))result.push({id:'garden-invite',title:'정원 초대',attention:!!input.invitationClaimable});
 if(input.rewards?.length)result.push({id:'live-events',title:'이벤트 보상',attention:input.rewards.some(event=>event.status==='published'&&!event.claimed&&now>=event.startsAt&&now<event.endsAt&&(event.reward.coins+event.reward.stars+event.reward.hearts+Object.values(event.reward.items).reduce((sum,n)=>sum+n,0)>0))});
 return result;
}

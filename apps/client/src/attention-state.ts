import type {NotificationCounts,Player,ProgressionResponse} from '@garden/contracts';
import type {OperationsSnapshot} from '../../../packages/contracts/src/operations';
import {passClaimable,treasureAttention} from '../../../packages/content/src/attention';
import {expeditionCanResume} from './expedition-progress';
import {eventTabs} from './event-tabs';
import {GARDEN_GAMES} from '../../../packages/contracts/src/garden-games';

const empty:NotificationCounts={missions:0,events:0,pass:0,gifts:0,friends:0,guild:0,minigame:0,shop:0,flowerlight:0,expedition:0,festival:0};
export function attentionState(player:Player|null,data:ProgressionResponse|null,operations:OperationsSnapshot|null,now:number){
 const enabled=(id:keyof NonNullable<OperationsSnapshot>['settings']['features'])=>operations?.settings.features[id]!==false;
 const snapshot=data&&data.player.id===player?.id?data:null,rewards=snapshot?.eventRewards;
 const fallback={progress:0,target:1,claimed:true};
 const minigame=!!snapshot&&treasureAttention(snapshot.minigame,now);
 const tabs=player?eventTabs({player,now,dailyAvailable:!!rewards&&rewards.daily.available&&now<rewards.daily.nextReset,treasureRemaining:minigame?1:0,treasurePlaying:false,season:rewards?.season??null,personal:rewards?.personal??fallback,guild:rewards?.guild??fallback,hasGuild:!!player.guildId,features:operations?.settings.features,settings:operations?.settings,expeditionCanResume:expeditionCanResume(player),startRush:operations?.settings.startBoosterRush,rewards:operations?.events.filter(event=>event.kind==='reward')}):[];
 const tab=(id:string)=>Number(tabs.some(value=>value.id===id&&value.attention));
 const regularMissions=snapshot?[snapshot.daily,snapshot.weekly].filter(window=>window&&now<window.endsAt).reduce((count,window)=>count+window.missions.filter(mission=>!mission.claimed&&mission.progress>=mission.target).length,0):0;
 const missions=enabled('missions')?regularMissions:0;
 const counts:NotificationCounts={...empty,missions,events:tab('attendance')+tab('season'),minigame:tab('treasure')+GARDEN_GAMES.reduce((sum,game)=>sum+tab(game),0),flowerlight:tab('flowerlight'),expedition:tab('animal-expedition'),festival:tab('power-festival'),pass:enabled('pass')&&player&&rewards?passClaimable(rewards,player,now):0,gifts:snapshot?.giftCounts?snapshot.giftCounts.items+(player&&player.hearts<5?snapshot.giftCounts.hearts:0):snapshot?.notifications.gifts??0,friends:enabled('friends')?(snapshot?.notifications.friends??0):0,guild:enabled('guild')&&player?.guildId&&player.level>=5?(snapshot?.notifications.guild??0):0};
 return {counts,contentEvents:tab('flowerlight')+tab('animal-expedition'),liveEvents:tab('live-events'),footer:{shop:0,friends:counts.friends,home:counts.missions+counts.pass+counts.gifts+(counts.festival??0),guild:counts.guild,events:tabs.filter(value=>value.attention).length}};
}

import type {EventRewardState,Player,ProgressionResponse} from '@garden/contracts';
import {gameEventAvailable,gameEventConfig,type RuntimeSettings} from '../../contracts/src/operations';
import {FLOWERLIGHT_STAGES,flowerlightClaimable} from './flowerlight';
import {ANIMAL_EXPEDITION_STAGES,expeditionDailyStatus,configuredExpeditionRound,expeditionRound,expeditionRounds} from './animal-expedition';
import {POWER_FESTIVAL_STAGES,festivalClaimable} from './power-festival';
import {missionPeriod} from './missions';
import {weeklyEvent} from '../../contracts/src/weekly-events';

export function flowerlightAttention(player:Player,now:number,settings?:RuntimeSettings){
 const event=player.flowerFestival;
 return settings?.features.flowerlight!==false&&(player.level>=gameEventConfig('flowerlight',settings).minLevel||!!event)&&(!event?gameEventAvailable('flowerlight',settings,now):flowerlightClaimable(event)>0||event.restoredStages<FLOWERLIGHT_STAGES.length&&now<event.endsAt);
}
export function expeditionAttention(player:Player,now=Date.now(),settings?:RuntimeSettings,resumable?:boolean){const config=gameEventConfig('animalExpedition',settings),round=expeditionRound(player.animalExpedition,configuredExpeditionRound(settings,now).roundId),pending=resumable??expeditionRounds(player.animalExpedition).some(r=>!!r.attempt),remaining=expeditionDailyStatus(player.animalExpedition,now,config.dailyLimit).remaining;return weeklyEvent(now).id==='animal-expedition'&&settings?.features.animalExpedition!==false&&(player.level>=config.minLevel||pending)&&(pending||gameEventAvailable('animalExpedition',settings,now)&&remaining>0&&(round?.completedStages??0)<ANIMAL_EXPEDITION_STAGES.length);}
export function powerFestivalCanStart(player:Player,now:number,settings?:RuntimeSettings){
 const event=player.powerFestival;
 return player.level>=gameEventConfig('powerFestival',settings).minLevel&&gameEventAvailable('powerFestival',settings,now)&&(!event||event.endsAt<=now||event.claimedStages>=POWER_FESTIVAL_STAGES.length)&&event?.day!==missionPeriod('daily',now).id&&(!event||festivalClaimable(event)===0);
}
export function powerFestivalAttention(player:Player,now:number,settings?:RuntimeSettings){
 const event=player.powerFestival;
 return settings?.features.powerFestival!==false&&(powerFestivalCanStart(player,now,settings)||!!event&&(festivalClaimable(event)>0||event.endsAt>now&&event.claimedStages<POWER_FESTIVAL_STAGES.length));
}
export function seasonClaimable(rewards:{season:{ends_at:number}|null;personal:{progress:number;target:number;claimed:boolean};guild:{progress:number;target:number;claimed:boolean}},hasGuild:boolean,now:number){
 if(!rewards.season||now>=rewards.season.ends_at)return 0;
 return [rewards.personal,...(hasGuild?[rewards.guild]:[])].filter(goal=>goal.progress>=goal.target&&!goal.claimed).length;
}
export function passClaimable(rewards:EventRewardState,player:Player,now:number){
 if(player.level<5)return 0;
 const pass=rewards.pass,tiers=rewards.season&&now<rewards.season.ends_at?pass.tiers.reduce((count,tier)=>count+(pass.points>=tier.points?Number(!tier.freeClaimed)+Number(pass.premium&&!tier.premiumClaimed):0),0):0;
 return tiers+(player.guildId?pass.guildGifts.filter(gift=>!gift.sent).length:0);
}
export function treasureAttention(minigame:ProgressionResponse['minigame'],now:number){return minigame.remaining>0&&now<minigame.nextReset||!!minigame.active&&minigame.active.status==='playing'&&now<minigame.active.expiresAt;}

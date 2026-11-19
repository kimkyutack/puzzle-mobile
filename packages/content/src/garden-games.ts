import type {Player} from '@garden/contracts';
import type {GardenGameId,GardenGamePrize,GardenGameProgress,GardenGameReward,GardenGameRound} from '../../contracts/src/garden-games';
import {gameEventAvailable,gameEventConfig,type RuntimeSettings} from '../../contracts/src/operations';
import {missionPeriod} from './missions';

export const GARDEN_GAME_STAGES=10;
export const GARDEN_GAME_FINISH_GRACE=15*60*1000;
export const GARDEN_GAME_TITLES:Record<GardenGameId,string>={'acorn-pinball':'도토리 핀볼','greenhouse-water':'온실 물길'};

export function gardenGameReward(game:GardenGameId,stage:number,grandPrize:GardenGamePrize):GardenGameReward{
 if(stage===10)return {coins:240,items:{'cross-firework':2,'world-bomb':1},decoration:grandPrize};
 if(stage===5)return {coins:90,items:{bomb:2},decoration:game==='acorn-pinball'?'garden-gazebo':'garden-lotus-pavilion'};
 if(stage===1||stage===3||stage===7)return {coins:35+stage*5,items:{[game==='acorn-pinball'?'hammer':'wind-row']:stage===7?2:1}};
 return {coins:35+stage*5,items:{}};
}

export function gardenGameRound(progress:GardenGameProgress|undefined,roundId:string):GardenGameRound|undefined{
 return progress&&Object.hasOwn(progress.rounds,roundId)?progress.rounds[roundId]:undefined;
}

export function gardenGameStatus(game:GardenGameId,player:Pick<Player,'level'|'gardenGames'>,now:number,settings?:RuntimeSettings|null){
 const config=gameEventConfig(game,settings),progress=player.gardenGames?.[game],configured=gardenGameRound(progress,config.roundId);
 const resume=Object.entries(progress?.rounds??{}).find(([,round])=>round.attempt&&round.attempt.expiresAt>now);
 const roundId=resume?.[0]??config.roundId,round=resume?.[1]??configured;
 const day=missionPeriod('daily',now);
 const available=player.level>=config.minLevel&&gameEventAvailable(game,settings,now);
 const enabled=settings?.features[game]!==false,completed=round?.completed??0,tickets=round?.tickets??0,free=progress?.freeDay!==day.id;
 const attempt=enabled?resume?.[1].attempt:undefined;
 const canStart=available&&completed<GARDEN_GAME_STAGES&&roundId===config.roundId&&(free||tickets>0);
 const justFinished=!!round?.result&&now-round.result.finishedAt<GARDEN_GAME_FINISH_GRACE;
 return {roundId,completed,tickets,free,attempt,available,canStart,visible:available||!!attempt||enabled&&justFinished,
  nextReset:day.endsAt,grandPrize:round?.grandPrize??config.grandPrize,result:round?.result};
}

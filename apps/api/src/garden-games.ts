import {z} from 'zod';
import {missionPeriod} from '@garden/content';
import {GARDEN_GAMES,PINBALL_PHYSICS_VERSION,type GardenGameAttempt,type GardenGameId,type GardenGameResult,type GardenGameRound,type PinballPhysics} from '../../../packages/contracts/src/garden-games';
import {gameEventAvailable,gameEventConfig,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import {GARDEN_GAME_FINISH_GRACE,GARDEN_GAME_STAGES,gardenGameReward,gardenGameRound,gardenGameStatus} from '../../../packages/content/src/garden-games';
import {pinballBoard,replayPinball} from '../../../packages/content/src/acorn-pinball';
import {waterBoard,replayWater} from '../../../packages/content/src/greenhouse-water';
import {ensure,mutate,operationKey,uid,type ApiEnv,type MutationContext} from './db';
import {grantActivityReward,recordActivity} from './activity';
import {grantEventDecoration} from './garden-world';
import {weeklyEvent,weeklyRoundId} from '../../../packages/contracts/src/weekly-events';

const roundSchema=z.string().min(1).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const physicsSchema=z.literal(PINBALL_PHYSICS_VERSION).optional();
const expiry=24*60*60*1000;

function ensurePinballPhysics(attempt:GardenGameAttempt,clientPhysics:PinballPhysics|undefined){
 ensure(!attempt.pinballPhysics||clientPhysics===attempt.pinballPhysics,'UPDATE_REQUIRED','앱을 업데이트하면 진행 중인 도전을 이어할 수 있어요.',409);
}

function editableRound(tx:MutationContext,game:GardenGameId,id:string):GardenGameRound{
 const progress=(tx.player.gardenGames??={})[game]??={rounds:{}};
 const current=gardenGameRound(progress,id);
 if(current)return current;
 const round={tickets:0,completed:0};
 progress.rounds={...progress.rounds,[id]:round};return round;
}

/** Only a newly rewarded campaign clear can mint a ticket. */
export function recordGardenGameClear(tx:MutationContext,settings:RuntimeSettings){
 for(const game of GARDEN_GAMES){
  const config=gameEventConfig(game,settings);
  if(tx.player.level<config.minLevel||!gameEventAvailable(game,settings,tx.now))continue;
  const round=editableRound(tx,game,weeklyRoundId(config.roundId,tx.now));
  if(round.completed<GARDEN_GAME_STAGES&&round.tickets<config.ticketCap)round.tickets++;
 }
}

export function startGardenGame(env:ApiEnv,userId:string,game:GardenGameId,body:Record<string,unknown>,settings:RuntimeSettings){
 const roundId=roundSchema.parse(body.roundId),config=gameEventConfig(game,settings);
 const pinballPhysics=game==='acorn-pinball'?physicsSchema.parse(body.pinballPhysics):undefined;
 return mutate(env,userId,operationKey(body),`garden-game:start:${game}:${roundId}${pinballPhysics?':'+pinballPhysics:''}`,tx=>{
  const status=gardenGameStatus(game,tx.player,tx.now,settings);
  ensure(roundId===status.roundId,'GARDEN_GAME_CHANGED','이벤트 회차가 바뀌었어요. 다시 열어 주세요.',409);
  if(status.attempt){ensurePinballPhysics(status.attempt,pinballPhysics);return {player:tx.player};}
  ensure(status.available,'EVENT_NOT_OPEN','지금은 이벤트 참여 시간이 아니에요.',409);
  ensure(status.completed<GARDEN_GAME_STAGES,'GARDEN_GAME_COMPLETE','이 회차의 미니게임을 모두 완료했어요.',409);
  ensure(status.canStart,'GARDEN_GAME_NO_TICKET','퍼즐을 완료해 입장권을 모아 주세요.',409);
  const progress=(tx.player.gardenGames??={})[game]??={rounds:{}};
  const round=editableRound(tx,game,roundId);
  if(status.free)progress.freeDay=missionPeriod('daily',tx.now).id;
  else round.tickets--;
  round.grandPrize??=config.grandPrize;
  const stage=round.completed+1;
  const seed=crypto.getRandomValues(new Uint32Array(1))[0]!||1;
  round.attempt={id:uid(),stage,seed,expiresAt:Math.min(tx.now+expiry,weeklyEvent(tx.now).endsAt,(config.endsAt??Infinity)+GARDEN_GAME_FINISH_GRACE),...(pinballPhysics?{pinballPhysics}:{})};
  return {player:tx.player};
 });
}

export function finishGardenGame(env:ApiEnv,userId:string,game:GardenGameId,body:Record<string,unknown>){
 const input=z.object({roundId:roundSchema,attemptId:z.string().uuid(),actions:z.array(z.number().int().min(0).max(24)).min(1).max(80),pinballPhysics:physicsSchema}).parse(body);
 return mutate(env,userId,operationKey(body),`garden-game:finish:${game}:${JSON.stringify(input)}`,async tx=>{
  ensure(weeklyEvent(tx.now).id===game,'EVENT_NOT_OPEN','이번 주 이벤트가 바뀌었어요. 홈에서 새 이벤트를 확인해 주세요.',409);
  const round=gardenGameRound(tx.player.gardenGames?.[game],input.roundId);
  if(round?.result?.attemptId===input.attemptId)return {player:tx.player,result:round.result};
  const attempt=round?.attempt;
  ensure(round&&attempt?.id===input.attemptId&&attempt.stage===round.completed+1&&round.grandPrize,'GARDEN_GAME_CHANGED','다른 기기에서 도전이 바뀌었어요. 다시 열어 주세요.',409);
  ensure(attempt.expiresAt>tx.now,'MINIGAME_EXPIRED','도전 시간이 끝났어요. 새로 시작해 주세요.',409);
  ensurePinballPhysics(attempt,input.pinballPhysics);
  const outcome=game==='acorn-pinball'?replayPinball(pinballBoard(attempt.stage,attempt.seed,attempt.pinballPhysics),input.actions):replayWater(waterBoard(attempt.stage,attempt.seed),input.actions);
  ensure(outcome.status==='won'||outcome.status==='lost','MINIGAME_NOT_FINISHED','도전 결과를 확인할 수 없어요. 남은 플레이를 마쳐 주세요.',409);
  const result:GardenGameResult={attemptId:attempt.id,stage:attempt.stage,won:outcome.status==='won',finishedAt:tx.now};
  if(result.won){
   const reward=gardenGameReward(game,attempt.stage,round.grandPrize);
   grantActivityReward(tx,reward);
   if(reward.decoration)await grantEventDecoration(tx,reward.decoration,`event-${game}-${input.roundId}-${attempt.stage}`);
   recordActivity(tx,{'minigame-wins':1});
   round.completed=attempt.stage;
   result.reward=reward;
  }
  delete round.attempt;round.result=result;
  return {player:tx.player,result};
 });
}

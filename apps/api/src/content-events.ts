import {z} from 'zod';
import {replay} from '@garden/core';
import {FLOW_GRAVITY_ENGINE_VERSION,SEED_DELIVERY_ENGINE_VERSION,type AnimalExpeditionRoundProgress,type LevelDefinition,type Player,type Run} from '@garden/contracts';
import {gameEventAvailable,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import {FLOWERLIGHT_ID,FLOWERLIGHT_STAGES,FLOWERLIGHT_GARDEN_GIFTS,flowerlightGiftInstanceIds,canCollectPetals} from '../../../packages/content/src/flowerlight';
import {EXPEDITION_ANIMALS,configuredExpeditionRound,expeditionRounds,expeditionRound,selectExpeditionRound,expeditionGrantId,ANIMAL_EXPEDITION_STAGES,animalExpeditionLevel,expeditionDailyStatus} from '../../../packages/content/src/animal-expedition';
import type {GardenWorldState} from '../../../packages/garden-world/src';
import {projectLiveGarden} from '../../../packages/garden-world/src/live';
import {grantEventDecoration,save} from './garden-world';
import {grantActivityReward} from './activity';
import {actionSchema} from './validation';
import {ensure,mutate,operationKey,uid,one,type ApiEnv,type MutationContext} from './db';
import {runtime} from './operations';

function compatibleExpeditionLevel(level:LevelDefinition):LevelDefinition{
 if(level.engineVersion!==SEED_DELIVERY_ENGINE_VERSION||level.gardenStage?.kind!=='animal')return level;
 return {...level,engineVersion:FLOW_GRAVITY_ENGINE_VERSION};
}

/** Older apps cannot open an attempt saved while the campaign engine was newer. */
export function compatibleExpeditionPlayer(data:unknown,requestedEngine:string|null):unknown{
 if(requestedEngine===SEED_DELIVERY_ENGINE_VERSION||!data||typeof data!=='object'||!('player' in data))return data;
 const player=data.player as Player|undefined,progress=player?.animalExpedition;
 if(!progress)return data;
 function compatibleRound<T extends Pick<AnimalExpeditionRoundProgress,'attempt'>>(round:T):T{
  const attempt=round.attempt;
  if(!attempt)return round;
  const level=compatibleExpeditionLevel(attempt.level);
  return level===attempt.level?round:{...round,attempt:{...attempt,level}};
 }
 const current=compatibleRound(progress),pastRounds=progress.pastRounds?.map(compatibleRound);
 if(current===progress&&!pastRounds?.some((round,index)=>round!==progress.pastRounds?.[index]))return data;
 return {...data,player:{...player,animalExpedition:{...current,...(pastRounds?{pastRounds}:{})}}};
}

/** Called only for a newly rewarded, authoritative normal-level clear in its existing batch. */
export function recordFlowerlightClear(tx:MutationContext,run:Run){
 const event=tx.player.flowerFestival;
 if(!event||!canCollectPetals(event,run.startedAt,tx.now)||event.petals>=FLOWERLIGHT_STAGES.at(-1)!.target)return false;
 event.petals++;return true;
}
export async function startFlowerlight(env:ApiEnv,userId:string,body:Record<string,unknown>,settings?:RuntimeSettings){
 const controls=settings??(await runtime(env)).settings,config=controls.gameEvents.flowerlight;
 return mutate(env,userId,operationKey(body),'flowerlight:start',tx=>{
  ensure(tx.player.level>=config.minLevel,'FLOWERLIGHT_LOCKED',`레벨 ${config.minLevel}부터 꽃빛축제에 참여할 수 있어요.`,409);
  if(!tx.player.flowerFestival)ensure(gameEventAvailable('flowerlight',controls,tx.now),'EVENT_NOT_OPEN','지금은 이벤트 참여 시간이 아니에요.',409);
  tx.player.flowerFestival??={id:FLOWERLIGHT_ID,startedAt:tx.now,endsAt:tx.now+config.durationDays*86400000,petals:0,restoredStages:0};
  return {player:tx.player};
 });
}
export function restoreFlowerlight(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const {stage}=z.object({stage:z.number().int().min(1).max(FLOWERLIGHT_STAGES.length)}).parse(body);
 return mutate(env,userId,operationKey(body),'flowerlight:restore:'+stage,async tx=>{
  const event=tx.player.flowerFestival;ensure(event?.id===FLOWERLIGHT_ID,'FLOWERLIGHT_NOT_STARTED','꽃빛축제에 먼저 참여해 주세요.',409);
  if(event.restoredStages>=stage)return {player:tx.player,granted:false};
  ensure(stage===event.restoredStages+1,'FLOWERLIGHT_STAGE_ORDER','앞 장소부터 차례로 복원해 주세요.',409);
  const definition=FLOWERLIGHT_STAGES[stage-1]!;ensure(event.petals>=definition.target,'FLOWERLIGHT_NOT_READY','퍼즐을 클리어해 꽃잎을 더 모아 주세요.',409);
  grantActivityReward(tx,definition.reward);event.restoredStages=stage;
  const row=await one<{revision:number;data:string}>(tx.db,'SELECT revision,data FROM garden_worlds WHERE user_id=?',tx.player.id);
  const world=projectLiveGarden(tx.player,row?JSON.parse(row.data) as GardenWorldState:null);save(tx,row,world);
  const gift=FLOWERLIGHT_GARDEN_GIFTS[stage-1]!,ids=flowerlightGiftInstanceIds(gift);
  return {player:tx.player,world,granted:true,reward:definition.reward,decoration:{itemId:gift.itemId,variant:gift.variant,quantity:gift.quantity,installed:ids.filter(id=>!!world.placements[id]),stored:ids.filter(id=>!world.placements[id])}};
 });
}
export async function startAnimalExpedition(env:ApiEnv,userId:string,body:Record<string,unknown>,settings?:RuntimeSettings){
 const input=z.object({roundId:z.string().min(1).max(100).optional(),restart:z.boolean().optional(),attemptId:z.string().min(1).max(100).optional()}).parse(body);
 const controls=settings??(await runtime(env)).settings,config=controls.gameEvents.animalExpedition;
 return mutate(env,userId,operationKey(body),'animal-expedition:start:'+JSON.stringify(input),tx=>{
  const configured=configuredExpeditionRound(controls),saved=tx.player.animalExpedition;
  // Older installed clients omit roundId; keep their unfinished round stable.
  const active=expeditionRounds(saved)[0],roundId=input.roundId??(active&&active.completedStages<ANIMAL_EXPEDITION_STAGES.length?active.roundId:configured.roundId),known=expeditionRound(saved,roundId);
  ensure(roundId===configured.roundId||!!known,'EXPEDITION_CHANGED','이 원정은 시작할 수 없어요. 다시 열어 주세요.',409);
  const progress=tx.player.animalExpedition=selectExpeditionRound(saved,known??configured);
  ensure(progress.completedStages<ANIMAL_EXPEDITION_STAGES.length,'EXPEDITION_COMPLETE','친구들을 모두 구했어요. 정원에서 만나 보세요!',409);
  if(progress.attempt&&!input.restart)return {player:tx.player};
  ensure(tx.player.level>=config.minLevel,'EXPEDITION_LOCKED',`레벨 ${config.minLevel}부터 동물 구출 원정에 참여할 수 있어요.`,409);
  if(input.restart)ensure(progress.attempt?.id===input.attemptId,'EXPEDITION_CHANGED','다른 기기에서 원정이 바뀌었어요. 다시 열어 주세요.',409);
  ensure(gameEventAvailable('animalExpedition',controls,tx.now),'EVENT_NOT_OPEN','지금은 이벤트 참여 시간이 아니에요.',409);
  const daily=expeditionDailyStatus(progress,tx.now,config.dailyLimit);
  ensure(daily.remaining>0,'EXPEDITION_DAILY_LIMIT','오늘의 원정 도전 횟수를 모두 사용했어요. 한국 시간 00:00에 다시 도전할 수 있어요.',409);
  progress.dailyAttempts={day:daily.day,used:daily.used+1};
  const stage=progress.completedStages+1,variant=input.restart?((progress.attempt?.variant??0)+1)%3:0;
  progress.attempt={id:uid(),stage,variant,startedAt:tx.now,level:animalExpeditionLevel(stage,variant)};
  return {player:tx.player};
 });
}
export function finishAnimalExpedition(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const input=z.object({attemptId:z.string().min(1).max(100),actions:z.array(actionSchema.refine(action=>action.type==='swap'||action.type==='tap')).min(1).max(120)}).parse(body);
 return mutate(env,userId,operationKey(body),'animal-expedition:finish:'+JSON.stringify(input),async tx=>{
  const saved=tx.player.animalExpedition,rounds=expeditionRounds(saved);
  if(rounds.some(round=>round.completedAttempts.includes(input.attemptId)))return {player:tx.player,granted:false};
  const round=rounds.find(round=>round.attempt?.id===input.attemptId),progress=round?(saved?.roundId===round.roundId||!saved?.roundId&&round.animal==='dog'?saved:saved?.pastRounds?.find(value=>value.roundId===round.roundId)):undefined;
  const attempt=progress?.attempt;ensure(progress&&attempt?.id===input.attemptId,'EXPEDITION_CHANGED','다른 기기에서 원정이 바뀌었어요. 다시 열어 주세요.',409);
  ensure(attempt.stage===progress.completedStages+1,'EXPEDITION_STAGE_ORDER','앞 코스부터 차례로 완료해 주세요.',409);
  const won=(level:LevelDefinition)=>{const result=replay(level,input.actions);return result.accepted&&result.state.status==='won';};
  const compatible=compatibleExpeditionLevel(attempt.level);
  ensure(won(attempt.level)||(compatible!==attempt.level&&won(compatible)),'EXPEDITION_NOT_COMPLETE','동물을 집까지 안내한 기록을 확인할 수 없어요.',409);
  const definition=ANIMAL_EXPEDITION_STAGES[attempt.stage-1]!;grantActivityReward(tx,definition.reward);
  progress.completedStages=attempt.stage;progress.completedAttempts.push(attempt.id);delete progress.attempt;
  if(progress.completedStages===ANIMAL_EXPEDITION_STAGES.length)await grantEventDecoration(tx,EXPEDITION_ANIMALS[round!.animal].itemId,expeditionGrantId(round!));
  return {player:tx.player,granted:true,reward:definition.reward,animal:round!.animal,roundId:round!.roundId};
 });
}

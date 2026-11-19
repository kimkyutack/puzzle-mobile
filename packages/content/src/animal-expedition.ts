import type {ActivityReward,LevelDefinition,AnimalExpeditionProgress,AnimalExpeditionRoundProgress,ExpeditionAnimal} from '@garden/contracts';
import type {RuntimeSettings} from '../../contracts/src/operations';
import {gameEventConfig} from '../../contracts/src/operations';
import {missionPeriod} from './missions';
import {animalExpeditionCandidate} from './animal-expedition-candidates';
import recipes from './animal-expedition-recipes.json';
export const ANIMAL_EXPEDITION_MIN_LEVEL=20;
export const ANIMAL_EXPEDITION_ID='woodland-friends-v1';
export const ANIMAL_EXPEDITION_DOG_GRANT_ID='woodland-dog-v2';
export const ANIMAL_EXPEDITION_DAILY_LIMIT=3;
export const ANIMAL_EXPEDITION_STAGES=[
 {title:'숲 입구의 발자국',description:'길을 막은 흙마개 위에서 타일을 맞춰 주세요.',reward:{coins:50,items:{hammer:1}}},
 {title:'굽이진 꽃길',description:'구불구불한 길을 열어 친구를 집으로 안내해요.',reward:{coins:75,items:{'sweep-row':1}}},
 {title:'연못 너머의 친구',description:'통나무 사이에서 특수 아이템을 만들어 물가의 길을 이어요.',reward:{coins:100,items:{bomb:1}}},
 {title:'집으로 가는 약속',description:'겹겹의 통나무를 치우고 굽이진 길을 끝까지 이어 주세요.',reward:{coins:125,items:{rainbow:1}}},
 {title:'숲속 쉼터',description:'좁아진 숲길에서 폭탄과 로켓을 조합해 친구를 쉼터까지 안내해요.',reward:{coins:150,items:{'world-bomb':1}}},
 {title:'노을빛 징검다리',description:'징검다리의 굽이를 따라 막힌 길을 하나씩 열어 주세요.',reward:{coins:175,items:{'sweep-column':1}}},
 {title:'바람 부는 언덕',description:'언덕을 돌아가는 긴 길에서 로켓 조합을 활용해 보세요.',reward:{coins:200,items:{bomb:2}}},
 {title:'반딧불 숲길',description:'통나무 뒤에 숨은 길을 찾아 친구와 함께 숲을 건너요.',reward:{coins:225,items:{rainbow:1}}},
 {title:'정원 앞 마지막 굽이',description:'길을 넓게 여는 폭탄과 로켓으로 마지막 언덕을 넘어요.',reward:{coins:250,items:{'world-bomb':1}}},
 {title:'정원으로 초대해요',description:'숲의 길을 모두 이어 동물 친구를 정원에 초대해요.',reward:{coins:300,items:{'world-bomb':2}}},
] satisfies Array<{title:string;description:string;reward:ActivityReward}>;
export function expeditionDailyStatus(progress:AnimalExpeditionProgress|undefined,now:number,maximum=ANIMAL_EXPEDITION_DAILY_LIMIT){const period=missionPeriod('daily',now),used=progress?.dailyAttempts?.day===period.id?progress.dailyAttempts.used:0;return {day:period.id,used,maximum,remaining:Math.max(0,maximum-used),nextReset:period.endsAt};}
/** Ten certified routes with progressively longer paths. No inventory tools or hearts. */
export function animalExpeditionLevel(stage:number,variant=0):LevelDefinition {
 if(!Number.isInteger(stage)||stage<1||stage>ANIMAL_EXPEDITION_STAGES.length)throw Error('INVALID_EXPEDITION_STAGE');
 if(!Number.isInteger(variant)||variant<0||variant>=3)throw Error('INVALID_EXPEDITION_VARIANT');
 const recipe=recipes.find(recipe=>recipe.stage===stage);if(!recipe)throw Error('EXPEDITION_CONTENT_NOT_READY');
 const base=animalExpeditionCandidate(stage,recipe.seeds[variant]!);
 return {...base,strategy:{id:ANIMAL_EXPEDITION_ID,name:ANIMAL_EXPEDITION_STAGES[stage-1]!.title,hint:ANIMAL_EXPEDITION_STAGES[stage-1]!.description}};
}

export const EXPEDITION_ANIMALS={
 dog:{name:'꼬마 웰시코기',itemId:'animal-dog'},
 panda:{name:'아기 판다',itemId:'animal-panda'},
 fox:{name:'사막여우',itemId:'animal-fox'},
 'red-panda':{name:'아기 레서판다',itemId:'animal-red-panda'},
} as const;
export const LEGACY_EXPEDITION_ROUND='legacy-dog-v1';
export function configuredExpeditionRound(settings?:Pick<RuntimeSettings,'gameEvents'>|null){const config=gameEventConfig('animalExpedition',settings);return {roundId:`${config.animal??'panda'}:${config.roundId??'001'}`,animal:config.animal??'panda'};}
export function expeditionRounds(progress:AnimalExpeditionProgress|undefined):AnimalExpeditionRoundProgress[]{
 if(!progress)return [];
 const {pastRounds,dailyAttempts,...current}=progress;
 return [{...current,roundId:current.roundId??LEGACY_EXPEDITION_ROUND,animal:current.animal??'dog'},...(pastRounds??[])];
}
export function expeditionRound(progress:AnimalExpeditionProgress|undefined,roundId:string){return expeditionRounds(progress).find(round=>round.roundId===roundId);}
/** Switch active round without losing previous progress or the shared daily counter. */
export function selectExpeditionRound(progress:AnimalExpeditionProgress|undefined,target:{roundId:string;animal:ExpeditionAnimal}):AnimalExpeditionProgress{
 const rounds=expeditionRounds(progress),existing=rounds.find(round=>round.roundId===target.roundId);
 return {...(existing??{...target,completedStages:0,completedAttempts:[]}),dailyAttempts:progress?.dailyAttempts,pastRounds:rounds.filter(round=>round.roundId!==target.roundId)};
}
export function expeditionGrantId(round:Pick<AnimalExpeditionRoundProgress,'roundId'|'animal'>){return round.roundId===LEGACY_EXPEDITION_ROUND?ANIMAL_EXPEDITION_DOG_GRANT_ID:'expedition-friend:'+round.roundId;}

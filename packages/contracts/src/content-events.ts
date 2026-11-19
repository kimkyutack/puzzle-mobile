import type {ActivityReward,LevelDefinition} from './index';

/** The inaugural festival is a personal seven-day journey; earned gifts never expire. */
export interface FlowerFestivalProgress {
 id:string;startedAt:number;endsAt:number;petals:number;restoredStages:number;
}
export interface AnimalExpeditionAttempt {id:string;stage:number;variant?:number;startedAt:number;level:LevelDefinition}
export type ExpeditionAnimal = 'dog' | 'panda' | 'fox' | 'red-panda';
export type ExclusiveExpeditionAnimal = Exclude<ExpeditionAnimal,'dog'>;
export interface AnimalExpeditionRoundProgress {
 roundId:string;animal:ExpeditionAnimal;
 completedStages:number;completedAttempts:string[];attempt?:AnimalExpeditionAttempt;
}
export interface AnimalExpeditionProgress {
 /** Absent metadata identifies the original dog expedition. */
 roundId?:string;animal?:ExpeditionAnimal;pastRounds?:AnimalExpeditionRoundProgress[];
 completedStages:number;completedAttempts:string[];attempt?:AnimalExpeditionAttempt;
 /** New attempts only; a saved attempt may be resumed across the KST date boundary. */
 dailyAttempts?:{day:string;used:number};
}
export interface FestivalStage {
 id:string;title:string;target:number;reward:ActivityReward;
 dialogue:{speaker:'lumi'|'tori'|'naru';text:string}[];
}

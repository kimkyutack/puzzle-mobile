import type {ActivityReward} from './index';

export const GARDEN_GAMES=['acorn-pinball','greenhouse-water'] as const;
export const PINBALL_PHYSICS_VERSION=2 as const;
export type PinballPhysics=typeof PINBALL_PHYSICS_VERSION;
export type GardenGameId=typeof GARDEN_GAMES[number];
export const isGardenGame=(id:string):id is GardenGameId=>GARDEN_GAMES.some(game=>game===id);
export const GARDEN_GAME_PRIZES=['garden-acorn-cottage','garden-waterwork-pavilion','animal-panda','animal-fox','animal-red-panda'] as const;
export type GardenGamePrize=typeof GARDEN_GAME_PRIZES[number];
export type GardenGameReward=ActivityReward&{decoration?:string};
export interface GardenGameAttempt {id:string;stage:number;seed:number;expiresAt:number;pinballPhysics?:PinballPhysics}
export interface GardenGameResult {attemptId:string;stage:number;won:boolean;finishedAt:number;reward?:GardenGameReward}
export interface GardenGameRound {
 tickets:number;
 completed:number;
 grandPrize?:GardenGamePrize;
 attempt?:GardenGameAttempt;
 result?:GardenGameResult;
}
export interface GardenGameProgress {
 freeDay?:string;
 rounds:Record<string,GardenGameRound>;
}

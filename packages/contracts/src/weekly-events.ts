import type {Player} from './index';

export const WEEKLY_EVENTS=['animal-expedition','acorn-pinball','greenhouse-water'] as const;
export type WeeklyEventId=typeof WEEKLY_EVENTS[number];
const WEEK=7*24*60*60*1000;
const EPOCH=Date.UTC(2026,10,15,15);

/** Monday 00:00 in Korea. Each return of the rescue event advances its animal. */
export function weeklyEvent(now:number){
 const index=Math.floor((now-EPOCH)/WEEK);
 const slot=((index%3)+3)%3;
 const startsAt=EPOCH+index*WEEK;
 return {id:WEEKLY_EVENTS[slot]!,key:'week-'+startsAt,startsAt,endsAt:startsAt+WEEK,cycle:Math.floor(index/3)};
}
export const isWeeklyEvent=(id:string):id is WeeklyEventId=>WEEKLY_EVENTS.some(value=>value===id);
export const weeklyRoundId=(configured:string,now:number)=>'w'+Math.floor(weeklyEvent(now).startsAt/86400000)+'-'+configured;

/** Progress and attempts expire together. Already awarded wallet and garden items remain owned. */
export function resetWeeklyEvents(player:Player,now:number):Player{
 const current=weeklyEvent(now);
 if(player.weeklyEventKey===current.key)return player;
 const {animalExpedition,gardenGames,...rest}=player;
 return {...rest,weeklyEventKey:current.key};
}

import {describe,it,expect} from 'vitest';
import {newPlayer} from '../apps/api/src/db';
import {eventTabs,type EventTabInput} from '../apps/client/src/event-tabs';
import {FLOWERLIGHT_ID} from '../packages/content/src/flowerlight';
import {emptyPowerUses} from '../packages/content/src/power-festival';
import {missionPeriod} from '../packages/content/src/missions';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';
const now=Date.UTC(2026,10,9,3,5); // 12:05 KST
function input():EventTabInput{
 const player=newPlayer('event-tab-qa',now);player.level=84;
 return {player,now,dailyAvailable:true,treasureRemaining:3,treasurePlaying:false,season:{ends_at:now+86400000},personal:{progress:7,target:10,claimed:false},guild:{progress:14,target:30,claimed:false},hasGuild:true,startRush:{enabled:true,dailyTimes:['12:00','18:00','21:00']}};
}
const ready=(value:EventTabInput,id:string)=>eventTabs(value).find(tab=>tab.id===id)?.attention;
describe('event icon availability and attention',()=>{
 it('offers the fifth garden invitation tab after level five and keeps social restrictions',()=>{
  const value=input();expect(eventTabs(value).map(tab=>tab.id)).toEqual(['attendance','flowerlight','treasure','season','garden-invite']);
  value.socialAllowed=false;expect(ready(value,'garden-invite')).toBeUndefined();
  value.socialAllowed=true;value.player.level=4;expect(ready(value,'garden-invite')).toBeUndefined();
  value.player.level=5;value.features={guild:false};expect(ready(value,'garden-invite')).toBeUndefined();
 });
 it('removes the rescue dot after all three entries are spent, but keeps free resume and resets at KST midnight',()=>{
  const value=input();value.player.animalExpedition={roundId:'panda:001',animal:'panda',completedStages:2,completedAttempts:[],dailyAttempts:{day:missionPeriod('daily',now).id,used:3}};
  expect(ready(value,'animal-expedition')).toBeUndefined();value.expeditionCanResume=true;expect(ready(value,'animal-expedition')).toBeUndefined();value.expeditionCanResume=false;value.now=missionPeriod('daily',now).endsAt;expect(ready(value,'animal-expedition')).toBeUndefined();
 });
 it('uses operator schedules, unlock levels and quota limits instead of leaving unavailable event dots',()=>{
  const value=input();value.settings=defaultOperationsRuntime();value.settings.gameEvents.animalExpedition.minLevel=100;expect(ready(value,'animal-expedition')).toBeUndefined();value.settings.gameEvents.animalExpedition.minLevel=20;
  value.settings.gameEvents.animalExpedition.startsAt=now+1000;expect(ready(value,'animal-expedition')).toBeUndefined();value.settings.gameEvents.animalExpedition.startsAt=0;value.player.animalExpedition={roundId:'panda:001',animal:'panda',completedStages:1,completedAttempts:[],dailyAttempts:{day:missionPeriod('daily',now).id,used:1}};value.settings.gameEvents.animalExpedition.dailyLimit=1;expect(ready(value,'animal-expedition')).toBeUndefined();
 });
 it('keeps attendance first and moves the three weekly games out of the event list',()=>{
  const value=input();value.dailyAvailable=false;
  expect(eventTabs(value).slice(0,4).map(tab=>tab.id)).toEqual(['attendance','flowerlight','treasure','season']);
  for(const id of ['animal-expedition','acorn-pinball','greenhouse-water','power-festival'])expect(eventTabs(value).some(tab=>tab.id===id)).toBe(false);
  expect(ready(value,'attendance')).toBe(false);
 });
 it('keeps the treasure dot until all plays are used, including an unfinished final attempt',()=>{
  const value=input();value.treasureRemaining=2;expect(ready(value,'treasure')).toBe(true);
  value.treasureRemaining=0;expect(ready(value,'treasure')).toBe(false);
  value.treasurePlaying=true;expect(ready(value,'treasure')).toBe(true);
 });
 it('marks festival play and earned gifts, but clears the dot after completion or an expired unrewarded journey',()=>{
  const value=input();expect(ready(value,'flowerlight')).toBe(true);
  value.player.flowerFestival={id:FLOWERLIGHT_ID,startedAt:now-1000,endsAt:now+1000,petals:0,restoredStages:0};
  expect(ready(value,'flowerlight')).toBe(true);
  value.player.flowerFestival.endsAt=now-1;expect(ready(value,'flowerlight')).toBe(false);
  value.player.flowerFestival.petals=2;expect(ready(value,'flowerlight')).toBe(true);
  value.player.flowerFestival.restoredStages=5;value.player.flowerFestival.petals=20;expect(ready(value,'flowerlight')).toBe(false);
 });
 it('shows expedition at level 20 and keeps its playable dot between courses',()=>{
  const value=input();value.player.level=19;expect(ready(value,'animal-expedition')).toBeUndefined();
  value.player.level=20;value.player.animalExpedition={roundId:'panda:001',animal:'panda',completedStages:1,completedAttempts:['first']};expect(ready(value,'animal-expedition')).toBeUndefined();
  value.player.animalExpedition.completedStages=10;expect(ready(value,'animal-expedition')).toBeUndefined();
 });
 it('keeps active and expired power challenges out of the event tabs',()=>{
  const value=input();value.player.powerFestival={id:'power',day:missionPeriod('daily',now).id,startedAt:now-1000,endsAt:now+1000,counts:emptyPowerUses(),claimedStages:0};
  expect(ready(value,'power-festival')).toBeUndefined();
  value.player.powerFestival.endsAt=now-1;expect(ready(value,'power-festival')).toBeUndefined();
 });
 it('does not mark season goals that are still in progress even when attendance is available',()=>{
  const value=input();expect(ready(value,'attendance')).toBe(true);
  expect(ready(value,'season')).toBe(false);
 });
 it('clears the season dot when both completed rewards have been claimed',()=>{
  const value=input();value.personal.progress=10;value.guild.progress=30;
  expect(ready(value,'season')).toBe(true);
  value.personal.claimed=true;expect(ready(value,'season')).toBe(true);
  value.guild.claimed=true;expect(ready(value,'season')).toBe(false);
  expect(ready(value,'attendance')).toBe(true);
 });
 it('only counts a completed guild goal when the player belongs to a guild',()=>{
  const value=input();value.guild.progress=value.guild.target;
  value.hasGuild=false;expect(ready(value,'season')).toBe(false);
  value.hasGuild=true;expect(ready(value,'season')).toBe(true);
  value.guild.claimed=true;expect(ready(value,'season')).toBe(false);
 });
 it('only marks an unclaimed completed season reward while the server season is active',()=>{
  const value=input();value.personal.progress=value.personal.target;
  expect(ready(value,'season')).toBe(true);
  value.season!.ends_at=now-1;expect(ready(value,'season')).toBe(false);
  value.season!.ends_at=now+1;expect(ready(value,'season')).toBe(true);
  value.season=null;expect(ready(value,'season')).toBe(false);
 });
 it('keeps unlimited tools on home during both active and waiting windows and respects disabled events',()=>{
  const value=input();expect(ready(value,'start-rush')).toBeUndefined();
  value.now+=5*60000;expect(ready(value,'start-rush')).toBeUndefined();
  value.features={flowerlight:false,animalExpedition:false,treasure:false,powerFestival:false,daily:false};
  expect(eventTabs(value).map(tab=>tab.id)).toEqual(['attendance','season','garden-invite']);
  expect(ready(value,'attendance')).toBe(false);
 });
});

it('opens a new operator round after completion and keeps archive resume separate from the shared quota',()=>{
 const value=input();value.settings=defaultOperationsRuntime();value.player.animalExpedition={roundId:'panda:001',animal:'panda',completedStages:10,completedAttempts:[]};
 expect(ready(value,'animal-expedition')).toBeUndefined();value.settings.gameEvents.animalExpedition.animal='fox';expect(ready(value,'animal-expedition')).toBeUndefined();
 value.player.animalExpedition.dailyAttempts={day:missionPeriod('daily',now).id,used:3};expect(ready(value,'animal-expedition')).toBeUndefined();
 value.expeditionCanResume=true;expect(ready(value,'animal-expedition')).toBeUndefined();value.expeditionCanResume=false;expect(ready(value,'animal-expedition')).toBeUndefined();
});

it('marks a garden game only for an entry or a resumable attempt and resets free play at KST midnight',()=>{
 const value=input();value.settings=defaultOperationsRuntime();
 const game='acorn-pinball',day=missionPeriod('daily',now);
 const round={completed:2,tickets:0};
 value.player.gardenGames={[game]:{freeDay:day.id,rounds:{'001':round}}};
 expect(ready(value,game)).toBeUndefined();
 round.tickets=1;expect(ready(value,game)).toBeUndefined();
 round.tickets=0;value.now=day.endsAt-1;expect(ready(value,game)).toBeUndefined();
 value.now=day.endsAt;expect(ready(value,game)).toBeUndefined();
 value.settings.gameEvents[game].endsAt=day.endsAt;expect(ready(value,game)).toBeUndefined();
 value.player.gardenGames[game]!.rounds['001']!.attempt={id:'saved-attempt',stage:3,seed:37,expiresAt:day.endsAt+60_000};
 expect(ready(value,game)).toBeUndefined();
 value.settings.features[game]=false;expect(ready(value,game)).toBeUndefined();
});

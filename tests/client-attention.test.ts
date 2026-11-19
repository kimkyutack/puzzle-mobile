import {describe,it,expect} from 'vitest';
import type {EventRewardState,ProgressionResponse,TreasureAttempt} from '@garden/contracts';
import {newPlayer} from '../apps/api/src/db';
import {defaultOperationsRuntime,type OperationsSnapshot} from '../packages/contracts/src/operations';
import {attentionState} from '../apps/client/src/attention-state';
import {powerFestivalCanStart,passClaimable} from '../packages/content/src/attention';
import {emptyPowerUses,POWER_FESTIVAL_STAGES,addPowerUses} from '../packages/content/src/power-festival';
import {FLOWERLIGHT_ID} from '../packages/content/src/flowerlight';
import {missionPeriod} from '../packages/content/src/missions';

const now=Date.parse('2026-11-09T04:00:00Z');
function fixture(){
 const player=newPlayer('attention-qa',now);player.level=84;player.hearts=5;
 player.gardenGames={'acorn-pinball':{rounds:{'001':{completed:10,tickets:0}}},'greenhouse-water':{rounds:{'001':{completed:10,tickets:0}}}};
 player.flowerFestival={id:FLOWERLIGHT_ID,startedAt:now-86400000,endsAt:now+86400000,petals:20,restoredStages:5};player.animalExpedition={roundId:'panda:001',animal:'panda',completedStages:10,completedAttempts:[]};
 player.powerFestival={id:'finished',day:missionPeriod('daily',now).id,startedAt:now-3600000,endsAt:now-1000,counts:emptyPowerUses(),claimedStages:5};
 const rewards:EventRewardState={daily:{available:false,coins:50,nextReset:now+3600000},season:{id:'season',ends_at:now+3600000},personal:{progress:10,target:10,coins:300,claimed:true},guild:{progress:30,target:30,coins:100,claimed:true},pass:{points:10,premium:false,tiers:[{tier:1,points:10,freeClaimed:true,premiumClaimed:false}],guildGifts:[]}};
 const data:ProgressionResponse={player:structuredClone(player),daily:{id:'d',endsAt:now+3600000,missions:[]},weekly:{id:'w',endsAt:now+3600000,missions:[]},milestone:{clears:10,progress:0,target:10,awarded:1,owned:1},minigame:{remaining:0,maximum:3,nextReset:now+3600000,active:null},eventRewards:rewards,giftCounts:{hearts:0,items:0},notifications:{missions:9,events:9,pass:9,gifts:9,friends:0,guild:0,minigame:9,shop:9,flowerlight:9,expedition:9,festival:9}};
 const operations:OperationsSnapshot={settings:defaultOperationsRuntime(),maintenanceActive:false,revision:1,notices:[],events:[],serverNow:now};operations.settings.startBoosterRush.enabled=false;
 const state=()=>attentionState(player,data,operations,now);
 return {player,data,rewards,operations,state};
}
describe('menu attention uses actionable state instead of unrelated or stale aggregate counts',()=>{
 it('clears every reward/play dot after everything is completed, even if old notification totals are positive',()=>{
  const f=fixture(),state=f.state();expect(Object.values(state.counts).every(count=>count===0)).toBe(true);expect(Object.values(state.footer).every(count=>count===0)).toBe(true);
 });
 it('keeps attendance separate from claimed seasonal rewards and updates their shared event footer',()=>{
  const f=fixture();f.rewards.daily.available=true;expect(f.state().counts.events).toBe(1);expect(f.state().footer.events).toBe(1);
  f.rewards.daily.available=false;expect(f.state().footer.events).toBe(0);
  f.rewards.personal.claimed=false;expect(f.state().counts.events).toBe(1);f.rewards.personal.claimed=true;expect(f.state().footer.events).toBe(0);
 });
 it('keeps treasure marked for remaining attempts and for the unfinished last attempt',()=>{
  const f=fixture();f.data.minigame.remaining=2;expect(f.state().counts.minigame).toBe(1);expect(f.state().footer.events).toBe(1);
  f.data.minigame.remaining=0;f.data.minigame.active={id:'last',status:'playing',expiresAt:now+1000} as TreasureAttempt;expect(f.state().counts.minigame).toBe(1);
  f.data.minigame.active.status='won';expect(f.state().footer.events).toBe(0);
  f.data.minigame.active.status='playing';f.data.minigame.active.expiresAt=now;expect(f.state().counts.minigame).toBe(0);
 });
 it('uses the same expedition progress in the home shortcut, event tab total and footer',()=>{
  const f=fixture();f.player.animalExpedition!.completedStages=2;expect(f.state().contentEvents).toBe(1);expect(f.state().counts.expedition).toBe(1);expect(f.state().footer.events).toBe(1);
  f.player.animalExpedition!.completedStages=10;expect(f.state().contentEvents).toBe(0);
  f.player.level=19;f.player.animalExpedition=undefined;expect(f.state().counts.expedition).toBe(0);
 });
 it('ignores expired flowerlight play but keeps earned restore rewards claimable',()=>{
  const f=fixture(),event=f.player.flowerFestival!;event.restoredStages=0;event.petals=0;event.endsAt=now;expect(f.state().counts.flowerlight).toBe(0);
  event.petals=2;expect(f.state().contentEvents).toBe(1);event.restoredStages=5;expect(f.state().contentEvents).toBe(0);
 });
 it('marks power festival start/continuation and earned expired gifts, but clears the completed current day',()=>{
  const f=fixture();expect(powerFestivalCanStart(f.player,now)).toBe(false);expect(f.state().counts.festival).toBe(0);
  f.player.powerFestival=undefined;expect(f.state().counts.festival).toBe(1);
  f.player.powerFestival={id:'active',day:missionPeriod('daily',now).id,startedAt:now-1000,endsAt:now+1000,counts:emptyPowerUses(),claimedStages:0};expect(f.state().counts.festival).toBe(1);
  f.player.powerFestival.endsAt=now;expect(f.state().counts.festival).toBe(0);
  f.player.powerFestival.counts=addPowerUses(emptyPowerUses(),POWER_FESTIVAL_STAGES[0]!.targets);expect(f.state().counts.festival).toBe(1);
  f.player.powerFestival.claimedStages=1;expect(f.state().counts.festival).toBe(0);
 });
 it('counts only completed unclaimed missions in a live daily or weekly window',()=>{
  const f=fixture();f.data.daily.missions=[{id:'ready',period:'daily',title:'미션',metric:'clears',target:3,progress:3,claimed:false,claimable:false,icon:'star',reward:{coins:50,items:{}}}];
  expect(f.state().counts.missions).toBe(1);f.data.daily.missions[0]!.claimed=true;expect(f.state().counts.missions).toBe(0);
  f.data.daily.missions[0]!.claimed=false;f.data.daily.endsAt=now;expect(f.state().counts.missions).toBe(0);
 });
 it('does not mark unowned premium rewards and includes earned unsent guild gift vouchers',()=>{
  const f=fixture();expect(f.state().counts.pass).toBe(0);f.rewards.pass.premium=true;expect(f.state().counts.pass).toBe(1);
  f.rewards.pass.tiers[0]!.premiumClaimed=true;f.rewards.pass.guildGifts=[{seasonId:'old-season',sent:false}];expect(f.state().counts.pass).toBe(0);
  f.player.guildId='guild';expect(f.state().counts.pass).toBe(1);f.rewards.season=null;expect(passClaimable(f.rewards,f.player,now)).toBe(1);
  f.rewards.pass.guildGifts[0]!.sent=true;expect(f.state().footer.home).toBe(0);
 });
 it('does not mark stored hearts when full, while keeping collectible item gifts marked',()=>{
  const f=fixture();f.data.giftCounts={hearts:2,items:0};expect(f.state().counts.gifts).toBe(0);
  f.player.hearts=4;expect(f.state().counts.gifts).toBe(2);f.player.hearts=5;f.data.giftCounts.items=1;expect(f.state().counts.gifts).toBe(1);
 });
 it('keeps pending incoming friend and authorized guild requests separate and respects disabled features',()=>{
  const f=fixture();f.data.notifications.friends=1;f.data.notifications.guild=1;expect(f.state().footer.friends).toBe(1);expect(f.state().footer.guild).toBe(0);
  f.player.guildId='guild';expect(f.state().footer.guild).toBe(1);
  f.rewards.daily.available=true;f.data.minigame.remaining=3;f.player.animalExpedition=undefined;f.player.powerFestival=undefined;
  for(const id of Object.keys(f.operations.settings.features) as Array<keyof typeof f.operations.settings.features>)f.operations.settings.features[id]=false;
  expect(f.state().footer).toEqual({shop:0,friends:0,guild:0,home:0,events:0});
 });
 it('only marks published active unclaimed operations rewards with an actual reward',()=>{
  const f=fixture(),event={id:'ops',title:'선물',description:'',kind:'reward' as const,status:'published' as const,startsAt:now-1,endsAt:now+1,imageUrl:'',reward:{coins:10,stars:0,hearts:0,items:{}},revision:1,claimed:false};f.operations.events=[event];expect(f.state().liveEvents).toBe(1);expect(f.state().footer.events).toBe(1);
  event.claimed=true;expect(f.state().liveEvents).toBe(0);event.claimed=false;event.endsAt=now;expect(f.state().liveEvents).toBe(0);event.endsAt=now+1;event.reward.coins=0;expect(f.state().liveEvents).toBe(0);
 });
 it('includes the limited start-item window in the event footer and clears it at the boundary',()=>{
  const f=fixture();f.operations.settings.startBoosterRush={enabled:true,dailyTimes:['13:00']};expect(f.state().footer.events).toBe(1);
  expect(attentionState(f.player,f.data,f.operations,now+600000).footer.events).toBe(0);
 });
 it('ignores cached rewards and requests belonging to another account',()=>{
  const f=fixture();f.data.player.id='different';f.rewards.daily.available=true;f.data.notifications.friends=1;expect(f.state().footer.events).toBe(0);expect(f.state().footer.friends).toBe(0);
 });
});

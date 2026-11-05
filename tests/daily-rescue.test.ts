import {describe,it,expect} from 'vitest';
import {bridgeDailyWindow,bridgeLevel} from '@garden/content';
import {replay,stateHash,createGame} from '@garden/core';
import type {Action} from '@garden/contracts';
import {dailyRescueCacheKey,rescueCacheKey,restoreRescue} from '../apps/client/src/rescue-progress';
import proof from './fixtures/daily-rescue-proof.json';
describe('daily rescue calendar and separate progress',()=>{
 it('switches once at Korean midnight and keeps the same reward throughout a day',()=>{
  const before=bridgeDailyWindow(Date.parse('2026-11-05T14:59:59.999Z')),after=bridgeDailyWindow(Date.parse('2026-11-05T15:00:00.000Z'));
  expect(before.periodId).toBe('d:2026-11-05');expect(before.endsAt).toBe(Date.parse('2026-11-05T15:00:00.000Z'));expect(after.periodId).toBe('d:2026-11-06');
  expect(bridgeDailyWindow(Date.parse('2026-11-05T00:00:00Z')).reward).toEqual(before.reward);expect(after.endsAt-before.endsAt).toBe(86_400_000);
 });
 it('shows one existing item in a stable seven-day reward cycle',()=>{
  const now=Date.parse('2026-11-05T04:00:00Z'),days=Array.from({length:7},(_,i)=>bridgeDailyWindow(now+i*86_400_000));expect(new Set(days.map(day=>day.reward.item)).size).toBe(7);expect(days.every(day=>day.reward.quantity===1)).toBe(true);expect(bridgeDailyWindow(now+7*86_400_000).reward).toEqual(days[0]!.reward);
 });
 it('isolates accounts, days and the old won story cache without erasing other progress',()=>{
  const today=dailyRescueCacheKey('owner','d:2026-11-05'),tomorrow=dailyRescueCacheKey('owner','d:2026-11-06'),other=dailyRescueCacheKey('friend','d:2026-11-05');expect(new Set([today,tomorrow,other,rescueCacheKey('owner')]).size).toBe(4);
  const saved=new Map([[today,JSON.stringify(proof)],[rescueCacheKey('owner'),JSON.stringify(proof)]]);expect(restoreRescue(saved.get(today)!).state.status).toBe('won');expect(stateHash(restoreRescue(saved.get(tomorrow)??null).state)).toBe(stateHash(createGame(bridgeLevel())));expect(saved.size).toBe(2);
 });
 it('keeps an unclaimed win recoverable for a lost reward response and rejects corrupted cache',()=>{
  const result=replay(bridgeLevel(),proof as Action[]);expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(stateHash(restoreRescue(JSON.stringify(proof)).state)).toBe(stateHash(result.state));expect(restoreRescue('{bad').actions).toEqual([]);
 });
});

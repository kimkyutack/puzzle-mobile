import {describe,it,expect} from 'vitest';
import {createGame} from '@garden/core';
import {getLevel} from '@garden/content';
import type {PreBooster} from '@garden/contracts';
import {startBoosterCells,lumiIntroDuration,LUMI_INTRO} from '../apps/client/src/lumi-intro';

describe('Lumi start-booster delivery',()=>{
 it('finds exactly the cells createGame filled with the chosen start boosters',()=>{
  for(const picks of [['bomb'],['wind-row','rainbow'],['wind-row','bomb','rainbow']] as PreBooster[][])for(const level of [1,5,12,30]){
   const plain=createGame(getLevel(level)),state=createGame(getLevel(level),picks),cells=startBoosterCells(state,picks);
   expect(cells).toHaveLength(picks.length);
   expect(cells.map(at=>state.cells[at]!.tile!.kind).sort()).toEqual([...picks].sort());
   for(const at of cells)expect(plain.cells[at]!.tile?.kind).toBe('normal');
  }
 });
 it('plays only on a fresh run that picked start boosters',()=>{
  const state=createGame(getLevel(1),['bomb']);
  expect(startBoosterCells(createGame(getLevel(1)),[])).toEqual([]);
  expect(startBoosterCells({...state,turn:1},['bomb'])).toEqual([]);
 });
 it('keeps the whole delivery short, even with three boosters',()=>{
  expect(lumiIntroDuration(3)).toBeLessThan(2600);expect(lumiIntroDuration(3)).toBeGreaterThan(lumiIntroDuration(1));expect(LUMI_INTRO.flight).toBeGreaterThan(300);
 });
 it('scatters the start boosters across the board instead of filling the first free cells',()=>{
  let checked=0;
  for(let level=1;level<=60;level++){
   let state;try{state=createGame(getLevel(level),['wind-row','bomb','rainbow']);}catch{continue;}
   if(getLevel(level).startBoosterGuide)continue;
   const cells=startBoosterCells(state,['wind-row','bomb','rainbow']),rows=new Set(cells.map(at=>Math.floor(at/state.width)));
   const gap=Math.min(...cells.flatMap((a,i)=>cells.slice(i+1).map(b=>Math.hypot(a%state.width-b%state.width,Math.floor(a/state.width)-Math.floor(b/state.width)))));
   expect(rows.size,`level ${level}`).toBeGreaterThan(1);expect(gap,`level ${level}`).toBeGreaterThanOrEqual(2.5);checked++;
  }
  expect(checked).toBeGreaterThan(20);
 });
});

import {describe,it,expect} from 'vitest';
import {configureViewport} from '../apps/client/src/platform/viewport';
describe('native viewport ownership',()=>{
 it('reserves Android system bars without duplicating or dropping viewport options',()=>{
  const viewport={content:'width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no'};
  configureViewport('android',viewport);configureViewport('android',viewport);
  expect(viewport.content).toBe('width=device-width,initial-scale=1,user-scalable=no,viewport-fit=contain');
 });
 it('keeps iOS and web safe-area behavior and tolerates a missing meta tag',()=>{
  for(const platform of ['ios','web']){const viewport={content:'width=device-width,viewport-fit=cover'};configureViewport(platform,viewport);expect(viewport.content).toBe('width=device-width,viewport-fit=cover');}
  expect(()=>configureViewport('android',null)).not.toThrow();
 });
});

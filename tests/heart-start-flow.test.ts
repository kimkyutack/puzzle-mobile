import {describe,expect,it} from 'vitest';
import {HeartStartFlow} from '../apps/client/src/heart-start-flow';

const now=1_000;
const empty={hearts:0,unlimitedUntil:0};

describe('start interrupted by heart shortage',()=>{
 it('resumes once after a refill, but ordinary heart visits never start a level',()=>{
  const flow=new HeartStartFlow();
  expect(flow.close({...empty,hearts:5},now)).toBe('dismiss');
  flow.waitForHearts();
  expect(flow.close({...empty,hearts:5},now)).toBe('resume');
  expect(flow.close({...empty,hearts:5},now)).toBe('dismiss');
 });
 it('returns to the garden when closed without usable hearts',()=>{
  const flow=new HeartStartFlow();flow.waitForHearts();
  expect(flow.close(empty,now)).toBe('home');
  expect(flow.close({...empty,hearts:1},now)).toBe('dismiss');
 });
 it('accepts active unlimited play but not an expired grant',()=>{
  const flow=new HeartStartFlow();flow.waitForHearts();
  expect(flow.close({...empty,unlimitedUntil:now+1},now)).toBe('resume');
  flow.waitForHearts();
  expect(flow.close({...empty,unlimitedUntil:now},now)).toBe('home');
 });
 it('waits for a refill closed in flight and uses its latest result exactly once',()=>{
  const flow=new HeartStartFlow();flow.waitForHearts();flow.setWorking(true);
  expect(flow.close(empty,now)).toBe('wait');
  expect(flow.close(empty,now)).toBe('wait');
  expect(flow.setWorking(false)).toBe(true);
  expect(flow.close({...empty,hearts:5},now)).toBe('resume');
  expect(flow.setWorking(false)).toBe(false);
 });
 it('goes home after a failed refill and does not start later on regeneration',()=>{
  const flow=new HeartStartFlow();flow.waitForHearts();flow.setWorking(true);
  expect(flow.close(empty,now)).toBe('wait');expect(flow.setWorking(false)).toBe(true);
  expect(flow.close(empty,now)).toBe('home');
  expect(flow.close({...empty,hearts:1},now)).toBe('dismiss');
 });
 it('cancels delayed continuation when navigating away',()=>{
  const flow=new HeartStartFlow();flow.waitForHearts();flow.setWorking(true);
  expect(flow.close(empty,now)).toBe('wait');expect(flow.cancel()).toBe(true);
  expect(flow.setWorking(false)).toBe(false);
  expect(flow.close({...empty,hearts:5},now)).toBe('dismiss');
 });
});

import {describe,it,expect} from 'vitest';
import {STORY_SCENES} from '@garden/content';
import {pendingScenes,enqueueStoryScene,confirmStoryScenes} from '../apps/client/src/story-progress';
const storage=()=>{const data=new Map<string,string>();return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};};
describe('durable story acknowledgement outbox',()=>{
 it('survives a lost response and restart without sharing progress across accounts',()=>{
  const disk=storage();enqueueStoryScene('one','letters-prologue',disk);enqueueStoryScene('one','letters-prologue',disk);enqueueStoryScene('two','letters-sky-path',disk);
  const restarted={getItem:disk.getItem,setItem:disk.setItem};expect(pendingScenes('one',restarted)).toEqual(['letters-prologue']);expect(pendingScenes('two',restarted)).toEqual(['letters-sky-path']);
  confirmStoryScenes('one',['letters-prologue'],restarted);expect(pendingScenes('one',restarted)).toEqual([]);expect(pendingScenes('two',restarted)).toHaveLength(1);
 });
 it('drains all sixty-four scenes in old-server-compatible packets and keeps newly queued scenes during a response',()=>{
  const disk=storage();for(const scene of STORY_SCENES.slice(0,19))enqueueStoryScene('user',scene.id,disk);
  const first=pendingScenes('user',disk).slice(0,19);for(const scene of STORY_SCENES.slice(19))enqueueStoryScene('user',scene.id,disk);confirmStoryScenes('user',first,disk);
  expect(pendingScenes('user',disk)).toEqual(STORY_SCENES.slice(19).map(s=>s.id));const lengths:number[]=[];
  while(pendingScenes('user',disk).length){const packet=pendingScenes('user',disk).slice(0,19);lengths.push(packet.length);confirmStoryScenes('user',packet,disk);}
  expect(lengths).toEqual([19,19,7]);
 });
 it('does not pretend to save when persistent storage rejects the write',()=>{
  const disk={getItem:()=>null,setItem:()=>{throw Error('storage full');}};expect(()=>enqueueStoryScene('user','letters-prologue',disk)).toThrow('storage full');
 });
 it('does not resend malformed or removed scene IDs',()=>{
  const disk=storage();disk.setItem('garden-story-pending-user',JSON.stringify(['unknown',4,'letters-prologue','letters-prologue']));expect(pendingScenes('user',disk)).toEqual(['letters-prologue']);expect(()=>enqueueStoryScene('user','unknown',disk)).toThrow();
 });
});

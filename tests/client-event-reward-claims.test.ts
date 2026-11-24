import {describe,it,expect,vi} from 'vitest';
import type {OpsEvent} from '../packages/contracts/src/operations';
import {claimEventRewardBatch,collectedEventRewards} from '../apps/client/src/event-reward-claims';
const event=(id:string,claimed=false):OpsEvent=>({id,claimed,title:id,description:'',kind:'reward',status:'published',startsAt:0,endsAt:99999,imageUrl:'',revision:1,reward:{coins:200,stars:1,hearts:0,items:{hammer:1}}});
describe('event reward collection',()=>{
 it('claims only unclaimed real rewards and totals received balances',async()=>{
  const events=[event('received',true),event('ready'),{...event('empty'),reward:{coins:0,stars:0,hearts:0,items:{}}}],claim=vi.fn(async()=>{});
  const result=await claimEventRewardBatch(events,claim,id=>{events.find(event=>event.id===id)!.claimed=true});
  expect(result).toEqual(['ready']);expect(claim.mock.calls).toEqual([['ready']]);expect(collectedEventRewards(events)).toEqual({coins:400,stars:2,hearts:0,items:{hammer:2}});
 });
 it('keeps earlier successes and stops on failure so a retry skips the received gift',async()=>{
  const events=[event('one'),event('two'),event('three')],claim=vi.fn(async(id:string)=>{if(id==='two')throw new Error('offline')});
  await expect(claimEventRewardBatch(events,claim,id=>{events.find(event=>event.id===id)!.claimed=true})).rejects.toThrow('offline');
  expect(events.map(event=>!!event.claimed)).toEqual([true,false,false]);expect(claim.mock.calls.map(([id])=>id)).toEqual(['one','two']);
  const retry=vi.fn(async()=>{});expect(await claimEventRewardBatch(events,retry,()=>{})).toEqual(['two','three']);
 });
});

import {describe,it,expect} from 'vitest';
import {createGame} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Player,Run} from '@garden/contracts';
import {createRunGateway} from '../apps/client/src/run-gateway';
const input={idempotencyKey:'same-start-key',preBoosters:['rainbow'] as ['rainbow']};
describe('start against the deployed engine',()=>{
 it('uses the older production engine for both request and preview, caching one shared health read',async()=>{
  const calls:Array<{path:string;body:unknown}>=[],level=getLevel(20,'1.2.0'),run={level,state:createGame(level)} as Run;
  const transport=async<T>(path:string,body?:unknown):Promise<T>=>{calls.push({path,body});return (path==='/health'?{ok:true,engineVersion:'1.2.0'}:{player:{} as Player,run}) as T;};
  const gateway=createRunGateway(transport);expect(await Promise.all([gateway.resolveEngine(),gateway.resolveEngine()])).toEqual(['1.2.0','1.2.0']);
  const result=await gateway.start(input);expect(calls).toHaveLength(2);expect(calls[1]!.body).toEqual({...input,engineVersion:'1.2.0'});expect(result.run.level).toEqual(getLevel(20,await gateway.resolveEngine()));expect(calls).toHaveLength(2);
 });
 it('refreshes after a version rejection and retries once with the same key and boosters',async()=>{
  const posts:unknown[]=[],versions=['1.2.0','1.3.0'];
  const transport=async<T>(path:string,body?:unknown):Promise<T>=>{if(path==='/health')return {ok:true,engineVersion:versions.shift()} as T;posts.push(body);if(posts.length===1)throw {code:'INVALID_INPUT'};return {run:{},player:{}} as T;};
  await createRunGateway(transport).start(input);expect(posts).toEqual([{...input,engineVersion:'1.2.0'},{...input,engineVersion:'1.3.0'}]);
 });
 it('does not downgrade an unknown future engine, retry a charge on network failure or loop on unrelated invalid input',async()=>{
  let futureReads=0;const future=async<T>():Promise<T>=>{futureReads++;return {ok:true,engineVersion:'9.0.0'} as T;};await expect(createRunGateway(future).start(input)).rejects.toMatchObject({code:'UPDATE_REQUIRED'});expect(futureReads).toBe(1);
  for(const code of ['NETWORK','INVALID_INPUT','HEARTS_EMPTY']){const calls:string[]=[],gateway=createRunGateway(async<T>(path:string):Promise<T>=>{calls.push(path);if(path==='/health')return {ok:true,engineVersion:'1.2.0'} as T;throw {code};});await expect(gateway.start(input)).rejects.toMatchObject({code});expect(calls.filter(path=>path==='/runs/start')).toHaveLength(1);}
 });
 it('allows retry after a failed health request instead of caching a rejected promise',async()=>{
  let reads=0;const gateway=createRunGateway(async<T>():Promise<T>=>{if(++reads===1)throw new Error('offline');return {ok:true,engineVersion:'1.2.0'} as T;});await expect(gateway.resolveEngine()).rejects.toThrow('offline');expect(await gateway.resolveEngine()).toBe('1.2.0');
 });
});

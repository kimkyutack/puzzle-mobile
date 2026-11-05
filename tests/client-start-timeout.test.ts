import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('../apps/client/src/api-endpoint',()=>({apiBase:'https://qa.invalid/api'}));
vi.mock('../apps/client/src/platform/storage',()=>({tokenStorage:{get:async()=>null}}));
import {request} from '../apps/client/src/api';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('bounded start preparation',()=>{
 it('releases a never-responding start request at 20 seconds and permits an exact-key retry',async()=>{
  vi.useFakeTimers();const body={idempotencyKey:'same-key',engineVersion:'1.2.0',preBoosters:[]};let attempt=0;
  vi.stubGlobal('fetch',vi.fn((_url,init:RequestInit)=>{if(++attempt>1)return Promise.resolve(new Response(JSON.stringify({data:{ok:true}}),{status:200}));return new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));}));
  const pending=expect(request('/runs/start',body)).rejects.toMatchObject({code:'NETWORK'});await vi.advanceTimersByTimeAsync(20000);await pending;
  await expect(request('/runs/start',body)).resolves.toEqual({ok:true});expect(attempt).toBe(2);
 });
});

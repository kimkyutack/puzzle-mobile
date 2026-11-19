import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../apps/client/src/api-endpoint',()=>({apiBase:'/api'}));
vi.mock('../apps/client/src/platform/app-info',()=>({clientRelease:async()=>({platform:'web',version:'test'})}));
vi.mock('../apps/client/src/platform/storage',()=>({tokenStorage:{get:async()=>null}}));
import {request,setToken} from '../apps/client/src/api';

beforeEach(()=>{vi.useFakeTimers();setToken('');});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('festival requests recover from a stalled connection',()=>{
 for(const path of ['/flowerlight/start','/flowerlight/restore'])it(`bounds ${path} and permits a retry with the same command`,async()=>{
  const body={key:'festival-stalled-request',...(path.endsWith('restore')?{stage:1}:{})};
  const transport=vi.fn<typeof fetch>().mockImplementationOnce((_url,init)=>new Promise((_resolve,reject)=>{
   init!.signal!.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  })).mockResolvedValueOnce(Response.json({data:{confirmed:true},serverNow:Date.now()}));
  vi.stubGlobal('fetch',transport);
  const stalled=request(path,body),failure=expect(stalled).rejects.toMatchObject({code:'NETWORK'});
  await vi.advanceTimersByTimeAsync(20_000);await failure;
  expect(await request(path,body)).toEqual({confirmed:true});
  expect(transport.mock.calls.map(call=>JSON.parse(call[1]!.body as string))).toEqual([body,body]);
  expect(vi.getTimerCount()).toBe(0);
 });
});

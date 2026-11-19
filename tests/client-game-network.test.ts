import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {request,setToken} from '../apps/client/src/api';

vi.mock('../apps/client/src/platform/app-info',()=>({
 clientRelease:async()=>({platform:'ios',version:'1.12'}),
}));
vi.mock('../apps/client/src/platform/storage',()=>({
 tokenStorage:{get:async()=>({accessToken:'test-access',refreshToken:'test-refresh'}),set:async()=>{},clear:async()=>{}},
}));
vi.mock('../apps/client/src/platform/account-age',()=>({clearAccountAge:()=>{}}));

const json=(data:unknown)=>Response.json({data,serverNow:1000,stateVersion:1});
const expired=()=>Response.json({error:{code:'SESSION_EXPIRED',message:'Session expired'}},{status:401});

beforeEach(()=>{vi.useFakeTimers();setToken('');});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('game request deadlines',()=>{
 it('times out an unresolved save and can resend the exact payload and key',async()=>{
  let blocked:AbortSignal|null=null;
  const fetch=vi.fn<typeof globalThis.fetch>()
   .mockImplementationOnce((_url,options)=>{blocked=options?.signal??null;return new Promise<Response>(()=>{});})
   .mockResolvedValueOnce(json({sequence:8}));
  vi.stubGlobal('fetch',fetch);
  const payload={idempotencyKey:'same-batch',sequence:7,actions:[{type:'swap',from:4,to:5}]};
  const first=request('/runs/test/actions',payload);
  const rejected=expect(first).rejects.toMatchObject({code:'NETWORK'});
  await vi.advanceTimersByTimeAsync(8_000);
  await rejected;
  expect(blocked).toMatchObject({aborted:true});
  await expect(request('/runs/test/actions',payload)).resolves.toEqual({sequence:8});
  expect(fetch.mock.calls[0]?.[1]?.body).toBe(fetch.mock.calls[1]?.[1]?.body);
 });

 it('covers a stalled response body after the headers have arrived',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream({start(){}})));
  vi.stubGlobal('fetch',fetch);
  const result=request('/runs/test/finish',{key:'finish-test'});
  const rejected=expect(result).rejects.toMatchObject({code:'NETWORK'});
  await vi.advanceTimersByTimeAsync(8_000);
  await rejected;
  expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
 });

 it('shares the original deadline across renewal and does not replay a timed-out command',async()=>{
  setToken('expired');
  let refresh!: (value:Response)=>void;
  const fetch=vi.fn<typeof globalThis.fetch>()
   .mockImplementationOnce(()=>new Promise(resolve=>setTimeout(()=>resolve(expired()),5_000)))
   .mockImplementationOnce(()=>new Promise(resolve=>{refresh=resolve;}));
  vi.stubGlobal('fetch',fetch);
  const result=request('/runs/test/continue',{key:'continue-test-7',sequence:7,expectedCost:900});
  const rejected=expect(result).rejects.toMatchObject({code:'NETWORK'});
  await vi.advanceTimersByTimeAsync(8_000);
  await rejected;
  refresh(json({accessToken:'fresh',refreshToken:'refresh'}));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(fetch.mock.calls[1]?.[0])).toContain('/auth/refresh');
 });

 it('preserves explicit server rejections and treats an upstream error page as a connection failure',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>()
   .mockResolvedValueOnce(Response.json({error:{code:'RUN_CLOSED',message:'The run ended'}},{status:409}))
   .mockResolvedValueOnce(new Response('<html>upstream timeout</html>',{status:504}));
  vi.stubGlobal('fetch',fetch);
  await expect(request('/runs/test/actions',{idempotencyKey:'key'})).rejects.toMatchObject({code:'RUN_CLOSED'});
  await expect(request('/runs/test/actions',{idempotencyKey:'key'})).rejects.toMatchObject({code:'NETWORK'});
 });
});

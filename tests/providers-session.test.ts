import {beforeEach,describe,it,expect,vi} from 'vitest';
const stored=vi.hoisted(()=>({accessToken:'old',refreshToken:'refresh-token'}));
vi.mock('../apps/client/src/platform/storage',()=>({tokenStorage:{get:async()=>({...stored}),set:async(value:typeof stored)=>Object.assign(stored,value)}}));
let api:typeof import('../apps/client/src/api');
beforeEach(async()=>{vi.resetModules();stored.accessToken='old';stored.refreshToken='refresh-token';api=await import('../apps/client/src/api');api.setToken('old');});
function ok(data:unknown){return Response.json({data,serverNow:Date.now(),stateVersion:1});}
function expired(){return Response.json({error:{code:'UNAUTHORIZED',message:'expired'},serverNow:Date.now()},{status:401});}
describe('session renewal without replaying under another account',()=>{
 it('shares refresh and retries the same idempotent body',async()=>{
  let renewals=0;const bodies:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   if(url.endsWith('/auth/refresh')){renewals++;await Promise.resolve();return ok({accessToken:'new',refreshToken:'refresh-token'});}
   bodies.push(String(init.body));return (init.headers as Record<string,string>).Authorization==='Bearer old'?expired():ok({done:true});
  }));
  const body={idempotencyKey:'unchanged',amount:1};
  await expect(Promise.all([api.request('/hearts/buy',body),api.request('/hearts/buy',body)])).resolves.toEqual([{done:true},{done:true}]);
  expect(renewals).toBe(1);expect(new Set(bodies)).toEqual(new Set([JSON.stringify(body)]));expect(stored.accessToken).toBe('new');
 });
 it('does not replay a failed mutation after account switching',async()=>{
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  vi.stubGlobal('fetch',vi.fn(async()=>{await gate;return expired();}));
  const pending=api.request('/shop/buy',{idempotencyKey:'one',item:'hammer'});api.setToken('another-account');release();
  await expect(pending).rejects.toMatchObject({code:'SESSION_CHANGED'});expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('stops after one renewal and leaves invalid refresh errors visible',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>expired()));
  await expect(api.request('/me')).rejects.toMatchObject({code:'UNAUTHORIZED'});expect(fetch).toHaveBeenCalledTimes(2);
 });
});

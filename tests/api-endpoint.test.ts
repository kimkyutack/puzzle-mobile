import {afterEach,describe,expect,it,vi} from 'vitest';
import deployment from '../config/deployment.json';
import {resolveApiBase,sessionStorageKey} from '../apps/client/src/api-endpoint';

afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
describe('deployed API routing',()=>{
 it('uses the Worker in release builds and preserves the explicit local development proxy',()=>{
  expect(resolveApiBase(undefined,false)).toBe(deployment.apiUrl);
  expect(resolveApiBase('',true)).toBe('/api');
  expect(resolveApiBase('http://localhost:8787/api/',false)).toBe('http://localhost:8787/api');
  expect(resolveApiBase(deployment.apiUrl+'/',true)).toBe(deployment.apiUrl);
 });
 it.each(['/api','http://api.example.com/api','https://user:password@api.example.com/api','https://api.example.com/api?token=value','https://api.example.com/api#value','https://api.example.com/'])('rejects an invalid deployed base: %s',value=>{
  expect(()=>resolveApiBase(value,false)).toThrow();
 });
 it('builds guild sockets from the same remote API with an encoded single-use ticket',async()=>{
  vi.stubEnv('VITE_API_URL',deployment.apiUrl+'/');
  const {guildSocketUrl}=await import('../apps/client/src/api-endpoint');
  const url=new URL(guildSocketUrl('ticket+with&symbols','capacitor://localhost/index.html'));
  expect(url.protocol).toBe('wss:');expect(url.host).toBe(new URL(deployment.apiUrl).host);
  expect(url.pathname).toBe('/api/guild/socket');expect(url.searchParams.get('ticket')).toBe('ticket+with&symbols');
 });
 it('preserves local credentials and keeps each remote database session separate',()=>{
  expect(sessionStorageKey('/api')).toBe('cloud-garden-session-v1');
  expect(sessionStorageKey('http://localhost:8787/api')).toBe('cloud-garden-session-v1');
  expect(sessionStorageKey(deployment.apiUrl)).not.toBe(sessionStorageKey('/api'));
  expect(sessionStorageKey(deployment.apiUrl)).not.toBe(sessionStorageKey('https://other.example.com/api'));
 });
});

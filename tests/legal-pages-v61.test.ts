import {afterEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../apps/api/src/guild-room',()=>({GuildRoom:class{}}));
import worker from '../apps/api/src/index';
import {serveLegalPage} from '../apps/api/src/legal-pages';
import LegalLinks from '../apps/client/src/LegalLinks';
import {setLocale} from '../apps/client/src/i18n';
import legal from '../config/legal.json';
import type {ApiEnv} from '../apps/api/src/db';

const origin='https://legal.example.test';
const read=(path:string,method='GET')=>serveLegalPage(new Request(origin+path,{method}));
afterEach(()=>{vi.restoreAllMocks();setLocale('ko');});
describe('public legal pages',()=>{
 it.each(['/privacy','/terms','/account-deletion'])('serves %s through the Worker without a session or database access',async path=>{
  const prepare=vi.fn(()=>{throw Error('Legal page must not read private data');});
  const env={DB:{prepare},CLIENT_ORIGINS:'',ENVIRONMENT:'production'} as unknown as ApiEnv;
  vi.spyOn(console,'log').mockImplementation(()=>{});
  const response=await worker.fetch(new Request(origin+path),env,{waitUntil:vi.fn()} as unknown as ExecutionContext);
  expect(response.status).toBe(200);expect(response.headers.get('x-d1-calls')).toBe('0');expect(prepare).not.toHaveBeenCalled();
  const html=await response.text();expect(html).toContain('<html lang="ko"');expect(html).toContain(legal.serviceName);expect(html).toContain(legal.businessName);
  expect(html).not.toMatch(/<script|<iframe|<form/);expect(response.headers.has('set-cookie')).toBe(false);
 });
 it('publishes only business details, excluding identity document and tax office details',async()=>{
  const html=await read('/privacy')!.text();
  for(const text of [legal.businessRegistrationNumber,legal.address,legal.representative,legal.contactEmail])expect(html).toContain(text);
  // Check document-only fields without copying their actual private values into a test.
  expect(html).not.toMatch(/\d{6}-[1-8*][\d*]{6}|발급번호|접수번호|세무서|국세청민원|주민등록번호\s*[:：]/);
  expect(html).not.toContain('.pdf');
 });
 it('opens a populated email request rather than claiming that a request has already been sent',async()=>{
  const html=await read('/account-deletion')!.text();
  const href=html.match(/class="primary" href="([^"]+)"/)![1]!.replaceAll('&amp;','&');
  const url=new URL(href);expect(url.protocol).toBe('mailto:');expect(url.pathname).toBe(legal.contactEmail);
  expect(url.searchParams.get('subject')).toContain('계정 및 개인정보 삭제 요청');
  expect(url.searchParams.get('body')).toContain('법정대리인');expect(url.searchParams.get('body')).toContain('비밀번호');
  expect(html).toContain('메일을 직접 보내야 접수됩니다.');expect(html).toContain('계정 ID를 모르거나');
 });
 it('provides a HEAD response and rejects writes without changing any account',async()=>{
  const get=read('/privacy')!,head=read('/privacy','HEAD')!;
  expect(await head.text()).toBe('');expect(head.headers.get('content-type')).toBe(get.headers.get('content-type'));
  for(const method of ['POST','PUT','PATCH','DELETE']){const response=read('/account-deletion',method)!;expect(response.status).toBe(405);expect(response.headers.get('allow')).toBe('GET, HEAD');}
  expect(read('/privacy/')).not.toBeNull();expect(read('/admin')).toBeNull();expect(read('/api/account')).toBeNull();expect(read('/api/privacy')).toBeNull();
 });
 it('serves its local stylesheet and keeps active content and third-party connections disabled',async()=>{
  const response=read('/official/site.css')!;expect(response.headers.get('content-type')).toContain('text/css');expect(await response.text()).toContain('@media(max-width:680px)');
  const page=read('/privacy')!;expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  expect(page.headers.get('referrer-policy')).toBe('no-referrer');expect(page.headers.get('x-content-type-options')).toBe('nosniff');
 });
 it('connects settings to the configured production policy pages in both UI languages',()=>{
  for(const locale of ['ko','en'] as const){setLocale(locale);const html=renderToStaticMarkup(createElement(LegalLinks,{locale,onError:vi.fn()}));
   for(const path of ['/privacy','/terms','/account-deletion'])expect(html).toContain('https://puzzle-mobile.ddr1323.workers.dev/official'+(locale==='en'?'/en':'')+path);
   expect(html).toContain('rel="noopener noreferrer"');expect(html).toContain(locale==='ko'?'약관 및 개인정보':'Terms and privacy');
  }
 });
});

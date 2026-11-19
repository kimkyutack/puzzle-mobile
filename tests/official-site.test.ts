import {readFile} from 'node:fs/promises';
import {describe,expect,it,vi} from 'vitest';
import {serveOfficialPage,serveOfficialSite,storeListing} from '../apps/api/src/official-site';
import {puzzlePreview} from '../apps/api/src/official-site/copy';
import {locales,policyPaths,sitePath} from '../apps/api/src/official-site/model';
import {serveStudioSite} from '../apps/api/src/studio-site';
import admob from '../config/admob.json';

const origin='https://official.example.test';
const read=(path:string,method='GET')=>serveOfficialPage(new Request(origin+path,{method}));
const pages=['/',...policyPaths] as const;

describe('studio crawler files',()=>{
 const file=(path:string,method='GET')=>serveStudioSite(new Request('https://hiddenstage.app'+path,{method}));

 it('publishes the exact seller record for both shipped AdMob apps without requiring an asset binding',async()=>{
  const response=await file('/app-ads.txt');
  expect(response?.status).toBe(200);
  expect(response?.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  expect(response?.headers.has('Set-Cookie')).toBe(false);
  const record=await response?.text();
  for(const app of [admob.android,admob.ios]){
   const publisher=app.appId.match(/^ca-app-(pub-\d+)~/)?.[1];
   expect(publisher).toBeDefined();
   expect(record).toBe(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`);
  }
  expect(await serveStudioSite(new Request('https://example.test/app-ads.txt'))).toBeUndefined();
 });

 it('allows crawlers and supports GET and HEAD for the public files',async()=>{
  const policy=await file('/robots.txt');
  expect(policy?.status).toBe(200);
  expect(await policy?.text()).toBe('User-agent: *\nAllow: /app-ads.txt\n');
  for(const path of ['/robots.txt','/app-ads.txt']){
   const head=await file(path,'HEAD');
   expect(head?.status).toBe(200);
   expect(await head?.text()).toBe('');
   const post=await file(path,'POST');
   expect(post?.status).toBe(405);
   expect(post?.headers.get('Allow')).toBe('GET, HEAD');
  }
 });
});

describe('official game website',()=>{
 it('offers all four pages in each language and keeps switches on the same page',async()=>{
  for(const locale of locales)for(const page of pages){
   const response=read(sitePath(locale,page))!;expect(response.status).toBe(200);
   const html=await response.text();expect(html).toContain(`<html lang="${locale}"`);
   for(const lang of locales)expect(html).toContain(`lang="${lang}" hreflang="${lang}" href="${sitePath(lang,page)}"`);
   expect(html).toContain('class="site-header"');expect(html).toContain('class="site-footer"');
   expect(html).not.toContain('<iframe');
   if(page==='/'){
    expect(html).toContain('<script type="module" src="/official/gameplay-preview.js?v=1"></script>');
    expect(html).toContain(`data-src="/official/media/${puzzlePreview}"`);
    expect(response.headers.get('content-security-policy')).toContain("media-src 'self'");
    expect(html).toContain(`src="/official/media/title-${locale}.webp"`);
   }else{
    expect(html).not.toContain('<script');
    expect(response.headers.get('content-security-policy')).not.toContain('script-src');
   }
   expect(response.headers.has('set-cookie')).toBe(false);
  }
 });
 it('localizes the complete policy body, internal links and deletion email',async()=>{
  const localized=[['ko','개인정보처리방침','삭제 요청'],['en','Privacy Policy','Request to delete'],['ja','プライバシーポリシー','削除申請']] as const;
  for(const [locale,title,subject] of localized){
   const privacy=await read(sitePath(locale,'/privacy'))!.text();
   expect(privacy).toContain(`<h1>${title}</h1>`);expect(privacy.match(/class="policy-block"/g)).toHaveLength(10);
   expect(privacy).toContain(`href="${sitePath(locale,'/account-deletion')}"`);
   expect(privacy).toContain('Cloudflare');expect(privacy).toContain('Google AdMob');expect(privacy).toContain('hiddenstagedev@gmail.com');
   const terms=await read(sitePath(locale,'/terms'))!.text();expect(terms.match(/class="policy-block"/g)).toHaveLength(10);
   const deletion=await read(sitePath(locale,'/account-deletion'))!.text();expect(deletion.match(/class="policy-block"/g)).toHaveLength(6);
   expect(deletion).toContain(`href="${sitePath(locale,'/privacy')}#retention"`);
   const mail=new URL(deletion.match(/class="primary" href="([^"]+)"/)![1]!.replaceAll('&amp;','&'));
   expect(mail.pathname).toBe('hiddenstagedev@gmail.com');expect(mail.searchParams.get('subject')).toContain(subject);expect(mail.searchParams.get('body')!.length).toBeGreaterThan(140);
  }
 });
 it('shows both store platforms as upcoming without fabricated store links',async()=>{
  for(const [locale,label] of [['ko','출시 예정'],['en','Coming soon'],['ja','配信予定']] as const){
   const html=await read(sitePath(locale))!.text();
   expect(html.match(/class="store-badge" type="button" disabled/g)).toHaveLength(2);
   expect(html).toContain(`<small>${label}</small><strong>Google Play</strong>`);
   expect(html).toContain(`<small>${label}</small><strong>App Store</strong>`);
   expect(html).not.toMatch(/href="https:\/\/(play\.google\.com|apps\.apple\.com)/);
  }
 });
 it('accepts the proper public listing URLs only when configured',()=>{
  expect(storeListing('googlePlay','https://play.google.com/store/apps/details?id=com.cloudgarden.match')).not.toBeNull();
  expect(storeListing('googlePlay','https://play.google.com/store/apps/details?id=com.other.game')).toBeNull();
  expect(storeListing('appStore','https://apps.apple.com/kr/app/cloud-garden/id1234567890')).not.toBeNull();
  expect(storeListing('appStore','https://testflight.apple.com/join/example')).toBeNull();
  expect(storeListing('appStore','https://apps.apple.com.evil.example/app/id1234')).toBeNull();
  expect(storeListing('appStore','javascript:alert(1)')).toBeNull();
 });
 it('preserves the original policy URLs and keeps API and admin routing separate',async()=>{
  expect(read('/')!.headers.get('location')).toBe('/official/');
  expect((await read('/privacy?lang=ja')!.text())).toContain('<html lang="ja"');
  expect((await read('/account-deletion')!.text())).toContain('계정 삭제 요청 이메일 작성');
  expect(read('/api/account')).toBeNull();expect(read('/admin/')).toBeNull();
  expect(read('/official/en/privacy','POST')!.status).toBe(405);
  expect(await read('/official/ja/','HEAD')!.text()).toBe('');
 });
 it('serves real local artwork and does not fetch unlisted paths from static assets',async()=>{
  const fetch=vi.fn(async(request:Request)=>{
   const filename=new URL(request.url).pathname.split('/').at(-1)!;
   return new Response(request.method==='HEAD'?null:await readFile('apps/admin/public/official/media/'+filename),{headers:{ETag:'"hero"'}});
  });
  const assets={fetch} as unknown as Pick<Fetcher,'fetch'>;
  const route=(name:string,method='GET')=>serveOfficialSite(new Request(origin+'/official/media/'+name,{method}),assets);
  const hero=(await route('garden-hero-small.webp'))!;
  expect(hero.headers.get('content-type')).toBe('image/webp');expect(hero.headers.get('etag')).toBe('"hero"');
  expect(new TextDecoder().decode((await hero.arrayBuffer()).slice(0,4))).toBe('RIFF');
  expect(await (await route('app-icon.webp','HEAD'))!.text()).toBe('');
  expect((await route('unknown.webp'))!.status).toBe(404);expect((await route('app-icon.webp','POST'))!.status).toBe(405);
  expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('serves the gameplay clip with the byte range required by mobile video players',async()=>{
  const clip=await readFile('apps/admin/public/_studio/media/'+puzzlePreview);
  const assets={fetch:async(request:Request)=>new Response(await readFile('apps/admin/public'+new URL(request.url).pathname))} as unknown as Pick<Fetcher,'fetch'>;
  const url=origin+'/official/media/'+puzzlePreview;
  const range=await serveOfficialSite(new Request(url,{headers:{Range:'bytes=0-15'}}),assets);
  expect(range?.status).toBe(206);
  expect(range?.headers.get('content-type')).toBe('video/mp4');
  expect(range?.headers.get('content-range')).toBe(`bytes 0-15/${clip.length}`);
  expect(Buffer.from(await range!.arrayBuffer()).equals(clip.subarray(0,16))).toBe(true);
  const invalid=await serveOfficialSite(new Request(url,{headers:{Range:`bytes=${clip.length}-`}}),assets);
  expect(invalid?.status).toBe(416);
 });
});

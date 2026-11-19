import deployment from '../../../../config/deployment.json';
import {assetNames,copy,puzzlePreview} from './copy';
import {gameplayPreviewJs} from './gameplay-preview';
import {business,businessDetails,escape,isLocale,isPolicyPath,languageNames,locales,media,policyPaths,site,sitePath,type Policies,type PolicyPage,type SiteLocale,type SitePath} from './model';
import {englishPolicies} from './policies-en';
import {japanesePolicies} from './policies-ja';
import {koreanPolicies} from './policies-ko';
import {siteCss} from './style';

const policies:Record<SiteLocale,Policies>={ko:koreanPolicies,en:englishPolicies,ja:japanesePolicies};
const origin=new URL(site.origin??deployment.apiUrl).origin;
const stylesheet=site.basePath+'/site.css';
const previewScript=site.basePath+'/gameplay-preview.js';
const year=business.effectiveDate.slice(0,4);
const playIcon='<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#57bdf1" d="M3 2.5v19l10-9.5z"/><path fill="#78db8f" d="M3 2.5 16.4 9 13 12z"/><path fill="#ffd369" d="m16.4 9 4.3 2.1a1 1 0 0 1 0 1.8l-4.3 2.1L13 12z"/><path fill="#fb7971" d="M3 21.5 16.4 15 13 12z"/></svg>';
const appleIcon='<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M16.1 1.5c.1 1.4-.5 2.7-1.3 3.6-.9.9-2 1.5-3.3 1.4-.2-1.3.5-2.6 1.3-3.5.9-1 2.2-1.5 3.3-1.5ZM19.4 18.1c-.9 1.8-2 3.5-3.5 3.5-1.3 0-1.7-.8-3.4-.8s-2.1.8-3.4.8c-1.5.1-2.7-1.6-3.7-3.3C3.5 14.8 3.3 10.4 5 8.2c1-1.3 2.4-2 3.9-2 1.4 0 2.7.9 3.5.9.8 0 2.5-1.1 4.1-.9 1.2.1 2.5.7 3.4 1.8-2.9 1.7-2.4 5.9.5 7.1-.2 1-.5 2-1 3Z"/></svg>';

/** A configured link must be an actual listing URL, never an unrelated or preview link. */
export function storeListing(platform:keyof typeof site.stores,value:unknown):string|null{
 if(typeof value!=='string'||!value.trim())return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.port||url.username||url.password)return null;
  const valid=platform==='googlePlay'?url.hostname==='play.google.com'&&url.pathname==='/store/apps/details'&&url.searchParams.get('id')===site.packageId:url.hostname==='apps.apple.com'&&/^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id\d+\/?$/.test(url.pathname);
  return valid?url.href:null;
 }catch{return null;}
}

function localeLinks(locale:SiteLocale,path:SitePath){
 return `<nav class="languages" aria-label="${escape(copy[locale].language)}">${locales.map(lang=>`<a lang="${lang}" hreflang="${lang}" href="${sitePath(lang,path)}"${lang===locale?' aria-current="page"':''}>${languageNames[lang]}</a>`).join('')}</nav>`;
}
function header(locale:SiteLocale,path:SitePath){
 const c=copy[locale],home=sitePath(locale);
 return `<header class="site-header"><div class="wrap topbar"><a class="brand" href="${home}"><img src="${media('app-icon.webp')}" width="44" height="44" alt=""><span><b>${escape(c.name)}</b><small>${escape(site.studioName)}</small></span></a><nav class="main-nav" aria-label="${escape(c.home)}"><a href="${home}#game">${escape(c.home)}</a><a href="${home}#download">${escape(c.downloads)}</a><a href="${sitePath(locale,'/privacy')}">${escape(policies[locale]['/privacy'].title)}</a></nav>${localeLinks(locale,path)}</div></header>`;
}
function footer(locale:SiteLocale){
 const c=copy[locale];
 return `<footer class="site-footer"><div class="wrap"><div class="footer-top"><span class="studio-label">${escape(site.studioName)}</span><nav class="footer-links" aria-label="${escape(c.policies)}">${policyPaths.map(path=>`<a href="${sitePath(locale,path)}">${escape(policies[locale][path].title)}</a>`).join('')}</nav></div><div class="footer-info">${businessDetails(locale,c.name+' · '+c.contact)}<p class="footer-copyright">© ${year} ${escape(site.studioName)}<br><a href="#content">${escape(c.top)}</a></p></div></div></footer>`;
}
function downloads(locale:SiteLocale){
 const c=copy[locale];
 const stores=[['googlePlay','Google Play',playIcon],['appStore','App Store',appleIcon]] as const;
 return `<div id="download" class="stores" role="group" aria-label="${escape(c.downloads)}">${stores.map(([platform,name,icon])=>{
  const href=storeListing(platform,site.stores[platform]);
  const label=`${icon}<span><small>${escape(href?c.download:c.planned)}</small><strong>${name}</strong></span>`;
  return href?`<a class="store-badge" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`:`<button class="store-badge" type="button" disabled>${label}</button>`;
 }).join('')}</div>`;
}
function homeContent(locale:SiteLocale){
 const c = copy[locale];
 const art = [
  ['puzzle-play.webp', 'puzzle', 390, 844],
  ['garden-play.webp', 'garden', 540, 900],
  ['animal-expedition.webp', 'expedition', 800, 533]
 ] as const;
 const logo = `<h1 class="hero-logo"><img src="${media(`title-${locale}.webp`)}" alt="${escape(c.title)}" width="720" height="${locale === 'ko' ? 300 : 299}" decoding="async"></h1>`;
 const tiles = ['blue', 'red', 'yellow'].map(color =>
  `<img class="puzzle-tile puzzle-tile--${color}" src="${media(`tile-${color}.webp`)}" alt="" width="144" height="144" loading="lazy" decoding="async">`
 ).join('');
 const features = c.featuresList.map((feature, i) => {
  const [file, kind, width, height] = art[i]!;
  const isPuzzle = kind === 'puzzle';
  return `<article class="feature feature--${kind}"${isPuzzle ? ' data-gameplay-preview' : ''}>
   <div class="feature-art">
    <img class="feature-image" src="${media(file)}" width="${width}" height="${height}" alt="${escape(feature.alt)}" loading="lazy" decoding="async">
    ${isPuzzle ? `${tiles}<video class="feature-video" data-src="${media(puzzlePreview)}" width="432" height="936" muted playsinline loop preload="none" aria-hidden="true"></video>` : ''}
   </div>
   ${isPuzzle ? `<button class="preview-toggle" type="button" hidden data-play="${escape(c.previewPlay)}" data-stop="${escape(c.previewStop)}"><span class="preview-icon" aria-hidden="true"></span><span data-preview-label>${escape(c.previewPlay)}</span></button>` : ''}
   <div class="feature-copy"><h3>${escape(feature.title)}</h3><p>${escape(feature.description)}</p></div>
  </article>`;
 }).join('');
 return `<main id="content">
  <section id="game" class="game-hero">
   <picture class="hero-art">
    <source media="(max-width:680px)" srcset="${media('garden-hero-small.webp')}">
    <img src="${media('garden-hero.webp')}" alt="${escape(c.artAlt)}" width="1536" height="1024" fetchpriority="high" decoding="async">
   </picture>
   <div class="wrap hero-wrap">
    <div class="hero-copy">
     <span class="genre">${escape(c.genre)}</span>
     ${logo}
     <p class="hero-tagline">${escape(c.tagline)}</p>
     <p class="hero-description">${escape(c.description)}</p>
     ${downloads(locale)}
    </div>
   </div>
  </section>
  <section class="feature-section" id="features">
   <div class="wrap">
    <h2 class="feature-heading">${escape(c.featureTitle)}</h2>
    <div class="features-grid">${features}</div>
   </div>
  </section>
 </main>`;
}
function policyContent(locale:SiteLocale,page:PolicyPage){
 const c=copy[locale];
 const localLinks=(html:string)=>html.replace(/href="(\/(?:privacy|terms|account-deletion))(#[^"\s]*)?"/g,(_match,path:string,anchor:string|undefined)=>isPolicyPath(path)?`href="${sitePath(locale,path)}${anchor??''}"`:_match);
 return `<main id="content"><section class="policy-banner"><img class="policy-banner-art" src="${media('garden-hero-small.webp')}" width="720" height="480" alt=""><div class="wrap"><span class="eyebrow">${escape(c.name)} · ${escape(c.policies)}</span><h1>${escape(page.title)}</h1><p>${escape(page.summary)}</p><p class="meta">${escape(c.effective)} ${business.effectiveDate} · ${escape(c.version)} ${business.version}</p></div></section><div class="wrap policy-content"><nav class="policy-jumps" aria-label="${escape(page.title)}">${page.sections.map(section=>`<a href="#${section.id}">${escape(section.title)}</a>`).join('')}</nav><article>${page.sections.map(section=>`<section class="policy-block" id="${section.id}" aria-labelledby="heading-${section.id}"><h2 id="heading-${section.id}">${escape(section.title)}</h2>${localLinks(section.body)}</section>`).join('')}</article></div></main>`;
}

function document(locale:SiteLocale,path:SitePath){
 const c=copy[locale],page=path==='/'?undefined:policies[locale][path],title=page?`${page.title} | ${c.title}`:c.title,description=page?.summary??c.description,canonical=origin+sitePath(locale,path);
 const alternatives=locales.map(lang=>`<link rel="alternate" hreflang="${lang}" href="${origin+sitePath(lang,path)}">`).join('');
 const script=page?'':`<script type="module" src="${previewScript}?v=1"></script>`;
 return `<!doctype html><html lang="${locale}" data-game="${escape(site.slug)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#ffffff"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}">${alternatives}<link rel="alternate" hreflang="x-default" href="${origin+sitePath('ko',path)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin+media('garden-hero.webp')}"><link rel="icon" type="image/webp" href="${media('app-icon.webp')}"><link rel="stylesheet" href="${stylesheet}?v=5">${script}</head><body${page ? '' : ' class="home-page"'}><a class="skip" href="#content">${escape(c.skip)}</a>${header(locale,path)}${page?policyContent(locale,page):homeContent(locale)}${footer(locale)}</body></html>`;
}

function pageRoute(url:URL):{locale:SiteLocale;path:SitePath}|null{
 const path=url.pathname.replace(/\/+$/,'');
 if(isPolicyPath(path)){const lang=url.searchParams.get('lang');return {locale:isLocale(lang)?lang:'ko',path};}
 if(path===site.basePath)return {locale:'ko',path:'/'};
 if(!path.startsWith(site.basePath+'/'))return null;
 const parts=path.slice(site.basePath.length+1).split('/');
 const locale=isLocale(parts[0]??null)?parts.shift() as SiteLocale:'ko';
 const rest=('/'+parts.join('/'));
 if(rest==='/'||isPolicyPath(rest))return {locale,path:rest};
 return null;
}
function pageHeaders(type:string,cache:string,interactive=false){
 const previewPolicy=interactive?"; script-src 'self'; media-src 'self'":'';
 return new Headers({'Content-Type':type,'Cache-Control':cache,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"+previewPolicy,'Permissions-Policy':'camera=(), microphone=(), geolocation=()'});
}
const readable=(method:string)=>method==='GET'||method==='HEAD';
function invalidMethod(){return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}

/** Public GET/HEAD pages do not create sessions, use D1, or load external scripts. */
export function serveOfficialPage(request:Request):Response|null{
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/'&&readable(method))return new Response(null,{status:308,headers:{Location:sitePath('ko'),'Cache-Control':'public, max-age=300'}});
 if(path===stylesheet||path==='/legal/style.css')return readable(method)?new Response(method==='HEAD'?null:siteCss,{headers:pageHeaders('text/css; charset=utf-8','public, max-age=3600')}):invalidMethod();
 if(path===previewScript)return readable(method)?new Response(method==='HEAD'?null:gameplayPreviewJs,{headers:pageHeaders('text/javascript; charset=utf-8','public, max-age=3600')}):invalidMethod();
 const route=pageRoute(url);
 if(!route)return null;
 if(!readable(method))return invalidMethod();
 return new Response(method==='HEAD'?null:document(route.locale,route.path),{headers:pageHeaders('text/html; charset=utf-8','public, max-age=300',route.path==='/')});
}

async function serveVideoRange(response:Response,headers:Headers,range:RegExpMatchArray){
 const content=await response.arrayBuffer();
 const size=content.byteLength;
 const start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));
 const end=range[1]&&range[2]?Math.min(size-1,Number(range[2])):size-1;
 if(start>end){
  headers.set('Content-Range',`bytes */${size}`);
  headers.delete('Content-Length');
  return new Response(null,{status:416,headers});
 }
 headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
 headers.set('Content-Length',String(end-start+1));
 return new Response(content.slice(start,end+1),{status:206,headers});
}

async function serveMedia(request:Request,file:string,assets?:Pick<Fetcher,'fetch'>){
 if(!readable(request.method))return invalidMethod();
 if(!assetNames.some(name=>name===file)||!assets)return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
 const isVideo=file===puzzlePreview;
 // The integrated studio site owns the clip and the legacy URL still serves it.
 const url=new URL((isVideo?'/_studio/media/':'/official/media/')+file,request.url);
 const headers=new Headers(),etag=request.headers.get('If-None-Match');if(etag)headers.set('If-None-Match',etag);
 const response=await assets.fetch(new Request(url,{method:request.method,headers}));
 if(!response.ok&&response.status!==304)return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
 const resultHeaders=new Headers({'Content-Type':isVideo?'video/mp4':'image/webp','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
 const receivedTag=response.headers.get('ETag');if(receivedTag)resultHeaders.set('ETag',receivedTag);
 if(isVideo){
  resultHeaders.set('Accept-Ranges','bytes');
  const length=response.headers.get('Content-Length');if(length)resultHeaders.set('Content-Length',length);
  const range=request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/i);
  const ifRange=request.headers.get('If-Range');
  // Safari requests a small byte range before it begins video playback.
  if(request.method==='GET'&&response.status===200&&range&&(range[1]||range[2])&&(!ifRange||(!ifRange.startsWith('W/')&&ifRange===receivedTag)))return serveVideoRange(response,resultHeaders,range);
 }
 return new Response(request.method==='HEAD'||response.status===304?null:response.body,{status:response.status,headers:resultHeaders});
}

export function serveOfficialSite(request:Request,assets?:Pick<Fetcher,'fetch'>){
 const path=new URL(request.url).pathname,prefix=site.basePath+'/media/';
 return path.startsWith(prefix)?serveMedia(request,path.slice(prefix.length),assets):serveOfficialPage(request);
}

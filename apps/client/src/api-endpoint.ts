import deployment from '../../../config/deployment.json';

/** Native release and published web builds share the deployed API; Vite dev keeps its local proxy. */
export function resolveApiBase(configured:string|undefined,development:boolean):string {
 const value=(configured?.trim()||(development?'/api':deployment.apiUrl)).replace(/\/+$/,'');
 if(value==='/api'&&development)return value;
 let url:URL;
 try{url=new URL(value);}catch{throw new Error('API 주소는 /api로 끝나는 절대 주소여야 합니다.');}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/api')||
   !(url.protocol==='https:'||url.protocol==='http:'&&loopback))throw new Error('올바른 HTTPS API 주소가 필요합니다.');
 return url.href.replace(/\/+$/,'');
}

export const apiBase=resolveApiBase(import.meta.env.VITE_API_URL,import.meta.env.DEV);

export function guildSocketUrl(ticket:string,pageUrl:string):string {
 const url=new URL(apiBase+'/guild/socket',pageUrl);
 url.protocol=url.protocol==='https:'?'wss:':'ws:';
 url.search=new URLSearchParams({ticket}).toString();
 return url.href;
}

/** Keep existing local progress while preventing local credentials from reaching the deployed DB. */
export function sessionStorageKey(base:string):string {
 const local=base==='/api'||['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
 return local?'cloud-garden-session-v1':'cloud-garden-session-v2:'+base;
}

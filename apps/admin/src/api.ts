import type {AdminIdentity} from '../../../packages/contracts/src/operations';
let csrf='';
export function installCsrf(value:string){csrf=value;}
export async function api<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const response=await fetch('/api/admin'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-Admin-CSRF':csrf}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json() as {data:T;error?:{code:string;message:string}};
 if(!response.ok||result.error){if(response.status===401&&!path.startsWith('/auth/'))window.dispatchEvent(new Event('admin-session-expired'));throw new Error(result.error?.message??'요청을 처리하지 못했습니다.');}return result.data;
}
export type Session={admin:AdminIdentity;csrf:string};
export const date=(value:unknown)=>value?new Date(Number(value)).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
export const fullDate=(value:unknown)=>value?new Date(Number(value)).toLocaleString('ko-KR'):'—';
export const number=(value:unknown)=>Number(value??0).toLocaleString('ko-KR');
export function inputDate(value:number|null){if(!value)return '';const date=new Date(value);return new Date(value-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export const parseDate=(value:string)=>value?new Date(value).getTime():null;

export async function uploadImage(file:File){if(file.size>5*1024*1024)throw new Error("이미지는 5MB 이하여야 합니다.");const response=await fetch("/api/admin/media",{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type,"X-Admin-CSRF":csrf},body:file});const result=await response.json() as {data:{url:string};error?:{message:string}};if(!response.ok||result.error)throw new Error(result.error?.message??"업로드하지 못했습니다.");return result.data.url;}

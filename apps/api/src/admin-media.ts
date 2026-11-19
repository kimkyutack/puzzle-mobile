import {ensure,digest,type ApiEnv} from './db';
import {adminResponse,requireAdmin,requireRole,auditStatement} from './admin-auth';
const MAX=5*1024*1024;
export async function uploadAdminImage(request:Request,env:ApiEnv){
 const admin=await requireAdmin(request,env);requireRole(admin,['owner','operator']);ensure(Number(request.headers.get('content-length')??0)<=MAX,'IMAGE_TOO_LARGE','이미지는 5MB 이하여야 합니다.',413);
 const reader=request.body?.getReader();ensure(reader,'IMAGE_REQUIRED','이미지를 선택해 주세요.');const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX){await reader.cancel();ensure(false,'IMAGE_TOO_LARGE','이미지는 5MB 이하여야 합니다.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}let extension='',type='';
 if(size>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){extension='png';type='image/png';}
 else if(size>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){extension='jpg';type='image/jpeg';}
 else if(size>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){extension='webp';type='image/webp';}
 ensure(extension,'INVALID_IMAGE','PNG, JPG, WEBP 이미지만 업로드할 수 있습니다.');const hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'),key='garden-ops/'+hash+'.'+extension;
 await env.ASSETS.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:'public,max-age=31536000,immutable'}});await auditStatement(env,admin.email,'media.upload',key,'이벤트 이미지 업로드',undefined,{bytes:size,type}).run();return adminResponse({url:new URL('/api/assets/'+key,request.url).href,bytes:size},201);
}

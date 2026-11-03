import { z } from 'zod';
import { HttpError } from './db';
export const keySchema=z.string().min(8).max(100);
export const itemSchema=z.enum(['hammer','sweep-row','sweep-column','shuffle','sweep-border','world-bomb','cross-firework','color-magnet','move-hourglass','wind-row','bomb','rainbow']);
export const boosterSchema=z.enum(['hammer','sweep-row','sweep-column','shuffle','sweep-border','world-bomb','cross-firework','color-magnet','move-hourglass']);
export const preSchema=z.enum(['wind-row','bomb','rainbow']);
const at=z.number().int().min(0).max(99);
export const actionSchema=z.discriminatedUnion('type',[z.object({type:z.literal('swap'),from:at,to:at}).strict(),z.object({type:z.literal('tap'),at}).strict(),z.object({type:z.literal('booster'),item:boosterSchema,at:at.optional()}).strict()]);
export const actionsSchema=z.object({sequence:z.number().int().min(0).max(2000),actions:z.array(actionSchema).min(1).max(200),idempotencyKey:keySchema.optional(),key:keySchema.optional()});
export async function boundedText(request:Request,maximum=100_000):Promise<string>{
  if(Number(request.headers.get('content-length')??0)>maximum)throw new HttpError('PAYLOAD_TOO_LARGE','요청이 너무 큽니다.',413);
  const reader=request.body?.getReader();if(!reader)return '';
  let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new HttpError('PAYLOAD_TOO_LARGE','요청이 너무 큽니다.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  return new TextDecoder().decode(bytes);
}
export async function bodyOf(request:Request):Promise<Record<string,unknown>>{
  const raw=await boundedText(request);
  try{const data=JSON.parse(raw||'{}');if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data as Record<string,unknown>;}catch{throw new HttpError('INVALID_JSON','잘못된 요청입니다.');}
}

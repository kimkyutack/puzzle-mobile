import {z} from 'zod';
import {PROFILE_AVATARS,PROFILE_FRAMES,PROFILE_BACKDROPS} from '@garden/contracts';

export const profileAppearanceSchema=z.object({
 avatar:z.enum(PROFILE_AVATARS),
 frame:z.enum(PROFILE_FRAMES),
 backdrop:z.enum(PROFILE_BACKDROPS),
 customImage:z.string().max(48000).regex(/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/).refine(value=>{
  try{
   const bytes=atob(value.slice(value.indexOf(',')+1));
   return value.startsWith('data:image/jpeg;')?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
  }catch{return false;}
 },'올바른 프로필 이미지를 선택해 주세요.').optional(),
}).strict();

/** Columns that read a player's saved look from `players.data`; pair with `withAppearance`. */
export const appearanceColumns=(alias='p')=>['avatar','frame','backdrop','customImage'].map(key=>`json_extract(${alias}.data,'$.profileAppearance.${key}') ${key}`).join(',');
/** Folds the raw appearance columns into `profileAppearance`, dropping it when nothing valid was saved. */
export function withAppearance<T extends {avatar?:unknown;frame?:unknown;backdrop?:unknown;customImage?:unknown}>({avatar,frame,backdrop,customImage,...rest}:T){
 const appearance=profileAppearanceSchema.safeParse({avatar,frame,backdrop,...(customImage?{customImage}:{})});
 return {...rest,...(appearance.success?{profileAppearance:appearance.data}:{})};
}

export type SupportedLocale='ko'|'en';
export const LANGUAGE_KEY='cloud-garden-language-v1';
export interface LanguagePreference {language:SupportedLocale;pending:boolean;userId?:string}
type StorageAccess=Pick<Storage,'getItem'|'setItem'>;
let memory:LanguagePreference|null=null;
let memoryStorage:StorageAccess|undefined;
function deviceStorage():StorageAccess|undefined{try{return typeof localStorage==='undefined'?undefined:localStorage}catch{return undefined}}
export function readLanguagePreference(storage:StorageAccess|undefined=deviceStorage()):LanguagePreference|null{
 try{const raw=storage?.getItem(LANGUAGE_KEY);if(raw){const value=JSON.parse(raw);if((value.language==='ko'||value.language==='en')&&typeof value.pending==='boolean')return {language:value.language,pending:value.pending,...(typeof value.userId==='string'?{userId:value.userId}:{})};}}catch{/* A broken/blocked preference must not block the language picker. */}
 return storage===memoryStorage?memory:null;
}
export function saveLanguagePreference(language:SupportedLocale,pending=true,userId?:string,storage:StorageAccess|undefined=deviceStorage()){
 memoryStorage=storage;memory={language,pending,...(userId?{userId}:{})};try{storage?.setItem(LANGUAGE_KEY,JSON.stringify(memory))}catch{/* The selection still applies for this session. */}return memory;
}
export function preferredDeviceLocale():SupportedLocale{try{return typeof navigator!=='undefined'&&navigator.language.toLowerCase().startsWith('ko')?'ko':'en'}catch{return 'en'}}
export async function syncLanguagePreference<T extends {id:string;settings:{language:SupportedLocale}}>(player:T,save:(language:SupportedLocale)=>Promise<T>):Promise<T>{
 const selected=readLanguagePreference();
 if(!selected?.pending)return player;
 const result=selected.language===player.settings.language?player:await save(selected.language);
 if(readLanguagePreference()?.language===result.settings.language)saveLanguagePreference(result.settings.language,false,result.id);
 return result;
}

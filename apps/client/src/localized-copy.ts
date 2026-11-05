import catalog from './locales/catalog.en.json';
import {storyContinuationCopy} from './locales/story-v30';
const english:Record<string,string>={...catalog,...storyContinuationCopy};
export const copyMessages=english;
export type CopyLocale='ko'|'en';
const entries=Object.entries(english);
const reverse=new Map(entries.filter(([,value])=>value).map(([source,value])=>[value,source]));
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function pattern(value:string){const names:string[]=[];let offset=0,source='^';for(const match of value.matchAll(/\{(\d+)\}/g)){source+=escape(value.slice(offset,match.index))+'([\\s\\S]+?)';names.push(match[1]!);offset=match.index!+match[0].length;}return names.length?{expression:new RegExp(source+escape(value.slice(offset))+'$'),names}:null;}
const patterns=entries.filter(([source])=>/\{\d+\}/.test(source)).sort((a,b)=>b[0].length-a[0].length).map(([ko,en])=>({ko,en,fromKo:pattern(ko)!,fromEn:pattern(en)!}));
function fill(value:string,values:Record<string,string|number|null|undefined>){return value.replace(/\{(\d+)\}/g,(whole,name:string)=>Object.hasOwn(values,name)?String(values[name]??''):whole);}
/** Call only for authored/system copy. Player names, guild names and chat stay untouched. */
export function translateCopy(source:string,language:CopyLocale,values:Record<string,string|number|null|undefined>={}):string{
 const direct=Object.hasOwn(english,source)?(language==='en'?english[source as keyof typeof english]:source):undefined;
 if(direct!==undefined)return fill(direct,values);
 if(language==='ko'&&reverse.has(source))return fill(reverse.get(source)!,values);
 for(const item of patterns){const rule=language==='en'?item.fromKo:item.fromEn,match=rule.expression.exec(source);if(!match)continue;const captured=Object.fromEntries(rule.names.map((name,index)=>[name,match[index+1]!]));return fill(language==='en'?item.en:item.ko,{...captured,...values});}
 return source;
}

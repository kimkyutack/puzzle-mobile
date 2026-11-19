import {gardenStageCopy} from './locales/garden-stages';
import catalog from './locales/catalog.en.json';
import japaneseCatalog from './locales/catalog.ja.json';
import type {AppLocale} from '@garden/contracts';
import {storyContinuationCopy} from './locales/story-v30';
import {engineContentCopy} from './locales/engine-content';
import {contentEventsCopy} from './locales/content-events';
import {powerFestivalCopy} from './locales/power-festival';
import {inputDiagnosticsCopy} from './locales/input-diagnostics';
import {ageAccessCopy} from './locales/age-access';
import {campaignDeviceEntries} from './locales/campaign-devices';
import {breakableEntries} from './locales/breakable-obstacles';
import {chainCampaignEntries} from './locales/chain-campaign';
import {planterGardenEntries} from './locales/planter-garden';
import {goldGardenCopy} from './locales/gold-garden';
import {gardenGamesCopy} from './locales/garden-games';
import {gardenPuzzleEntries} from './locales/garden-puzzles';
import {hiddenPowerMissionCopy} from './locales/hidden-power-missions';
import {risingCampaignEntries} from './locales/rising-campaign';
import {chapterCopy} from '../../../packages/contracts/src/chapter-copy';
import {layeredObstacleCopy} from '../../../packages/contracts/src/layered-obstacle-copy';
const chapterEntries=Object.values(chapterCopy).flatMap(([ko,en,ja])=>
 [[ko[0],[en[0],ja[0]]],[ko[1],[en[1],ja[1]]]] as const);
const layeredEntries=Object.values(layeredObstacleCopy).flatMap(([ko,en,ja])=>
 [[ko[0],[en[0],ja[0]]],[ko[1],[en[1],ja[1]]]] as const);
const localizedEntries=[...Object.entries(ageAccessCopy),...campaignDeviceEntries,...breakableEntries,...chainCampaignEntries,...planterGardenEntries,...gardenPuzzleEntries,...risingCampaignEntries,...chapterEntries,...layeredEntries,...Object.entries(goldGardenCopy),...Object.entries(gardenGamesCopy),...Object.entries(hiddenPowerMissionCopy)];
const english:Record<string,string>={...catalog,...storyContinuationCopy,...engineContentCopy,...powerFestivalCopy,...gardenStageCopy,...contentEventsCopy,...inputDiagnosticsCopy,...Object.fromEntries(localizedEntries.map(([ko,[en]])=>[ko,en]))};
export const copyMessages=english;
export const japaneseCopyMessages:Record<string,string>={...japaneseCatalog,...Object.fromEntries(localizedEntries.map(([ko,[,ja]])=>[ko,ja]))};
export type CopyLocale=AppLocale;
const entries=Object.entries(english);
const reverse=new Map(entries.filter(([,value])=>value).map(([source,value])=>[value,source]));
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function pattern(value:string){const names:string[]=[];let offset=0,source='^';for(const match of value.matchAll(/\{(\d+)\}/g)){source+=escape(value.slice(offset,match.index))+'([\\s\\S]+?)';names.push(match[1]!);offset=match.index!+match[0].length;}return names.length?{expression:new RegExp(source+escape(value.slice(offset))+'$'),names}:null;}
const patterns=entries.filter(([source])=>/\{\d+\}/.test(source)).sort((a,b)=>b[0].length-a[0].length).map(([ko,en])=>({ko,en,fromKo:pattern(ko)!,fromEn:pattern(en)!}));
function fill(value:string,values:Record<string,string|number|null|undefined>){return value.replace(/\{(\d+)\}/g,(whole,name:string)=>Object.hasOwn(values,name)?String(values[name]??''):whole);}
/** Call only for authored/system copy. Player names, guild names and chat stay untouched. */
export function translateCopy(source:string,language:CopyLocale,values:Record<string,string|number|null|undefined>={}):string{
 const localize=(ko:string,en:string)=>language==='ko'?ko:language==='en'?en:japaneseCopyMessages[ko]??en;
 if(Object.hasOwn(english,source))return fill(localize(source,english[source]!),values);
 const knownKorean=language==='en'?undefined:reverse.get(source);
 if(knownKorean!==undefined)return fill(localize(knownKorean,source),values);
 for(const item of patterns){
  const matchFrom=(rule:typeof item.fromKo)=>{
   const match=rule.expression.exec(source);
   return match&&Object.fromEntries(rule.names.map((name,index)=>[name,match[index+1]!]));
  };
  const captured=(language==='ko'?null:matchFrom(item.fromKo))||(language==='en'?null:matchFrom(item.fromEn));
  if(captured)return fill(localize(item.ko,item.en),{...captured,...values});
 }
 return source;
}

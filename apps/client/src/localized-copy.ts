import {itemLessonEntries} from './locales/item-lesson';
import {gardenInvitationCopy} from './locales/garden-invitation';
import {circuitEntries} from './locales/garden-circuit';
import {frontierEntries} from './locales/garden-frontier';
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
const inboxEntries=[['선물을 불러오는 중…',['Loading gifts…','プレゼントを読み込み中…']]] as const;
const guildMapEntries=[['함께할 길드를 만나보세요',['Find a guild to call home','一緒に楽しむギルドを見つけよう']],['길드원과 하트를 나누고 함께 즐겨요.',['Share hearts and play together.','仲間とハートを分け合って楽しもう。']],['좋은 길드에 가입해요.',['Meet your new guild.','すてきなギルドに参加しよう。']],['나만의 길드를 만들어요.',['Create your own guild.','自分のギルドを作ろう。']],['길드 목록',['Guild list','ギルド一覧']]] as const;
const botanicalEntries=[['분홍 벚꽃나무',['Pink cherry tree','ピンクの桜']],['노란 꽃 벤치 아치',['Yellow flower pergola','黄色い花のベンチアーチ']],['분홍 꽃밭',['Pink flower bed','ピンクの花畑']],['햇살 데이지',['Sunny daisies','陽だまりデイジー']],['파란 수국 무리',['Blue hydrangeas','青いアジサイ']],['작은 꽃화분 세트',['Flower pot trio','小さな花鉢セット']],['작은 초록 나무',['Small cypress','小さな緑の木']]] as const;
const hubLoadingEntries=[['연결이 조금 늦어지고 있어요.',['The connection is taking a little longer.','接続に少し時間がかかっています。']],['최신 정보를 확인하지 못했어요.',['Could not refresh the latest information.','最新の情報を確認できませんでした。']]] as const;
const firstGardenEntries=[['정원 준비 중…',['Preparing your garden…','庭を準備中…']],['첫 정원을 복구해요',['Restore your first garden','初めての庭を修復しよう']],['퍼즐에서 얻은 꽃별로 정원 입구를 고쳐 보세요.',['Use the flower star from your puzzle to repair the garden entrance.','パズルで手に入れた花の星で、庭の入口を直しましょう。']],['복구 버튼을 누르면 정원이 되살아나요!',['Tap Restore to bring your garden back to life!','修復ボタンを押すと庭がよみがえります！']],['정원 복구하기',['Restore the garden','庭を修復']],['첫 정원을 복구하고 있어요…',['Restoring your first garden…','初めての庭を修復中…']],['한 번 더 해볼까요?',['Shall we try again?','もう一度挑戦しよう！']],['같은 색 타일을 3개 이상 맞춰 첫 퍼즐을 완성해 보세요.',['Match 3 or more tiles of the same color to complete your first puzzle.','同じ色のタイルを3つ以上そろえて、最初のパズルを完成させましょう。']],['정원 복구하러 가기',['Restore the garden','庭の修復へ']]] as const;
const localizedEntries=[...Object.entries(gardenInvitationCopy),...itemLessonEntries,...inboxEntries,...firstGardenEntries,...hubLoadingEntries,...guildMapEntries,...botanicalEntries,...circuitEntries,...frontierEntries,...Object.entries(ageAccessCopy),...campaignDeviceEntries,...breakableEntries,...chainCampaignEntries,...planterGardenEntries,...gardenPuzzleEntries,...risingCampaignEntries,...chapterEntries,...layeredEntries,...Object.entries(goldGardenCopy),...Object.entries(gardenGamesCopy),...Object.entries(hiddenPowerMissionCopy)];
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

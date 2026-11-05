import { useSyncExternalStore } from 'react';
import {translateCopy} from './localized-copy';
import errorEnglish from './locales/errors.en.json';
import {readLanguagePreference,saveLanguagePreference,preferredDeviceLocale} from './locale-preference';
export type Locale='ko'|'en';
const ko={
 'brand.name':'구름정원','brand.subtitle':'루미의 초대장','brand.title':'구름정원: 루미의 초대장','brand.description':'루미와 함께 퍼즐을 풀고 구름 위 정원을 되살리는 이야기',
 'language.choose':'언어를 선택해 주세요','language.changeLater':'설정에서 언제든 바꿀 수 있어요.',
 'menu.shop':'상점','menu.hearts':'하트 충전','menu.garden':'정원 가꾸기','menu.guild':'우리 길드','menu.gifts':'선물함','menu.settings':'설정','menu.profile':'나의 정원사','menu.events':'무료 선물','menu.pass':'정원 패스',
 'nav.shop':'상점','nav.home':'홈','nav.guild':'길드','nav.settings':'설정','nav.profile':'내 프로필',
 'common.close':'닫기','common.cancel':'취소','common.claim':'받기','common.done':'완료','common.language':'언어','common.on':'켜짐','common.off':'꺼짐','common.skip':'건너뛰기','common.coins':'코인','common.stars':'별','common.hearts':'하트','common.back':'돌아가기','common.wait':'불러오는 중…',
 'hud.goals':'목표','hud.moves':'이동 횟수','hud.level':'레벨 {level}','hud.count':'{count}개','hud.points':'{points}점',
 'button.play':'플레이','button.resume':'이어서 플레이','button.continue':'계속 플레이','button.next':'다음 레벨','button.garden':'정원으로','button.endRun':'이번 판 종료','button.okay':'좋아요!','button.retry':'다시 연결','button.continueCost':'계속 플레이 · {coins} 코인','button.refillCost':'하트 채우기 · {coins} 코인','button.restoreCost':'별 {stars}개','button.restoreDone':'복원 완료','button.freeUnlimited':'무료 30분 무제한 받기','button.freeLocked':'4판 완료 후 무료 무제한','button.freeIn':'무료 수령까지 {time}','button.adHeart':'광고 보고 하트 +1','button.guildHeart':'길드에 하트 요청','button.storedGifts':'보관된 선물 보기','button.rewardStatus':'보상 상태 확인','button.noStore':'스토어 연결 필요',
 'settings.nickname':'닉네임','settings.saveName':'이름 저장','settings.comfort':'편안한 플레이','settings.sound':'효과음','settings.music':'배경 음악','settings.haptics':'진동','settings.reducedMotion':'연출 줄이기','settings.replayTutorial':'튜토리얼 다시 보기','settings.saveProgress':'진행 안전하게 보관하기','settings.recoverPurchases':'구매 내역 동기화','settings.adPrivacy':'광고 개인정보 설정','settings.account':'계정 관리','settings.delete':'계정 삭제',
 'home.sky':'하늘 정원','home.greenhouse':'온실 작업실','home.terrace':'분수 테라스','home.subtitle':'구름 위에 피어나는, 우리들의 이야기','home.otherGarden':'다른 정원 보기','home.restored':'{count} / 18 복원 완료','home.stars':'{count}개의 별','home.resumeCaption':'가꾸던 퍼즐로 돌아가기','home.unlockGuild':'레벨 5 해금','home.free30':'무료 30분',
 'status.play':'작은 한 수가 정원을 바꿔요','status.saving':'진행 확인 중…','status.offline':'연결 대기 · 진행은 이 기기에 저장돼요','status.win':'멋져요! 정원에 생기가 돌아왔어요.','status.ready':'정원 준비 중…','status.unlimited':'무제한 이용 중 · 하트 소모 없음','status.heartCost':'실패할 때만 하트 1개','status.invalidSwap':'같은 색 블록 3개를 연결해 보세요.','status.neighbor':'바로 옆 칸과 바꿔 주세요.',
 'title.win':'정원이 활짝 피었어요!','title.fail':'조금만 더 가꿔볼까요?','title.pause':'잠깐 쉬어가기','title.found':'{item} 발견!',
 'guild.search':'길드 찾기','guild.join':'가입','guild.apply':'가입 신청','guild.create':'길드 만들기','guild.chat':'대화','guild.help':'도움','guild.members':'멤버','guild.send':'보내기','guild.requestHeart':'하트 도움 요청','guild.request':'요청','guild.donate':'도와주기','guild.approve':'승인','guild.kick':'추방','guild.leave':'길드 탈퇴','guild.mail':'선물함 열기',
 'events.claimDaily':'오늘의 무료 선물 받기','events.dailyDone':'오늘 수령 완료','events.passPoints':'정원 패스 · {points}점','events.premium':'프리미엄 패스 보기',
 'item.berry':'빨강 블록','item.drop':'파랑 블록','item.sun':'노랑 블록','item.sprout':'초록 블록','item.flower':'보라 블록','item.acorn':'주황 블록','item.crate':'상자','item.vine':'덩굴','item.frost':'서리','item.seed':'씨앗 주머니','item.pot':'색상 화분','item.moss':'이끼','item.cabinet':'씨앗 저장함','item.pipe':'접이식 물관','item.bud':'씨앗 꽃봉오리','item.carousel':'회전 화분대','item.curtain':'온실 차양','item.wind-row':'줄바람','item.wind-column':'줄바람','item.bomb':'꽃폭탄','item.glider':'씨앗비행기','item.rainbow':'무지개등','item.hammer':'망치','item.sweep-row':'가로 쓸기','item.sweep-column':'세로 쓸기','item.shuffle':'섞기','item.sweep-border':'테두리 폭죽','item.world-bomb':'별빛 대폭탄','item.cross-firework':'십자 폭죽','item.color-magnet':'색상 자석','item.move-hourglass':'모래시계','item.combo':'특수 조합','item.special':'특수 타일',
} as const;
export type MessageKey=keyof typeof ko;
const en:Record<MessageKey,string>={
 'brand.name':'Cloud Garden','brand.subtitle':"Lumi's Invitation",'brand.title':"Cloud Garden: Lumi's Invitation",'brand.description':'Solve puzzles with Lumi and bring a garden above the clouds back to life.',
 'language.choose':'Choose your language','language.changeLater':'You can change this anytime in Settings.', 
 'menu.shop':'Shop','menu.hearts':'Hearts','menu.garden':'Restore garden','menu.guild':'Your guild','menu.gifts':'Mailbox','menu.settings':'Settings','menu.profile':'Your gardener','menu.events':'Free gifts','menu.pass':'Garden pass',
 'nav.shop':'Shop','nav.home':'Home','nav.guild':'Guild','nav.settings':'Settings','nav.profile':'Your profile',
 'common.close':'Close','common.cancel':'Cancel','common.claim':'Claim','common.done':'Done','common.language':'Language','common.on':'On','common.off':'Off','common.skip':'Skip','common.coins':'Coins','common.stars':'Stars','common.hearts':'Hearts','common.back':'Back','common.wait':'Loading…',
 'hud.goals':'Goals','hud.moves':'Moves','hud.level':'Level {level}','hud.count':'{count}','hud.points':'{points} pts',
 'button.play':'Play','button.resume':'Resume','button.continue':'Keep playing','button.next':'Next level','button.garden':'Back to garden','button.endRun':'End this puzzle','button.okay':'Got it!','button.retry':'Reconnect','button.continueCost':'Continue · {coins} coins','button.refillCost':'Refill · {coins} coins','button.restoreCost':'{stars} stars','button.restoreDone':'Restored','button.freeUnlimited':'Free 30 min of hearts','button.freeLocked':'Unlock after 4 clears','button.freeIn':'Free in {time}','button.adHeart':'Watch an ad · +1 heart','button.guildHeart':'Request guild hearts','button.storedGifts':'View stored gifts','button.rewardStatus':'Check reward status','button.noStore':'Store setup required',
 'settings.nickname':'Nickname','settings.saveName':'Save name','settings.comfort':'Comfort settings','settings.sound':'Sound effects','settings.music':'Music','settings.haptics':'Haptics','settings.reducedMotion':'Reduce motion','settings.replayTutorial':'Replay tutorials','settings.saveProgress':'Keep your progress safe','settings.recoverPurchases':'Sync purchases','settings.adPrivacy':'Ad privacy options','settings.account':'Account','settings.delete':'Delete account',
 'home.sky':'Sky garden','home.greenhouse':'Greenhouse workshop','home.terrace':'Fountain terrace','home.subtitle':'A little story blooming above the clouds','home.otherGarden':'View another garden','home.restored':'{count} / 18 restored','home.stars':'{count} stars','home.resumeCaption':'Return to your puzzle','home.unlockGuild':'Unlock at level 5','home.free30':'Free 30 min',
 'status.play':'Every little move grows your garden','status.saving':'Saving your progress…','status.offline':'Offline · moves saved on this device','status.win':'Lovely! Your garden is blooming.','status.ready':'Getting ready…','status.unlimited':'Unlimited hearts · no heart cost','status.heartCost':'Uses 1 heart only on failure','status.invalidSwap':'Connect 3 blocks of the same color.','status.neighbor':'Swap with a neighboring piece.',
 'title.win':'Your garden is blooming!','title.fail':'A few more moves?','title.pause':'Take a little break','title.found':'{item} discovered!',
 'guild.search':'Find a guild','guild.join':'Join','guild.apply':'Request to join','guild.create':'Create guild','guild.chat':'Chat','guild.help':'Help','guild.members':'Members','guild.send':'Send','guild.requestHeart':'Request hearts','guild.request':'Request','guild.donate':'Help out','guild.approve':'Approve','guild.kick':'Remove','guild.leave':'Leave guild','guild.mail':'Open mailbox',
 'events.claimDaily':'Claim daily gift','events.dailyDone':'Claimed today','events.passPoints':'Garden pass · {points} pts','events.premium':'View premium pass',
 'item.berry':'Red block','item.drop':'Blue block','item.sun':'Yellow block','item.sprout':'Green block','item.flower':'Purple block','item.acorn':'Orange block','item.crate':'Crate','item.vine':'Vine','item.frost':'Frost','item.seed':'Seed pouch','item.pot':'Color pot','item.moss':'Moss','item.cabinet':'Seed chest','item.pipe':'Retracting pipe','item.bud':'Seed bud','item.carousel':'Moving planter','item.curtain':'Greenhouse shade','item.wind-row':'Row wind','item.wind-column':'Column wind','item.bomb':'Flower bomb','item.glider':'Seed glider','item.rainbow':'Rainbow lantern','item.hammer':'Hammer','item.sweep-row':'Row sweep','item.sweep-column':'Column sweep','item.shuffle':'Shuffle','item.sweep-border':'Border fireworks','item.world-bomb':'Starlight bomb','item.cross-firework':'Cross fireworks','item.color-magnet':'Color magnet','item.move-hourglass':'Hourglass','item.combo':'Power-up combos','item.special':'Power-ups',
};
export const messages={ko,en};
let locale:Locale=readLanguagePreference()?.language??preferredDeviceLocale();const listeners=new Set<()=>void>();
export const getLocale=()=>locale;
export function setLocale(next:Locale){if(next!=='ko'&&next!=='en')return;if(typeof document!=='undefined'){document.documentElement.lang=next;document.title=messages[next]['brand.title'];document.querySelector('meta[name="description"]')?.setAttribute('content',messages[next]['brand.description']);}if(locale===next)return;locale=next;for(const fn of listeners)fn();}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}};
export function t(key:MessageKey,values:Record<string,string|number>={},language:Locale=locale):string{return messages[language][key].replace(/\{(\w+)\}/g,(whole,name:string)=>String(values[name]??whole));}
export function itemName(id:string,language:Locale=locale):string{const key=`item.${id}` as MessageKey;return key in ko?t(key,{},language):id;}
const literalKeys=new Map<string,MessageKey>(Object.entries(ko).filter(([,value])=>!value.includes('{')).map(([key,value])=>[value,key as MessageKey]));
/** Migration bridge for existing first-party button/title literals. Unknown/user text stays unchanged. */
export function translateText(value:string,language:Locale=locale):string {
 if(language==='ko')return value;const trimmed=value.trim(),key=literalKeys.get(trimmed);
 let m:RegExpMatchArray|null;
 if((m=trimmed.match(/^레벨 (\d+)$/)))return t('hud.level',{level:m[1]!},language);
 if((m=trimmed.match(/^계속 플레이 · ([\d,]+) 코인$/)))return t('button.continueCost',{coins:m[1]!},language);
 if((m=trimmed.match(/^하트 채우기 · ([\d,]+) 코인$/)))return t('button.refillCost',{coins:m[1]!},language);
 if((m=trimmed.match(/^별 (\d+)개$/)))return t('button.restoreCost',{stars:m[1]!},language);
 if((m=trimmed.match(/^무료 수령까지 (.+)$/)))return t('button.freeIn',{time:m[1]!},language);
 if((m=trimmed.match(/^정원 패스 · (\d+)점$/)))return t('events.passPoints',{points:m[1]!},language);
 if((m=trimmed.match(/^(\d+)점$/)))return t('hud.points',{points:m[1]!},language);
 if((m=trimmed.match(/^(\d+)개$/)))return t('hud.count',{count:m[1]!},language);
 if((m=trimmed.match(/^(.+) 발견!$/)))return t('title.found',{item:literalKeys.has(m[1]!)?t(literalKeys.get(m[1]!)!,{},language):m[1]!},language);
 const copied=translateCopy(value,language);if(copied!==value)return copied;
 return key?value.replace(trimmed,t(key,{},language)):value;
}
export function useI18n(){const current=useSyncExternalStore(subscribe,getLocale,()=> 'ko' as Locale);return {locale:current,t:(key:MessageKey,values?:Record<string,string|number>)=>t(key,values,current),translate:(value:string)=>translateText(value,current)};}

export function selectLanguage(language:Locale){saveLanguagePreference(language);setLocale(language)}
export function applyPlayerLanguage(player:{id:string;settings:{language:Locale}}){const saved=readLanguagePreference();if(saved?.pending){setLocale(saved.language);if(saved.language===player.settings.language)saveLanguagePreference(saved.language,false,player.id);}else{saveLanguagePreference(player.settings.language,false,player.id);setLocale(player.settings.language);}}

const tileCopy:Record<string,string>={
 '열매를 옮겨 같은 모양 3개를 이어요!':'빨강 블록을 옮겨 같은 색 3개를 이어요!',
 '물방울 4개를 이으면 줄바람이 생겨요!':'파랑 블록 4개를 이으면 줄바람이 생겨요!',
 '방패 40개 모으기':'파랑 블록 40개 모으기','방패 300개 모으기':'파랑 블록 300개 모으기',
 '루비 40개 모으기':'빨강 블록 40개 모으기','루비 300개 모으기':'빨강 블록 300개 모으기'
};
export function tr(source:string|null|undefined,values:Record<string,string|number|null|undefined>={}){return source==null?'':translateCopy(tileCopy[source]??source,locale,values)}
export function formatLocale(){return locale==='ko'?'ko-KR':'en-US'}

export function localizeApiError(code:string,message:string){
 if(locale==='ko')return message;
 const known=translateText(message,'en');
 if(!/[가-힣]/.test(known))return known;
 return errorEnglish[code as keyof typeof errorEnglish]||tr('요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

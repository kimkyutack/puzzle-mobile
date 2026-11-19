import {afterEach,describe,it,expect} from 'vitest';
import {formatLocale,getLocale,localizeApiError,setLocale,t,tr,translateText,itemName,messages} from '../apps/client/src/i18n';
import {copyMessages,japaneseCopyMessages,translateCopy} from '../apps/client/src/localized-copy';
afterEach(()=>setLocale('ko'));
describe('client locale structure',()=>{
 it('has matching typed dictionaries and preserves placeholders',()=>{expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.ko).sort());expect(t('hud.level',{level:12},'en')).toBe('Level 12');expect(t('button.continueCost',{coins:300},'en')).toBe('Continue · 300 coins');});
 it('updates shared visible names after setting locale',()=>{setLocale('en');expect(getLocale()).toBe('en');expect(itemName('glider')).toBe('Seed glider');expect(t('hud.moves')).toBe('Moves');setLocale('ko');expect(itemName('glider')).toBe('씨앗비행기');});
 it('names colored blocks consistently in goals and older server mission copy',()=>{setLocale('ko');expect(itemName('berry')).toBe('빨강 블록');expect(itemName('drop')).toBe('파랑 블록');expect(tr('방패 40개 모으기')).toBe('파랑 블록 40개 모으기');expect(tr('열매를 옮겨 같은 모양 3개를 이어요!')).toContain('같은 색');setLocale('en');expect(itemName('drop')).toBe('Blue block');expect(tr('루비 300개 모으기')).toBe('Collect 300 red blocks');});
 it('shows rocket names and migrates retained level instructions without changing their data',()=>{
  expect(itemName('wind-row','ko')).toBe('가로 로켓');expect(itemName('wind-column','ko')).toBe('세로 로켓');
  expect(itemName('wind-row','en')).toBe('Horizontal Rocket');expect(itemName('wind-column','en')).toBe('Vertical Rocket');
  const retained=['물방울 4개를 이으면 줄바람이 생겨요!','방패 4개를 이으면 줄바람이 생겨요!','파랑 블록 4개를 이으면 줄바람이 생겨요!'];
  for(const language of ['ko','en'] as const){setLocale(language);for(const text of retained)expect(tr(text)).toBe(language==='ko'?'파랑 블록 4개를 이으면 로켓이 생겨요!':'Match 4 blue blocks to create a Rocket!');expect(tr('여러 층의 상자를 줄바람과 조합으로 무너뜨려요.')).not.toMatch(/줄바람|wind/i);}
 });
 it('translates known button/title literals and dynamic prices',()=>{expect(translateText('정원이 활짝 피었어요!','en')).toBe('Your garden is blooming!');expect(translateText('하트 채우기 · 500 코인','en')).toBe('Refill · 500 coins');expect(translateText('별 2개','en')).toBe('2 stars');});
 it('leaves unknown user text unchanged',()=>{const name='루미와 가나다 정원 123';expect(translateText(name,'en')).toBe(name);expect(translateText(name,'ko')).toBe(name);});
 it('covers the complete authored Japanese catalog and keeps each numbered placeholder',()=>{
  const marks=(value:string)=>[...value.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort();
  expect(Object.keys(messages.ja).sort()).toEqual(Object.keys(messages.ko).sort());
  expect(Object.keys(japaneseCopyMessages).sort()).toEqual(Object.keys(copyMessages).sort());
  for(const [source,translation] of Object.entries(japaneseCopyMessages)){
   expect(translation,source).not.toMatch(/[가-힣]/);
   expect(marks(translation),source).toEqual(marks(source));
  }
 });
 it('localizes gameplay, server errors and formatted text while preserving player text',()=>{
  setLocale('ja');
  expect(t('brand.title')).toBe('雲の庭：ルミの招待状');
  expect(t('hud.level',{level:12})).toBe('レベル 12');
  expect(itemName('wind-column')).toBe('縦ロケット');
  expect(formatLocale()).toBe('ja-JP');
  expect(tr('물방울 4개를 이으면 줄바람이 생겨요!')).toContain('ロケット');
  expect(localizeApiError('COINS_EMPTY','잔액이 부족해요.')).toBe('コインが足りません。');
  expect(translateCopy('{0}님의 {1} {2}개','ja',{0:'별 정원',1:'ハンマー',2:3})).toBe('별 정원さんからハンマーが3個');
 });
});

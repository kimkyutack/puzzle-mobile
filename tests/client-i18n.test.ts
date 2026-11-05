import {afterEach,describe,it,expect} from 'vitest';
import {getLocale,setLocale,t,tr,translateText,itemName,messages} from '../apps/client/src/i18n';
afterEach(()=>setLocale('ko'));
describe('client locale structure',()=>{
 it('has matching typed dictionaries and preserves placeholders',()=>{expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.ko).sort());expect(t('hud.level',{level:12},'en')).toBe('Level 12');expect(t('button.continueCost',{coins:300},'en')).toBe('Continue · 300 coins');});
 it('updates shared visible names after setting locale',()=>{setLocale('en');expect(getLocale()).toBe('en');expect(itemName('glider')).toBe('Seed glider');expect(t('hud.moves')).toBe('Moves');setLocale('ko');expect(itemName('glider')).toBe('씨앗비행기');});
 it('names colored blocks consistently in goals and older server mission copy',()=>{setLocale('ko');expect(itemName('berry')).toBe('빨강 블록');expect(itemName('drop')).toBe('파랑 블록');expect(tr('방패 40개 모으기')).toBe('파랑 블록 40개 모으기');expect(tr('열매를 옮겨 같은 모양 3개를 이어요!')).toContain('같은 색');setLocale('en');expect(itemName('drop')).toBe('Blue block');expect(tr('루비 300개 모으기')).toBe('Collect 300 red blocks');});
 it('translates known button/title literals and dynamic prices',()=>{expect(translateText('정원이 활짝 피었어요!','en')).toBe('Your garden is blooming!');expect(translateText('하트 채우기 · 500 코인','en')).toBe('Refill · 500 coins');expect(translateText('별 2개','en')).toBe('2 stars');});
 it('leaves unknown user text unchanged',()=>{const name='루미와 가나다 정원 123';expect(translateText(name,'en')).toBe(name);expect(translateText(name,'ko')).toBe(name);});
});

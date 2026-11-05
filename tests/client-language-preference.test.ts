import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LanguageGate from '../apps/client/src/LanguageGate';
import {LANGUAGE_KEY,readLanguagePreference,saveLanguagePreference,syncLanguagePreference} from '../apps/client/src/locale-preference';
import {applyPlayerLanguage,getLocale,setLocale,selectLanguage,t,tr,localizeApiError} from '../apps/client/src/i18n';
import {translateCopy,copyMessages} from '../apps/client/src/localized-copy';
import {AREAS,RESTORATIONS,STORY_CHAPTERS,STORY_SCENES,STORY_SPEAKERS,PRODUCTS} from '../packages/content/src/index';
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},values};}
beforeEach(()=>{vi.stubGlobal('localStorage',storage());setLocale('ko');});
afterEach(()=>{setLocale('ko');vi.unstubAllGlobals();});
describe('first language selection and preference sync',()=>{
 it('does not mount the game before an explicit choice; remembers an accepted choice',()=>{
  let boots=0;function Game(){boots++;return createElement('p',null,'game boot');}
  const first=renderToStaticMarkup(createElement(LanguageGate,null,createElement(Game)));
  expect(first).toContain('한국어');expect(first).toContain('English');expect(boots).toBe(0);
  expect(first).toContain('class="brand-logo"');expect(first).toContain('alt="구름정원: 루미의 초대장"');
  selectLanguage('en');expect(readLanguagePreference()).toEqual({language:'en',pending:true});
  expect(renderToStaticMarkup(createElement(LanguageGate,null,createElement(Game)))).toContain('game boot');expect(boots).toBe(1);
 });
 it('ignores invalid stored languages and corrupted JSON',()=>{const s=storage();s.setItem(LANGUAGE_KEY,'{oops');expect(readLanguagePreference(s)).toBeNull();s.setItem(LANGUAGE_KEY,JSON.stringify({language:'fr',pending:true}));expect(readLanguagePreference(s)).toBeNull();});
 it('keeps the first choice ahead of a default server language and syncs only that preference',async()=>{
  const player={id:'locale-test',version:4,coins:1500,hearts:3,inventory:{hammer:2},settings:{language:'ko' as 'ko'|'en',sound:false}};const before=structuredClone(player);
  selectLanguage('en');applyPlayerLanguage(player);expect(getLocale()).toBe('en');
  const save=vi.fn(async(language:'ko'|'en')=>({...player,version:5,settings:{...player.settings,language}}));
  const result=await syncLanguagePreference(player,save);expect(save).toHaveBeenCalledExactlyOnceWith('en');expect(player).toEqual(before);expect(result.coins).toBe(before.coins);expect(result.hearts).toBe(before.hearts);expect(result.inventory).toEqual(before.inventory);expect(result.settings.sound).toBe(false);expect(readLanguagePreference()).toEqual({language:'en',pending:false,userId:'locale-test'});
  await syncLanguagePreference(result,save);expect(save).toHaveBeenCalledTimes(1);
 });
 it('keeps a failed sync pending and does not erase a newer choice during an older sync',async()=>{
  const player={id:'locale-test',settings:{language:'ko' as 'ko'|'en'}};selectLanguage('en');
  await expect(syncLanguagePreference(player,async()=>{throw new Error('offline')})).rejects.toThrow('offline');expect(readLanguagePreference()?.pending).toBe(true);expect(getLocale()).toBe('en');
  await syncLanguagePreference(player,async()=>{selectLanguage('ko');return {...player,settings:{language:'en'}}});expect(readLanguagePreference()).toEqual({language:'ko',pending:true});expect(getLocale()).toBe('ko');
 });
 it('retains the current selection if persistent storage is blocked',()=>{const blocked={getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}};saveLanguagePreference('en',true,undefined,blocked);expect(readLanguagePreference(blocked)).toEqual({language:'en',pending:true});});
 it('adopts a saved account language when no local change is waiting',()=>{saveLanguagePreference('ko',false,'old-account');applyPlayerLanguage({id:'new-account',settings:{language:'en'}});expect(getLocale()).toBe('en');expect(readLanguagePreference()).toEqual({language:'en',pending:false,userId:'new-account'});});
});
describe('complete authored copy and brand localization',()=>{
 it('keeps translation parameters and has English for every catalog entry',()=>{for(const [ko,en] of Object.entries(copyMessages)){expect(en,ko).not.toMatch(/[가-힣]/);expect([...ko.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort(),ko).toEqual([...en.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort());}});
 it('translates every current story beat, speaker, chapter, area and restoration name',()=>{
  const values=[...AREAS.map(v=>v.name),...RESTORATIONS.map(v=>v.name),...STORY_CHAPTERS.flatMap(v=>[v.title,v.summary]),...STORY_SCENES.flatMap(v=>[v.title,...v.beats.map(b=>b.text)]),...Object.values(STORY_SPEAKERS).map(v=>v.name)];for(const value of values){expect(translateCopy(value,'en'),value).not.toMatch(/[가-힣]/);expect(translateCopy(value,'ko')).toBe(value);}
 });
 it('preserves user text and parameters, including text resembling an interface label',()=>{const name='별 2개';expect(translateCopy('{0}님의 {1} {2}개','en',{0:name,1:'Hammer',2:3})).toBe('별 2개 sent 3 × Hammer');expect(translateCopy('나의 멋진 길드 채팅','en')).toBe('나의 멋진 길드 채팅');});
 it('translates authored offer titles and descriptions from the product catalog',()=>{for(const product of PRODUCTS){if(!product.offer)continue;expect(translateCopy(product.offer.title,'en'),product.id).not.toMatch(/[가-힣]/);expect(translateCopy(product.offer.description,'en'),product.id).not.toMatch(/[가-힣]/);}});
 it('changes the full title and system messages in both directions',()=>{expect(t('brand.title')).toBe('구름정원: 루미의 초대장');setLocale('en');expect(t('brand.title')).toBe("Cloud Garden: Lumi's Invitation");expect(tr('모두 받기')).toBe('Claim all');expect(localizeApiError('HEARTS_EMPTY','하트가 부족해요.')).not.toMatch(/[가-힣]/);setLocale('ko');expect(tr('Claim all')).toBe('모두 받기');});
});

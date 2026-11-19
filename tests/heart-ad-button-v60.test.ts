import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import HeartAdButton from '../apps/client/src/HeartAdButton';
import {setLocale} from '../apps/client/src/i18n';
const render=(remaining:number|null,disabled=false,error=false)=>renderToStaticMarkup(createElement(HeartAdButton,{quota:remaining===null?null:{limit:5,remaining,resetsAt:Date.parse('2026-11-12T00:00:00+09:00')},disabled,error,onClick:()=>{}}));
beforeEach(()=>setLocale('ko'));afterEach(()=>setLocale('ko'));
describe('heart ad remaining-view label',()=>{
 it('places the authoritative remaining count inside the existing ad button',()=>{const html=render(4);expect(html).toContain('광고 보고 하트 +1');expect(html).toContain('오늘 4/5회 남음');expect(html).toContain('aria-live="polite"');expect(html).not.toContain('disabled=""');});
 it('disables at zero and still shows the zero count',()=>{const html=render(0);expect(html).toContain('오늘 0/5회 남음');expect(html).toContain('disabled=""');expect(render(5,true)).toContain('disabled=""');});
 it('does not invent a full quota while loading or after a read failure',()=>{expect(render(null)).toContain('횟수 확인 중…');expect(render(null,false,true)).toContain('횟수 확인 실패');expect(render(null)).not.toContain('5/5');});
 it('localizes the remaining count and preserves the same button in English',()=>{setLocale('en');const html=render(3);expect(html).toContain('3/5 views left today');expect(html).toContain('Watch an ad');});
});

import { describe,it,expect } from 'vitest';
import { consumeHeart,newPlayer,recoverHearts,spendCoins,spendItem } from '../apps/api/src/db';
describe('authoritative heart and attribution arithmetic',()=>{
 it('does not reset a 59-minute timer on another heart spend',()=>{const p=newPlayer('p',0);consumeHeart(p,1000);const q=recoverHearts(p,3_541_000);consumeHeart(q,3_541_000);expect(q.heartAt).toBe(1000);expect(recoverHearts(q,3_601_000).hearts).toBe(4);});
 it('discards excess regeneration at cap and starts a fresh cycle when spending',()=>{const p=newPlayer('p',0);consumeHeart(p,1000);const q=recoverHearts(p,86_400_000);expect(q.hearts).toBe(5);expect(q.heartAt).toBe(0);consumeHeart(q,86_400_000);expect(recoverHearts(q,86_400_001).hearts).toBe(4);});
 it('recovers naturally during unlimited; the start boundary is exact',()=>{const p=newPlayer('p',0);p.hearts=0;p.heartAt=1000;p.unlimitedUntil=3_700_000;const q=recoverHearts(p,3_601_000);expect(q.hearts).toBe(1);expect(consumeHeart(q,3_699_999)).toBe(false);expect(consumeHeart(q,3_700_000)).toBe(true);expect(q.hearts).toBe(0);});
 it('uses bound coins first and makes mixed purchases bound',()=>{const p=newPlayer('p',0);p.boundCoins=100;expect(spendCoins(p,150)).toBe(true);expect(p.boundCoins).toBe(0);expect(p.coins).toBe(450);});
 it('self consumption uses bound first; donations cannot use bound stock',()=>{const p=newPlayer('p',0);p.inventory.hammer={normal:0,bound:2};expect(()=>spendItem(p,'hammer',true)).toThrow();expect(p.inventory.hammer.bound).toBe(2);spendItem(p,'hammer');expect(p.inventory.hammer.bound).toBe(1);});
 it('refuses zero-heart starts and negative balances',()=>{const p=newPlayer('p',0);p.hearts=0;expect(()=>consumeHeart(p,1000)).toThrow();expect(()=>spendCoins(p,501)).toThrow();expect(p.coins).toBe(500);});
});

import {describe,it,expect} from 'vitest';
import {OFFER_PRODUCTS,offerWindow} from '@garden/content';
import type {ShopOffer} from '@garden/contracts';
import {isOfferListed} from '../apps/client/src/shop-offers';
describe('campaign windows and concrete stage-help bundles',()=>{
 it('uses calendar months, including leap February, instead of resetting on every visit',()=>{const product=OFFER_PRODUCTS.find(p=>p.offer?.kind==='chain')!;const window=offerWindow(product,0,Date.UTC(2028,1,29,23,59));expect(window.startsAt).toBe(Date.UTC(2028,1,1));expect(window.endsAt).toBe(Date.UTC(2028,2,1));expect(offerWindow(product,0,window.endsAt).periodId).not.toBe(window.periodId);});
 it('pins the timed offer to the actual level-four clear',()=>{const product=OFFER_PRODUCTS.find(p=>p.offer?.kind==='timed')!,clear=Date.UTC(2026,10,2,3);expect(offerWindow(product,clear,clear+1000)).toEqual(offerWindow(product,clear,clear+90_000_000));expect(offerWindow(product,clear,clear).endsAt).toBe(clear+86_400_000);});
 it('supplies the requested four rising reference tiers and useful inventory rather than ranking points',()=>{const steps=OFFER_PRODUCTS.filter(p=>p.offer?.kind==='chain');expect(steps.map(p=>p.offer!.referencePriceKrw)).toEqual([1200,4400,7700,15000]);expect(steps.map(p=>p.offer!.step)).toEqual([1,2,3,4]);for(const product of steps){expect(product.coins).toBeGreaterThan(0);expect(product.items.hammer).toBeGreaterThan(0);expect(product.unlimitedSeconds).toBeGreaterThan(0);expect(product).not.toHaveProperty('rankingPoints');}expect(steps[3]!.offer!.previousProductId).toBe(steps[2]!.id);});
});

describe('offer visibility on the home and store surfaces',()=>{
 it('removes ended offers even while their fetched status is still available',()=>{
  const product=OFFER_PRODUCTS.find(item=>item.offer?.kind==='limited')!;
  const now=Date.UTC(2026,10,1),window=offerWindow(product,0,now);
  const offer:ShopOffer={product,...window,status:'available'};
  expect(isOfferListed(offer,window.startsAt-1)).toBe(false);
  expect(isOfferListed(offer,window.endsAt-1)).toBe(true);
  expect(isOfferListed(offer,window.endsAt)).toBe(false);
  expect(isOfferListed({...offer,status:'purchased'},window.endsAt)).toBe(false);
  expect(isOfferListed({...offer,status:'expired'},now)).toBe(false);
 });

 it('preserves the timed unlock notice before the first sale window',()=>{
  const product=OFFER_PRODUCTS.find(item=>item.offer?.kind==='timed')!;
  const now=Date.UTC(2026,10,1);
  const offer:ShopOffer={product,...offerWindow(product,0,now),status:'locked'};
  expect(isOfferListed(offer,now)).toBe(true);
  expect(isOfferListed({...offer,...offerWindow(product,now-86_400_000,now)},now)).toBe(false);
 });
});

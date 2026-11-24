import {describe,it,expect} from 'vitest';
import {PageSnapshots} from '../apps/client/src/page-snapshots';
describe('presentation snapshots',()=>{
 it('keeps account and page snapshots separate, including late previous-account writes',()=>{
  const cache=new PageSnapshots();cache.put('alice','events',{coins:200},1);cache.put('bob','friends',{names:['Bob']},2);cache.put('alice','events',{coins:250},3);
  expect(cache.read('bob','events',4)).toBeNull();expect(cache.read('alice','friends',4)).toBeNull();expect(cache.read('bob','friends',4)).toEqual({names:['Bob']});expect(cache.read('alice','events',4)).toEqual({coins:250});
 });
 it('expires snapshots without extending validity when read',()=>{
  const cache=new PageSnapshots(4,1000);cache.put('alice','events',{available:true},100);
  expect(cache.read('alice','events',1099)).toEqual({available:true});expect(cache.read('alice','events',1100)).toBeNull();
 });
 it('bounds retained pages and clears every account on session reset',()=>{
  const cache=new PageSnapshots(2);cache.put('alice','events',1,1);cache.put('alice','friends',2,2);cache.put('bob','shop',3,3);
  expect(cache.read('alice','events',4)).toBeNull();expect(cache.read('bob','shop',4)).toBe(3);cache.clear();expect(cache.read('alice','friends',5)).toBeNull();expect(cache.read('bob','shop',5)).toBeNull();
 });
});

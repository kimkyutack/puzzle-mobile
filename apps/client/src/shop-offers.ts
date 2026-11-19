import {useEffect,useState} from 'react';
import type {OffersResponse,Player,ShopOffer} from '@garden/contracts';
import {request,serverNow} from './api';

export function isOfferListed(offer:ShopOffer,now:number){
 if(offer.status==='expired')return false;
 // The timed offer has no sale window until the first eligible clear.
 const awaitingUnlock=offer.product.offer?.kind==='timed'&&offer.status==='locked'&&offer.startsAt===0;
 return awaitingUnlock||offer.startsAt<=now&&now<offer.endsAt;
}

let lastShopOffers:{owner:string;offers:ShopOffer[]}|undefined;

export function useShopOffers({id,version}:Pick<Player,'id'|'version'>,enabled:boolean,now=serverNow()){
 // Home and Shop can unmount during navigation. Keep the last eligible account's snapshot through the next request.
 const [result,setResult]=useState(()=>lastShopOffers);
 useEffect(()=>{
  if(!enabled)return;
  let active=true;
  void request<OffersResponse>('/offers').then(data=>{
   if(!active)return;
   lastShopOffers={owner:id,offers:data.offers};
   setResult(lastShopOffers);
  },()=>{});
  return ()=>{active=false;};
 },[id,version,enabled]);
 return enabled&&result?.owner===id?result.offers.filter(offer=>isOfferListed(offer,now)):[];
}

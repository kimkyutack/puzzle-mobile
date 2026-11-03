import type {Product} from '@garden/contracts';
// Reference KRW prices are planning values. Native checkout always uses the store's localized price.
export const OFFER_PRODUCTS:Product[]=[
 {id:'garden.offer.limited',kind:'boosters',coins:1800,items:{hammer:3,'sweep-row':2,'sweep-column':2,bomb:2,rainbow:1},unlimitedSeconds:1800,oneTime:false,offer:{kind:'limited',campaign:'garden-festival',title:'꽃축제 한정 꾸러미',description:'매월 첫 7일, 한 번만 만나는 공략 도구',referencePriceKrw:4400}},
 {id:'garden.offer.timed',kind:'boosters',coins:1000,items:{hammer:2,'wind-row':2,bomb:2},unlimitedSeconds:1800,oneTime:false,offer:{kind:'timed',campaign:'first-bloom',title:'첫 개화 타임 특가',description:'레벨 4 클리어 후 24시간 동안 한 번',referencePriceKrw:1200}},
 ...[
  {price:1200,coins:700,items:{hammer:1,'wind-row':1,bomb:1},minutes:15},
  {price:4400,coins:2500,items:{hammer:3,'sweep-row':2,'sweep-column':2,bomb:2},minutes:30},
  {price:7700,coins:5000,items:{hammer:5,'sweep-row':3,'sweep-column':3,rainbow:3,bomb:3},minutes:60},
  {price:15000,coins:11000,items:{hammer:10,'sweep-row':5,'sweep-column':5,'wind-row':5,bomb:5,rainbow:5},minutes:120}
 ].map((step,index):Product=>({id:'garden.offer.chain.'+(index+1),kind:'boosters',coins:step.coins,items:step.items,unlimitedSeconds:step.minutes*60,oneTime:false,offer:{kind:'chain',campaign:'monthly-bloom',title:'꽃길 연쇄 '+(index+1)+'단계',description:'앞 단계를 구매하면 다음 꾸러미가 열려요',referencePriceKrw:step.price,step:index+1,...(index?{previousProductId:'garden.offer.chain.'+index}:{})}}))
];
export function offerWindow(product:Product,unlockedAt:number,now:number){
 const kind=product.offer!.kind;
 if(kind==='timed')return {periodId:product.offer!.campaign+':once',startsAt:unlockedAt,endsAt:unlockedAt+86_400_000};
 const date=new Date(now),start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1);
 return {periodId:product.offer!.campaign+':'+new Date(start).toISOString().slice(0,7),startsAt:start,endsAt:kind==='limited'?start+7*86_400_000:Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)};
}

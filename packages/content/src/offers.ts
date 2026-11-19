import type {ActivityReward,Product} from '@garden/contracts';
// Reference KRW prices are planning values. Native checkout always uses the store's localized price.
export const OFFER_PRODUCTS:Product[]=[
 {id:'garden.offer.limited',kind:'boosters',coins:1600,items:{hammer:1,'sweep-column':1,bomb:1},unlimitedSeconds:1200,oneTime:false,offer:{kind:'limited',campaign:'garden-festival',title:'꽃축제 한정 꾸러미',description:'매월 첫 7일, 한 번만 만나는 공략 도구',referencePriceKrw:4400}},
 {id:'garden.offer.timed',kind:'boosters',coins:400,items:{hammer:1,'wind-row':1},unlimitedSeconds:600,oneTime:false,offer:{kind:'timed',campaign:'first-bloom',title:'첫 개화 타임 특가',description:'레벨 4 클리어 후 24시간 동안 한 번',referencePriceKrw:1200}},
 ...[
  {price:1200,coins:500,items:{hammer:1},minutes:5},
  {price:4400,coins:1700,items:{hammer:1,'sweep-row':1,'sweep-column':1},minutes:15},
  {price:7700,coins:3500,items:{hammer:1,'sweep-column':1,bomb:1,rainbow:1},minutes:30},
  {price:15000,coins:7500,items:{hammer:1,'sweep-row':1,'sweep-column':1,bomb:1,rainbow:1},minutes:45}
 ].map((step,index):Product=>({id:'garden.offer.chain.'+(index+1),kind:'boosters',coins:step.coins,items:step.items,unlimitedSeconds:step.minutes*60,oneTime:false,offer:{kind:'chain',campaign:'monthly-bloom',title:'꽃길 연쇄 '+(index+1)+'단계',description:'앞 단계를 구매하면 다음 꾸러미가 열려요',referencePriceKrw:step.price,step:index+1,...(index?{previousProductId:'garden.offer.chain.'+index}:{})}}))
];

export const OFFER_CHAIN_REWARDS:ReadonlyArray<{id:string;previousProductId:string;reward:ActivityReward}>=[
 {id:'after-1',previousProductId:'garden.offer.chain.1',reward:{coins:100,items:{}}},
 {id:'after-2',previousProductId:'garden.offer.chain.2',reward:{coins:0,items:{bomb:1}}},
 {id:'after-3',previousProductId:'garden.offer.chain.3',reward:{coins:200,items:{'wind-row':1}}},
];

export function offerWindow(product:Product,unlockedAt:number,now:number){
 const kind=product.offer!.kind;
 if(kind==='timed')return {periodId:product.offer!.campaign+':once',startsAt:unlockedAt,endsAt:unlockedAt+86_400_000};
 const date=new Date(now),start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1);
 return {periodId:product.offer!.campaign+':'+new Date(start).toISOString().slice(0,7),startsAt:start,endsAt:kind==='limited'?start+7*86_400_000:Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)};
}

import { CONTENT_VERSION, type Item, type LevelDefinition, type Product } from '@garden/contracts';
import approved from './approved.json';
import legacy from './legacy-approved-v1.json';
import {OFFER_PRODUCTS} from './offers';
export {OFFER_PRODUCTS,offerWindow} from './offers';
export {STORY_VERSION,STORY_SCENES,STORY_CHAPTERS,STORY_SPEAKERS,getUnlockedStories,storyForTask} from './story';
export const ECONOMY={maxHearts:5,heartRecoverySeconds:3600,freeUnlimitedSeconds:1800,freeClaimCooldownSeconds:14400,newCoins:500,newHearts:5,continueCosts:[300,600,900],heartPrice:100,runTtlSeconds:86400,winCoins:{normal:50,hard:75,super:100},itemPrices:{hammer:150,'sweep-row':250,'sweep-column':250,shuffle:150,'wind-row':150,bomb:200,rainbow:300} satisfies Record<Item,number>,guildHeartSendDaily:10,guildHeartReceiveDaily:10,guildGiftCap:20,guildItemDaily:3,adHeartDaily:5,adCoinDaily:10} as const;
export const PRODUCTS:Product[]=[...[1000,2500,6000,15000,40000,100000].map(coins=>({id:`garden.coins.${coins}`,kind:'coins' as const,coins,items:{},unlimitedSeconds:0,oneTime:false})),{id:'garden.starter',kind:'starter',coins:1500,items:{hammer:3,'wind-row':3,bomb:3},unlimitedSeconds:1800,oneTime:true},{id:'garden.boosters',kind:'boosters',coins:2000,items:{hammer:5,'sweep-row':3,'sweep-column':3,shuffle:5,bomb:3,rainbow:3},unlimitedSeconds:3600,oneTime:false},{id:'garden.pass',kind:'pass',coins:0,items:{},unlimitedSeconds:0,oneTime:false},...OFFER_PRODUCTS];
export const RESTORATIONS=[
 ['sky-path','sky','정원 입구 고치기',1,'door'],['sky-planter','sky','첫 꽃 심기',1,'planter'],['sky-bench','sky','쉼터 놓기',1,'bench'],['sky-lamp','sky','정원 불 밝히기',2,'lamp'],['sky-fountain','sky','분수 되살리기',2,'fountain'],['sky-arch','sky','별빛 망원경',3,'telescope'],
 ['workshop-door','workshop','온실 문 고치기',1,'door'],['workshop-table','workshop','작업대 정리',1,'bench'],['workshop-planter','workshop','묘목 옮겨 심기',2,'planter'],['workshop-lamp','workshop','작업등 달기',2,'lamp'],['workshop-shelf','workshop','작은 분수 놓기',2,'fountain'],['workshop-roof','workshop','별빛 관측대',3,'telescope'],
 ['terrace-path','terrace','테라스 입구 고치기',1,'door'],['terrace-bench','terrace','벤치 복원',2,'bench'],['terrace-planter','terrace','화단 채우기',2,'planter'],['terrace-lamp','terrace','가로등 복원',2,'lamp'],['terrace-telescope','terrace','별빛 망원경',3,'telescope'],['terrace-fountain','terrace','분수 테라스 완성',3,'fountain']
].map(([id,area,name,cost,asset])=>({id:id as string,area:area as string,name:name as string,cost:cost as number,asset:asset as string}));
export const AREAS=[{id:'sky',name:'하늘 정원',asset:'garden'},{id:'workshop',name:'온실 작업실',asset:'workshop'},{id:'terrace',name:'분수 테라스',asset:'terrace'}];
export function getLevel(id:number,legacyClient=false):LevelDefinition {
 if(!Number.isSafeInteger(id)||id<1)throw new Error('INVALID_LEVEL_ID');
 const pool=(legacyClient?legacy:approved) as unknown as LevelDefinition[];if(pool.length<200)throw new Error('APPROVED_CONTENT_UNAVAILABLE');
 // Long-term fallback repeats a certified bounded-complexity pool, never injects an untested seed.
 const source=id<=200?pool[id-1]!:pool[140+((id-201)%60)]!;
 return {...structuredClone(source),id,version:legacyClient?source.version:CONTENT_VERSION};
}
export const APPROVED_LEVEL_COUNT=approved.length;
export {BRIDGE_EPISODE,bridgeLevel,bridgeStage,rescueUnlocked} from './rescue';

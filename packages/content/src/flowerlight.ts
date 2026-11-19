import type {FestivalStage,FlowerFestivalProgress} from '@garden/contracts';
export const FLOWERLIGHT_ID='flowerlight-invitation-v1';
export const FLOWERLIGHT_MIN_LEVEL=10;
export const FLOWERLIGHT_DURATION=7*86_400_000;
export const FLOWERLIGHT_DECORATION='garden-flowerlight-fountain';
export const FLOWERLIGHT_STAGES:readonly FestivalStage[]=[
 {id:'welcome',title:'축제 입구 꾸미기',target:2,reward:{coins:50,items:{hammer:1}},dialogue:[{speaker:'tori',text:'오래된 초대장에 답장이 왔어. 친구들이 꽃빛축제에 오고 싶대!'},{speaker:'lumi',text:'이번에는 우리가 맞이하자. 꽃잎을 모아 입구부터 꾸며 볼까?'}]},
 {id:'flowers',title:'꽃길 잇기',target:5,reward:{coins:75,items:{'sweep-row':1}},dialogue:[]},
 {id:'fountain',title:'꽃빛 분수 밝히기',target:9,reward:{coins:100,items:{bomb:1}},dialogue:[{speaker:'naru',text:'분수에 물이 돌아! 꽃등도 하나씩 켜지고 있어.'},{speaker:'lumi',text:'우리가 모은 꽃잎이 불빛이 되었네. 멀리 있는 친구들도 길을 찾겠어.'}]},
 {id:'guests',title:'축제 쉼터 꾸미기',target:14,reward:{coins:150,items:{rainbow:1}},dialogue:[]},
 {id:'festival',title:'꽃빛축제 개막',target:20,reward:{coins:200,items:{'world-bomb':1}},dialogue:[{speaker:'tori',text:'초대장을 받은 친구들이 모두 도착했어. 이번엔 한 통도 늦지 않았네!'},{speaker:'lumi',text:'우리 정원 전체가 축제장이 되었네. 이 불빛과 오늘의 약속을 오래 기억하자.'}]},
];
export function flowerlightClaimable(progress?:FlowerFestivalProgress):number {
 return progress?FLOWERLIGHT_STAGES.filter((stage,index)=>index>=progress.restoredStages&&progress.petals>=stage.target).length:0;
}
export function canCollectPetals(progress:FlowerFestivalProgress|undefined,startedAt:number,now:number):boolean {
 return !!progress&&progress.id===FLOWERLIGHT_ID&&startedAt>=progress.startedAt&&now>=progress.startedAt&&now<progress.endsAt&&progress.restoredStages<FLOWERLIGHT_STAGES.length;
}

/** Permanent real-garden gifts. Preserve the original fountain grant identity. */
export const FLOWERLIGHT_GARDEN_GIFTS=[
 {itemId:'garden-flowerlight-arch',variant:'classic',name:'꽃빛 축제 아치',quantity:1,grantId:FLOWERLIGHT_ID+':welcome',near:{x:16,y:20}},
 {itemId:'garden-planter',variant:'festival',name:'축제 꽃 화단',quantity:4,grantId:FLOWERLIGHT_ID+':flowers',near:{x:13,y:18}},
 {itemId:FLOWERLIGHT_DECORATION,variant:'classic',name:'꽃빛 분수',quantity:1,grantId:FLOWERLIGHT_ID,near:{x:18,y:13}},
 {itemId:'garden-bench',variant:'festival',name:'축제 벤치',quantity:1,grantId:FLOWERLIGHT_ID+':guests',near:{x:12,y:16}},
 {itemId:'garden-lamp',variant:'festival',name:'축제 가로등',quantity:2,grantId:FLOWERLIGHT_ID+':festival',near:{x:17,y:20}},
] as const;
export function flowerlightGiftInstanceIds(gift:typeof FLOWERLIGHT_GARDEN_GIFTS[number]):string[]{return Array.from({length:gift.quantity},(_,i)=>gift.grantId+(gift.quantity>1?':'+i:''));}

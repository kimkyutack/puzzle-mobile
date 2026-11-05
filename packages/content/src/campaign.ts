import type {CampaignBeat,CampaignPosition,ObstacleKind} from '@garden/contracts';

export const MAX_CAMPAIGN_LEVEL=30_000;
export const CAMPAIGN_PACK_SIZE=50;
export const CAMPAIGN_PACK_COUNT=MAX_CAMPAIGN_LEVEL/CAMPAIGN_PACK_SIZE;
export const CAMPAIGN_LESSONS:ReadonlyArray<{level:number;kind:ObstacleKind;name:string}>=[
 {level:3,kind:'crate',name:'상자'}, {level:10,kind:'vine',name:'덩굴'},
 {level:18,kind:'pot',name:'색상 화분'}, {level:23,kind:'moss',name:'이끼'},
 {level:28,kind:'cabinet',name:'씨앗 저장함'}, {level:201,kind:'pipe',name:'접이식 물관'},
 {level:211,kind:'bud',name:'씨앗 꽃봉오리'}, {level:221,kind:'carousel',name:'회전 화분대'},
 {level:231,kind:'curtain',name:'온실 차양'},
];
const rhythm:readonly CampaignBeat[]=['easy','normal','normal','hard','easy','normal','normal','super','easy','celebration'];
export function campaignPosition(id:number):CampaignPosition {
 if(!Number.isSafeInteger(id)||id<1||id>MAX_CAMPAIGN_LEVEL)throw new Error('INVALID_LEVEL_ID');
 const lesson=CAMPAIGN_LESSONS.find(item=>id>=item.level&&id<item.level+3);
 return {pack:Math.floor((id-1)/CAMPAIGN_PACK_SIZE)+1,position:(id-1)%CAMPAIGN_PACK_SIZE+1,
  beat:lesson?(id===lesson.level?'introduction':'practice'):rhythm[(id-1)%10]!,
  ...(lesson?{lesson:lesson.kind}:{}),phase:id<=100?1:id<=1000?2:id<=5000?3:id<=10000?4:5};
}
export function campaignPack(pack:number){
 if(!Number.isInteger(pack)||pack<1||pack>CAMPAIGN_PACK_COUNT)throw new Error('INVALID_CAMPAIGN_PACK');
 const start=(pack-1)*CAMPAIGN_PACK_SIZE+1;
 return {id:pack,start,end:start+CAMPAIGN_PACK_SIZE-1,levels:Array.from({length:CAMPAIGN_PACK_SIZE},(_,i)=>({id:start+i,...campaignPosition(start+i)}))};
}
export const campaignDifficulty=(beat:CampaignBeat)=>beat==='hard'?'hard':beat==='super'?'super':'normal';
/** Bot margins are authoring targets, not human difficulty or measured win rates. */
export const campaignMoveMargin=(beat:CampaignBeat)=>({introduction:14,practice:12,easy:10,normal:7,hard:4,super:2,celebration:12})[beat];

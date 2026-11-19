import {CAMPAIGN_DEVICES,type CampaignDeviceKind} from '../../contracts/src/campaign-devices';
import type {CampaignBeat} from '@garden/contracts';
import {campaignPosition} from './campaign';

export const LONG_CAMPAIGN_START=401;
export const LONG_CAMPAIGN_END=20_000;
export const LONG_CAMPAIGN_VERSION='garden-2026.11.14-rotation-v2';
export const LONG_CAMPAIGN_STYLES=['crates','frost','magnets','pots','seed','moss','planters','special'] as const;
export type LongCampaignStyle=typeof LONG_CAMPAIGN_STYLES[number];

const deviceCount=CAMPAIGN_DEVICES.length;
const secondOffsets=[0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7] as const;
// Rotate the second device through the full set. Every ordered pair appears
// once and the first 14 chapters introduce every individual device.
export function longCampaignChapter(index:number){
 if(!Number.isInteger(index)||index<0||index>=deviceCount**2)return;
 const cycle=Math.floor(index/deviceCount),position=index%deviceCount;
 const first=CAMPAIGN_DEVICES[(position+cycle*3)%deviceCount]!;
 const second=CAMPAIGN_DEVICES[(position+cycle*3+secondOffsets[cycle]!+deviceCount)%deviceCount]!;
 return {first,second,cycle};
}

const openingRuns=['current','pair','recap','current','pair','recap'] as const;
const runLengths=[3,2,3,2,2,3] as const;
export function longCampaignSlot(id:number){
 if(!Number.isSafeInteger(id)||id<LONG_CAMPAIGN_START||id>LONG_CAMPAIGN_END||id%10===0)return;
 const index=Math.floor((id-LONG_CAMPAIGN_START)/100),offset=(id-LONG_CAMPAIGN_START)%100;
 let slot=offset-Math.floor(offset/10);
 const chapter=longCampaignChapter(index)!;
 let beat:CampaignBeat=campaignPosition(id).beat;
 if(slot<3){
  beat=slot===0?'introduction':'practice';
  const lesson=index<deviceCount?`intro/${chapter.first}`:`pair/${index}`;
  return {key:lesson,beat,variant:slot,run:0};
 }
 let remaining=87,run=0;slot-=3;
 while(true){
  const length=remaining===4?2:remaining<=3?remaining:runLengths[run%runLengths.length]!;
  if(slot<length)break;
  slot-=length;remaining-=length;run++;
 }
 const pressure=beat==='super'||beat==='hard'?1:0;
 const style=LONG_CAMPAIGN_STYLES[(run+Math.floor(run/6)+index)%LONG_CAMPAIGN_STYLES.length]!;
 const old=longCampaignChapter(index-1)?.first??chapter.first;
 const mode=openingRuns[run%openingRuns.length];
 const key=mode==='pair'?`pair/${index}`:`mix/${mode==='current'?chapter.first:old}/${style}/${pressure}`;
 return {key,beat,variant:slot,run:run+1};
}

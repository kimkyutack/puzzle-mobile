import type {CampaignBeat} from '@garden/contracts';
export const PROGRESSIVE_CONTENT_VERSION='garden-2026.11.06-progression-v39';
export const progressionBand=(id:number)=>id<=100?0:id<=200?1:id<=400?2:id<=700?3:4;
export function progressionMargin(id:number,beat:CampaignBeat){
 const late=id>700?1:0;
 return ({introduction:8,practice:7,easy:6,normal:4,hard:2,super:1,celebration:9})[beat]+(beat==='easy'?late:0);
}
/** Complexity is introduced on selected beats; easy and story rounds remain breaks. */
export function progressionLayout(id:number,beat:CampaignBeat){
 if(id<=100||id%10===0)return null;
 const band=progressionBand(id),lesson=id>=101&&id<=103;
 if(!lesson&&['introduction','practice','celebration','easy'].includes(beat))return null;
 const position=(id-1)%10+1,slots=band===1?[4,8]:band===2?[2,4,6,8]:band===3?[2,4,6,7,8]:[2,3,4,6,7,8];
 if(!lesson&&!slots.includes(position))return null;
 const challenge=lesson?'intro':beat==='super'?'super':beat==='hard'?'hard':'normal';
 // Four spatial variants per profile. A new run still randomizes ordinary colours.
 const variant=(Math.floor((id-101)/10)+position)%4;
 return {band,challenge,variant,key:`${band}/${challenge}/${variant}`};
}

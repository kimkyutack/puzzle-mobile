import {campaignPosition} from './campaign';

const patterns=['urns','statues','supply-urns','crystals','crystal-crates','statue-court','warehouse','frozen-urns','magnet-yard','seed-hall'] as const;
export type BreakablePattern=typeof patterns[number];
const introPatterns=['urns','statues','supply-urns','crystals'] as const;
export const BREAKABLE_CAMPAIGN_VERSION='garden-2026.11.15-breakables-v2';

export function breakableSlot(id:number){
 if(!Number.isInteger(id)||id<401||id>20000)return;
 const offset=(id-401)%100,chapter=Math.floor((id-401)/100);
 // Keep the first new rule in each chapter, with three direct-obstacle
 // groups inserted during the chapter's cycle.
 const intro=chapter<introPatterns.length&&offset>=3&&offset<=5;
 const first=offset>=16&&offset<=18,second=offset>=43&&offset<=45,third=offset>=75&&offset<=77;
 if(!intro&&!first&&!second&&!third)return;
 const group=first?0:second?1:2;
 const pattern=intro?introPatterns[chapter]!:patterns[(chapter*3+group*3)%patterns.length]!;
 const variant=intro?offset-3:first?offset-16:second?offset-43:offset-75;
 const beat=intro&&variant===0?'introduction':intro?'practice':campaignPosition(id).beat;
 const raised=!intro&&(beat==='hard'||beat==='super')?1:0;
 return {pattern,variant,beat,key:`${pattern}/${variant}/${raised}`};
}

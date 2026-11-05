import type {LevelDefinition,CampaignBeat} from '@garden/contracts';
import catalogueJson from './bulk-catalogue.json';
import {campaignPosition,campaignDifficulty,MAX_CAMPAIGN_LEVEL} from './campaign';

export const BULK_CONTENT_VERSION='garden-2026.11.04-bulk-v22';
export const BULK_BATCH_SIZE=10_000;
export const BULK_START=301;
export type BulkBeat=Exclude<CampaignBeat,'introduction'|'practice'>;
export const BULK_BEATS:readonly BulkBeat[]=['easy','normal','hard','super','celebration'];
export const BULK_FAMILIES=['meadow','frost-terraces','seed-delivery','color-pots','moss-race','seed-vaults','crate-wall','frozen-greenhouse','fusion-festival','pipe','bud','carousel','curtain','pipe-seed-route','shade-seed-garden','moving-pipe-court','shade-carousel','greenhouse-finale'] as const;
export interface BulkTemplate {key:string;tier:number;beat:BulkBeat;family:string;variant:number;source:number;steps:number;level:LevelDefinition}
export interface BulkCatalogue {version:string;published:number;templates:BulkTemplate[];entries:Array<[number,number]>}
const catalogue=catalogueJson as unknown as BulkCatalogue;
export const BULK_PUBLISHED_LEVEL=catalogue.published;
export const bulkTier=(id:number)=>id<=1000?0:id<=3000?1:id<=6000?2:id<=10000?3:id<=15000?4:id<=20000?5:id<=25000?6:7;
export function bulkProfile(id:number){
 if(!Number.isSafeInteger(id)||id<BULK_START||id>MAX_CAMPAIGN_LEVEL)throw new Error('INVALID_LEVEL_ID');
 const tier=bulkTier(id),beat=campaignPosition(id).beat as BulkBeat;
 // Different tactics within each ten-stage wave; never a whole wave of one map.
 const offset=id-BULK_START,familyIndex=(Math.floor(offset/10)*7+offset%10*5)%BULK_FAMILIES.length;
 const variant=(Math.floor(offset/180)+offset)%2,family=BULK_FAMILIES[familyIndex]!;
 return {key:`${tier}/${beat}/${family}/${variant}`,tier,beat,family,variant};
}
export function levelFromBulkEntry(id:number,entry:readonly number[],template:BulkTemplate):LevelDefinition {
 const level=structuredClone(template.level),campaign=campaignPosition(id);
 return {...level,id,moves:entry[1]!,campaign,difficulty:campaignDifficulty(campaign.beat),version:BULK_CONTENT_VERSION,approved:true};
}
export function getBulkLevel(id:number):LevelDefinition {
 if(!Number.isSafeInteger(id)||id<BULK_START||id>MAX_CAMPAIGN_LEVEL)throw new Error('INVALID_LEVEL_ID');
 const entry=catalogue.entries[id-BULK_START];
 if(id>catalogue.published||!entry||!catalogue.templates[entry[0]])throw new Error('LEVEL_CONTENT_PENDING');
 return levelFromBulkEntry(id,entry,catalogue.templates[entry[0]]!);
}

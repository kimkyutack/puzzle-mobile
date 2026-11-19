import type {ExclusiveExpeditionAnimal} from './content-events';
import {defaultStartBoosterSchedule,type StartBoosterSchedule} from './start-booster-rush';
import {GARDEN_GAMES,type GardenGamePrize} from './garden-games';
export const OP_FEATURES=['shop','missions','treasure','powerFestival','flowerlight','animalExpedition','pass','daily','friends','guild','ads','purchases','offers',...GARDEN_GAMES] as const;
export type OpsFeature=typeof OP_FEATURES[number];
export const GAME_EVENT_FEATURES=['flowerlight','animalExpedition','powerFestival','treasure',...GARDEN_GAMES] as const;
export type GameEventFeature=typeof GAME_EVENT_FEATURES[number];
export interface GameEventSchedule {startsAt:number;endsAt:number|null;minLevel:number}
export interface GardenGameControl extends GameEventSchedule {roundId:string;ticketCap:number;grandPrize:GardenGamePrize}
export interface GameEventControls {
 flowerlight:GameEventSchedule&{durationDays:number};
 animalExpedition:GameEventSchedule&{dailyLimit:number;roundId:string;animal:ExclusiveExpeditionAnimal};
 powerFestival:GameEventSchedule;
 treasure:GameEventSchedule;
 'acorn-pinball':GardenGameControl;
 'greenhouse-water':GardenGameControl;
}
export const defaultGameEventControls=():GameEventControls=>({flowerlight:{startsAt:0,endsAt:null,minLevel:10,durationDays:7},animalExpedition:{startsAt:0,endsAt:null,minLevel:20,dailyLimit:3,roundId:'001',animal:'panda'},powerFestival:{startsAt:0,endsAt:null,minLevel:5},treasure:{startsAt:0,endsAt:null,minLevel:1},
 'acorn-pinball':{startsAt:0,endsAt:null,minLevel:10,roundId:'001',ticketCap:5,grandPrize:'garden-acorn-cottage'},
 'greenhouse-water':{startsAt:0,endsAt:null,minLevel:15,roundId:'001',ticketCap:5,grandPrize:'garden-waterwork-pavilion'}});
export interface VersionPolicy {latest:string;minimum:string;storeUrl:string;message:string}
export interface RuntimeSettings {
 maintenance:{enabled:boolean;title:string;message:string;startsAt:number;endsAt:number|null;allowActiveRuns:boolean};
 versions:Record<'ios'|'android'|'web',VersionPolicy>;
 features:Record<OpsFeature,boolean>;
 prices:Record<string,number>;
 startBoosterRush:StartBoosterSchedule;
 gameEvents:GameEventControls;
}
export interface OpsReward {coins:number;stars:number;hearts:number;items:Record<string,number>}
export interface OpsNotice {id:string;title:string;body:string;status:'draft'|'published'|'archived';startsAt:number;endsAt:number|null;pinned:boolean;popup:boolean;revision:number}
export interface OpsEvent {id:string;title:string;description:string;kind:'season'|'reward';status:'draft'|'published'|'paused'|'ended';startsAt:number;endsAt:number;imageUrl:string;reward:OpsReward;revision:number;claimed?:boolean}
export interface OperationsSnapshot {settings:RuntimeSettings;maintenanceActive:boolean;revision:number;notices:OpsNotice[];events:OpsEvent[];serverNow:number;supportUnread?:number;restriction?:{banned:boolean;until:number|null;reason:string}|null}
export interface SupportTicket {id:string;userId:string;category:string;title:string;status:'open'|'pending'|'resolved'|'closed';priority:'normal'|'high';createdAt:number;updatedAt:number;messages?:Array<{id:string;author:'player'|'admin'|'note';body:string;createdAt:number}>}
export type AdminRole='owner'|'operator'|'support'|'viewer';
export interface AdminIdentity {id:string;email:string;role:AdminRole}

export function defaultOperationsRuntime():RuntimeSettings {const policy={latest:"0.0.0",minimum:"0.0.0",storeUrl:"",message:"새로운 버전으로 업데이트해 주세요."};return {maintenance:{enabled:false,title:"정원을 가꾸는 중이에요",message:"더 나은 플레이를 위해 잠시 점검하고 있어요.",startsAt:0,endsAt:null,allowActiveRuns:true},versions:{ios:{...policy},android:{...policy},web:{...policy}},features:Object.fromEntries(OP_FEATURES.map(k=>[k,true])) as Record<OpsFeature,boolean>,prices:{},startBoosterRush:defaultStartBoosterSchedule(),gameEvents:defaultGameEventControls()};}
export function gameEventConfig<K extends GameEventFeature>(feature:K,settings?:Pick<RuntimeSettings,'gameEvents'>|null):GameEventControls[K]{return settings?.gameEvents?.[feature]??defaultGameEventControls()[feature];}
export function gameEventAvailable(feature:GameEventFeature,settings:Pick<RuntimeSettings,'gameEvents'|'features'>|null|undefined,now:number){const schedule=gameEventConfig(feature,settings);return settings?.features[feature]!==false&&now>=schedule.startsAt&&(schedule.endsAt===null||now<schedule.endsAt);}

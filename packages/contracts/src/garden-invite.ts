import type {ActivityReward,Player} from './index';
import type {GardenWorldState} from '../../garden-world/src/model';
import {DECORATIONS} from '../../garden-world/src/catalog';

export const GARDEN_INVITE_ID='garden-invite-v1';
export const GARDEN_INVITE_LEVEL=5;
export const GARDEN_INVITE_SHARE_COOLDOWN=60_000;
export const GARDEN_INVITE_DECORATION='garden-starlight-wish-pavilion';
export const GARDEN_INVITE_STAGES:readonly {visitors:number;reward:ActivityReward;decoration?:string}[]=[
 {visitors:10,reward:{coins:300,items:{hammer:1}}},
 {visitors:50,reward:{coins:700,items:{rainbow:1}}},
 {visitors:100,reward:{coins:1500,items:{bomb:2}},decoration:GARDEN_INVITE_DECORATION}
];
export interface GardenInviteObjective {id:'bench'|'building'|'tree';complete:boolean}
export interface GardenInviteState {
 id:typeof GARDEN_INVITE_ID;eligible:boolean;ready:boolean;visitors:number;claimedStages:number;
 readyAt:number|null;sharedAt:number|null;nextShareAt:number;objectives:GardenInviteObjective[];
}
export function gardenInviteObjectives(player:Pick<Player,'restored'>,world:GardenWorldState):GardenInviteObjective[]{
 const placed=new Set(Object.keys(world.placements).map(id=>world.owned[id]?.itemId));
 return [
  {id:'bench',complete:[...placed].some(id=>!!id&&(id.includes('bench')||id==='garden-yellow-pergola'))},
  {id:'building',complete:player.restored.length>0&&Object.keys(world.placements).some(id=>world.owned[id]?.source==='restoration'&&DECORATIONS.find(item=>item.id===world.owned[id]!.itemId)?.category==='building')},
  {id:'tree',complete:[...placed].some(id=>!!id&&(id==='garden-tree'||id.endsWith('-tree')))}
 ];
}

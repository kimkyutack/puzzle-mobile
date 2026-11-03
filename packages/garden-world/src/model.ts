import {DECORATIONS,GARDEN_WORLD,type DecorationDefinition,type GardenDefinition,type GardenRegionId,type GardenRotation,type GridRect} from './catalog';

export type DecorationSource='restoration'|'shop'|'event';
export interface OwnedDecoration {id:string;itemId:string;variant:string;source:DecorationSource}
export interface GardenPlacement {instanceId:string;x:number;y:number;rotation:GardenRotation}
export interface GardenWorldState {
 ownerId:string;mapId:string;revision:number;unlockedRegions:GardenRegionId[];
 owned:Record<string,OwnedDecoration>;placements:Record<string,GardenPlacement>;
 /** These receipts belong in authoritative DB tables when the module is integrated. */
 grants:Record<string,string>;operations:Record<string,string>;
}
interface CommandBase {operationId:string;expectedRevision:number;instanceId:string}
export type GardenCommand=(CommandBase & {type:'place'|'move';x:number;y:number;rotation:GardenRotation}) | (CommandBase & {type:'store'});
export interface TrustedDecorationGrant {
 ownerId:string;grantId:string;itemId:string;variant:string;source:DecorationSource;instanceIds:string[];
}
export type GardenErrorCode='INVALID_INPUT'|'FORBIDDEN'|'UNKNOWN_ITEM'|'UNKNOWN_REGION'|'ITEM_NOT_FOR_SALE'|'GRANT_CONFLICT'|'INSTANCE_CONFLICT'|'OPERATION_CONFLICT'|'STALE_REVISION'|'NOT_OWNED'|'ALREADY_PLACED'|'NOT_PLACED'|'OUT_OF_BOUNDS'|'REGION_LOCKED'|'WRONG_REGION'|'UNSUPPORTED_ROTATION'|'OCCUPIED';
export class GardenWorldError extends Error {
 constructor(public readonly code:GardenErrorCode){super(code);this.name='GardenWorldError';}
}
const fail=(code:GardenErrorCode):never=>{throw new GardenWorldError(code);};
const own=<T>(values:Record<string,T>,key:string):T|undefined=>Object.hasOwn(values,key)?values[key]:undefined;
const validId=(id:string)=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(id);
function requireId(id:string){if(!validId(id))fail('INVALID_INPUT');}
function itemDefinition(itemId:string,catalog:readonly DecorationDefinition[]){return catalog.find(item=>item.id===itemId)??fail('UNKNOWN_ITEM');}
function requireMap(state:GardenWorldState,map:GardenDefinition){if(state.mapId!==map.id)fail('INVALID_INPUT');}
const contains=(rect:GridRect,x:number,y:number)=>x>=rect.x&&y>=rect.y&&x<rect.x+rect.width&&y<rect.y+rect.height;

export function createGardenWorld(ownerId:string,map:GardenDefinition=GARDEN_WORLD):GardenWorldState {
 requireId(ownerId);
 return {ownerId,mapId:map.id,revision:0,unlockedRegions:[...map.initialRegions],owned:{},placements:{},grants:{},operations:{}};
}

/** Call only after the server has approved restoration/event/purchase entitlement. No charging here. */
export function applyTrustedDecorationGrant(state:GardenWorldState,grant:TrustedDecorationGrant,catalog:readonly DecorationDefinition[]=DECORATIONS):GardenWorldState {
 if(grant.ownerId!==state.ownerId)fail('FORBIDDEN');
 requireId(grant.grantId);
 const item=itemDefinition(grant.itemId,catalog);
 if(grant.source==='shop'&&!item.futureShop)fail('ITEM_NOT_FOR_SALE');
 if(!item.variants.includes(grant.variant)||!['restoration','shop','event'].includes(grant.source)||!Array.isArray(grant.instanceIds)||grant.instanceIds.length<1||grant.instanceIds.length>100)fail('INVALID_INPUT');
 grant.instanceIds.forEach(requireId);
 if(new Set(grant.instanceIds).size!==grant.instanceIds.length)fail('INSTANCE_CONFLICT');
 const fingerprint=JSON.stringify([grant.itemId,grant.variant,grant.source,[...grant.instanceIds].sort()]);
 const previous=own(state.grants,grant.grantId);
 if(previous!==undefined){if(previous!==fingerprint)fail('GRANT_CONFLICT');return state;}
 if(grant.instanceIds.some(id=>own(state.owned,id)!==undefined))fail('INSTANCE_CONFLICT');
 const owned={...state.owned};
 for(const id of grant.instanceIds)owned[id]={id,itemId:grant.itemId,variant:grant.variant,source:grant.source};
 return {...state,revision:state.revision+1,owned,grants:{...state.grants,[grant.grantId]:fingerprint}};
}

export function decorationFootprint(item:DecorationDefinition,rotation:GardenRotation):{width:number;height:number} {
 if(!item.rotations.includes(rotation))fail('UNSUPPORTED_ROTATION');
 return rotation===90||rotation===270?{width:item.height,height:item.width}:{width:item.width,height:item.height};
}
export function placementCells(item:DecorationDefinition,placement:GardenPlacement):Array<{x:number;y:number}> {
 const footprint=decorationFootprint(item,placement.rotation),cells=[];
 for(let y=0;y<footprint.height;y++)for(let x=0;x<footprint.width;x++)cells.push({x:placement.x+x,y:placement.y+y});
 return cells;
}

export function validateGardenPlacement(state:GardenWorldState,placement:GardenPlacement,map:GardenDefinition=GARDEN_WORLD,catalog:readonly DecorationDefinition[]=DECORATIONS):void {
 requireMap(state,map);requireId(placement.instanceId);
 const instance=own(state.owned,placement.instanceId)??fail('NOT_OWNED'),item=itemDefinition(instance.itemId,catalog);
 if(!Number.isSafeInteger(placement.x)||!Number.isSafeInteger(placement.y))fail('INVALID_INPUT');
 const cells=placementCells(item,placement);
 if(cells.some(c=>c.x<0||c.y<0||c.x>=map.width||c.y>=map.height))fail('OUT_OF_BOUNDS');
 if(cells.some(c=>!map.regions.some(region=>state.unlockedRegions.includes(region.id)&&contains(region,c.x,c.y))))fail('REGION_LOCKED');
 if(item.regions&&cells.some(c=>!map.regions.some(region=>item.regions!.includes(region.id)&&contains(region,c.x,c.y))))fail('WRONG_REGION');
 const occupied=new Set<string>();
 for(const existing of Object.values(state.placements)){
  if(existing.instanceId===placement.instanceId)continue;
  const other=own(state.owned,existing.instanceId)??fail('NOT_OWNED'),otherItem=itemDefinition(other.itemId,catalog);
  if(otherItem.layer!==item.layer)continue;
  for(const c of placementCells(otherItem,existing))occupied.add(c.x+','+c.y);
 }
 if(cells.some(c=>occupied.has(c.x+','+c.y)))fail('OCCUPIED');
}

/** actorId must come from authenticated server context, never a request body. Pure and immutable. */
export function applyGardenCommand(state:GardenWorldState,command:GardenCommand,actorId:string,map:GardenDefinition=GARDEN_WORLD,catalog:readonly DecorationDefinition[]=DECORATIONS):GardenWorldState {
 if(actorId!==state.ownerId)fail('FORBIDDEN');
 requireMap(state,map);requireId(command.operationId);requireId(command.instanceId);
 if(!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<0)fail('INVALID_INPUT');
 if(!['place','move','store'].includes(command.type))fail('INVALID_INPUT');
 const fingerprint=JSON.stringify(command.type==='store'?[command.type,command.instanceId,command.expectedRevision]:[command.type,command.instanceId,command.expectedRevision,command.x,command.y,command.rotation]);
 const previous=own(state.operations,command.operationId);
 if(previous!==undefined){if(previous!==fingerprint)fail('OPERATION_CONFLICT');return state;}
 if(command.expectedRevision!==state.revision)fail('STALE_REVISION');
 if(!own(state.owned,command.instanceId))fail('NOT_OWNED');
 const existing=own(state.placements,command.instanceId);
 if(command.type==='place'&&existing)fail('ALREADY_PLACED');
 if(command.type!=='place'&&!existing)fail('NOT_PLACED');
 const placements={...state.placements};
 if(command.type==='store')delete placements[command.instanceId];
 else {
  const placement={instanceId:command.instanceId,x:command.x,y:command.y,rotation:command.rotation};
  validateGardenPlacement(state,placement,map,catalog);placements[command.instanceId]=placement;
 }
 return {...state,revision:state.revision+1,placements,operations:{...state.operations,[command.operationId]:fingerprint}};
}

/** Region availability is a trusted story/economy result, not a normal client placement command. */
export function applyTrustedRegionUnlock(state:GardenWorldState,regionId:GardenRegionId,map:GardenDefinition=GARDEN_WORLD):GardenWorldState {
 requireMap(state,map);
 if(!map.regions.some(region=>region.id===regionId))fail('UNKNOWN_REGION');
 if(state.unlockedRegions.includes(regionId))return state;
 return {...state,revision:state.revision+1,unlockedRegions:[...state.unlockedRegions,regionId]};
}

export interface PublicGardenSnapshot {
 ownerId:string;mapId:string;revision:number;unlockedRegions:GardenRegionId[];
 objects:Array<GardenPlacement & {itemId:string;variant:string}>;
}
/** Only placed appearance is public. No unplaced inventory, receipts, operations or economy. */
export function publicGardenSnapshot(state:GardenWorldState):PublicGardenSnapshot {
 return {ownerId:state.ownerId,mapId:state.mapId,revision:state.revision,unlockedRegions:[...state.unlockedRegions],objects:Object.values(state.placements).map(placement=>{
  const item=own(state.owned,placement.instanceId)??fail('NOT_OWNED');
  return {...placement,itemId:item.itemId,variant:item.variant};
 })};
}

export function storedDecorations(state:GardenWorldState):OwnedDecoration[] {
 return Object.values(state.owned).filter(item=>!own(state.placements,item.id)).map(item=>({...item}));
}

import {z} from 'zod';
import {applyGardenCommand,applyGardenPlacementBatch,applyGardenExpansion,applyTrustedDecorationGrant,gardenVisitWorld,GARDEN_EXPANSION_COST,GARDEN_EXPANSION_TILES,GardenWorldError,type GardenWorldState,type GardenVisitResponse} from '../../../packages/garden-world/src';
import type {Player} from '@garden/contracts';
import {CLASSIC_GARDEN_SHOP_PRICES,MARKET_GARDEN_SHOP_PRICES,GARDEN_SHOP_LEVELS,GARDEN_SHOP_MIN_LEVEL,GARDEN_SHOP_PRICES,LEGACY_GARDEN_SHOP_PRICES,projectLiveGarden} from '../../../packages/garden-world/src/live';
import {assertSQL,ensure,HttpError,mutate,one,operationKey,readPlayer,spendCoins,sql,type ApiEnv,type MutationContext} from './db';
import {sha256} from './providers/common';
import {unblockedSQL} from './friends';
import {publicPlayerAgeSQL} from './age-access';

const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/);
const base={instanceId:id,expectedRevision:z.number().int().nonnegative(),key:id.min(8)};
const commandSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('store')}).strict(),
 z.object({...base,type:z.enum(['place','move']),x:z.number().int(),y:z.number().int(),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)])}).strict(),
 z.object({type:z.literal('paint'),key:id.min(8),expectedRevision:z.number().int().nonnegative(),placements:z.array(z.object({instanceId:id,x:z.number().int(),y:z.number().int(),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)])}).strict()).min(1).max(100)}).strict()
]);
export async function stored(env:ApiEnv,userId:string){return one<{revision:number;data:string}>(env.DB,'SELECT revision,data FROM garden_worlds WHERE user_id=?',userId);}
export async function gardenWorld(env:ApiEnv,userId:string,quotedShop=false,marketArt=false,botanicalArt=false){
 const [player,row]=await Promise.all([readPlayer(env.DB,userId),stored(env,userId)]);
 const prices=quotedShop?(botanicalArt?GARDEN_SHOP_PRICES:marketArt?MARKET_GARDEN_SHOP_PRICES:CLASSIC_GARDEN_SHOP_PRICES):LEGACY_GARDEN_SHOP_PRICES;
 return {world:projectLiveGarden(player,row?JSON.parse(row.data) as GardenWorldState:null),prices,...(quotedShop?{shopVersion:2 as const}:{}),...(marketArt&&quotedShop?{minimumLevels:GARDEN_SHOP_LEVELS}:{}),land:{cost:GARDEN_EXPANSION_COST,tiles:GARDEN_EXPANSION_TILES}};
}
export async function visitGarden(env:ApiEnv,userId:string,target:string):Promise<GardenVisitResponse>{
 z.string().uuid().parse(target);
 const row=await one<{data:string;garden_data:string|null;blocked:number}>(env.DB,`SELECT p.data,g.data garden_data,NOT (${unblockedSQL}) blocked FROM players p LEFT JOIN garden_worlds g ON g.user_id=p.id WHERE p.id=? AND p.deleted_at IS NULL AND ${publicPlayerAgeSQL(env)}`,userId,target,target,userId,target);
 ensure(row,'PLAYER_NOT_FOUND','정원사를 찾을 수 없어요.',404);
 ensure(!row.blocked,'PLAYER_UNAVAILABLE','이 정원사와 교류할 수 없어요.',403);
 const player=JSON.parse(row.data) as Player;
 const world=projectLiveGarden(player,row.garden_data?JSON.parse(row.garden_data) as GardenWorldState:null);
 return {owner:{userId:target,nickname:player.nickname,level:player.level},world:gardenVisitWorld(world),invitationVisits:true};
}
export function save(tx:MutationContext,row:{revision:number}|null,world:GardenWorldState){
 // The world and player balance commit together. Separate revision protects simultaneous device edits.
 tx.statements.push(row?assertSQL(tx.db,'SELECT revision=? FROM garden_worlds WHERE user_id=?',row.revision,world.ownerId):assertSQL(tx.db,'SELECT NOT EXISTS(SELECT 1 FROM garden_worlds WHERE user_id=?)',world.ownerId));
 tx.statements.push(sql(tx.db,'INSERT INTO garden_worlds(user_id,revision,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at',world.ownerId,world.revision,JSON.stringify(world),tx.now));
}
export async function grantEventDecoration(tx:MutationContext,itemId:string,grantId:string){
 const row=await one<{revision:number;data:string}>(tx.db,'SELECT revision,data FROM garden_worlds WHERE user_id=?',tx.player.id);
 const world=projectLiveGarden(tx.player,row?JSON.parse(row.data) as GardenWorldState:null);
 const next=applyTrustedDecorationGrant(world,{ownerId:tx.player.id,grantId,itemId,variant:'classic',source:'event',instanceIds:[grantId]});
 save(tx,row,next);
}
export async function gardenCommand(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const parsed=commandSchema.parse(body),{key,...command}=parsed;
 try{return await mutate(env,userId,key,'garden:layout:'+JSON.stringify(command),async tx=>{
  const row=await stored(env,userId),world=projectLiveGarden(tx.player,row?JSON.parse(row.data):null);
  const next=command.type==='paint'?applyGardenPlacementBatch(world,{...command,operationId:key},userId):applyGardenCommand(world,{...command,operationId:key},userId);
  // Global operations table holds retry receipts, so the growing command history need not be sent/stored twice.
  next.operations={};save(tx,row,next);return {world:next};
 },{touchPlayer:false});}catch(error){
  if(error instanceof GardenWorldError)throw new HttpError(error.code,error.code==='STALE_REVISION'?'다른 기기에서 정원이 바뀌었어요. 새로 불러온 뒤 다시 놓아 주세요.':'이 위치에 놓을 수 없어요. 다른 칸을 골라 주세요.',409);
  throw error;
 }
}
export async function buyDecoration(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const {itemId,quantity,expectedUnitPrice}=z.object({itemId:id,quantity:z.number().int().min(1).max(100).default(1),expectedUnitPrice:z.number().int().nonnegative().optional(),key:id.min(8)}).strict().parse(body);
 const cost=Object.hasOwn(GARDEN_SHOP_PRICES,itemId)?GARDEN_SHOP_PRICES[itemId]:undefined;
 ensure(cost!==undefined,'ITEM_NOT_FOR_SALE','판매 중인 장식을 골라 주세요.');
 const fingerprint='garden:buy:'+itemId+(quantity===1?'':':'+quantity)+(expectedUnitPrice===undefined?'':':quote='+expectedUnitPrice);
 return mutate(env,userId,operationKey(body),fingerprint,async tx=>{
  ensure(tx.player.level>=GARDEN_SHOP_MIN_LEVEL,'LOCKED','레벨 5부터 정원 상점이 열려요.');
  if(expectedUnitPrice===undefined){
   ensure(LEGACY_GARDEN_SHOP_PRICES[itemId]===cost,'UPDATE_REQUIRED','장식 가격이 변경됐어요. 앱을 업데이트해 주세요.',409);
  }else{
   ensure(expectedUnitPrice===cost,'GARDEN_PRICE_CHANGED','장식 가격이 변경됐어요. 새 가격을 확인해 주세요.',409);
  }
  const minimumLevel=GARDEN_SHOP_LEVELS[itemId]??GARDEN_SHOP_MIN_LEVEL;
  ensure(tx.player.level>=minimumLevel,'GARDEN_ITEM_LEVEL_REQUIRED',`레벨 ${minimumLevel}부터 이 시설을 구매할 수 있어요.`,403);
  const row=await stored(env,userId),world=projectLiveGarden(tx.player,row?JSON.parse(row.data):null);
  ensure(Object.keys(world.owned).length+quantity<=1000,'GARDEN_FULL','보관함이 가득해요.');
  const total=cost*quantity;spendCoins(tx.player,total);
  const receiptKey=operationKey(body),purchaseId='shop-'+(receiptKey.length<=84?receiptKey:await sha256(receiptKey)),instanceIds=Array.from({length:quantity},(_,i)=>quantity===1?purchaseId:purchaseId+'-'+i);
  const next=applyTrustedDecorationGrant(world,{ownerId:userId,grantId:purchaseId,itemId,variant:'classic',source:'shop',instanceIds});
  save(tx,row,next);return {player:tx.player,world:next,instanceId:instanceIds[0],instanceIds,quantity,cost:total};
 });
}

export async function expandGarden(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const {plotId,expectedRevision,key}=z.object({plotId:id,expectedRevision:z.number().int().nonnegative(),key:id.min(8)}).strict().parse(body);
 try{return await mutate(env,userId,key,`garden:expand:${plotId}:${expectedRevision}`,async tx=>{
  const row=await stored(env,userId),world=projectLiveGarden(tx.player,row?JSON.parse(row.data):null);
  const next=applyGardenExpansion(world,{plotId,expectedRevision,operationId:key},userId);
  spendCoins(tx.player,GARDEN_EXPANSION_COST);next.operations={};save(tx,row,next);
  return {player:tx.player,world:next,cost:GARDEN_EXPANSION_COST,cellsAdded:GARDEN_EXPANSION_TILES};
 });}catch(error){if(error instanceof GardenWorldError)throw new HttpError(error.code,error.code==='STALE_REVISION'?'다른 기기에서 정원이 바뀌었어요. 새로 불러온 뒤 다시 확장해 주세요.':'확장할 수 없는 땅이에요. 다른 위치를 골라 주세요.',409);throw error;}
}

import {z} from 'zod';
import {applyGardenCommand,applyTrustedDecorationGrant,GardenWorldError,type GardenWorldState} from '../../../packages/garden-world/src';
import {GARDEN_SHOP_PRICES,projectLiveGarden} from '../../../packages/garden-world/src/live';
import {assertSQL,ensure,HttpError,mutate,one,operationKey,readPlayer,spendCoins,sql,type ApiEnv,type MutationContext} from './db';

const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/);
const base={instanceId:id,expectedRevision:z.number().int().nonnegative(),key:id.min(8)};
const commandSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('store')}).strict(),
 z.object({...base,type:z.enum(['place','move']),x:z.number().int(),y:z.number().int(),rotation:z.union([z.literal(0),z.literal(90)])}).strict()
]);
async function stored(env:ApiEnv,userId:string){return one<{revision:number;data:string}>(env.DB,'SELECT revision,data FROM garden_worlds WHERE user_id=?',userId);}
export async function gardenWorld(env:ApiEnv,userId:string){
 const [player,row]=await Promise.all([readPlayer(env.DB,userId),stored(env,userId)]);
 return {world:projectLiveGarden(player,row?JSON.parse(row.data) as GardenWorldState:null),prices:GARDEN_SHOP_PRICES};
}
function save(tx:MutationContext,row:{revision:number}|null,world:GardenWorldState){
 // The world and player balance commit together. Separate revision protects simultaneous device edits.
 tx.statements.push(row?assertSQL(tx.db,'SELECT revision=? FROM garden_worlds WHERE user_id=?',row.revision,world.ownerId):assertSQL(tx.db,'SELECT NOT EXISTS(SELECT 1 FROM garden_worlds WHERE user_id=?)',world.ownerId));
 tx.statements.push(sql(tx.db,'INSERT INTO garden_worlds(user_id,revision,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at',world.ownerId,world.revision,JSON.stringify(world),tx.now));
}
export async function gardenCommand(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const parsed=commandSchema.parse(body),{key,...command}=parsed;
 try{return await mutate(env,userId,key,'garden:layout:'+JSON.stringify(command),async tx=>{
  const row=await stored(env,userId),world=projectLiveGarden(tx.player,row?JSON.parse(row.data):null);
  const next=applyGardenCommand(world,{...command,operationId:key},userId);
  // Global operations table holds retry receipts, so the growing command history need not be sent/stored twice.
  next.operations={};save(tx,row,next);return {world:next};
 },{touchPlayer:false});}catch(error){
  if(error instanceof GardenWorldError)throw new HttpError(error.code,error.code==='STALE_REVISION'?'다른 기기에서 정원이 바뀌었어요. 새로 불러온 뒤 다시 놓아 주세요.':'이 위치에 놓을 수 없어요. 다른 칸을 골라 주세요.',409);
  throw error;
 }
}
export async function buyDecoration(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const {itemId}=z.object({itemId:id,key:id.min(8)}).strict().parse(body);
 const cost=Object.hasOwn(GARDEN_SHOP_PRICES,itemId)?GARDEN_SHOP_PRICES[itemId]:undefined;
 ensure(cost!==undefined,'ITEM_NOT_FOR_SALE','판매 중인 장식을 골라 주세요.');
 return mutate(env,userId,operationKey(body),'garden:buy:'+itemId,async tx=>{
  ensure(tx.player.level>=5,'LOCKED','레벨 5부터 정원 상점이 열려요.');
  const row=await stored(env,userId),world=projectLiveGarden(tx.player,row?JSON.parse(row.data):null);
  ensure(Object.keys(world.owned).length<1000,'GARDEN_FULL','보관함이 가득해요.');
  spendCoins(tx.player,cost);
  const instanceId='shop-'+operationKey(body);
  const next=applyTrustedDecorationGrant(world,{ownerId:userId,grantId:instanceId,itemId,variant:'classic',source:'shop',instanceIds:[instanceId]});
  save(tx,row,next);return {player:tx.player,world:next,instanceId,cost};
 });
}

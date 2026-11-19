import type {Player,Run} from '@garden/contracts';

export type HomeRewardKind='coins'|'stars';
export type HomeRewardAmount=Record<HomeRewardKind,number>;
export interface HomeReward extends HomeRewardAmount {id:string;version:number}
interface SavedRewards {pending:HomeReward[];seen:string[]}
interface RewardStore {value:SavedRewards;listeners:Set<()=>void>}

const stores=new Map<string,RewardStore>();
const key=(id:string)=>`garden-home-rewards-v1-${id}`;
const validCount=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
function isReward(value:unknown):value is HomeReward{
 if(!value||typeof value!=='object')return false;
 const reward=value as Partial<HomeReward>;
 return typeof reward.id==='string'&&validCount(reward.version)&&validCount(reward.coins)&&validCount(reward.stars);
}
function read(id:string):SavedRewards{
 try{
  const saved=JSON.parse(localStorage.getItem(key(id))??'null') as Partial<SavedRewards>|null;
  if(saved)return {
   pending:Array.isArray(saved.pending)?saved.pending.filter(reward=>isReward(reward)&&(reward.coins>0||reward.stars>0)):[],
   seen:Array.isArray(saved.seen)?saved.seen.filter(id=>typeof id==='string'):[],
  };
 }catch{/* A damaged or unavailable cache should not block showing the home screen. */}
 return {pending:[],seen:[]};
}
function storeFor(id:string){
 let store=stores.get(id);
 if(!store){store={value:read(id),listeners:new Set()};stores.set(id,store);}
 return store;
}
function save(id:string,store:RewardStore,value:SavedRewards){
 store.value=value;
 try{localStorage.setItem(key(id),JSON.stringify(value));}catch{/* Keep pending motion in memory for this session. */}
 for(const listener of store.listeners)listener();
}

export function rememberHomeReward(player:Pick<Player,'id'|'version'>,id:string,amount:HomeRewardAmount){
 if(!validCount(amount.coins)||!validCount(amount.stars)||amount.coins+amount.stars===0)return;
 const store=storeFor(player.id),{pending,seen}=store.value;
 if(seen.includes(id)||pending.some(reward=>reward.id===id))return;
 save(player.id,store,{pending:[...pending,{id,version:player.version,...amount}],seen:[...seen,id].slice(-512)});
}

export function rememberPuzzleReward(player:Player,run:Run){
 if(run.userId===player.id&&run.status==='won'&&run.reward&&player.level>run.level.id){
  rememberHomeReward(player,`run:${run.id}`,{coins:run.reward.coins,stars:run.reward.stars});
 }
}

export const pendingHomeRewards=(id:string):readonly HomeReward[]=>storeFor(id).value.pending;
export function watchHomeRewards(id:string,listener:()=>void){
 const {listeners}=storeFor(id);
 listeners.add(listener);
 return ()=>{listeners.delete(listener);};
}

// The queue only controls presentation. Player balances always come from the server.
export function landHomeRewards(id:string,receipts:ReadonlySet<string>,amount?:Partial<HomeRewardAmount>){
 const store=storeFor(id),pending:HomeReward[]=[];
 let coins=amount?.coins??0,stars=amount?.stars??0,changed=false;
 for(const reward of store.value.pending){
  if(!receipts.has(reward.id)){pending.push(reward);continue;}
  if(!amount){changed=true;continue;}
  const coinDelta=Math.min(coins,reward.coins),starDelta=Math.min(stars,reward.stars);
  coins-=coinDelta;stars-=starDelta;
  changed||=coinDelta>0||starDelta>0;
  if(reward.coins>coinDelta||reward.stars>starDelta)pending.push({...reward,coins:reward.coins-coinDelta,stars:reward.stars-starDelta});
 }
 if(changed)save(id,store,{...store.value,pending});
}

export function homeRewardTotal(rewards:readonly HomeReward[]):HomeRewardAmount{
 return rewards.reduce((total,reward)=>({coins:total.coins+reward.coins,stars:total.stars+reward.stars}),{coins:0,stars:0});
}

export function rewardPieces(kind:HomeRewardKind,amount:number){
 if(amount<=0)return [];
 const count=kind==='coins'?Math.min(14,Math.max(6,Math.ceil(Math.sqrt(amount)*1.5))):Math.min(9,amount+2);
 return Array.from({length:count},(_,index)=>Math.floor((index+1)*amount/count)-Math.floor(index*amount/count));
}

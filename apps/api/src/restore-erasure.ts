import { erasureAccountHash, eraseAccount } from './account-erasure';
import { rows, sql, type ApiEnv } from './db';

interface Receipt {account_hash:string;erased_at:number;expires_at:number}

export async function exportErasureReceipts(env:ApiEnv,after:string) {
  const items=await rows<Receipt>(env.DB,`SELECT account_hash,erased_at,expires_at FROM account_erasure_receipts
    WHERE expires_at>? AND account_hash>? ORDER BY account_hash LIMIT 100`,Date.now(),after);
  return {items,next:items.length===100?items.at(-1)!.account_hash:null};
}

export async function importErasureReceipts(env:ApiEnv,items:Receipt[]) {
  const now=Date.now();
  const active=items.filter(item=>item.expires_at>now&&item.erased_at<=now&&item.expires_at-item.erased_at===30*86_400_000);
  if(active.length)await env.DB.batch(active.map(item=>sql(env.DB,
    'INSERT INTO account_erasure_receipts VALUES(?,?,?) ON CONFLICT(account_hash) DO NOTHING',item.account_hash,item.erased_at,item.expires_at)));
  return {received:active.length};
}

export async function replayErasureReceipts(env:ApiEnv,after:string) {
  const candidates=await rows<{id:string}>(env.DB,'SELECT id FROM players WHERE id>? ORDER BY id LIMIT 100',after);
  const hashes=await Promise.all(candidates.map(({id})=>erasureAccountHash(id)));
  if(!hashes.length)return {erased:0,next:null};
  const matched=await rows<{account_hash:string}>(env.DB,`SELECT account_hash FROM account_erasure_receipts
    WHERE account_hash IN (SELECT value FROM json_each(?)) AND expires_at>?`,JSON.stringify(hashes),Date.now());
  const erasedHashes=new Set(matched.map(row=>row.account_hash));
  let erased=0;
  for(const [index,{id}] of candidates.entries()){
    if(erasedHashes.has(hashes[index]!)){await eraseAccount(env,id,'restore');erased++;}
  }
  return {erased,next:candidates.length===100?candidates.at(-1)!.id:null};
}

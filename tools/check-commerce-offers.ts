import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {OFFER_PRODUCTS} from '@garden/content';
import {offerState,offers,checkOfferGrant} from '../apps/api/src/offers';
import {preparePurchase,cancelPurchaseIntent} from '../apps/api/src/monetization';
import {newPlayer,readPlayer,sql,uid,type ApiEnv} from '../apps/api/src/db';
import {startRun,runActions,closeRun} from '../apps/api/src/runs';
import solutions from '../packages/content/src/solutions.json';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-11-02',d1Databases:{DB:'isolated-offer-test'}}));
const realNow=Date.now;let now=Date.UTC(2026,10,2,9);Date.now=()=>now;
const checks:string[]=[];const pass=(name:string)=>{checks.push(name);console.log('PASS '+name)};
try{
 const db=await mf.getD1Database('DB');for(const file of(await readdir('apps/api/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const env={DB:db,ENVIRONMENT:'development'} as ApiEnv,p=newPlayer(uid(),now);await sql(db,'INSERT INTO players(id,data,version,created_at) VALUES(?,?,1,?)',p.id,JSON.stringify(p),now).run();
 const timed=OFFER_PRODUCTS.find(p=>p.offer?.kind==='timed')!,chain=OFFER_PRODUCTS.filter(p=>p.offer?.kind==='chain');assert.equal((await offerState(db,p.id,timed,now)).status,'locked');assert((await offers(env,p.id)).offers.every(offer=>offer.status==='locked'));await assert.rejects(()=>preparePurchase(env,p.id,{key:uid(),productId:chain[0]!.id}));pass('new players cannot buy locked offers');
 for(let i=1;i<=4;i++){const {run}=await startRun(env,p.id,{key:uid()});await runActions(env,p.id,run.id,{key:uid(),sequence:0,actions:(solutions as Record<string,{actions:import('@garden/contracts').Action[]}>)[i]!.actions});await closeRun(env,p.id,run.id,{key:uid()});}
 const before=await readPlayer(db,p.id);assert.equal(before.level,5);assert.equal((await offerState(db,p.id,timed,now)).startsAt,now);assert.equal((await offerState(db,p.id,timed,now)).status,'available');pass('timed window begins at a real validated level-four clear');
 await assert.rejects(()=>preparePurchase(env,p.id,{key:uid(),productId:chain[1]!.id}));pass('later chain steps cannot be purchased out of order');
 const intent=await preparePurchase(env,p.id,{key:uid(),productId:chain[0]!.id});const row=await db.prepare('SELECT * FROM purchase_intents WHERE id=?').bind(intent.purchaseIntentId).first<{season_id:string;created_at:number}>();assert(row?.season_id.includes('2026-11'));await assert.rejects(()=>preparePurchase(env,p.id,{key:uid(),productId:chain[0]!.id}));assert.equal((await readPlayer(db,p.id)).coins,before.coins);assert.deepEqual((await readPlayer(db,p.id)).inventory,before.inventory);pass('reservation pins month, blocks duplicate sheets and grants nothing');
 await checkOfferGrant(db,p.id,chain[0]!,row!.season_id,row!.created_at);
 // Private receipt fixture only; no public bypass, store call or ordinary player DB is used.
 await sql(db,'INSERT INTO purchases VALUES(?,?,?,?,?,?,?,?,?)','google','private-receipt',p.id,chain[0]!.id,'Sandbox','granted','{}',now,intent.purchaseIntentId).run();await sql(db,"UPDATE purchase_intents SET status='granted' WHERE id=?",intent.purchaseIntentId).run();
 assert.equal((await offerState(db,p.id,chain[1]!,now)).status,'available');await assert.rejects(()=>checkOfferGrant(db,p.id,chain[0]!,row!.season_id,row!.created_at));await assert.rejects(()=>preparePurchase(env,p.id,{key:uid(),productId:chain[0]!.id}));pass('confirmed purchase opens next step and blocks a second grant in that month');
 await sql(db,"UPDATE purchases SET status='refunded' WHERE transaction_id='private-receipt'").run();assert.equal((await offerState(db,p.id,chain[0]!,now)).status,'refunded');assert.equal((await offerState(db,p.id,chain[1]!,now)).status,'locked');await assert.rejects(()=>checkOfferGrant(db,p.id,chain[0]!,row!.season_id,row!.created_at));await sql(db,"UPDATE purchases SET status='granted' WHERE transaction_id='private-receipt'").run();pass('refunds are shown accurately and cannot reopen a consumed campaign or unlock later steps');
 const next=await preparePurchase(env,p.id,{key:uid(),productId:chain[1]!.id});const nextRow=await db.prepare('SELECT season_id,created_at FROM purchase_intents WHERE id=?').bind(next.purchaseIntentId).first<{season_id:string;created_at:number}>();now=Date.UTC(2026,11,1);await checkOfferGrant(db,p.id,chain[1]!,nextRow!.season_id,nextRow!.created_at);pass('late authentic approvals retain the original reserved month');
 const renewed=await offers(env,p.id);assert.equal(renewed.offers.find(o=>o.product.id===chain[0]!.id)!.status,'available');assert.equal(renewed.offers.find(o=>o.product.id===chain[1]!.id)!.status,'locked');assert.equal(renewed.offers.find(o=>o.product.id===timed.id)!.status,'expired');pass('new month resets chain while expired timed offers do not restart');
 assert.equal((await readPlayer(db,p.id)).level,before.level);assert.equal((await db.prepare('SELECT max(level_id) n FROM level_rewards WHERE user_id=?').bind(p.id).first<{n:number}>())!.n,4);pass('offer reservations and purchase history cannot buy leaderboard progress');
 await cancelPurchaseIntent(env,p.id,next.purchaseIntentId,{key:uid()});await mkdir('output/verification/home-commerce',{recursive:true});await writeFile('output/verification/home-commerce/api.json',JSON.stringify({checks,passed:checks.length,scope:'isolated real workerd/D1; four real validated clears; private purchase-status fixture; no live store payment'},null,2));
}finally{Date.now=realNow;await mf.dispose()}

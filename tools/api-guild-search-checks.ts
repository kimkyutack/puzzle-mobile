import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { newPlayer, sql, uid, type ApiEnv } from '../apps/api/src/db';
import { createGuild, searchGuilds } from '../apps/api/src/guild';

// Ephemeral real workerd/D1, not a SQL mock or a debug endpoint in the deployed Worker.
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("local test")}}',compatibilityDate:'2026-11-02',d1Databases:{DB:'guild-search-regression'}}));
const checks:Array<{name:string;passed:boolean}>=[];
const record=(name:string)=>{checks.push({name,passed:true});console.log('PASS '+name);};
try{
 const db=await mf.getD1Database('DB');
 for(const file of ['0001_initial.sql','0002_integrity_and_identity.sql','0003_purchase_intents.sql','0004_receipt_binding.sql','0005_rate_expiry.sql','0006_apple_authorization.sql','0007_rankings.sql'])await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(query=>db.prepare(query)));
 const env:ApiEnv={DB:db,get ASSETS():R2Bucket{throw new Error('search cannot access assets');},get GUILD_ROOMS():Env['GUILD_ROOMS']{throw new Error('search cannot access realtime transport');},ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',GOOGLE_PACKAGE_NAME:'com.cloudgarden.match',GOOGLE_IAP_ENVIRONMENT:'Sandbox',ADMOB_AD_UNITS:'',ADMOB_REWARD_ITEMS:'reward',APPLE_BUNDLE_ID:'com.cloudgarden.match',ADMOB_HEART_AD_UNIT:'',ADMOB_COIN_AD_UNIT:''};
 const names=['가나다라마바사아자차카타파하가나다라마바사아자차','우리CloudGarden친구','백%정원_친구'];
 assert.equal(names[0]!.length,24);
 const ids:string[]=[],players:string[]=[];
 for(const name of names){const now=Date.now(),player=newPlayer(uid(),now);player.level=5;await sql(db,'INSERT INTO players(id,data,version,created_at) VALUES(?,?,1,?)',player.id,JSON.stringify(player),now).run();const result=await createGuild(env,player.id,{key:uid(),name,minLevel:5,emblem:0,mode:'open'});ids.push(result.guild.id);players.push(player.id);}
 const results=async(q:string)=>(await searchGuilds(env,q)).guilds.map(guild=>guild.id);
 // Prove this real D1 runtime reproduces the old SQL failure at the documented byte boundary.
 await db.prepare('SELECT ? LIKE ? matches').bind(names[0],'%'+names[0]!.slice(0,16)+'%').first();
 await assert.rejects(()=>db.prepare('SELECT ? LIKE ? matches').bind(names[0],'%'+names[0]!.slice(0,17)+'%').first());
 record('real D1 reproduces old LIKE failure after 50-byte pattern');
 for(const length of [16,17,24])assert.deepEqual(await results(names[0]!.slice(0,length)),[ids[0]]);
 assert.deepEqual(await results(names[0]!.slice(5,21)),[ids[0]]);
 record('16, 17 and 24 Hangul characters and an interior substring all find the intended guild');
 for(const query of ['cloudgarden','CLOUDGARDEN','cLoUdGaRdEn'])assert.deepEqual(await results(query),[ids[1]]);
 record('ASCII case-insensitive partial search is preserved');
 for(const query of ['%','_','%정원_'])assert.deepEqual(await results(query),[ids[2]]);
 assert.deepEqual(await results('백정원친구'),[]);
 record('percent and underscore are literal searchable characters, never wildcards or silently removed');
 assert.deepEqual(await results("' OR 1=1 --"),[]);
 record('SQL-looking input stays a bound literal and does not widen results');
 await sql(db,'INSERT INTO guild_applications VALUES(?,?,?)',ids[0],players[1],Date.now()).run();
 assert.deepEqual((await searchGuilds(env,names[0]!,players[1])).pendingIds,[ids[0]]);
 assert.deepEqual((await searchGuilds(env,names[0]!,players[2])).pendingIds,[]);
 record('pending application IDs remain isolated to the requesting player');
 await db.batch(Array.from({length:55},(_,index)=>sql(db,'INSERT INTO guilds VALUES(?,?,?,?,?,?,?,?)',uid(),'추가검색정원'+index,'','','open',5,0,Date.now()+index)));
 const list=await searchGuilds(env,'');assert.equal(list.guilds.length,50);assert(list.guilds.slice(0,3).every(guild=>guild.members===1));
 record('empty search retains 50-result cap and member-count ordering');
 await mkdir('output/verification',{recursive:true});await writeFile('output/verification/api-guild-search-checks.json',JSON.stringify({at:new Date().toISOString(),environment:'ephemeral real workerd/D1, actual migrations and guild handlers; private level-5 test fixtures',checks,passed:checks.length},null,2));
}finally{await mf.dispose();}

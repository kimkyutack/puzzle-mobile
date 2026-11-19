import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {newPlayer,readPlayer,type ApiEnv} from '../apps/api/src/db';
import {selectRewardedUnit} from '../apps/api/src/ad-config';
import {createIntent,intentStatus,intentSignal,storeVerifiedCallback,processAdGrant,admobCallback} from '../apps/api/src/monetization';
import {verifyAdMobSignature} from '../apps/api/src/providers';

class Statement {
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null) as T|null}
 execute(){return {success:true,results:this.db.prepare(this.query).all(...this.args),meta:{changes:0}}}
 async all(){return this.execute()}async run(){return this.execute()}
}
const android='ca-app-pub-8278526737142254/9847446642',ios='ca-app-pub-8278526737142254/4199921188';
const user='admob-v55',now=Date.parse('2026-11-10T08:00:00Z');let db:DatabaseSync,env:ApiEnv;
const probeKeys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),probePem=probeKeys.publicKey.export({type:'spki',format:'pem'}).toString();
function consoleCallback(overrides:Record<string,string>={}){
 const params=new URLSearchParams({ad_unit:'4199921188',custom_data:'admob-ssv-check',reward_amount:'1',reward_item:'Reward',timestamp:String(now),transaction_id:'console-ssv-check',user_id:'admob-ssv-check',...overrides});const signed=params.toString();
 return new Request(`https://example.test/api/ads/ssv?${signed}&signature=${sign('sha256',Buffer.from(signed),probeKeys.privateKey).toString('base64url')}&key_id=17`);
}
function verifierKeys(){return vi.spyOn(globalThis,'fetch').mockImplementation(async()=>Response.json({keys:[{keyId:17,pem:probePem}]}));}
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');for(const f of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+f,'utf8'));
 env={ADMOB_ENABLED:'true',ADMOB_ANDROID_HEART_AD_UNIT:android,ADMOB_ANDROID_COIN_AD_UNIT:android,ADMOB_IOS_HEART_AD_UNIT:ios,ADMOB_IOS_COIN_AD_UNIT:ios,ADMOB_HEART_AD_UNIT:'',ADMOB_COIN_AD_UNIT:'',ADMOB_AD_UNITS:android+','+ios,ADMOB_REWARD_ITEMS:'reward,Reward',DB:{prepare:(q:string)=>new Statement(db,q),batch:async(s:Statement[])=>{db.exec('BEGIN');try{const r=s.map(x=>x.execute());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}} as unknown as ApiEnv;
 const player=newPlayer(user,now);player.level=10;player.hearts=2;player.heartAt=now;db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(player),player.version,now);
});
describe('AdMob console URL verification without granting game rewards',()=>{
 it('acknowledges only the explicitly marked signed setup check with no DB access or background grant',async()=>{
  verifierKeys();env.ADMOB_ENABLED='false';const noDb={...env,get DB():never{throw Error('Setup verification must not access player data')}};const waitUntil=vi.fn();
  await expect(admobCallback(noDb,consoleCallback(),{waitUntil} as unknown as ExecutionContext)).resolves.toEqual({received:true,verificationOnly:true});expect(waitUntil).not.toHaveBeenCalled();
 });
 it.each(['1234567890','9999999999'])('accepts the Google-signed console synthetic unit %s only for the exact no-reward setup markers',async unit=>{
  verifierKeys();env.ADMOB_ENABLED='false';const noDb={...env,get DB():never{throw Error('Synthetic-unit setup check must not access player data')}},waitUntil=vi.fn(),request=consoleCallback({ad_unit:unit});
  // The ordinary signature-verification API remains strict by default.
  expect(()=>verifyAdMobSignature(request.url,probePem,env)).toThrow();
  await expect(admobCallback(noDb,request,{waitUntil} as unknown as ExecutionContext)).resolves.toEqual({received:true,verificationOnly:true});expect(waitUntil).not.toHaveBeenCalled();
  const verified=verifyAdMobSignature(request.url,probePem,env,{allowSetupCheck:true});await expect(storeVerifiedCallback(noDb,verified)).rejects.toMatchObject({code:'SSV_SETUP_ONLY'});
 });
 it('rejects unsigned and tampered setup checks before any DB access',async()=>{
  verifierKeys();const noDb={...env,get DB():never{throw Error('Unverified setup request reached player data')}};const ctx={waitUntil:vi.fn()} as unknown as ExecutionContext;
  await expect(admobCallback(noDb,new Request('https://example.test/api/ads/ssv?user_id=admob-ssv-check&custom_data=admob-ssv-check'),ctx)).rejects.toMatchObject({code:'INVALID_SSV'});
  const request=consoleCallback();await expect(admobCallback(noDb,new Request(request.url.replace('reward_amount=1','reward_amount=9')),ctx)).rejects.toMatchObject({code:'INVALID_SSV_SIGNATURE'});
 });
 it.each<Record<string,string>>([{reward_amount:'2'},{reward_item:'unknown'}])('does not acknowledge a disallowed signed setup payload %j',async values=>{
  verifierKeys();await expect(admobCallback(env,consoleCallback(values),{waitUntil:vi.fn()} as unknown as ExecutionContext)).rejects.toThrow();expect(db.prepare('SELECT count(*) n FROM ad_callbacks').get()?.n).toBe(0);
 });
 it.each<Record<string,string>>([{user_id:'someone-else'},{custom_data:'unknown-reservation'}])('rejects synthetic units when only one console marker matches %j',async values=>{
  verifierKeys();await expect(admobCallback(env,consoleCallback({ad_unit:'1234567890',...values}),{waitUntil:vi.fn()} as unknown as ExecutionContext)).rejects.toMatchObject({code:'INVALID_SSV_PLACEMENT'});expect(db.prepare('SELECT count(*) n FROM ad_callbacks').get()?.n).toBe(0);
 });
 it.each<Record<string,string>>([{user_id:'someone-else'},{custom_data:'unknown-reservation'}])('keeps normal intent validation when only one setup marker matches %j',async values=>{
  verifierKeys();await expect(admobCallback(env,consoleCallback(values),{waitUntil:vi.fn()} as unknown as ExecutionContext)).rejects.toMatchObject({code:'INTENT_NOT_FOUND'});expect(db.prepare('SELECT count(*) n FROM ad_callbacks').get()?.n).toBe(0);
 });
 it('logs bounded rejection diagnostics without the callback, signature or player/intent identifiers',async()=>{
  verifierKeys();const warn=vi.spyOn(console,'warn').mockImplementation(()=>{}),request=consoleCallback({ad_unit:'9999999999',user_id:'private-player-id-test',custom_data:'private-intent-id-test'});
  await expect(admobCallback(env,request,{waitUntil:vi.fn()} as unknown as ExecutionContext)).rejects.toMatchObject({code:'INVALID_SSV_PLACEMENT'});
  const message=String(warn.mock.calls[0]?.[0]);expect(JSON.parse(message)).toMatchObject({event:'ad:ssv-rejected',hasSignature:true,signatureLast:true,hasUserId:true,hasCustomData:true,setupUser:false,setupData:false,configuredUnit:false,rewardAmountIsOne:true});for(const secret of ['private-player-id-test','private-intent-id-test',request.url,new URL(request.url).searchParams.get('signature')!])expect(message).not.toContain(secret);
 });
});
afterEach(()=>{db.close();vi.restoreAllMocks()});
describe('platform-specific AdMob units and immutable reservations',()=>{
 it('chooses the matching platform for both placements and fails closed for web/unknown or missing platform',()=>{
  for(const placement of ['heart','coin_bonus'] as const){expect(selectRewardedUnit(env,placement,'android')).toBe(android);expect(selectRewardedUnit(env,placement,'ios')).toBe(ios);expect(()=>selectRewardedUnit(env,placement,'web')).toThrow();expect(()=>selectRewardedUnit(env,placement)).toThrow();}
  env.ADMOB_HEART_AD_UNIT='legacy-heart';env.ADMOB_COIN_AD_UNIT='legacy-coins';expect(selectRewardedUnit(env,'heart')).toBe('legacy-heart');expect(selectRewardedUnit(env,'coin_bonus')).toBe('legacy-coins');env.ADMOB_IOS_HEART_AD_UNIT='';expect(selectRewardedUnit(env,'heart','ios')).toBe('legacy-heart');
 });
 it('reuses cancelled slots only for their own platform unit',async()=>{
  const first=await createIntent(env,user,{key:'android-reservation',placement:'heart'},'android');await intentSignal(env,user,first.intent.id,{key:'android-cancel-key',status:'cancelled'});
  const second=await createIntent(env,user,{key:'ios-reservation-key',placement:'heart'},'ios');expect(second.intent.adUnit).toBe(ios);expect(second.intent.id).not.toBe(first.intent.id);await expect(createIntent(env,user,{key:'android-still-pending',placement:'heart'},'android')).rejects.toMatchObject({code:'AD_PENDING'});await intentSignal(env,user,second.intent.id,{key:'ios-cancel-key',status:'cancelled'});
  const retry=await createIntent(env,user,{key:'android-retry-key',placement:'heart'},'android');expect(retry.intent.id).toBe(first.intent.id);expect(retry.intent.adUnit).toBe(android);
 });
 it('keeps the exact stored response and old reserved unit through configuration rotation',async()=>{
  const request={key:'immutable-reservation',placement:'heart'},first=await createIntent(env,user,request,'android');env.ADMOB_ANDROID_HEART_AD_UNIT='rotated-unit';expect(await createIntent(env,user,request,'android')).toEqual(first);
  await expect(createIntent(env,user,{key:'another-reservation',placement:'heart'},'android')).rejects.toMatchObject({code:'AD_PENDING'});expect(db.prepare('SELECT ad_unit FROM reward_intents WHERE id=?').get(first.intent.id)?.ad_unit).toBe(android);
 });
 it('never grants from client pending/cancel signals; a real signed numeric SSV grants once even after new requests are disabled',async()=>{
  const {intent}=await createIntent(env,user,{key:'ssv-reservation-key',placement:'heart'},'ios');await intentSignal(env,user,intent.id,{key:'pending-signal-key',status:'pending'});await processAdGrant(env,intent.id);expect((await readPlayer(env.DB,user)).hearts).toBe(2);
  const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pem=pair.publicKey.export({type:'spki',format:'pem'}).toString();const raw=`ad_unit=4199921188&custom_data=${intent.id}&reward_amount=1&reward_item=Reward&timestamp=${now}&transaction_id=ssv-transaction-v55&user_id=${user}`;const url=`https://example.test/api/ads/ssv?${raw}&signature=${sign('sha256',Buffer.from(raw),pair.privateKey).toString('base64url')}&key_id=17`;
  const verified=verifyAdMobSignature(url,pem,env);expect(verified.adUnit).toBe(ios);env.ADMOB_ENABLED='false';await expect(createIntent(env,user,{key:'disabled-new-key',placement:'heart'},'ios')).rejects.toMatchObject({code:'ADS_UNAVAILABLE'});
  await expect(storeVerifiedCallback(env,{...verified,userId:'another-user'})).rejects.toMatchObject({code:'SSV_INTENT_MISMATCH'});await storeVerifiedCallback(env,verified);await processAdGrant(env,intent.id);await storeVerifiedCallback(env,verified);await processAdGrant(env,intent.id);expect((await readPlayer(env.DB,user)).hearts).toBe(3);expect(db.prepare('SELECT count(*) n FROM ad_callbacks').get()?.n).toBe(1);expect(db.prepare('SELECT granted FROM ad_daily_usage WHERE user_id=?').get(user)?.granted).toBe(1);
 });
 it('uses the clear reward amount for coins and rejects forged client grants or duplicate run bonuses',async()=>{
  const runId=crypto.randomUUID();db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(runId,user,JSON.stringify({status:'won',reward:{coins:50}}),'won',0,now+10000,'coin-clear-fixture');const before=await readPlayer(env.DB,user);
  const{intent}=await createIntent(env,user,{key:'coin-reservation-key',placement:'coin_bonus',runId,amount:999999},'android');expect(intent.amount).toBe(50);await expect(intentSignal(env,user,intent.id,{key:'forged-coin-grant',status:'granted'})).rejects.toThrow();expect((await readPlayer(env.DB,user)).boundCoins).toBe(before.boundCoins);
  await storeVerifiedCallback(env,{transactionId:'coin-view-transaction',intentId:intent.id,userId:user,adUnit:android,timestamp:now,rewardAmount:1,rewardItem:'Reward'});await processAdGrant(env,intent.id);await processAdGrant(env,intent.id);const after=await readPlayer(env.DB,user);expect(after.boundCoins).toBe(before.boundCoins+50);expect(after.coins).toBe(before.coins);await expect(createIntent(env,user,{key:'duplicate-coin-key',placement:'coin_bonus',runId},'android')).rejects.toMatchObject({code:'AD_ALREADY_REQUESTED'});
 });
});
describe('ad reward quotas reset at Korean midnight',()=>{
 function clock(at:number){vi.mocked(Date.now).mockReturnValue(at);const row=db.prepare('SELECT data FROM players WHERE id=?').get(user)!;const player=JSON.parse(String(row.data));player.hearts=1;player.heartAt=at;db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),user);}
 function past(placement:'heart'|'coin_bonus',approvedAt:number,status='granted'){
  const id=crypto.randomUUID(),legacyUtcDay=Math.floor(approvedAt/86400000);db.prepare('INSERT INTO reward_intents VALUES(?,?,?,?,?,?,?,?,?,?,NULL)').run(id,user,placement,null,placement==='heart'?1:50,ios,status,approvedAt,approvedAt+1800000,legacyUtcDay);return id;
 }
 function wonRun(){const id=crypto.randomUUID();db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(id,user,JSON.stringify({status:'won',reward:{coins:50}}),'won',0,Date.now()+10000,'quota-clear-fixture');return id;}
 it.each([['heart',5],['coin_bonus',10]] as const)('resets the %s quota at exactly 00:00 KST, preserving its %i daily limit',async(placement,limit)=>{
  const before=Date.parse('2026-11-11T23:59:59.999+09:00'),after=before+1;clock(before);for(let i=0;i<limit;i++)past(placement,before-3600000-i*1000);
  const request={placement,...(placement==='coin_bonus'?{runId:wonRun()}:{})};await expect(createIntent(env,user,{key:'kst-before-midnight',...request},'ios')).rejects.toMatchObject({code:'AD_DAILY_LIMIT'});
  clock(after);const {intent}=await createIntent(env,user,{key:'kst-after-midnight',...request},'ios');expect(intent.adUnit).toBe(ios);expect(db.prepare('SELECT approved_at,day FROM reward_intents WHERE id=?').get(intent.id)).toMatchObject({approved_at:after,day:Math.floor((after+9*3600000)/86400000)});
 });
 it('does not reset again at 09:00 KST when UTC changes date',async()=>{
  const before=Date.parse('2026-11-11T08:59:59.999+09:00');clock(before);for(let i=0;i<5;i++)past('heart',before-60000-i*1000);await expect(createIntent(env,user,{key:'before-utc-midnight',placement:'heart'},'ios')).rejects.toMatchObject({code:'AD_DAILY_LIMIT'});
  clock(before+1);await expect(createIntent(env,user,{key:'after-utc-midnight',placement:'heart'},'ios')).rejects.toMatchObject({code:'AD_DAILY_LIMIT'});
 });
 it('counts legacy UTC-keyed reservations across both UTC dates within the same Korean day',async()=>{
  clock(Date.parse('2026-11-11T17:00:00+09:00'));for(let i=0;i<3;i++)past('heart',Date.parse('2026-11-11T02:00:00+09:00')+i*1000);for(let i=0;i<2;i++)past('heart',Date.parse('2026-11-11T12:00:00+09:00')+i*1000);await expect(createIntent(env,user,{key:'legacy-quota-transition',placement:'heart'},'ios')).rejects.toMatchObject({code:'AD_DAILY_LIMIT'});
 });
 it('reuses cancelled legacy reservations in the same Korean day but creates a new reservation after midnight',async()=>{
  const approvedAt=Date.parse('2026-11-11T08:59:00+09:00'),cancelled=past('heart',approvedAt,'cancelled');clock(Date.parse('2026-11-11T09:01:00+09:00'));
  const retry=await createIntent(env,user,{key:'kst-cancelled-retry',placement:'heart'},'ios');expect(retry.intent.id).toBe(cancelled);await intentSignal(env,user,cancelled,{key:'kst-retry-cancelled',status:'cancelled'});
  clock(Date.parse('2026-11-12T00:00:00+09:00'));const next=await createIntent(env,user,{key:'kst-new-day-cancelled',placement:'heart'},'ios');expect(next.intent.id).not.toBe(cancelled);
 });
 it('attributes a delayed legacy callback to its original Korean reservation day and grants only once',async()=>{
  const approvedAt=Date.parse('2026-11-11T00:10:00+09:00'),id=past('heart',approvedAt,'pending');clock(Date.parse('2026-11-12T00:00:01+09:00'));
  const callback={transactionId:'delayed-midnight-callback',intentId:id,userId:user,adUnit:ios,timestamp:approvedAt+500,rewardAmount:1,rewardItem:'Reward'};await storeVerifiedCallback(env,callback);await processAdGrant(env,id);await storeVerifiedCallback(env,callback);await processAdGrant(env,id);
  expect(db.prepare('SELECT day,granted FROM ad_daily_usage WHERE user_id=?').get(user)).toMatchObject({day:Math.floor((approvedAt+9*3600000)/86400000),granted:1});expect((await readPlayer(env.DB,user)).hearts).toBe(2);
 });
});
describe('authoritative ad remaining-view counts',()=>{
 it('returns full quotas and Korean midnight from both list and single-intent reads without writes',async()=>{
  const list=await intentStatus(env,user,undefined,'ios');expect(list.quotas).toEqual({heart:{limit:5,remaining:5,resetsAt:Date.parse('2026-11-11T00:00:00+09:00')},coin_bonus:{limit:10,remaining:10,resetsAt:Date.parse('2026-11-11T00:00:00+09:00')}});expect((await intentStatus(env,user,'missing','ios')).quotas).toEqual(list.quotas);expect(db.prepare('SELECT count(*) n FROM operations').get()?.n).toBe(0);
  env.ADMOB_ENABLED='false';expect((await intentStatus(env,user,undefined,'ios')).quotas).toEqual(list.quotas);
 });
 it('decreases on reservation, restores cancelled/no-fill slots and never decreases twice for duplicate grants',async()=>{
  const{intent}=await createIntent(env,user,{key:'remaining-reservation',placement:'heart'},'ios');expect((await intentStatus(env,user,intent.id,'ios')).quotas.heart.remaining).toBe(4);
  await intentSignal(env,user,intent.id,{key:'remaining-cancel-key',status:'cancelled'});expect((await intentStatus(env,user,undefined,'ios')).quotas.heart.remaining).toBe(5);
  expect((await createIntent(env,user,{key:'remaining-retry-key',placement:'heart'},'ios')).intent.id).toBe(intent.id);await intentSignal(env,user,intent.id,{key:'remaining-pending-key',status:'pending'});expect((await intentStatus(env,user,undefined,'ios')).quotas.heart.remaining).toBe(4);
  await storeVerifiedCallback(env,{transactionId:'remaining-view',intentId:intent.id,userId:user,adUnit:ios,timestamp:now,rewardAmount:1,rewardItem:'Reward'});await processAdGrant(env,intent.id);await processAdGrant(env,intent.id);expect((await intentStatus(env,user,undefined,'ios')).quotas.heart.remaining).toBe(4);expect((await intentStatus(env,'another-account',undefined,'ios')).quotas.heart.remaining).toBe(5);
 });
 it('counts only reusable cancelled units for the requesting platform',async()=>{
  const{intent}=await createIntent(env,user,{key:'remaining-unit-key',placement:'heart'},'ios');await intentSignal(env,user,intent.id,{key:'remaining-unit-cancel',status:'cancelled'});expect((await intentStatus(env,user,undefined,'ios')).quotas.heart.remaining).toBe(5);expect((await intentStatus(env,user,undefined,'android')).quotas.heart.remaining).toBe(4);env.ADMOB_IOS_HEART_AD_UNIT='rotated-unit';expect((await intentStatus(env,user,undefined,'ios')).quotas.heart.remaining).toBe(4);
 });
 it('shows zero at the cap and refreshes to five exactly at Korean midnight',async()=>{
  vi.mocked(Date.now).mockReturnValue(Date.parse('2026-11-11T23:59:59.999+09:00'));for(let i=0;i<5;i++)db.prepare('INSERT INTO reward_intents VALUES(?,?,?,?,?,?,?,?,?,?,NULL)').run(crypto.randomUUID(),user,'heart',null,1,ios,'granted',Date.now()-i*1000,Date.now()+1800000,0);
  expect((await intentStatus(env,user,undefined,'ios')).quotas.heart.remaining).toBe(0);expect((await intentStatus(env,user,undefined,'ios')).quotas.coin_bonus.remaining).toBe(10);vi.mocked(Date.now).mockReturnValue(Date.now()+1);expect((await intentStatus(env,user,undefined,'ios')).quotas.heart.remaining).toBe(5);
 });
});

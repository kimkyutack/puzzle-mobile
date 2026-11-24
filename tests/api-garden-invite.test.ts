import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {newPlayer,readPlayer,type ApiEnv} from '../apps/api/src/db';
import {gardenInvite,prepareGardenInvite,shareGardenInvite,recordGardenInviteVisit,claimGardenInvite} from '../apps/api/src/garden-invite';
import {gardenCommand,buyDecoration,visitGarden} from '../apps/api/src/garden-world';
import {guildView} from '../apps/api/src/guild';
import {guardAgeAccess} from '../apps/api/src/age-access';
import {projectLiveGarden,GARDEN_SHOP_PRICES} from '../packages/garden-world/src/live';
import {applyGardenCommand,applyTrustedDecorationGrant,DECORATIONS,type GardenWorldState} from '../packages/garden-world/src';
import {GARDEN_INVITE_DECORATION} from '../packages/contracts/src/garden-invite';
import {compatibleGardenArt,gardenArtCapabilities} from '../apps/api/src/garden-art-compat';
import {progression} from '../apps/api/src/activity';

class Statement {
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null) as T|null}
 execute(){return {success:true,results:this.db.prepare(this.query).all(...this.args),meta:{changes:0}}}
 async all(){return this.execute()}async run(){return this.execute()}
}
let db:DatabaseSync,env:ApiEnv;
const owner='10000000-0000-4000-8000-000000000001',visitor='10000000-0000-4000-8000-000000000002',outsider='10000000-0000-4000-8000-000000000003',guild='10000000-0000-4000-8000-000000000004';
const now=Date.parse('2026-11-24T01:00:00Z');
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');
 for(const file of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+file,'utf8'));
 env={DB:{prepare:(query:string)=>new Statement(db,query),batch:async(statements:Statement[])=>{db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}}} as unknown as ApiEnv;
 for(const id of [owner,visitor,outsider]){const p=newPlayer(id,now);p.level=107;p.restored=['sky-path','sky-bench'];if(id!==outsider)p.guildId=guild;db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(id,JSON.stringify(p),p.version,now);}
 db.prepare('INSERT INTO guilds VALUES(?,?,?,?,?,?,?,?)').run(guild,'초대 검수 길드','','','open',5,0,now);
 for(const id of [owner,visitor])db.prepare('INSERT INTO guild_members VALUES(?,?,?,?,?)').run(id,guild,id===owner?'leader':'member',0,now);
});
afterEach(()=>{db.close();vi.restoreAllMocks()});
async function preparedWorld(){
 const player=await readPlayer(env.DB,owner);let world=projectLiveGarden(player);
 world=applyTrustedDecorationGrant(world,{ownerId:owner,grantId:'qa-tree',itemId:'garden-tree',variant:'classic',source:'shop',instanceIds:['qa-tree']});
 let placed:GardenWorldState|undefined;
 for(let y=10;y<21&&!placed;y++)for(let x=10;x<21&&!placed;x++)try{placed=applyGardenCommand(world,{type:'place',instanceId:'qa-tree',x,y,rotation:0,operationId:'qa-place-tree',expectedRevision:world.revision},owner)}catch{}
 if(!placed)throw Error('No tree site');world=placed;
 db.prepare('INSERT INTO garden_worlds VALUES(?,?,?,?)').run(owner,world.revision,JSON.stringify(world),now);return world;
}
async function readyAndShared(){await preparedWorld();await prepareGardenInvite(env,owner,{key:'prepare-invitation'});return shareGardenInvite(env,owner,{key:'share-invitation'});}
describe('garden invitation authoritative lifetime event',()=>{
 it('uses real placed objects and restored buildings, accepts existing gardens and never resets progress',async()=>{
  const missing=await gardenInvite(env,owner);expect(missing.objectives.find(g=>g.id==='tree')?.complete).toBe(false);
  await expect(prepareGardenInvite(env,owner,{key:'too-early-prepare'})).rejects.toMatchObject({code:'GARDEN_INVITE_PREPARATION'});
  await preparedWorld();expect((await gardenInvite(env,owner)).objectives.every(g=>g.complete)).toBe(true);
  await prepareGardenInvite(env,owner,{key:'first-prepare-key'});db.prepare('UPDATE garden_invitations SET visitors=42 WHERE owner_id=?').run(owner);
  await prepareGardenInvite(env,owner,{key:'another-prepare-key'});expect((await gardenInvite(env,owner)).visitors).toBe(42);
 });
 it('creates a real guild invitation message, never accepts a forged target, and rate limits shares',async()=>{
  const shared=await readyAndShared(),view=await guildView(env,visitor);
  expect(view.messages.find(m=>m.id===shared.message.id)?.gardenInvite).toEqual({ownerId:owner});
  await expect(shareGardenInvite(env,owner,{key:'forged-share-key',ownerId:visitor})).rejects.toThrow();
  await expect(shareGardenInvite(env,owner,{key:'spam-share-key'})).rejects.toMatchObject({code:'GARDEN_INVITE_SHARE_COOLDOWN'});
  await shareGardenInvite(env,owner,{key:'share-invitation'});expect(db.prepare('SELECT count(*) n FROM garden_invitation_shares').get()?.n).toBe(1);
  await expect(shareGardenInvite(env,outsider,{key:'not-ready-share'})).rejects.toMatchObject({code:'GARDEN_INVITE_PREPARATION'});
  db.prepare('INSERT INTO garden_invitations(owner_id,ready_at) VALUES(?,?)').run(outsider,now);
  await expect(shareGardenInvite(env,outsider,{key:'no-guild-share'})).rejects.toMatchObject({code:'NOT_IN_GUILD'});
 });
 it('counts visible-map acknowledgements once per real visitor per Korean day; reads and self visits add nothing',async()=>{
  await readyAndShared();await visitGarden(env,visitor,owner);expect((await gardenInvite(env,owner)).visitors).toBe(0);
  expect(await recordGardenInviteVisit(env,owner,{ownerId:owner})).toEqual({counted:false});
  const results=await Promise.all([recordGardenInviteVisit(env,visitor,{ownerId:owner}),recordGardenInviteVisit(env,visitor,{ownerId:owner})]);
  expect(results.filter(r=>r.counted)).toHaveLength(1);expect((await gardenInvite(env,owner)).visitors).toBe(1);
  await recordGardenInviteVisit(env,outsider,{ownerId:owner});expect((await gardenInvite(env,owner)).visitors).toBe(2);
  vi.mocked(Date.now).mockReturnValue(Date.parse('2026-11-24T15:00:01Z'));await recordGardenInviteVisit(env,visitor,{ownerId:owner});expect((await gardenInvite(env,owner)).visitors).toBe(3);
 });
 it('does not count before sharing, blocked accounts, deleted owners, or unverified social access',async()=>{
  await preparedWorld();await prepareGardenInvite(env,owner,{key:'prepare-no-share'});
  expect((await recordGardenInviteVisit(env,visitor,{ownerId:owner})).counted).toBe(false);
  await shareGardenInvite(env,owner,{key:'share-for-blocks'});db.prepare('INSERT INTO blocks VALUES(?,?)').run(owner,visitor);
  await expect(recordGardenInviteVisit(env,visitor,{ownerId:owner})).rejects.toMatchObject({code:'PLAYER_UNAVAILABLE'});
  db.prepare('DELETE FROM blocks').run();db.prepare('UPDATE players SET deleted_at=? WHERE id=?').run(now,owner);
  await expect(recordGardenInviteVisit(env,visitor,{ownerId:owner})).rejects.toMatchObject({code:'PLAYER_NOT_FOUND'});
  expect(()=>guardAgeAccess(env,{band:'child',verified_at:now},'/garden/invite/visit','POST',{ownerId:owner},false)).toThrow();
 });
 it('requires earned ordered stages, pays each reward once, and atomically grants the exclusive decoration',async()=>{
  await readyAndShared();await expect(claimGardenInvite(env,owner,{key:'early-reward-key',stage:1})).rejects.toMatchObject({code:'GARDEN_INVITE_NOT_READY'});
  db.prepare('UPDATE garden_invitations SET visitors=100 WHERE owner_id=?').run(owner);
  expect((await progression(env,owner)).notifications.invitation).toBe(1);
  await expect(claimGardenInvite(env,owner,{key:'skip-to-final-key',stage:3})).rejects.toMatchObject({code:'GARDEN_INVITE_STAGE_ORDER'});
  const before=await readPlayer(env.DB,owner);const results=await Promise.all([claimGardenInvite(env,owner,{key:'reward-key-one',stage:1}),claimGardenInvite(env,owner,{key:'reward-key-two',stage:1})]);expect(results.filter(r=>r.granted)).toHaveLength(1);
  await claimGardenInvite(env,owner,{key:'reward-stage-two',stage:2});const final=await claimGardenInvite(env,owner,{key:'reward-final-stage',stage:3});expect(final.decoration).toBe(GARDEN_INVITE_DECORATION);
  await claimGardenInvite(env,owner,{key:'reward-final-stage',stage:3});await claimGardenInvite(env,owner,{key:'reward-final-again',stage:3});
  const after=await readPlayer(env.DB,owner);expect(after.coins-before.coins).toBe(2500);expect(after.inventory.hammer.normal-before.inventory.hammer.normal).toBe(1);expect(after.inventory.rainbow.normal-before.inventory.rainbow.normal).toBe(1);expect(after.inventory.bomb.normal-before.inventory.bomb.normal).toBe(2);
  const row=db.prepare('SELECT data,revision FROM garden_worlds WHERE user_id=?').get(owner)!;const world=JSON.parse(String(row.data)) as GardenWorldState;
  expect(Object.values(world.owned).filter(item=>item.itemId===GARDEN_INVITE_DECORATION)).toHaveLength(1);expect(world.owned['invite-starlight-v1']?.source).toBe('event');expect(world.placements['invite-starlight-v1']).toBeUndefined();
  expect((await gardenInvite(env,owner)).claimedStages).toBe(3);
  expect((await progression(env,owner)).notifications.invitation).toBe(0);
  let site:{x:number;y:number}|undefined;
  for(let y=10;y<20&&!site;y++)for(let x=10;x<20&&!site;x++)try{applyGardenCommand(world,{type:'place',instanceId:'invite-starlight-v1',x,y,rotation:0,expectedRevision:world.revision,operationId:'check-star-site'},owner);site={x,y};}catch{}
  expect(site).toBeDefined();
  const placed=await gardenCommand(env,owner,{type:'place',instanceId:'invite-starlight-v1',...site,rotation:0,expectedRevision:world.revision,key:'place-earned-pavilion'});
  expect(placed.world.placements['invite-starlight-v1']).toMatchObject(site!);
  await expect(buyDecoration(env,owner,{key:'try-buy-exclusive',itemId:GARDEN_INVITE_DECORATION,quantity:1,expectedUnitPrice:0})).rejects.toMatchObject({code:'ITEM_NOT_FOR_SALE'});
  expect(GARDEN_SHOP_PRICES[GARDEN_INVITE_DECORATION]).toBeUndefined();expect(DECORATIONS.find(item=>item.id===GARDEN_INVITE_DECORATION)?.width).toBe(3);
 });
 it('rolls back the coin reward if the decoration grant cannot commit',async()=>{
  await readyAndShared();db.prepare('UPDATE garden_invitations SET visitors=100,claimed_stages=2 WHERE owner_id=?').run(owner);
  db.exec("CREATE TRIGGER reject_invite_world BEFORE UPDATE ON garden_worlds BEGIN SELECT RAISE(ABORT,'fixture_world_failure'); END");
  const before=await readPlayer(env.DB,owner);await expect(claimGardenInvite(env,owner,{key:'rollback-final-claim',stage:3})).rejects.toThrow('fixture_world_failure');
  expect((await readPlayer(env.DB,owner)).coins).toBe(before.coins);expect((await gardenInvite(env,owner)).claimedStages).toBe(2);
 });
 it('keeps older native clients compatible without changing the canonical exclusive item',async()=>{
  const world={owned:{gift:{id:'gift',itemId:GARDEN_INVITE_DECORATION,variant:'classic',source:'event'}},placements:{}};
  const old=compatibleGardenArt({world},true,true,true,true,true,true,true) as {world:typeof world};expect(old.world.owned.gift.itemId).toBe('garden-gazebo');expect(world.owned.gift.itemId).toBe(GARDEN_INVITE_DECORATION);
  const capabilities=gardenArtCapabilities('garden-v117');expect(capabilities.botanical&&capabilities.invitation).toBe(true);
  expect((compatibleGardenArt({world},true,true,true,true,true,true,true,true) as {world:typeof world}).world.owned.gift.itemId).toBe(GARDEN_INVITE_DECORATION);
 });
});

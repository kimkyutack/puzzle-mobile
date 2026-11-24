import {configuredExpeditionRound} from '../packages/content/src/animal-expedition';
import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {newPlayer} from '../apps/api/src/db';
import {defaultOperationsRuntime,type OperationsSnapshot} from '../packages/contracts/src/operations';
import {eventIntroductionIds,eventDiscoveryKey,readEventDiscovery,markEventDiscoveryRead} from '../apps/client/src/event-discovery';
const now=Date.UTC(2026,10,16,7,30);
beforeEach(()=>vi.spyOn(Date,'now').mockReturnValue(now));afterEach(()=>vi.restoreAllMocks());
function fixture(){const player=newPlayer('discovery-test',now);player.level=30;const operations:OperationsSnapshot={settings:defaultOperationsRuntime(),revision:1,notices:[],events:[],maintenanceActive:false,serverNow:now};return {player,operations};}
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};}
describe('event introduction label acknowledgement',()=>{
 it('does not announce the home-only unlimited tools as a new event tab',()=>{const {player,operations}=fixture();operations.settings.startBoosterRush.enabled=true;expect(eventIntroductionIds(player,operations,now)).not.toContain('start-rush:v1');expect(eventIntroductionIds(player,operations,now)).not.toContain('power-festival:v1');});
 it('waits for real operations settings and excludes locked, disabled or future events',()=>{
  const {player,operations}=fixture();expect(eventIntroductionIds(player,null,now)).toEqual([]);expect(eventIntroductionIds(null,operations,now)).toEqual([]);
  player.level=19;expect(eventIntroductionIds(player,operations,now).some(id=>id.startsWith('animal-expedition:'))).toBe(false);
  operations.settings.features.flowerlight=false;expect(eventIntroductionIds(player,operations,now).some(id=>id.startsWith('flowerlight:'))).toBe(false);
  operations.settings.gameEvents.treasure.startsAt=now+1;expect(eventIntroductionIds(player,operations,now)).not.toContain('treasure:v1');
 });
 it('keeps daily resets, collected gifts, quota changes and settings revisions from becoming new events',()=>{
  const {player,operations}=fixture(),before=eventIntroductionIds(player,operations,now);player.animalExpedition={animal:'panda',roundId:'panda:001',completedStages:10,completedAttempts:[]};operations.revision++;operations.settings.gameEvents.animalExpedition.dailyLimit=4;
  expect(eventIntroductionIds(player,operations,now+86400000)).toEqual(before);
 });
 it('announces a genuinely new rescue round and season using stable content IDs',()=>{
  const {player,operations}=fixture(),before=eventIntroductionIds(player,operations,now,{id:'season-a',ends_at:now+1});operations.settings.gameEvents.animalExpedition.animal='fox';operations.settings.gameEvents.animalExpedition.roundId='002';
  const after=eventIntroductionIds(player,operations,now,{id:'season-b',ends_at:now+1});expect(after.filter(id=>!before.includes(id))).toEqual(['animal-expedition:'+configuredExpeditionRound(operations.settings,now).roundId,'season:season-b']);
 });
 it('announces published active operations rewards, regardless of ordinary red dot eligibility',()=>{
  const {player,operations}=fixture();operations.events=[{id:'gift-new',title:'선물',description:'',kind:'reward',status:'published',startsAt:now-1,endsAt:now+1,imageUrl:'',reward:{coins:50,stars:0,hearts:0,items:{}},revision:1,claimed:true}];
  expect(eventIntroductionIds(player,operations,now)).toContain('operations:gift-new');operations.events[0]!.status='draft';expect(eventIntroductionIds(player,operations,now)).not.toContain('operations:gift-new');
 });
 it('persists the first visit per account and only reappears for unseen identities',()=>{
  const device=storage(),ids=['flowerlight:first','animal-expedition:panda:001'];expect(readEventDiscovery('visit-user',device)).toEqual([]);markEventDiscoveryRead('visit-user',ids,device);
  expect(JSON.parse(device.getItem(eventDiscoveryKey('visit-user'))!)).toEqual(ids);expect(readEventDiscovery('visit-user',device)).toEqual(ids);expect(readEventDiscovery('different-user',device)).toEqual([]);
  expect([...ids,'animal-expedition:fox:002'].filter(id=>!readEventDiscovery('visit-user',device).includes(id))).toEqual(['animal-expedition:fox:002']);
 });
 it('retains older acknowledgements when new content is viewed, with safe malformed or unavailable storage',()=>{
  const device=storage();device.setItem(eventDiscoveryKey('invalid-cache-user'),'{}');expect(readEventDiscovery('invalid-cache-user',device)).toEqual([]);
  markEventDiscoveryRead('merge-user',['event-a'],device);markEventDiscoveryRead('merge-user',['event-b'],device);expect(readEventDiscovery('merge-user',device)).toEqual(['event-a','event-b']);
  const blocked={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('denied')}};expect(()=>markEventDiscoveryRead('blocked-user',['event-a'],blocked)).not.toThrow();expect(readEventDiscovery('blocked-user',blocked)).toEqual(['event-a']);
 });
});

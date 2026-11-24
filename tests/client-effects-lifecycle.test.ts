import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Application,Container,Texture} from 'pixi.js';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,GameEvent} from '@garden/contracts';
import solutions from '../packages/content/src/campaign-solutions.json';
import {CROSS_ROCKET_BEATS,effectTiming,VISUAL_BEATS} from '../apps/client/src/visual-timing';
import {BEE_BEATS} from '../apps/client/src/bee-motion';
import {rainbowSelections} from '../apps/client/src/rainbow-selection';
import {tileVisualSize} from '../apps/client/src/tile-visuals';
import type {DebrisPose} from '../apps/client/src/obstacle-debris';
const {FakeSprite}=vi.hoisted(()=>({FakeSprite:class {textures:unknown[];visible=false;destroyed=false;x=0;y=0;rotation=0;alpha=1;tint=0xffffff;blendMode='normal';width=0;height=0;loop=false;eventMode='none';anchor={set:()=>{}};scale={x:1,y:1,set:(x:number,y=x)=>{this.scale.x=x;this.scale.y=y;}};position={set:(x:number,y:number)=>{this.x=x;this.y=y;}};constructor(textures:unknown[]){this.textures=textures;}gotoAndStop(){}stop(){}destroy(){this.destroyed=true;}}}));
vi.mock('pixi.js',()=>({AnimatedSprite:FakeSprite}));
vi.mock('../apps/client/src/assets',()=>({assetImage:()=>undefined,hasArt:()=>true,texture:(id:string)=>({id,orig:{width:128,height:128}}),tileArt:(kind:string)=>kind}));
import {createBoardEffects} from '../apps/client/src/board-effects';
let now=0;beforeEach(()=>{now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);});afterEach(()=>vi.restoreAllMocks());
function harness(shards?:Parameters<typeof createBoardEffects>[2]['shards']){const callbacks=new Set<()=>void>(),children:InstanceType<typeof FakeSprite>[]=[],impacts:Array<{at:number;strength:number}>=[],shade:number[]=[];let debris:readonly DebrisPose[]=[];const fx=createBoardEffects({ticker:{add:(fn:()=>void)=>callbacks.add(fn),remove:(fn:()=>void)=>callbacks.delete(fn)}} as unknown as Application,{addChild:(sprite:InstanceType<typeof FakeSprite>)=>children.push(sprite)} as unknown as Container,{cellSize:()=>50,position:index=>({x:(index%7+.5)*50,y:(Math.floor(index/7)+.5)*50}),frames:()=>[] as Texture[],shards,debris:{bounds:()=>({x:-28,y:-165,width:406,height:705}),paint:pieces=>{debris=pieces;},destroy:()=>{}},shade:alpha=>shade.push(alpha),impulse:strength=>impacts.push({at:now,strength})});return {fx,children,impacts,shade,callbacks,get debris(){return debris;},tick:(time:number)=>{now=time;for(const callback of callbacks)callback();}};}
describe('bounded sprite choreography and cleanup',()=>{
 for(const kind of ['wind-row','wind-column','glider','beehive'] as const)it(`enlarges the fired ${kind} before it launches`,()=>{
  const before=createGame(getLevel(1)),at=24;
  before.cells[at]!.tile={id:500,kind};before.nextTileId=501;
  const action:Action={type:'tap',at},result=applyAction(before,action),timing=effectTiming(result.events,result.state,action),h=harness();
  const start=timing.delays[result.events.findIndex(event=>event.type==='special'&&event.kind===kind)]!;
  const charge=kind==='beehive'?BEE_BEATS.charge:VISUAL_BEATS.charge;
  const withArt=(id:string)=>h.children.filter(sprite=>sprite.visible&&(sprite.textures[0] as {id:string}).id===id);
  h.fx.play(result.events,before,result.state,false,action,timing);
  h.tick(start+1);
  const body=withArt(kind)[0]!,initialScale=body.scale.x,initialY=body.y;
  h.tick(start+charge-20);
  expect(body.visible).toBe(true);
  expect(body.scale.x).toBeGreaterThan(initialScale*1.3);
  expect(body.scale.y).toBeGreaterThan(initialScale*1.3);
  if(kind==='wind-row')expect(body.scale.x).toBeGreaterThan(body.scale.y);
  if(kind==='wind-column')expect(body.scale.y).toBeGreaterThan(body.scale.x);
  if(kind==='glider'||kind==='beehive')expect(body.y).toBeLessThan(initialY);
  const launchArt=kind==='glider'?'glider_flight':kind==='beehive'?'bee_flight':kind;
  expect(withArt(launchArt).filter(sprite=>sprite!==body)).toHaveLength(0);
  h.tick(start+charge+40);
  expect(withArt(launchArt).some(sprite=>sprite!==body&&sprite.alpha>0)).toBe(true);
  h.fx.destroy();
 });
 it('keeps small crumbs from an ordinary match in flight after refill begins',()=>{
  const before=createGame(getLevel(3)),action={type:'swap',from:3,to:4} as const,result=applyAction(before,action);
  const timing=effectTiming(result.events,result.state,action);
  const h=harness(()=>[[.27,.26],[.72,.25],[.73,.72],[.28,.74]].map(([x,y],i)=>({
   anchor:{x:x!,y:y!},texture:{id:'tile-piece-'+i,orig:{width:128,height:128}} as unknown as Texture,
  })));
  const duration=h.fx.play(result.events,before,result.state,false,action,timing);
  const contact=timing.delays[result.events.findIndex(event=>event.type==='remove')]!;
  h.tick(contact-1);
  expect(h.fx.activeCount).toBe(0);
  expect(duration).toBeGreaterThan(timing.settleAt);
  expect(duration-contact).toBeLessThan(180);
  h.tick(timing.settleAt+20);
  const visible=h.children.filter(sprite=>sprite.visible);
  expect(visible).toHaveLength(9);
  expect(visible.every(sprite=>sprite.blendMode==='normal'&&(sprite.textures[0] as {id:string}).id.startsWith('tile-piece-'))).toBe(true);
  expect(visible.every(sprite=>sprite.scale.x<50*tileVisualSize('normal')*.5/128)).toBe(true);
  h.tick(duration+1);
  expect(h.fx.activeCount).toBe(0);
  h.fx.play(result.events,before,result.state,true,action,timing);
  h.tick(duration+25);
  expect(h.fx.activeCount).toBe(0);
  h.fx.destroy();
 });
 for(const partner of ['wind-row','wind-column','bomb','glider'] as const)it(`renders every converted ${partner}, including targets beyond the old twelve-effect cap`,()=>{
  const before=createGame(getLevel(1));before.cells[24]!.tile={id:500,kind:'rainbow'};before.cells[25]!.tile={id:501,kind:partner};before.nextTileId=502;
  const action={type:'swap',from:24,to:25} as const,result=applyAction(before,action),plan=effectTiming(result.events,result.state,action),selection=[...rainbowSelections(result.events).values()][0]!,h=harness();
  const duration=h.fx.play(result.events,before,result.state,false,action,plan),convertedAt=Math.max(...selection.targets.map(at=>plan.conversionAt.get(at)!))+100;
  for(let ms=0;ms<convertedAt;ms+=16)h.tick(ms);h.tick(convertedAt);
  const convertedIds=partner.startsWith('wind-')?['wind-row','wind-column']:[partner];
  const items=h.children.filter(s=>s.visible&&convertedIds.includes((s.textures[0] as {id:string}).id));expect(items).toHaveLength(selection.targets.length);expect(items.length).toBeGreaterThan(12);
  const release=plan.delays[[...selection.children.keys()][0]!]!+VISUAL_BEATS.charge,launchedAt=release+(partner==='bomb'?120:200);
  h.tick(release-85);
  const burning=h.children.filter(s=>s.visible&&(s.textures[0] as {id:string}).id==='fx_starburst');
  expect(burning).toHaveLength(selection.targets.length);
  for(let ms=release-69;ms<launchedAt;ms+=16)h.tick(ms);h.tick(launchedAt);
  const id=partner==='bomb'?'bomb_open':partner==='glider'?'glider_flight':partner;
  expect(h.children.filter(s=>s.visible&&(partner.startsWith('wind-')?convertedIds:[id]).includes((s.textures[0] as {id:string}).id)).length).toBeGreaterThanOrEqual(selection.targets.length);
  expect(h.children.length).toBeLessThanOrEqual(180);h.tick(duration+1);expect(h.fx.activeCount).toBe(0);h.fx.destroy();
 });
 it('draws both actual ingredients moving together before the combined blast, with no replay-state changes',()=>{
  const before=createGame(getLevel(1));before.cells[24]!.tile={id:500,kind:'wind-row'};before.cells[25]!.tile={id:501,kind:'bomb'};before.nextTileId=502;const action:Action={type:'swap',from:24,to:25},result=applyAction(before,action),hash=stateHash(result.state),h=harness(),duration=h.fx.play(result.events,before,result.state,false,action);
  // Solid pieces only; each also leaves a faint additive trail.
  const solid=(sprite:InstanceType<typeof FakeSprite>)=>sprite.visible&&sprite.blendMode!=='add'&&['wind-row','bomb'].includes((sprite.textures[0] as {id:string}).id);
  h.tick(0);const pieces=h.children.filter(solid);expect(pieces).toHaveLength(2);expect(pieces.map(sprite=>sprite.x)).toEqual([175,225]);
  // Mid-fusion they circle each other on opposite sides of the anchor rather than stacking on it.
  h.tick(332.8);const [a,b]=pieces as [InstanceType<typeof FakeSprite>,InstanceType<typeof FakeSprite>];expect((a.x+b.x)/2).toBeCloseTo(225,0);expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeGreaterThan(8);expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(50);expect(h.impacts.filter(impact=>impact.strength>0)).toHaveLength(0);
  h.tick(520);expect(pieces.every(sprite=>!sprite.visible)).toBe(true);expect(h.children.filter(solid)).toHaveLength(2);
  h.tick(970);expect(h.impacts.some(impact=>impact.strength>0)).toBe(true);h.tick(duration+1);expect(h.fx.activeCount).toBe(0);expect(stateHash(result.state)).toBe(hash);h.fx.destroy();
 });
 it('launches four arms and carries their fading light and debris into the next cascade frame',()=>{
  const before=createGame(getLevel(1));before.cells[23]!.tile={id:500,kind:'wind-row'};before.cells[24]!.tile={id:501,kind:'wind-column'};before.nextTileId=502;
  const action:Action={type:'swap',from:23,to:24},result=applyAction(before,action),h=harness();
  h.fx.play(result.events,before,result.state,false,action);
  const id=(sprite:InstanceType<typeof FakeSprite>)=>(sprite.textures[0] as {id:string}).id;
  h.tick(CROSS_ROCKET_BEATS.fusion+CROSS_ROCKET_BEATS.travel/2);
  const heads=h.children.filter(sprite=>sprite.visible&&['wind-row','wind-column'].includes(id(sprite)));
  expect(heads).toHaveLength(4);
  expect(heads.map(sprite=>[sprite.x,sprite.y])).toEqual([[87.5,175],[262.5,175],[175,87.5],[175,262.5]]);
  h.tick(CROSS_ROCKET_BEATS.fusion+CROSS_ROCKET_BEATS.travel+70);
  h.fx.play([{type:'remove',cells:[0],kind:'sun'}],result.state,result.state,false,undefined,undefined,undefined,true);
  const remaining=h.children.filter(sprite=>sprite.visible).map(id);
  expect(remaining.filter(id=>id==='fx_ray')).toHaveLength(4);
  expect(remaining.some(id=>id.startsWith('fragment_'))).toBe(true);
  expect(remaining.every(id=>id==='fx_ray'||id==='fx_starburst'||id.startsWith('fragment_'))).toBe(true);
  h.tick(CROSS_ROCKET_BEATS.fusion+CROSS_ROCKET_BEATS.travel+CROSS_ROCKET_BEATS.afterglow+1);
  expect(h.children.some(sprite=>sprite.visible&&id(sprite)==='fx_ray')).toBe(false);
  h.fx.destroy();
 });
 it('holds the actual rainbow tile silhouettes in light until they clear',()=>{
  const before=createGame(getLevel(1));before.cells[24]!.tile={id:500,kind:'rainbow'};before.nextTileId=501;
  const action:Action={type:'tap',at:24},result=applyAction(before,action),h=harness();
  const selection=[...rainbowSelections(result.events).values()][0]!;
  h.fx.play(result.events,before,result.state,false,action);
  h.tick(VISUAL_BEATS.rainbowCharge+VISUAL_BEATS.rainbowTravel-9);
  expect(h.shade.at(-1)).toBeCloseTo(.3);
  const litTiles=h.children.filter(s=>s.visible&&(s.textures[0] as {id:string}).id.endsWith('-glow'));
  expect(litTiles).toHaveLength(selection.targets.length);
  expect(litTiles.every(s=>selection.targets.some(at=>s.x===(at%7+.5)*50&&s.y===(Math.floor(at/7)+.5)*50))).toBe(true);
  h.fx.play(result.events,before,result.state,true,action);
  expect(h.shade.at(-1)).toBe(0);
  h.tick(now+1000);
  expect(h.fx.activeCount).toBe(0);
  h.fx.destroy();
 });
 it('sends chips and crate parts from the hit cell out of the screen while the board refills',()=>{
  const before=createGame(getLevel(1)),at=24;
  before.obstacles.box={id:'box',kind:'crate',anchor:at,footprint:[at],hp:2,maxHp:2};
  before.cells[at]!.tile=null;before.cells[at]!.obstacleId='box';
  const after=structuredClone(before);
  delete after.obstacles.box;delete after.cells[at]!.obstacleId;
  const events:GameEvent[]=[{type:'hit',kind:'crate',cells:[at]},{type:'hit',kind:'crate',cells:[at]}];
  const plan={...effectTiming(events,after),delays:[100,500],settleAt:700},h=harness();
  h.fx.play(events,before,after,false,undefined,plan);
  h.tick(99);expect(h.debris).toHaveLength(0);
  h.tick(100);expect(h.debris[0]).toMatchObject({art:'crate-debris-corner',x:175,y:175});
  h.tick(140);expect(h.debris).toHaveLength(2);
  h.tick(820);
  const pieces=h.debris.filter(piece=>piece.size>15);
  expect(pieces.map(piece=>piece.art)).toEqual(['crate-debris-lid','crate-debris-wall','crate-debris-plank','crate-debris-corner']);
  expect(Math.min(...pieces.map(piece=>piece.x))).toBeLessThan(175);
  expect(Math.max(...pieces.map(piece=>piece.x))).toBeGreaterThan(175);
  expect(Math.min(...pieces.map(piece=>piece.y))).toBeLessThan(175);
  expect(Math.max(...pieces.map(piece=>piece.y))).toBeGreaterThan(175);
  h.fx.play([{type:'remove',kind:'sun',cells:[0]}],after,after,false,undefined,undefined,undefined,true);
  h.tick(960);
  expect(h.debris.find(piece=>piece.art==='crate-debris-lid')?.x).not.toBe(pieces[0]!.x);
  expect(h.debris.some(piece=>piece.x<0||piece.x>350||piece.y<0||piece.y>350)).toBe(true);
  h.tick(1800);expect(h.debris).toHaveLength(0);
  h.fx.destroy();
 });
 it('launches metal from the rocket contact and releases ceramic and ice when their overlays break',()=>{
  const before=createGame(getLevel(1)),pipeAt=14,urnAt=31,frostAt=42;
  before.obstacles.pipe={id:'pipe',kind:'pipe',anchor:pipeAt,footprint:[pipeAt,pipeAt+1],hp:2,maxHp:2};
  before.obstacles.urn={id:'urn',kind:'urn',anchor:urnAt,footprint:[urnAt],hp:1,maxHp:1};
  before.cells[frostAt]!.frost=1;
  const after=structuredClone(before);
  const pipe={...before.obstacles.pipe!,hp:1,footprint:[pipeAt]};
  after.obstacles.pipe=pipe;delete after.obstacles.urn;after.cells[frostAt]!.frost=0;
  const events:GameEvent[]=[
   {type:'hit',kind:'pipe',obstacleId:'pipe',obstacleAfter:pipe,cells:[pipeAt,pipeAt+1]},
   {type:'hit',kind:'urn',obstacleId:'urn',obstacleAfter:null,cells:[urnAt]},
   {type:'hit',kind:'frost',cells:[frostAt]},
  ];
  const plan={...effectTiming(events,after),delays:[100,200,300],settleAt:500,rocketContacts:new Map([[0,pipeAt+1]])};
  const h=harness();
  h.fx.play(events,before,after,false,undefined,plan);
  h.tick(100);expect(h.debris).toEqual([expect.objectContaining({art:'debris-metal-ring',x:75,y:125})]);
  h.tick(400);
  expect(h.debris.map(piece=>piece.art)).toEqual(expect.arrayContaining(['debris-metal-plate','debris-ceramic-rim','debris-ceramic-wall','debris-ice-sheet','debris-ice-chip']));
  h.fx.play(events,before,after,true,undefined,plan);
  expect(h.debris).toHaveLength(0);
  h.fx.destroy();
 });
 it('preserves the real hammer target state and emits one delayed physical impact',()=>{const before=createGame(getLevel(13)),action:Action={type:'booster',item:'hammer',at:14},result=applyAction(before,action),hash=stateHash(result.state),h=harness(),duration=h.fx.play(result.events,before,result.state,false,action);h.tick(750);expect(h.impacts.filter(impact=>impact.strength>0)).toHaveLength(0);h.tick(760);expect(h.impacts.filter(impact=>impact.strength>0)).toEqual([{at:760,strength:2.3}]);expect(duration).toBeLessThanOrEqual(1600);h.tick(duration+1);expect(h.fx.activeCount).toBe(0);expect(stateHash(result.state)).toBe(hash);h.fx.destroy();expect(h.callbacks.size).toBe(0);expect(h.children.every(sprite=>sprite.destroyed)).toBe(true);});
 it('holds the pool at 180 and removes every queued impact on clear or reduced-motion playback',()=>{const state=createGame(getLevel(2)),events:GameEvent[]=Array.from({length:20},(_,i)=>({type:'special',kind:i%2?'rainbow':'wind-row+bomb',cells:[24]}));const h=harness();for(let i=0;i<5;i++){h.fx.play(events,state,state,false);expect(h.children.length).toBeLessThanOrEqual(180);expect(h.fx.activeCount).toBeLessThanOrEqual(180);h.fx.clear();h.tick(now+4000);expect(h.fx.activeCount).toBe(0);}const before=h.impacts.filter(impact=>impact.strength>0).length;const duration=h.fx.play([{type:'special',kind:'bomb',cells:[3]},{type:'remove',kind:'drop',cells:[3,4,5]}],state,state,true);expect(duration).toBe(110);expect(h.fx.activeCount).toBeLessThanOrEqual(5);h.tick(now+150);expect(h.impacts.filter(impact=>impact.strength>0)).toHaveLength(before);expect(h.fx.activeCount).toBe(0);h.fx.destroy();});
 it('finishes the real bomb-wind-glider chain without extending its established budget',()=>{let before=createGame(getLevel(2));before=applyAction(before,(solutions['2'].actions as Action[])[0]!).state;const result=applyAction(before,(solutions['2'].actions as Action[])[1]!),hash=stateHash(result.state),h=harness(),duration=h.fx.play(result.events,before,result.state,false);expect(duration).toBeLessThanOrEqual(2800);expect(h.children.length).toBeLessThanOrEqual(180);h.tick(3000);expect(h.fx.activeCount).toBe(0);expect(h.impacts.filter(impact=>impact.strength>0)).toHaveLength(0);expect(stateHash(result.state)).toBe(hash);h.fx.destroy();});
});

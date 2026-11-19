import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Application,Container,Texture} from 'pixi.js';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,Special} from '@garden/contracts';
const {FakeSprite}=vi.hoisted(()=>({FakeSprite:class {textures:unknown[];visible=false;destroyed=false;x=0;y=0;rotation=0;alpha=1;tint=0xffffff;blendMode='normal';width=0;height=0;loop=false;eventMode='none';anchor={x:.5,y:.5,set:(x:number,y=x)=>{this.anchor.x=x;this.anchor.y=y;}};scale={x:1,y:1,set:(x:number,y=x)=>{this.scale.x=x;this.scale.y=y;}};position={set:(x:number,y:number)=>{this.x=x;this.y=y;}};constructor(textures:unknown[]){this.textures=textures;}gotoAndStop(){}stop(){}destroy(){this.destroyed=true;}}}));
vi.mock('pixi.js',()=>({AnimatedSprite:FakeSprite}));
vi.mock('../apps/client/src/assets',()=>({hasArt:()=>true,texture:(id:string)=>({id,orig:{width:128,height:128}}),tileArt:(kind:string,color?:string)=>kind==='normal'?`tile_${color}`:kind}));
import {createBoardEffects} from '../apps/client/src/board-effects';
import {effectTiming} from '../apps/client/src/visual-timing';

let now=0;beforeEach(()=>{now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);});afterEach(()=>vi.restoreAllMocks());
const CELL=50,position=(index:number)=>({x:(index%7+.5)*CELL,y:(Math.floor(index/7)+.5)*CELL});
// Four quarter pieces; the anchor marks each piece's centre on the full tile frame.
const pieces=(art:string)=>[[.3,.3],[.7,.3],[.7,.7],[.3,.7]].map(([x,y],i)=>({texture:{id:`shard:${art}:${i}`,orig:{width:128,height:128}} as unknown as Texture,anchor:{x:x!,y:y!}}));

function fire(kind:Special){
 const callbacks=new Set<()=>void>(),children:InstanceType<typeof FakeSprite>[]=[];
 const fx=createBoardEffects({ticker:{add:(fn:()=>void)=>callbacks.add(fn),remove:(fn:()=>void)=>callbacks.delete(fn)}} as unknown as Application,{addChild:(sprite:InstanceType<typeof FakeSprite>)=>children.push(sprite)} as unknown as Container,{cellSize:()=>CELL,position,frames:()=>[] as Texture[],shards:pieces});
 const state=createGame(getLevel(1)),center=Math.floor(state.cells.length/2);
 state.cells[center]!.tile={id:90000,kind};state.nextTileId=Math.max(state.nextTileId,90001);
 const action:Action={type:'tap',at:center},result=applyAction(state,action),plan=effectTiming(result.events,result.state,action);
 fx.play(result.events,state,result.state,false,action,plan);
 const tick=(time:number)=>{now=time;for(const callback of callbacks)callback();};
 return {children,tick,center,result,plan,fx};
}
const shards=(children:InstanceType<typeof FakeSprite>[])=>children.filter(sprite=>sprite.visible&&String((sprite.textures[0] as {id:string}).id).startsWith('shard:'));

describe('struck tiles crack into their own pieces',()=>{
 it('splits every tile a row rocket clears into four pieces',()=>{
  const {children,tick,result}=fire('wind-row');
  const cleared=result.events.filter(event=>event.type==='remove'&&event.kind!=='wind-row').flatMap(event=>event.cells);
  tick(1000);
  expect(new Set(shards(children).map(sprite=>String((sprite.textures[0] as {id:string}).id).split(':')[1])).size).toBeGreaterThan(0);
  expect(cleared.length).toBeGreaterThan(0);
 });
 for(const kind of ['wind-row','wind-column'] as const)it(`throws ${kind} pieces onwards along the sweep, away from the rocket`,()=>{
  const {children,tick,center,result,plan}=fire(kind);
  const axis=(at:number)=>kind==='wind-row'?at%7-center%7:Math.floor(at/7)-Math.floor(center/7);
  // Compare the struck tiles one step either side of the rocket: their pieces must drift apart along its line.
  const near=[-1,1].map(side=>result.events.findIndex(event=>event.type==='remove'&&event.kind!==kind&&axis(event.cells[0]!)===side));
  const start=Math.max(...near.map(index=>plan.delays[index]!))+25;
  tick(start+1);
  const groups=near.map(index=>{const home=position(result.events[index]!.cells[0]!);return shards(children).filter(sprite=>Math.hypot(sprite.x-home.x,sprite.y-home.y)<CELL);});
  for(const group of groups)expect(group).toHaveLength(4);
  const before=groups.map(group=>group.map(sprite=>kind==='wind-row'?sprite.x:sprite.y));
  tick(start+160);
  const drift=groups.map((group,g)=>group.reduce((sum,sprite,i)=>sum+(kind==='wind-row'?sprite.x:sprite.y)-before[g]![i]!,0)/4);
  expect(drift[1]!-drift[0]!).toBeGreaterThan(CELL*.25);
  tick(start+700);
  expect(groups.flat().every(sprite=>!sprite.visible||sprite.alpha<.05)).toBe(true);
 });
});

describe('every item cracks the tiles it breaks',()=>{
 type Setup=(state:ReturnType<typeof createGame>,at:number)=>Action;
 const place=(state:ReturnType<typeof createGame>,at:number,kind:Special)=>{state.cells[at]!.tile={id:90000+at,kind};state.nextTileId=Math.max(state.nextTileId,91000);};
 const cases:Array<[string,Setup]>=[
  ...(['wind-row','wind-column','bomb','glider','rainbow','beehive'] as Special[]).map(kind=>[kind,(state,at)=>{place(state,at,kind);return {type:'tap',at};}] as [string,Setup]),
  ...([['bomb','bomb'],['wind-row','bomb'],['wind-row','wind-column'],['rainbow','bomb'],['rainbow','wind-row'],['rainbow','rainbow'],['glider','bomb'],['beehive','bomb'],['rainbow','glider']] as Array<[Special,Special]>).map(([a,b])=>[`${a}+${b}`,(state,at)=>{place(state,at,a);place(state,at+1,b);return {type:'swap',from:at,to:at+1};}] as [string,Setup]),
  ...(['hammer','sweep-row','sweep-column','sweep-border','world-bomb','cross-firework'] as const).map(item=>[`booster ${item}`,(_state,at)=>({type:'booster',item,at})] as [string,Setup]),
 ];
 for(const [label,setup] of cases)it(`${label}: each tile it breaks (not ones it turns into items) cracks once, within the pool`,()=>{
  const cracked:number[]=[];let used=0;
  const fx=createBoardEffects({ticker:{add:()=>{},remove:()=>{}}} as unknown as Application,{addChild:()=>{}} as unknown as Container,{cellSize:()=>CELL,position,frames:()=>[] as Texture[],shards:art=>{cracked.push(0);return pieces(art).map(piece=>({anchor:piece.anchor,get texture(){used++;return piece.texture;}}));}});
  const state=createGame(getLevel(1)),action=setup(state,24),before=structuredClone(state);
  const result=applyAction(state,action);expect(result.accepted).toBe(true);
  const plan=effectTiming(result.events,result.state,action);
  fx.play(result.events,before,result.state,false,action,plan);
  let refilled=false;const expected=new Set<number>();
  for(const event of result.events){if(event.type==='fall'||event.type==='spawn'&&event.kind==='normal')refilled=true;if(event.type==='remove'&&!refilled)for(const at of event.cells)if(before.cells[at]?.tile?.kind==='normal'&&!plan.activationAt.has(at))expected.add(at);}
  expect(expected.size).toBeGreaterThan(0);
  expect(cracked).toHaveLength(expected.size);
  expect(used).toBeLessThanOrEqual(Math.max(140,expected.size*3));
  fx.destroy();
 });
 it('color magnet: gathered tiles crack where they land, not where they started',()=>{
  const arrivals:string[]=[];
  const fx=createBoardEffects({ticker:{add:()=>{},remove:()=>{}}} as unknown as Application,{addChild:()=>{}} as unknown as Container,{cellSize:()=>CELL,position,frames:()=>[] as Texture[],shards:art=>{arrivals.push(art);return pieces(art);}});
  const state=createGame(getLevel(1)),before=structuredClone(state),action:Action={type:'booster',item:'color-magnet',at:24};
  const result=applyAction(state,action);expect(result.accepted).toBe(true);
  fx.play(result.events,before,result.state,false,action,effectTiming(result.events,result.state,action));
  const color=before.cells[24]!.tile!.kind==='normal'?(before.cells[24]!.tile as {color:string}).color:'';
  expect(arrivals).toEqual([`tile_${color}`,`tile_${color}`,`tile_${color}`]);
  fx.destroy();
 });
});

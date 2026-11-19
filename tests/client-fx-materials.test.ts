import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Application,Container,Texture} from 'pixi.js';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,Special} from '@garden/contracts';
const {FakeSprite}=vi.hoisted(()=>({FakeSprite:class {textures:unknown[];visible=false;destroyed=false;x=0;y=0;rotation=0;alpha=1;tint=0xffffff;blendMode='normal';width=0;height=0;loop=false;eventMode='none';anchor={set:()=>{}};scale={x:1,y:1,set:(x:number,y=x)=>{this.scale.x=x;this.scale.y=y;}};position={set:(x:number,y:number)=>{this.x=x;this.y=y;}};constructor(textures:unknown[]){this.textures=textures;}gotoAndStop(){}stop(){}destroy(){this.destroyed=true;}}}));
vi.mock('pixi.js',()=>({AnimatedSprite:FakeSprite}));
vi.mock('../apps/client/src/assets',()=>({hasArt:()=>true,texture:(id:string)=>({id,orig:{width:128,height:128}}),tileArt:(kind:string,color?:string)=>kind==='normal'?`tile_${color}`:kind}));
import {createBoardEffects} from '../apps/client/src/board-effects';
import {effectTiming} from '../apps/client/src/visual-timing';
import {rainbowSelections} from '../apps/client/src/rainbow-selection';

let now=0;beforeEach(()=>{now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);});afterEach(()=>vi.restoreAllMocks());
const MATERIALS=['fx_glow','fx_puff','fx_rays','fx_sparks','fx_star','fx_streak','fx_trail'];
const ITEM_SPRITES=['rocket_half',...[0,1,2,3].flatMap(i=>[`rainbow_spin_blur_sheet_${i}`,`power_rainbow_spin_blur_sheet_${i}`])];
// Sprites the imagegen light materials replace; none of them may still be drawn once the materials load.
const LEGACY_LIGHT=['fx_flash','halo','burst','fx_smoke','fx_starburst','sparkle','fx_ray','trail','fx_ring'];

const position=(i:number)=>({x:(i%7+.5)*50,y:(Math.floor(i/7)+.5)*50});
function play(kinds:Special[],withMaterials:boolean,power=false){
 now=0;
 const callbacks=new Set<()=>void>(),children:InstanceType<typeof FakeSprite>[]=[];
 const fxArt=withMaterials?(id:string)=>MATERIALS.includes(id)||ITEM_SPRITES.includes(id)?({id,orig:{width:512,height:512}} as unknown as Texture):undefined:undefined;
 const fx=createBoardEffects({ticker:{add:(fn:()=>void)=>callbacks.add(fn),remove:(fn:()=>void)=>callbacks.delete(fn)}} as unknown as Application,{addChild:(sprite:InstanceType<typeof FakeSprite>)=>children.push(sprite)} as unknown as Container,{cellSize:()=>50,position,frames:()=>[] as Texture[],fxArt});
 const state=createGame(getLevel(1));if(power)(state as typeof state&{powerRainbow?:boolean}).powerRainbow=true;kinds.forEach((kind,i)=>{state.cells[24+i]!.tile={id:90000+i,kind};});state.nextTileId=91000;
 const action:Action=kinds.length===2?{type:'swap',from:24,to:25}:{type:'tap',at:24},before=structuredClone(state),result=applyAction(state,action);
 const duration=fx.play(result.events,before,result.state,false,action,effectTiming(result.events,result.state,action));
 const connected=new Map<number,Set<string>>(),seen=new Set<string>(),frames=new Map<string,number>(),poses:Array<{x:number;y:number;flip:boolean;rotation:number}>=[],reach=new Map<InstanceType<typeof FakeSprite>,{width:number;x:number;y:number}>();
 for(let t=0;t<=duration;t+=20){now=t;for(const callback of callbacks)callback();for(const sprite of children)if(sprite.visible){const id=(sprite.textures[0] as {id:string}).id;seen.add(id);frames.set(id,Math.max(frames.get(id)??0,sprite.textures.length));if(id==='rocket_half')poses.push({x:sprite.x,y:sprite.y,flip:sprite.scale.x<0,rotation:sprite.rotation});
  if(id==='fx_trail'&&sprite.alpha>.3){const set=connected.get(t)??new Set<string>();set.add(`${Math.round(sprite.x+Math.cos(sprite.rotation)*sprite.width/2)},${Math.round(sprite.y+Math.sin(sprite.rotation)*sprite.width/2)}`);connected.set(t,set);}
  if(id==='fx_trail'&&sprite.width>=(reach.get(sprite)?.width??0))reach.set(sprite,{width:sprite.width,x:sprite.x+Math.cos(sprite.rotation)*sprite.width/2,y:sprite.y+Math.sin(sprite.rotation)*sprite.width/2});}}
 return Object.assign(seen,{frames,poses,beamEnds:[...reach.values()],result,connected});
}

describe('imagegen light materials',()=>{
 for(const kinds of [['bomb'],['bomb','bomb'],['wind-row'],['wind-row','wind-column'],['glider'],['beehive'],['rainbow'],['rainbow','bomb']] as Special[][])
  it(`${kinds.join('+')} draws its light only from the imagegen materials`,()=>{
   const seen=play(kinds,true);
   expect([...seen].filter(id=>LEGACY_LIGHT.includes(id))).toEqual([]);
   expect([...seen].some(id=>MATERIALS.includes(id))).toBe(true);
  });
 it('a bomb blast layers the billowing puff, hot core, ray burst and sparks',()=>{
  const seen=play(['bomb'],true);
  for(const id of ['fx_puff','fx_glow','fx_rays','fx_sparks'])expect(seen.has(id)).toBe(true);
 });
 it('a rocket splits into two halves that fly apart nose-first along its line',()=>{
  const seen=play(['wind-row'],true);
  expect(seen.has('rocket_half')).toBe(true);
  const left=seen.poses.filter(pose=>pose.x<175-30),right=seen.poses.filter(pose=>pose.x>175+30);
  expect(left.length).toBeGreaterThan(0);expect(right.length).toBeGreaterThan(0);
  expect(left.every(pose=>pose.flip&&Math.abs(pose.y-175)<1)).toBe(true);expect(right.every(pose=>!pose.flip&&Math.abs(pose.y-175)<1)).toBe(true);
  const up=play(['wind-column'],true).poses.filter(pose=>pose.y<175-30);
  expect(up.length).toBeGreaterThan(0);expect(up.every(pose=>Math.abs(pose.rotation+Math.PI/2)<.1)).toBe(true);
 });
 it('the rainbow lantern spins fast through its four motion-blur frames while it charges',()=>{
  const seen=play(['rainbow'],true);
  expect(seen.has('rainbow_spin_blur_sheet_0')).toBe(true);
  expect(seen.frames.get('rainbow_spin_blur_sheet_0')).toBeGreaterThanOrEqual(12);
 });
 it('every rainbow beam ends exactly on the centre of the tile it collects',()=>{
  for(const power of [false,true]){
   const seen=play(['rainbow'],true,power),cells=new Set(seen.result.events.filter(event=>event.type==='remove'&&event.kind!=='rainbow').flatMap(event=>event.cells));
   const centres=[...cells].map(position);
   expect(seen.beamEnds.length).toBeGreaterThan(3);
   for(const end of seen.beamEnds)expect(Math.min(...centres.map(c=>Math.hypot(c.x-end.x,c.y-end.y)))).toBeLessThan(1);
  }
 });
 it('keeps a beam connected to every collected tile until they all break together',()=>{
  for(const power of [false,true]){
   const seen=play(['rainbow'],true,power),targets=[...rainbowSelections(seen.result.events).values()][0]!.targets;
   // Just before the shared impact (charge 720 ms + travel 1000 ms) every target still has its beam.
   const lit=seen.connected.get(1700)!;
   const ends=[...lit].map(key=>key.split(',').map(Number) as [number,number]);
   const missing=targets.filter(at=>{const c=position(at);return !ends.some(([x,y])=>Math.hypot(x-c.x,y-c.y)<2);});
   expect(missing,`power=${power}`).toEqual([]);
  }
 });
 it('falls back to the older sprites until the materials have loaded',()=>{
  const seen=play(['bomb'],false);
  expect([...seen].some(id=>LEGACY_LIGHT.includes(id))).toBe(true);
  expect([...seen].some(id=>MATERIALS.includes(id))).toBe(false);
 });
});

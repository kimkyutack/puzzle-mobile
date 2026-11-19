import {describe,it,expect,vi,afterEach} from 'vitest';
import type {Application,Container} from 'pixi.js';
import {applyAction,createGame,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {BEEHIVE_ENGINE_VERSION,type Special,type Action} from '@garden/contracts';
const {FakeSprite}=vi.hoisted(()=>({FakeSprite:class {textures:unknown[];visible=false;destroyed=false;x=0;y=0;rotation=0;alpha=1;tint=0xffffff;blendMode='normal';width=0;height=0;loop=false;eventMode='none';anchor={set:()=>{}};scale={x:1,y:1,set:(x:number,y=x)=>{this.scale.x=x;this.scale.y=y;}};position={set:(x:number,y:number)=>{this.x=x;this.y=y;}};constructor(textures:unknown[]){this.textures=textures;}gotoAndStop(){}stop(){}destroy(){this.destroyed=true;}}}));
vi.mock('pixi.js',()=>({AnimatedSprite:FakeSprite}));
vi.mock('../apps/client/src/assets',()=>({hasArt:()=>true,texture:(id:string)=>({id,orig:{width:256,height:256}}),tileArt:(kind:string)=>kind}));
import {createBoardEffects} from '../apps/client/src/board-effects';
import {effectTiming} from '../apps/client/src/visual-timing';
afterEach(()=>vi.restoreAllMocks());
for(const partner of [null,'wind-row','wind-column','bomb','glider','beehive','rainbow'] as Array<Special|null>)it(`completes the real ${partner??'single hive'} choreography and releases every sprite`,()=>{
 let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
 const before=createGame(getLevel(1,BEEHIVE_ENGINE_VERSION));before.cells[24]!.tile={id:500,kind:'beehive'};if(partner)before.cells[25]!.tile={id:501,kind:partner};before.nextTileId=502;
 const action:Action=partner?{type:'swap',from:24,to:25}:{type:'tap',at:24},result=applyAction(before,action),hash=stateHash(result.state),callbacks=new Set<()=>void>(),children:InstanceType<typeof FakeSprite>[]=[],seen=new Set<string>();
 const fx=createBoardEffects({ticker:{add:(fn:()=>void)=>callbacks.add(fn),remove:(fn:()=>void)=>callbacks.delete(fn)}} as unknown as Application,{addChild:(sprite:InstanceType<typeof FakeSprite>)=>children.push(sprite)} as unknown as Container,{cellSize:()=>40,position:index=>({x:(index%7+.5)*40,y:(Math.floor(index/7)+.5)*40})});
 const duration=fx.play(result.events,before,result.state,false,action,effectTiming(result.events,result.state,action));
 expect(duration).toBeGreaterThan(1800);expect(duration).toBeLessThan(12000);
 for(now=0;now<=duration+32;now+=16){for(const tick of callbacks)tick();for(const sprite of children)if(sprite.visible){seen.add((sprite.textures[0] as {id:string}).id);expect(Number.isFinite(sprite.x)&&Number.isFinite(sprite.y)&&Number.isFinite(sprite.scale.x)&&Number.isFinite(sprite.scale.y)).toBe(true);}expect(fx.activeCount).toBeLessThanOrEqual(180);}
 expect(seen).toContain('bee_flight');expect(seen).toContain('beehive');if(partner&&['wind-row','wind-column','bomb'].includes(partner))expect(seen).toContain(partner);
 expect(fx.activeCount).toBe(0);expect(stateHash(result.state)).toBe(hash);fx.destroy();expect(callbacks.size).toBe(0);expect(children.every(sprite=>sprite.destroyed)).toBe(true);
});

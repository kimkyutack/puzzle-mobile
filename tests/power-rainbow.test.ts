import {describe,expect,it} from 'vitest';
import {COLORS,ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,POWER_RAINBOW_ENGINE_VERSION,VISIBLE_TARGETS_ENGINE_VERSION,levelClearCoins,type GameState,type LevelDefinition} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,validateLevel} from '@garden/core';
import {rainbowSelections} from '../apps/client/src/rainbow-selection';
import {effectTiming} from '../apps/client/src/visual-timing';

function board(powered:boolean):LevelDefinition{
 return {id:701,engineVersion:POWER_RAINBOW_ENGINE_VERSION,version:'power-rainbow-fixture',difficulty:'normal',
  width:8,height:8,moves:25,seed:42379,shape:Array<boolean>(64).fill(true),colors:[...COLORS.slice(0,5)],
  goals:[{kind:'crate',count:1,remaining:1}],
  obstacles:[{id:'crate',kind:'crate',anchor:59,footprint:[59],hp:3,maxHp:3}],
  ...(powered?{powerRainbow:true as const}:{})};
}
function place(state:GameState,index:number,kind:'rainbow'|'bomb'|'glider'){
 state.cells[index]!.tile={id:state.cells[index]!.tile!.id,kind};
}
describe('power disco ball',()=>{
 it('selects the remaining collection color before a more common color',()=>{
  const state=createGame({...board(false),engineVersion:ENGINE_VERSION});
  place(state,21,'rainbow');
  const ranked=[...state.colors].sort((a,b)=>state.cells.filter(c=>c.tile?.kind==='normal'&&c.tile.color===b).length-state.cells.filter(c=>c.tile?.kind==='normal'&&c.tile.color===a).length);
  const wanted=ranked.at(-1)!;
  state.goals=[{kind:wanted,count:20,remaining:20}];
  const action={type:'tap',at:21} as const;
  const direct=(version:string)=>{
   const result=applyAction({...state,engineVersion:version},action);
   const lantern=result.events.find(event=>event.type==='special'&&event.kind==='rainbow')!;
   return [...new Set(result.events.filter(event=>event.type==='remove'&&event.effectId===lantern.effectId).map(event=>event.kind))];
  };
  expect(direct(ENGINE_VERSION)).toEqual([wanted]);
  expect(direct(VISIBLE_TARGETS_ENGINE_VERSION)).not.toContain(wanted);
 });
 it('uses its extra color on visible frost and also keeps the swapped color',()=>{
  const state=createGame({...board(true),engineVersion:ENGINE_VERSION});
  place(state,21,'rainbow');
  const selected=state.cells[20]!.tile!;
  if(selected.kind!=='normal')throw new Error('fixture');
  const frosted=state.cells.findIndex(cell=>cell.tile?.kind==='normal'&&cell.tile.color!==selected.color);
  state.cells[frosted]!.frost=2;state.goals=[{kind:'frost',count:2,remaining:2}];
  const result=applyAction(state,{type:'swap',from:21,to:20});
  const lantern=result.events.find(event=>event.type==='special'&&event.kind==='rainbow')!;
  expect(result.events).toContainEqual({type:'hit',kind:'frost',cells:[frosted],effectId:lantern.effectId});
  expect(result.events.some(event=>event.type==='remove'&&event.kind===selected.color&&event.effectId===lantern.effectId)).toBe(true);
 });
 it('clears the chosen color and a second color, with a light ray for every direct removal',()=>{
  const state=createGame(board(true));
  const next=state.cells[20]!.tile!;
  if(next.kind!=='normal')throw new Error('fixture');
  place(state,21,'rainbow');
  const action={type:'swap',from:21,to:20} as const;
  const boosted=actionWithFrames(state,action);
  const standard=applyAction({...state,powerRainbow:undefined},action);
  const activation=boosted.events.find(e=>e.type==='special'&&e.kind==='rainbow')!;
  expect(activation.powered).toBe(true);
  const colors=new Set(boosted.events.filter(e=>e.type==='remove'&&e.effectId===activation.effectId).map(e=>e.kind));
  expect(colors.size).toBe(2);
  expect(colors.has(next.color)).toBe(true);
  const selection=[...rainbowSelections(boosted.events).values()][0]!;
  expect(selection.targets.length).toBeGreaterThan([...rainbowSelections(standard.events).values()][0]!.targets.length);
  expect(boosted.state).toEqual(applyAction(state,action).state);
 });
 it.each(['bomb','glider'] as const)('converts both color sets into the combined %s',kind=>{
  const state=createGame(board(true));place(state,20,'rainbow');place(state,21,kind);
  const action={type:'swap',from:20,to:21} as const;
  const boosted=applyAction(state,action),standard=applyAction({...state,powerRainbow:undefined},action);
  const enhanced=[...rainbowSelections(boosted.events).values()][0]!,ordinary=[...rainbowSelections(standard.events).values()][0]!;
  expect(enhanced.replacement).toBe(kind);
  expect(enhanced.children.size).toBeGreaterThan(ordinary.children.size);
  expect(enhanced.children.size).toBe(enhanced.targets.length);
  if(kind==='glider')expect(boosted.events.filter(e=>e.kind==='glider-flight')).toHaveLength(enhanced.targets.length);
  expect(boosted.state.status).not.toBe('error');
 });
 it('hits surviving obstacles twice when two power balls combine',()=>{
  const state=createGame(board(true));place(state,20,'rainbow');place(state,21,'rainbow');
  const action={type:'swap',from:20,to:21} as const;
  const result=applyAction(state,action),ordinary=applyAction({...state,powerRainbow:undefined},action);
  const beforeRefill=(events:typeof result.events)=>{
   const index=events.findIndex(e=>e.type==='fall'||e.type==='spawn');
   return index===-1?events:events.slice(0,index);
  };
  const isCrateHit=(event:typeof result.events[number])=>event.kind==='crate'&&event.type==='hit';
  expect(beforeRefill(ordinary.events).filter(isCrateHit)).toHaveLength(1);
  expect(beforeRefill(result.events).filter(isCrateHit)).toHaveLength(2);
  const hitDelays=effectTiming(result.events,state).delays.slice(0,beforeRefill(result.events).length)
   .filter((_,i)=>isCrateHit(result.events[i]!));
  expect(hitDelays[1]!-hitDelays[0]!).toBe(180);
 });
 it('rejects boosted boards on old engines and shares the clear coin amounts',()=>{
  expect(validateLevel({...board(true),engineVersion:GREENHOUSE_ENGINE_VERSION})).toContain('POWER_RAINBOW_ENGINE');
  expect((['normal','hard','super'] as const).map(difficulty=>levelClearCoins({difficulty}))).toEqual([30,40,50]);
 });
});

import {describe,expect,it} from 'vitest';
import {ENGINE_VERSION,GARDEN_CIRCUIT_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,supportsGardenCircuit,supportsMixedRainbowRockets,type LevelDefinition} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,replay,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {rainbowSelections} from '../apps/client/src/rainbow-selection';
import {effectTiming,VISUAL_BEATS} from '../apps/client/src/visual-timing';

type Rocket='wind-row'|'wind-column';
function board(partner:Rocket,powered=false,engineVersion=ENGINE_VERSION,seed=42379):LevelDefinition{
 const level={...getLevel(1,engineVersion),seed},start=createGame(level);
 start.cells[24]!.tile={id:500,kind:'rainbow'};
 start.cells[25]!.tile={id:501,kind:partner};
 return {...level,version:'mixed-rainbow-rocket-test',initial:start.cells.map(cell=>cell.tile),
  goals:[{kind:'berry',count:100,remaining:100}],...(powered?{powerRainbow:true as const}:{})};
}

describe('mixed rockets from a rainbow combination',()=>{
 for(const partner of ['wind-row','wind-column'] as const)for(const reverse of [false,true])for(const powered of [false,true]){
  it(`mixes both directions for ${partner}, reverse=${reverse}, powered=${powered}`,()=>{
   const level=board(partner,powered),before=createGame(level),hash=stateHash(before);
   const action={type:'swap',from:reverse?25:24,to:reverse?24:25} as const;
   const result=applyAction(before,action),selection=[...rainbowSelections(result.events).values()][0]!;
   expect(result.accepted).toBe(true);expect(result.state.status).not.toBe('error');
   expect(selection.children.size).toBe(selection.targets.length);
   expect(selection.replacements.size).toBe(selection.targets.length);
   const kinds=[...selection.replacements.values()];
   expect(new Set(kinds)).toEqual(new Set(['wind-row','wind-column']));
   expect(Math.abs(kinds.filter(k=>k==='wind-row').length-kinds.filter(k=>k==='wind-column').length)).toBeLessThanOrEqual(1);
   const timing=effectTiming(result.events,result.state,action);
   const lastConversion=Math.max(...selection.targets.map(at=>timing.conversionAt.get(at)!));
   for(const [index,at]of selection.children){
    const activation=result.events[index]!,kind=selection.replacements.get(at)!;
    expect(activation.kind).toBe(kind);
    expect(timing.delays[index]!).toBeGreaterThanOrEqual(lastConversion+VISUAL_BEATS.rainbowHold);
    for(const event of result.events.filter(event=>(event.type==='remove'||event.type==='hit')&&event.effectId===activation.effectId)){
     expect(event.cells.every(cell=>kind==='wind-row'?Math.floor(cell/before.width)===Math.floor(at/before.width):cell%before.width===at%before.width)).toBe(true);
    }
   }
   expect(stateHash(before)).toBe(hash);
   expect(replay(level,[action])).toEqual(result);
   const animated=actionWithFrames(before,action);expect(animated.state).toEqual(result.state);expect(animated.events).toEqual(result.events);
  });
 }
 it('keeps both directions across different seeds and repeats each seed exactly',()=>{
  const arrangements=new Set<string>();
  for(let seed=1;seed<=20;seed++){
   const level=board('wind-row',false,ENGINE_VERSION,seed),before=createGame(level),action={type:'swap',from:24,to:25} as const;
   const result=applyAction(before,action),selection=[...rainbowSelections(result.events).values()][0]!;
   expect(new Set(selection.replacements.values())).toEqual(new Set(['wind-row','wind-column']));
   expect(applyAction(before,action)).toEqual(result);
   arrangements.add([...selection.replacements.values()].join(','));
  }
  expect(arrangements.size).toBeGreaterThan(1);
 });
 it.each([1,2])('handles a small selection of %d normal tiles',count=>{
  const level=board('wind-row');
  level.initial=level.initial!.map((tile,at)=>tile?.kind==='normal'?{...tile,color:at<count?'berry':tile.color==='berry'?'drop':tile.color}:tile);
  // Use an alternating palette so replacing unselected berries creates no initial matches.
  const otherColors=level.colors.filter(color=>color!=='berry');
  level.initial.forEach((tile,at)=>{if(tile?.kind==='normal'&&at>=count)tile.color=otherColors[at%otherColors.length]!;});
  const result=applyAction(createGame(level),{type:'swap',from:24,to:25}),selection=[...rainbowSelections(result.events).values()][0]!;
  expect(result.accepted).toBe(true);expect(result.state.status).not.toBe('error');
  expect(selection.children.size).toBe(count);
  if(count===2)expect(new Set(selection.replacements.values())).toEqual(new Set(['wind-row','wind-column']));
 });
 it.each(['wind-row','wind-column'] as const)('preserves the retained 1.34 rules for an existing %s combination',partner=>{
  const level=board(partner,false,GARDEN_CIRCUIT_ENGINE_VERSION),before=createGame(level),action={type:'swap',from:24,to:25} as const;
  const result=applyAction(before,action),selection=[...rainbowSelections(result.events).values()][0]!;
  expect(new Set(selection.replacements.values())).toEqual(new Set([partner]));
  expect(selection.children.size).toBe(selection.targets.length);
  expect(replay(level,[action])).toEqual(result);
 });
 it('negotiates the new rules while retaining every existing circuit capability',()=>{
  expect(SUPPORTED_ENGINE_VERSIONS).toContain(GARDEN_CIRCUIT_ENGINE_VERSION);
  expect(supportsGardenCircuit(ENGINE_VERSION)).toBe(true);
  expect(supportsMixedRainbowRockets(ENGINE_VERSION)).toBe(true);
  expect(supportsMixedRainbowRockets(GARDEN_CIRCUIT_ENGINE_VERSION)).toBe(false);
 });
});

import {describe,it,expect} from 'vitest';
import {RESTORATIONS} from '@garden/content';
import {createGardenWorld,gardenExpansionOptions,gardenExpansionPlot,gardenPlotCells,gardenLandCells,gardenBounds,canExpandGarden,applyGardenExpansion,applyGardenCommand,applyTrustedDecorationGrant,publicGardenSnapshot,type GardenWorldState} from '../packages/garden-world/src';
import {projectLiveGarden} from '../packages/garden-world/src/live';
import {gardenVisitorCount,gardenWalkable,residentRoute} from '../apps/client/src/garden-world/residents';
const owner='land-owner';
const expand=(world:GardenWorldState,plotId=gardenExpansionOptions(world)[0]!.id,key='expand-'+world.revision)=>applyGardenExpansion(world,{plotId,expectedRevision:world.revision,operationId:key},owner);
describe('paid twenty-cell garden land',()=>{
 it('adds exactly twenty connected tiles and preserves a legacy save and its buildings',()=>{
  const world=projectLiveGarden({id:owner,restored:RESTORATIONS.slice(0,6).map(t=>t.id)}),before=structuredClone(world),area=gardenLandCells(world).size,next=expand(world);
  expect(world).toEqual(before);expect(next.placements).toBe(world.placements);expect(next.owned).toBe(world.owned);expect(next.unlockedRegions).toEqual(world.unlockedRegions);expect(gardenLandCells(next).size).toBe(area+20);expect(next.revision).toBe(world.revision+1);
  expect(projectLiveGarden({id:owner,restored:RESTORATIONS.slice(0,6).map(t=>t.id)},JSON.parse(JSON.stringify(next)))).toEqual(next);
 });
 it('offers only full, separate twenty-tile plots without selling future story land',()=>{
  const world=createGardenWorld(owner),options=gardenExpansionOptions(world);expect(options.length).toBeGreaterThan(1);expect(options.length).toBeLessThanOrEqual(8);
  const offered=new Set<string>();for(const plot of options){expect(canExpandGarden(world,plot)).toBe(true);expect(gardenPlotCells(plot)).toHaveLength(20);for(const c of gardenPlotCells(plot)){expect(offered.has(c.x+','+c.y)).toBe(false);offered.add(c.x+','+c.y);expect(gardenLandCells(world).has(c.x+','+c.y)).toBe(false);}}
  expect(canExpandGarden(world,gardenExpansionPlot('land-5-10')!)).toBe(false);expect(canExpandGarden(world,gardenExpansionPlot('land-10-5')!)).toBe(false);
 });
 it('rejects overlaps, distant or forged plots, foreign actors and stale requests without changing land',()=>{
  const world=createGardenWorld(owner),plot=gardenExpansionOptions(world)[0]!,command={plotId:plot.id,expectedRevision:world.revision,operationId:'one-key-123'};
  expect(()=>applyGardenExpansion(world,command,'visitor')).toThrow('FORBIDDEN');expect(()=>applyGardenExpansion(world,{...command,expectedRevision:1},owner)).toThrow('STALE_REVISION');
  for(const plotId of ['land-0-0','land-10-10','land-999-999','land-01-1','land--1-1','anything'])expect(()=>applyGardenExpansion(world,{...command,plotId},owner)).toThrow('LAND_UNAVAILABLE');
  const next=applyGardenExpansion(world,command,owner);expect(applyGardenExpansion(next,command,owner)).toBe(next);expect(()=>applyGardenExpansion(next,{...command,plotId:gardenExpansionOptions(next)[0]!.id},owner)).toThrow('OPERATION_CONFLICT');expect(()=>expand(next,plot.id)).toThrow('LAND_UNAVAILABLE');expect(world.expansions).toBeUndefined();
 });
 it('permits all new tiles immediately, with old collision and complete-footprint checks',()=>{
  const initial=createGardenWorld(owner),plot=gardenExpansionOptions(initial)[0]!,id='bench-land';let world=applyTrustedDecorationGrant(initial,{ownerId:owner,grantId:'grant-bench',itemId:'garden-bench',variant:'classic',source:'shop',instanceIds:[id]});
  const command={type:'place' as const,instanceId:id,x:plot.x,y:plot.y,rotation:0 as const,operationId:'bench-place',expectedRevision:world.revision};expect(()=>applyGardenCommand(world,command,owner)).toThrow('REGION_LOCKED');world=expand(world,plot.id);
  expect(applyGardenCommand(world,{...command,expectedRevision:world.revision},owner).placements[id]).toMatchObject({x:plot.x,y:plot.y});
  expect(()=>applyGardenCommand(world,{...command,x:plot.x+4,expectedRevision:world.revision},owner)).toThrow('REGION_LOCKED');
 });
 it('continues beyond the old 32-cell boundary without moving existing coordinates',()=>{
  let world=createGardenWorld(owner);const initial=gardenLandCells(world).size;
  for(let i=0;i<60;i++){world=expand(world);expect(gardenLandCells(world).size).toBe(initial+(i+1)*20);}
  expect(gardenBounds(world).width+gardenBounds(world).height).toBeGreaterThan(64);expect(gardenBounds(world).width).toBeLessThanOrEqual(64);expect(gardenBounds(world).height).toBeLessThanOrEqual(64);
 });
 it('includes bought land in walking and visitor capacity and safely copies public land IDs',()=>{
  const before=createGardenWorld(owner),after=expand(before);expect(gardenVisitorCount(before)).toBe(2);expect(gardenVisitorCount(after)).toBe(3);
  const plot=gardenExpansionPlot(after.expansions![0]!)!,walkable=gardenWalkable(after);expect(residentRoute({x:16,y:16},{x:plot.x,y:plot.y},walkable).length).toBeGreaterThan(0);
  const snapshot=publicGardenSnapshot(after);expect(snapshot.expansions).toEqual(after.expansions);snapshot.expansions!.push('land-0-0');expect(after.expansions).toHaveLength(1);expect('operations' in snapshot).toBe(false);
 });
});

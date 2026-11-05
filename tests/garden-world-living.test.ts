import {describe,it,expect} from 'vitest';
import {applyGardenCommand,applyGardenPlacementBatch,applyTrustedDecorationGrant,applyTrustedRegionUnlock,createGardenWorld,type GardenWorldState} from '../packages/garden-world/src';
import {GardenResidents,gardenVisitorCount,gardenWalkable,residentRoute} from '../apps/client/src/garden-world/residents';
import {extendGardenPaint,gardenBrushLine} from '../apps/client/src/garden-world/paint';
const grant=(world:GardenWorldState,itemId:string,ids:string[])=>applyTrustedDecorationGrant(world,{ownerId:world.ownerId,itemId,instanceIds:ids,grantId:'grant-'+ids[0],variant:'classic',source:'shop'});
const place=(world:GardenWorldState,id:string,x:number,y:number)=>applyGardenCommand(world,{type:'place',instanceId:id,x,y,rotation:0,expectedRevision:world.revision,operationId:'place-'+id},world.ownerId);

describe('garden brush transactions',()=>{
 it('fills a fast stroke with distinct owned copies, skips occupied and locked cells, and stops at stock',()=>{
  let world=grant(createGardenWorld('gardener'),'garden-path-stone',Array.from({length:8},(_,i)=>'path-'+i));world=place(world,'path-0',10,10);
  const staged=extendGardenPaint(world,'garden-path-stone',[],gardenBrushLine({x:8,y:10},{x:20,y:10}));
  expect(staged.map(p=>p.x)).toEqual([11,12,13,14,15,16,17]);expect(new Set(staged.map(p=>p.instanceId)).size).toBe(7);
  expect(extendGardenPaint(world,'garden-path-stone',staged,[{x:11,y:10}])).toEqual(staged);
 });
 it('commits many placements at one revision and replays without granting or charging anything',()=>{
  const world=grant(createGardenWorld('gardener'),'garden-path-stone',['one','two','three']),before=structuredClone(world);
  const placements=extendGardenPaint(world,'garden-path-stone',[],gardenBrushLine({x:10,y:10},{x:12,y:10})),batch={operationId:'paint-batch',expectedRevision:world.revision,placements};
  const next=applyGardenPlacementBatch(world,batch,world.ownerId);expect(next.revision).toBe(world.revision+1);expect(Object.keys(next.placements)).toHaveLength(3);expect(next.owned).toEqual(world.owned);expect(world).toEqual(before);
  expect(applyGardenPlacementBatch(next,batch,world.ownerId)).toBe(next);
  expect(()=>applyGardenPlacementBatch(next,{...batch,placements:placements.slice(0,2)},world.ownerId)).toThrow('OPERATION_CONFLICT');
  expect(()=>applyGardenPlacementBatch(next,{...batch,operationId:'stale-paint'},world.ownerId)).toThrow('STALE_REVISION');
 });
 it('also paints repeated decorations while respecting their full footprints',()=>{
  const world=grant(createGardenWorld('gardener'),'garden-bench',['bench-a','bench-b','bench-c']);
  const staged=extendGardenPaint(world,'garden-bench',[],gardenBrushLine({x:10,y:10},{x:15,y:10}));
  expect(staged.map(p=>p.x)).toEqual([10,12,14]);
  expect(Object.keys(applyGardenPlacementBatch(world,{operationId:'bench-stroke',expectedRevision:world.revision,placements:staged},world.ownerId).placements)).toHaveLength(3);
 });
 it('rejects a whole batch if one cell or ownership is invalid, preserving the original layout',()=>{
  const world=grant(createGardenWorld('gardener'),'garden-path-stone',['one','two']),before=structuredClone(world);
  const first={instanceId:'one',x:10,y:10,rotation:0 as const},batch={operationId:'atomic-paint',expectedRevision:world.revision,placements:[first,{...first,instanceId:'two'}]};
  expect(()=>applyGardenPlacementBatch(world,batch,world.ownerId)).toThrow('OCCUPIED');expect(world).toEqual(before);
  expect(()=>applyGardenPlacementBatch(world,{...batch,placements:[first,{...first,instanceId:'foreign',x:11}]},world.ownerId)).toThrow('NOT_OWNED');
  expect(()=>applyGardenPlacementBatch(world,{...batch,placements:[first,{...first,instanceId:'two',x:1}]},world.ownerId)).toThrow('REGION_LOCKED');
  expect(()=>applyGardenPlacementBatch(world,batch,'visitor')).toThrow('FORBIDDEN');
  expect(()=>applyGardenPlacementBatch(world,{...batch,placements:Array(101).fill(first)},world.ownerId)).toThrow('INVALID_INPUT');
 });
});

describe('local garden life',()=>{
 it('adds visitors as earned land expands, and routes around buildings without entering locked cells',()=>{
  let world=grant(createGardenWorld('gardener'),'garden-bench',['bench']);world=place(world,'bench',14,14);
  const walkable=gardenWalkable(world),route=residentRoute({x:13,y:14},{x:16,y:14},walkable);
  expect(route.length).toBeGreaterThan(3);expect(route.every(p=>walkable.has(p.x+','+p.y))).toBe(true);expect(route.some(p=>p.x===14&&p.y===14)).toBe(false);
  expect(residentRoute({x:10,y:10},{x:1,y:1},walkable)).toEqual([]);expect(gardenVisitorCount(world)).toBe(2);
  world=applyTrustedRegionUnlock(world,'workshop');expect(gardenVisitorCount(world)).toBe(4);
  world=applyTrustedRegionUnlock(world,'terrace');expect(gardenVisitorCount(world)).toBe(5);
 });
 it('walks, yawns, sleeps and stretches without modifying saved animal homes or resources',()=>{
  let world=grant(createGardenWorld('gardener'),'animal-rabbit',['rabbit']);world=place(world,'rabbit',16,18);
  const before=structuredClone(world),simulation=new GardenResidents();simulation.sync(world);
  const poses=new Set<string>(),visited=new Set<string>();
  for(let i=0;i<3600;i++){simulation.step(.1);const rabbit=simulation.actors.find(a=>a.id==='rabbit')!;poses.add(rabbit.pose);visited.add(rabbit.x.toFixed(2)+','+rabbit.y.toFixed(2));for(const actor of simulation.actors)expect(simulation.walkable.has(Math.round(actor.x)+','+Math.round(actor.y))).toBe(true);}
  expect([...poses]).toEqual(expect.arrayContaining(['idle','walk','yawn','sleep','stretch']));expect(visited.size).toBeGreaterThan(30);expect(world).toEqual(before);
  const paused=structuredClone(simulation.actors);simulation.step(1,true);expect(simulation.actors).toEqual(paused);
 });
 it('removes stored animals and restarts a moved animal at its new home',()=>{
  let world=grant(createGardenWorld('gardener'),'animal-cat',['cat']);world=place(world,'cat',16,18);
  const simulation=new GardenResidents();simulation.sync(world);for(let i=0;i<100;i++)simulation.step(.1);
  world=applyGardenCommand(world,{type:'move',instanceId:'cat',x:11,y:11,rotation:0,operationId:'move-cat',expectedRevision:world.revision},world.ownerId);simulation.sync(world);
  expect(simulation.actors.find(a=>a.id==='cat')).toMatchObject({x:11,y:11,home:{x:11,y:11}});
  world=applyGardenCommand(world,{type:'store',instanceId:'cat',operationId:'store-cat',expectedRevision:world.revision},world.ownerId);simulation.sync(world);expect(simulation.actors.some(a=>a.id==='cat')).toBe(false);
 });
});

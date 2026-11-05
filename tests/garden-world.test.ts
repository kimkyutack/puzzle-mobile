import {describe,it,expect} from 'vitest';
import {DECORATIONS,GARDEN_WORLD,createGardenWorld,applyGardenCommand,applyTrustedDecorationGrant,applyTrustedRegionUnlock,publicGardenSnapshot,storedDecorations,placementCells,GardenWorldError,gardenGridToScreen,gardenScreenToGrid,gardenScreenToCell,zoomGardenAt,constrainGardenCamera,type GardenWorldState,type GardenCommand,type TrustedDecorationGrant} from '../packages/garden-world/src';

const owner='owner-1';
function grant(state:GardenWorldState,itemId='garden-bench',id='bench-1',source:TrustedDecorationGrant['source']='restoration'){
 return applyTrustedDecorationGrant(state,{ownerId:owner,grantId:'grant-'+id,itemId,variant:'classic',source,instanceIds:[id]});
}
function place(state:GardenWorldState,id:string,x:number,y:number,rotation:0|90=0,operationId='place-'+id){
 return applyGardenCommand(state,{type:'place',operationId,expectedRevision:state.revision,instanceId:id,x,y,rotation},owner);
}
function hasCode(action:()=>unknown,code:string){
 try{action();throw new Error('Expected '+code);}catch(error){expect(error).toBeInstanceOf(GardenWorldError);expect((error as GardenWorldError).code).toBe(code);}
}

describe('garden ownership, storage and placement',()=>{
 it('starts with an empty decoration inventory and a bounded twelve by twelve home region',()=>{
  const world=createGardenWorld(owner);
  expect(world.unlockedRegions).toEqual(['sky']);
  expect(GARDEN_WORLD.regions.find(region=>region.id==='sky')).toMatchObject({width:12,height:12});
  expect(world.owned).toEqual({});expect(world.placements).toEqual({});
  expect('coins' in world).toBe(false);expect('stars' in world).toBe(false);
 });

 it('grants a purchased item once across callback retries and detects changed receipts',()=>{
  const initial=createGardenWorld(owner),receipt:TrustedDecorationGrant={ownerId:owner,grantId:'purchase-1',itemId:'garden-bench',variant:'festival',source:'shop',instanceIds:['b-1','b-2']};
  const world=applyTrustedDecorationGrant(initial,receipt);
  expect(Object.keys(initial.owned)).toEqual([]);
  expect(storedDecorations(world)).toHaveLength(2);
  expect(applyTrustedDecorationGrant(world,{...receipt,instanceIds:['b-2','b-1']})).toBe(world);
  hasCode(()=>applyTrustedDecorationGrant(world,{...receipt,variant:'classic'}),'GRANT_CONFLICT');
  hasCode(()=>applyTrustedDecorationGrant(world,{...receipt,grantId:'another-purchase'}),'INSTANCE_CONFLICT');
  hasCode(()=>applyTrustedDecorationGrant(world,{...receipt,grantId:'duplicate-ids',instanceIds:['b-3','b-3']}),'INSTANCE_CONFLICT');
 });

 it('rejects grants to another owner and keeps earned landmarks out of shop grants',()=>{
  const world=createGardenWorld(owner);
  hasCode(()=>applyTrustedDecorationGrant(world,{ownerId:'visitor',grantId:'foreign-grant',itemId:'garden-bench',variant:'classic',source:'shop',instanceIds:['b-1']}),'FORBIDDEN');
  hasCode(()=>grant(world,'garden-fountain','f-1','shop'),'ITEM_NOT_FOR_SALE');
  expect(grant(world,'garden-fountain','f-1').owned['f-1'].source).toBe('restoration');
 });

 it('places, rotates, moves and stores the same owned instance without consuming or copying it',()=>{
  let world=grant(createGardenWorld(owner));const owned=world.owned;
  world=place(world,'bench-1',11,11);
  expect(storedDecorations(world)).toHaveLength(0);
  world=applyGardenCommand(world,{type:'move',operationId:'move-1',expectedRevision:world.revision,instanceId:'bench-1',x:13,y:13,rotation:90},owner);
  expect(placementCells(DECORATIONS[0]!,world.placements['bench-1']!)).toEqual([{x:13,y:13},{x:13,y:14}]);
  world=applyGardenCommand(world,{type:'store',operationId:'store-1',expectedRevision:world.revision,instanceId:'bench-1'},owner);
  expect(world.placements).toEqual({});expect(storedDecorations(world)).toHaveLength(1);
  world=place(world,'bench-1',15,15,0,'rebuild-1');
  expect(Object.keys(world.placements)).toHaveLength(1);expect(world.owned).toBe(owned);
 });

 it('prevents using unowned items or placing a second copy of one instance',()=>{
  const empty=createGardenWorld(owner);hasCode(()=>place(empty,'made-up-item',11,11),'NOT_OWNED');
  const world=place(grant(empty),'bench-1',11,11);
  hasCode(()=>place(world,'bench-1',15,15,0,'place-another-copy'),'ALREADY_PLACED');
 });

 it('does not change the original world when placement fails or succeeds',()=>{
  const world=grant(createGardenWorld(owner)),before=structuredClone(world);
  hasCode(()=>place(world,'bench-1',0,0),'REGION_LOCKED');
  place(world,'bench-1',11,11);
  expect(world).toEqual(before);
 });

 it('validates the entire rotated footprint against map bounds, unlocked regions and obstacles',()=>{
  let world=grant(grant(createGardenWorld(owner)),'garden-planter','flowers-1');
  world=place(world,'flowers-1',11,12);
  hasCode(()=>place(world,'bench-1',11,11,90),'OCCUPIED');
  expect(place(world,'bench-1',11,11,0).placements['bench-1']).toMatchObject({rotation:0});
  hasCode(()=>place(world,'bench-1',21,12),'REGION_LOCKED');
  hasCode(()=>place(world,'bench-1',31,12),'OUT_OF_BOUNDS');
  hasCode(()=>place(world,'bench-1',11.5,12),'INVALID_INPUT');
  hasCode(()=>place(world,'bench-1',NaN,12),'INVALID_INPUT');
  hasCode(()=>applyGardenCommand(world,{type:'move',operationId:'rotate-flowers',expectedRevision:world.revision,instanceId:'flowers-1',x:13,y:13,rotation:45 as 0},owner),'UNSUPPORTED_ROTATION');
 });

 it('lets paving and an object share a cell while blocking two objects or two paving pieces',()=>{
  let world=createGardenWorld(owner);
  world=grant(world,'garden-path-stone','path-1');world=grant(world,'garden-path-stone','path-2');world=grant(world,'garden-lamp','lamp-1');world=grant(world,'garden-planter','flowers-1');
  world=place(place(world,'path-1',12,12),'lamp-1',12,12);
  expect(Object.keys(world.placements)).toHaveLength(2);
  hasCode(()=>place(world,'path-2',12,12),'OCCUPIED');
  hasCode(()=>place(world,'flowers-1',12,12),'OCCUPIED');
 });

 it('preserves story region constraints for large landmarks after a region opens',()=>{
  let world=grant(createGardenWorld(owner),'garden-greenhouse','greenhouse-1');
  hasCode(()=>place(world,'greenhouse-1',3,12),'REGION_LOCKED');
  world=applyTrustedRegionUnlock(world,'workshop');
  expect(place(world,'greenhouse-1',3,12).placements['greenhouse-1']).toBeDefined();
  hasCode(()=>place(world,'greenhouse-1',12,12),'WRONG_REGION');
  expect(applyTrustedRegionUnlock(world,'workshop')).toBe(world);
 });

 it('makes operation retries idempotent, detects changed payloads and rejects stale changes',()=>{
  const initial=grant(createGardenWorld(owner));
  const command:GardenCommand={type:'place',operationId:'operation-1',expectedRevision:initial.revision,instanceId:'bench-1',x:11,y:11,rotation:0};
  const world=applyGardenCommand(initial,command,owner);
  expect(applyGardenCommand(world,command,owner)).toBe(world);
  hasCode(()=>applyGardenCommand(world,{...command,x:15},owner),'OPERATION_CONFLICT');
  hasCode(()=>applyGardenCommand(world,{type:'store',operationId:'operation-2',instanceId:'bench-1',expectedRevision:initial.revision},owner),'STALE_REVISION');
 });

 it('rejects all visitor edits, including replay of an owner operation',()=>{
  const initial=grant(createGardenWorld(owner));
  const command:GardenCommand={type:'place',operationId:'operation-1',expectedRevision:initial.revision,instanceId:'bench-1',x:11,y:11,rotation:0};
  const world=applyGardenCommand(initial,command,owner);
  hasCode(()=>applyGardenCommand(world,command,'visitor'),'FORBIDDEN');
  hasCode(()=>applyGardenCommand(world,{type:'store',operationId:'steal-1',expectedRevision:world.revision,instanceId:'bench-1'},'visitor'),'FORBIDDEN');
 });

 it('publishes appearance only and does not leak or alias private inventory/receipt state',()=>{
  let world=grant(grant(createGardenWorld(owner)),'garden-tree','tree-in-storage');world=place(world,'bench-1',11,11);
  const snapshot=publicGardenSnapshot(world);
  expect(Object.keys(snapshot).sort()).toEqual(['mapId','objects','ownerId','revision','unlockedRegions']);
  expect(snapshot.objects).toEqual([{instanceId:'bench-1',x:11,y:11,rotation:0,itemId:'garden-bench',variant:'classic'}]);
  expect(JSON.stringify(snapshot)).not.toContain('tree-in-storage');expect(JSON.stringify(snapshot)).not.toContain('grant-');
  snapshot.objects[0]!.x=20;snapshot.unlockedRegions.push('pond');
  expect(world.placements['bench-1']!.x).toBe(11);expect(world.unlockedRegions).toEqual(['sky']);
 });
});

describe('large garden isometric camera',()=>{
 it('round-trips grid positions and picks cells consistently across zoom and pan',()=>{
  for(const camera of [{x:200,y:100,zoom:.45},{x:-100,y:-300,zoom:1.8}])for(const cell of [{x:0,y:0},{x:10,y:21},{x:31,y:31}]){
   const center={x:cell.x+.5,y:cell.y+.5},screen=gardenGridToScreen(center,camera),back=gardenScreenToGrid(screen,camera);
   expect(back.x).toBeCloseTo(center.x);expect(back.y).toBeCloseTo(center.y);expect(gardenScreenToCell(screen,camera)).toEqual(cell);
  }
 });
 it('keeps the finger anchor fixed when zooming and limits magnification',()=>{
  const camera={x:130,y:-80,zoom:.8},finger={x:170,y:340},before=gardenScreenToGrid(finger,camera);
  for(const requested of [.01,1.1,100]){
   const zoomed=zoomGardenAt(camera,finger,requested),after=gardenScreenToGrid(finger,zoomed);
   expect(after.x).toBeCloseTo(before.x);expect(after.y).toBeCloseTo(before.y);
   expect(zoomed.zoom).toBeGreaterThanOrEqual(.45);expect(zoomed.zoom).toBeLessThanOrEqual(1.8);
  }
 });
 it('keeps an overscrolled map reachable and centers a map smaller than the viewport',()=>{
  const viewport={width:402,height:874};
  const camera=constrainGardenCamera({x:1e6,y:-1e6,zoom:1},GARDEN_WORLD,viewport);
  expect(camera.x).toBeLessThan(3000);expect(camera.y).toBeGreaterThan(-3000);
  const small=constrainGardenCamera({x:1e6,y:-1e6,zoom:1},{width:1,height:1},viewport);
  expect(gardenGridToScreen({x:.5,y:.5},small)).toEqual({x:201,y:437});
 });
 it('rejects invalid camera/viewport inputs before drawing or picking',()=>{
  expect(()=>gardenScreenToGrid({x:1,y:2},{x:0,y:0,zoom:0})).toThrow(RangeError);
  expect(()=>zoomGardenAt({x:0,y:0,zoom:1},{x:NaN,y:2},1)).toThrow(RangeError);
  expect(()=>constrainGardenCamera({x:0,y:0,zoom:1},GARDEN_WORLD,{width:0,height:100})).toThrow(RangeError);
 });
});

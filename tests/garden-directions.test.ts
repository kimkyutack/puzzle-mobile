import {describe,it,expect} from 'vitest';
import {DECORATIONS,GARDEN_ROTATIONS,nextGardenRotation,createGardenWorld,applyTrustedDecorationGrant,applyGardenCommand,decorationFootprint,gardenGridToScreen,type GardenPlacement,type GardenRotation} from '../packages/garden-world/src';
import {gardenDirectionArt,gardenObjectBounds} from '../apps/client/src/garden-world/direction-art';
import {WORLD_ART} from '../apps/client/src/garden-world/assets';
import {rotatePreviewPlacement} from '../apps/client/src/garden-world/placement-preview';
import {extendGardenPaint} from '../apps/client/src/garden-world/paint';
import {GardenResidents} from '../apps/client/src/garden-world/residents';
const bench=DECORATIONS.find(d=>d.id==='garden-bench')!,grid={tileWidth:96,tileHeight:48},camera={x:250,y:-300,zoom:.68};
function owned(itemId='garden-bench',ids=['bench']){return applyTrustedDecorationGrant(createGardenWorld('garden-owner'),{ownerId:'garden-owner',grantId:'grant-'+ids[0],itemId,variant:'classic',source:'shop',instanceIds:ids});}
describe('four-direction garden decorations',()=>{
 it('offers four directions for rotatable items and keeps the fixed invitation pavilion facing forward',()=>{
  expect(DECORATIONS.filter(item=>item.id!=='garden-starlight-wish-pavilion').every(item=>item.rotations.join(',')==='0,90,180,270')).toBe(true);
  const fixed=DECORATIONS.find(item=>item.id==='garden-starlight-wish-pavilion')!;expect(fixed.rotations).toEqual([0]);expect(gardenDirectionArt(WORLD_ART,fixed.id,'classic',0).art).toBeTruthy();
  expect(()=>decorationFootprint(fixed,90)).toThrow('UNSUPPORTED_ROTATION');
  let direction:GardenRotation=0;const sequence:GardenRotation[]=[direction];for(let i=0;i<4;i++){direction=nextGardenRotation(direction);sequence.push(direction);}expect(sequence).toEqual([0,90,180,270,0]);
 });
 it('uses authored front and rear images with different mirrored companions, including festival styles',()=>{
  const images={'garden-bench':'front','garden-bench:rear':'rear','garden-bench:festival':'pink-front','garden-bench:festival:rear':'pink-rear'};
  expect(GARDEN_ROTATIONS.map(rotation=>gardenDirectionArt(images,bench.id,'classic',rotation))).toEqual([
   {art:'front',assetId:'garden-bench',flipped:false},{art:'front',assetId:'garden-bench',flipped:true},{art:'rear',assetId:'garden-bench:rear',flipped:false},{art:'rear',assetId:'garden-bench:rear',flipped:true}
  ]);
  expect(gardenDirectionArt(images,bench.id,'festival',180).art).toBe('pink-rear');
  expect(()=>gardenDirectionArt({'garden-bench':'front'},bench.id,'classic',180)).toThrow('Missing garden direction art');
 });
 it('loads a distinct reverse sprite for every fixed installation style',()=>{
  for(const item of DECORATIONS.filter(d=>d.layer==='object'&&d.category!=='animal'&&d.rotations.length>1))for(const variant of item.variants){
   const [front,side,rear,reverseSide]=GARDEN_ROTATIONS.map(rotation=>gardenDirectionArt(WORLD_ART,item.id,variant,rotation));
   expect(front!.art).toBeTruthy();
   expect(rear!.art).toBeTruthy();
   expect(rear!.art).not.toBe(front!.art);
   expect(side).toEqual({...front,flipped:!front!.flipped});
   expect(reverseSide).toEqual({...rear,flipped:!rear!.flipped});
  }
 });
 it('persists all four directions and checks the whole perpendicular footprint',()=>{
  let world=owned();
  for(const rotation of GARDEN_ROTATIONS){world=applyGardenCommand(world,{type:world.placements.bench?'move':'place',instanceId:'bench',x:12,y:12,rotation,expectedRevision:world.revision,operationId:'rotate-'+rotation},world.ownerId);expect(JSON.parse(JSON.stringify(world)).placements.bench.rotation).toBe(rotation);expect(decorationFootprint(bench,rotation)).toEqual(rotation===90||rotation===270?{width:1,height:2}:{width:2,height:1});}
  expect(()=>applyGardenCommand(world,{type:'move',instanceId:'bench',x:12,y:12,rotation:45 as GardenRotation,expectedRevision:world.revision,operationId:'non-quarter'},world.ownerId)).toThrow('UNSUPPORTED_ROTATION');
  expect(()=>applyGardenCommand(world,{type:'move',instanceId:'bench',x:12,y:21,rotation:270,expectedRevision:world.revision,operationId:'locked-edge'},world.ownerId)).toThrow('REGION_LOCKED');
 });
 it('shares stable dimensions and anchor geometry between the drawing and preview hit boxes',()=>{
  const placements=GARDEN_ROTATIONS.map(rotation=>({instanceId:'bench',x:12,y:12,rotation} satisfies GardenPlacement)),bounds=placements.map(placed=>gardenObjectBounds(bench,placed,{width:640,height:624},camera,grid));
  expect(bounds[0]).toEqual(bounds[2]);expect(bounds[1]).toEqual(bounds[3]);expect(bounds[0]!.width).toBe(bounds[1]!.width);expect(bounds[0]!.height).toBe(bounds[1]!.height);expect(bounds[1]!.x).not.toBe(bounds[0]!.x);
  for(const [i,box] of bounds.entries()){
   const placed=placements[i]!,at=gardenGridToScreen({x:placed.x+box.foot.width/2,y:placed.y+box.foot.height/2},camera,grid);
   expect(box.x+box.width/2).toBeCloseTo(at.x);
  }
 });
 it('rotates each footprint without sliding sideways or drifting across four turns',()=>{
  for(const item of DECORATIONS.filter(item=>item.rotations.length>1)){
   const initial:GardenPlacement={instanceId:item.id,x:12,y:12,rotation:0};
   const bounds=(placed:GardenPlacement)=>gardenObjectBounds(item,placed,{width:640,height:624},camera,grid);
   const first=bounds(initial);
   let current=initial;
   for(let turn=0;turn<4;turn++){
    current=rotatePreviewPlacement(item,current);
    const box=bounds(current);
    expect(box.x+box.width/2).toBeCloseTo(first.x+first.width/2);
    expect(Math.abs(box.y-first.y)).toBeLessThanOrEqual(grid.tileHeight*camera.zoom/2+1e-8);
   }
   expect(current).toEqual(initial);
  }
 });
 it('stamps repeated objects in the selected direction without overlapping their rotated size',()=>{
  const world=owned('garden-bench',['one','two','three']);const staged=extendGardenPaint(world,bench.id,[],[{x:12,y:12},{x:12,y:13},{x:12,y:14},{x:12,y:15},{x:12,y:16}],270);
  expect(staged.map(p=>[p.x,p.y,p.rotation])).toEqual([[12,12,270],[12,14,270],[12,16,270]]);
 });
 it('starts a placed animal in its selected direction before it chooses its own walking direction',()=>{
  const base=owned('animal-rabbit',['rabbit']);const world=applyGardenCommand(base,{type:'place',instanceId:'rabbit',x:12,y:12,rotation:270,expectedRevision:base.revision,operationId:'rabbit-back'},base.ownerId),simulation=new GardenResidents();simulation.sync(world);
  expect(simulation.actors.find(a=>a.id==='rabbit')).toMatchObject({rear:true,facing:-1,placementRotation:270});
 });
});

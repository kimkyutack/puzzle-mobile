import {describe,it,expect} from 'vitest';
import {DECORATIONS,GARDEN_ROTATIONS,nextGardenRotation,createGardenWorld,applyTrustedDecorationGrant,applyGardenCommand,decorationFootprint,type GardenPlacement,type GardenRotation} from '../packages/garden-world/src';
import {gardenDirectionArt,gardenObjectBounds} from '../apps/client/src/garden-world/direction-art';
import {extendGardenPaint} from '../apps/client/src/garden-world/paint';
import {GardenResidents} from '../apps/client/src/garden-world/residents';
const bench=DECORATIONS.find(d=>d.id==='garden-bench')!,grid={tileWidth:96,tileHeight:48},camera={x:250,y:-300,zoom:.68};
function owned(itemId='garden-bench',ids=['bench']){return applyTrustedDecorationGrant(createGardenWorld('garden-owner'),{ownerId:'garden-owner',grantId:'grant-'+ids[0],itemId,variant:'classic',source:'shop',instanceIds:ids});}
describe('four-direction garden decorations',()=>{
 it('offers four directions for every item and loops back to the first',()=>{
  expect(DECORATIONS.every(item=>item.rotations.join(',')==='0,90,180,270')).toBe(true);
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
 it('persists all four directions and checks the whole perpendicular footprint',()=>{
  let world=owned();
  for(const rotation of GARDEN_ROTATIONS){world=applyGardenCommand(world,{type:world.placements.bench?'move':'place',instanceId:'bench',x:12,y:12,rotation,expectedRevision:world.revision,operationId:'rotate-'+rotation},world.ownerId);expect(JSON.parse(JSON.stringify(world)).placements.bench.rotation).toBe(rotation);expect(decorationFootprint(bench,rotation)).toEqual(rotation===90||rotation===270?{width:1,height:2}:{width:2,height:1});}
  expect(()=>applyGardenCommand(world,{type:'move',instanceId:'bench',x:12,y:12,rotation:45 as GardenRotation,expectedRevision:world.revision,operationId:'non-quarter'},world.ownerId)).toThrow('UNSUPPORTED_ROTATION');
  expect(()=>applyGardenCommand(world,{type:'move',instanceId:'bench',x:12,y:21,rotation:270,expectedRevision:world.revision,operationId:'locked-edge'},world.ownerId)).toThrow('REGION_LOCKED');
 });
 it('shares stable dimensions and anchor geometry between the drawing and preview hit boxes',()=>{
  const placements=GARDEN_ROTATIONS.map(rotation=>({instanceId:'bench',x:12,y:12,rotation} satisfies GardenPlacement)),bounds=placements.map(placed=>gardenObjectBounds(bench,placed,{width:640,height:624},camera,grid));
  expect(bounds[0]).toEqual(bounds[2]);expect(bounds[1]).toEqual(bounds[3]);expect(bounds[0]!.width).toBe(bounds[1]!.width);expect(bounds[0]!.height).toBe(bounds[1]!.height);expect(bounds[1]!.x).not.toBe(bounds[0]!.x);
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

import {describe,expect,it} from 'vitest';
import sharp from 'sharp';
import {flowerShelfGeometry,SHELF_VASE_FOOT,SHELF_VASE_SCALE,shelfVaseY} from '../apps/client/src/flower-shelf-layout';
import {inkBounds} from '../apps/client/src/board-sprite-art';

describe('flower vases standing on a shared two-tier shelf',()=>{
 it('places the actual painted feet of every vase state on both support faces at mobile sizes',async()=>{
  for(let stage=0;stage<3;stage++){
   const{data,info}=await sharp(`packages/assets/obstacle-redesign/runtime/mobile-shelf-vase-${stage}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const foot=inkBounds(data,info.width,info.height)!.bottom/info.height;
   expect(foot).toBe(SHELF_VASE_FOOT);
   for(const cell of [31.9488889,39.7266667,60]){
    const mesh=flowerShelfGeometry(cell*3.98,cell*2,{y:30,height:200});
    for(let row=0;row<2;row++){
     const height=cell*.99*SHELF_VASE_SCALE,center=shelfVaseY((row+.5)*cell,cell,height);
     const paintedFoot=center+(foot-.5)*height,woodSurface=mesh.positions[(row===0?1:3)*4+1]!;
     expect(paintedFoot).toBeCloseTo(woodSurface,4);
    }
    expect(mesh.positions[13]!-mesh.positions[5]!).toBeCloseTo(cell,4);
   }
  }
 });
 it('maps the two standing faces to real painted planks rather than the open shelf bays',async()=>{
  const{data,info}=await sharp('packages/assets/obstacle-redesign/runtime/mobile-rack-frame-0.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const frame={y:30,height:200},mesh=flowerShelfGeometry(160,80,frame);
  for(const row of [1,3]){
   const y=Math.round(frame.y+mesh.uvs[row*4+1]!*frame.height);
   for(const x of [80,112,144,176])expect(data[(y*info.width+x)*4+3],`wood at ${x},${y}`).toBeGreaterThan(240);
  }
  expect([...mesh.uvs].every(n=>n>=0&&n<=1)).toBe(true);
  expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length/2);
 });
});

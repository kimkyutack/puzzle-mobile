import {describe,it,expect} from 'vitest';
import {rasterSlices} from '../apps/client/src/raster-nine-slice';
describe('header raster seams',()=>{
 it('covers each output pixel exactly once at fractional widths and densities',()=>{
  for(const [width,height,density] of [[274.3125,95,1],[228.7,94,1.25],[390,114,2],[556,124,3],[41,22,1.5],[41,100,1]]){
   const frame=rasterSlices(768,256,width!,height!,{left:80,right:80,top:56,bottom:60},.38,density!);
   const coverage=new Uint8Array(frame.width*frame.height);
   for(const slice of frame.slices){
    expect(slice.sw).toBeGreaterThan(0);expect(slice.sh).toBeGreaterThan(0);
    for(let y=slice.dy;y<slice.dy+slice.dh;y++)for(let x=slice.dx;x<slice.dx+slice.dw;x++)coverage[y*frame.width+x]!++;
   }
   expect(coverage.every(value=>value===1)).toBe(true);
  }
 });
});

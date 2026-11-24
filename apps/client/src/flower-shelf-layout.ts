// Calibrated against the authored 256px rack-frame atlas and vase silhouette.
// Keep the wood's standing surfaces one tile apart; stretching the whole rack
// uniformly makes the lower row of vases sink through its front edge.
export const SHELF_VASE_SCALE=.84;
export const SHELF_VASE_FOOT=251/256;
const CONTACT=.86;

export function shelfVaseY(center:number,cell:number,drawnHeight:number){
 return center+(CONTACT-.5)*cell-(SHELF_VASE_FOOT-.5)*drawnHeight;
}

export function flowerShelfGeometry(width:number,height:number,frame:{y:number;height:number}){
 // The first point on each plank is its flat upper face, followed by its lip.
 const source=[frame.y,112,132,190,211,frame.y+frame.height];
 const target=[0,CONTACT/2,.495,(1+CONTACT)/2,.995,1];
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let i=0;i<source.length;i++){
  positions.push(0,target[i]!*height,width,target[i]!*height);
  const v=(source[i]!-frame.y)/frame.height;uvs.push(0,v,1,v);
  if(i<source.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 }
 return {positions:new Float32Array(positions),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)};
}

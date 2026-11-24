import sharp from 'sharp';
const root='packages/assets/home-refinement-v78/runtime';const source=await sharp('packages/assets/home-refinement-v78/source/selected-normalized.png').resize(780,1688).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const alphaFile='packages/assets/home-refinement-v78/runtime/lime-button.webp';
for(const[name,width,height,sourceX,sourceY,sourceHeight]of [['gift-capsule',440,72,118,548,36],['festival-capsule',180,74,331,547,37]]){
 const parts=[];for(const[rect,w,left]of [[{left:0,top:0,width:68,height:144},39,0],[{left:68,top:0,width:250,height:144},width-78,39],[{left:318,top:0,width:68,height:144},39,width-39]])parts.push({input:await sharp(alphaFile).extract(rect).resize(w,height,{fit:'fill'}).png().toBuffer(),left,top:0});
 const {data,info}=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(parts).raw().toBuffer({resolveWithObject:true});
 for(let y=0;y<height;y++){
  const sy=sourceY*2+Math.min(sourceHeight*2-1,Math.floor(y*sourceHeight*2/height));let pixel=[...source.data.subarray((sy*780+sourceX*2)*4,(sy*780+sourceX*2)*4+3)];
  if(name==='festival-capsule'&&y>3&&y<height-6){const bins=new Map();for(let x=596;x<764;x++){const p=(sy*780+x)*4,[r,g,b]=source.data.subarray(p,p+3);if(r<90&&g>70&&b>150){const k=[r>>3,g>>3,b>>3].join(','),a=bins.get(k)||[];a.push([r,g,b]);bins.set(k,a);}}const a=[...bins.values()].sort((a,b)=>b.length-a.length)[0];if(a)pixel=[0,1,2].map(c=>Math.round(a.reduce((n,v)=>n+v[c],0)/a.length));}
  for(let x=0;x<width;x++){const at=(y*width+x)*4;for(let c=0;c<3;c++)data[at+c]=pixel[c];}
 }
 if(name==='festival-capsule'){for(let y=0;y<height;y++){const neighbors=[];for(let j=Math.max(0,y-4);j<=Math.min(height-1,y+4);j++)neighbors.push([...data.subarray(j*width*4,j*width*4+3)]);for(let x=0;x<width;x++)for(let c=0;c<3;c++)data[(y*width+x)*4+c]=Math.round(neighbors.reduce((n,p)=>n+p[c],0)/neighbors.length);}}
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/'+name+'.webp');
}

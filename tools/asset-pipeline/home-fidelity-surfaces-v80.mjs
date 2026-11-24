import fs from 'node:fs/promises';
import sharp from 'sharp';
const root='packages/assets/home-fidelity-v80',source='packages/garden-world/art/home-v78/source/selected-original.png';
await fs.mkdir(root+'/runtime',{recursive:true});await fs.mkdir(root+'/source',{recursive:true});
const src=await sharp(source).resize(780,1688).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const crop=async rect=>sharp(src.data,{raw:{width:780,height:1688,channels:4}}).extract({left:rect[0]*2,top:rect[1]*2,width:rect[2]*2,height:rect[3]*2}).raw().toBuffer({resolveWithObject:true});
const records=[];
for(const[name,rect,left,right,palette]of [['gift-capsule',[7,546,224,38],6,5,'gold'],['festival-capsule',[292,545,94,40],8,5,'blue'],['active-home',[154,751,82,78],14,14,'home']]){
 const {data,info}=await crop(rect),{width:w,height:h}=info;await sharp(data,{raw:info}).png().toFile(root+'/source/'+name+'-original.png');
 for(let y=4;y<h-4;y++){
  const l=(y*w+left*2-1)*4,r=(y*w+w-right*2)*4;
  const sample=(rect[1]*2+y)*780+(palette==='gold'?45:329)*2;
  const color=palette==='home'?undefined:[...src.data.subarray(sample*4,sample*4+3)];
  for(let x=left*2;x<w-right*2;x++){
   const p=(y*w+x)*4,t=(x-left*2)/(w-(left+right)*2-1);
   for(let c=0;c<3;c++)data[p+c]=palette==='home'?Math.round(data[l+c]*(1-t)+data[r+c]*t):color?.[c]??Math.round(data[l+c]*(1-t)+data[r+c]*t);
  }
 }
 if(palette==='home'){
  // Matte only the surrounding ivory. Preserve the original continuous top/bottom rim.
  const bg=[...data.subarray(0,3)],seen=new Uint8Array(w*h),q=[];
  const matches=n=>Math.hypot(...bg.map((c,i)=>data[n*4+i]-c))<24;
  for(let x=0;x<w;x++)for(const y of [0,h-1]){const n=y*w+x;if(matches(n)){seen[n]=1;q.push(n);}}
  for(let y=0;y<h;y++)for(const x of [0,w-1]){const n=y*w+x;if(matches(n)){seen[n]=1;q.push(n);}}
  for(let i=0;i<q.length;i++){const n=q[i],x=n%w,y=Math.floor(n/w);data[n*4+3]=0;for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[k]&&matches(k)){seen[k]=1;q.push(k);}}}
 }
 for(let n=0;n<w*h;n++){const [r,g,b]=data.subarray(n*4,n*4+3);if(g>r+5&&g>b+5)data[n*4+3]=0;}
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');records.push({name,rect,left,right,method:'Original perimeter retained; editable foreground cleared from clean source columns (gold x45, blue x329) or side interpolation.'});
}
for(const[name,rect]of [['festival',[300,551,30,29]],['gift',[13,548,31,33]]]){
 const {data,info}=await crop(rect),{width:w,height:h}=info;await sharp(data,{raw:info}).png().toFile(root+'/source/'+name+'-original.png');
 const seen=new Uint8Array(w*h),q=[];
 const background=(x,y)=>{
  const p=(y*w+x)*4,[r,g,b]=data.subarray(p,p+3);
  if(name==='festival')return b>r+8&&b>=g||r>220&&g>220&&b>220;
  const bg=((rect[1]*2+y)*780+45*2)*4;return Math.hypot(r-src.data[bg],g-src.data[bg+1],b-src.data[bg+2])<24||g>r+15&&g>b;
 };
 for(let y=0;y<h;y++)for(const x of [0,w-1])if(background(x,y)){seen[y*w+x]=1;q.push(y*w+x);}
 for(let x=0;x<w;x++)for(const y of [0,h-1])if(background(x,y)){seen[y*w+x]=1;q.push(y*w+x);}
 for(let j=0;j<q.length;j++){const n=q[j],x=n%w,y=Math.floor(n/w);data[n*4+3]=0;for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[k]&&background(xx,yy)){seen[k]=1;q.push(k);}}}
 const body=await sharp(data,{raw:info}).trim({threshold:1}).png().toBuffer({resolveWithObject:true}),scale=Math.min(120/body.info.width,120/body.info.height),width=Math.round(body.info.width*scale),height=Math.round(body.info.height*scale);
 await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}}).composite([{input:await sharp(body.data).resize(width,height).png().toBuffer(),left:Math.floor((128-width)/2),top:Math.floor((128-height)/2)}]).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');records.push({name,rect,body:[body.info.width,body.info.height],packed:[width,height],method:'Background-connected pixels matted; original icon pixels retained.'});
}
for(const[name,top,height]of [['command-ivory',576,205],['footer-ivory',751,93]]){
 const pixels=Buffer.alloc(8*height*2*4);let prior=[243,234,223];
 for(let y=0;y<height*2;y++){const sy=Math.max(610,Math.min(1687,top*2+y)/2),candidates=[];for(const x of [3,4,5,385,386,387]){const at=(Math.floor(sy*2)*780+x*2)*4,p=[...src.data.subarray(at,at+3)];if(p[0]>210&&p[1]>200&&p[2]>185&&p[0]>=p[1]&&p[1]>=p[2])candidates.push(p);}
  if(candidates.length)prior=[0,1,2].map(c=>Math.round(candidates.reduce((n,p)=>n+p[c],0)/candidates.length));
  for(let x=0;x<8;x++){const at=(y*8+x)*4;for(let c=0;c<3;c++)pixels[at+c]=prior[c];pixels[at+3]=255;}
 }
 await sharp(pixels,{raw:{width:8,height:height*2,channels:4}}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');records.push({name,rect:[3,top,385,height],method:'Clean source backdrop edge samples; no foreground content.'});
}
for(const[name,rect]of [['lime-button',[10,668,193,72]],['coral-button',[208,668,174,72]]]){
 const painted=await sharp(`packages/assets/home-refinement-v78/runtime/${name}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),original=await sharp(`packages/assets/home-refinement-v78/source/${name}-original.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{data,info}=painted;
 for(let y=0;y<info.height;y++){const bg=[0,1,2].map(c=>[3,4,5,385,386,387].reduce((sum,x)=>sum+src.data[((rect[1]*2+y)*780+x*2)*4+c],0)/6);
  for(let x=0;x<info.width;x++){const at=(y*info.width+x)*4,p=[...(data[at+3]?data:original.data).subarray(at,at+3)];
   if(Math.max(...p)-Math.min(...p)>60){data[at+3]=255;continue;}
   const delta=Math.max(...p.map((v,c)=>Math.abs(v-bg[c])));if(delta<2){data[at+3]=0;continue;}
   const alpha=Math.min(1,Math.max(...p.map((v,c)=>v<bg[c]?(bg[c]-v)/bg[c]:(v-bg[c])/(255-bg[c]))));
   for(let c=0;c<3;c++)data[at+c]=Math.max(0,Math.min(255,Math.round((p[c]-(1-alpha)*bg[c])/alpha)));data[at+3]=Math.round(alpha*255);
  }
 }
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');records.push({name,rect,method:'Source face with its original soft shadow decontaminated against the source backdrop.'});
}
await fs.writeFile(root+'/extraction.json',JSON.stringify({source,normalizedPixels:[780,1688],records},null,2)+'\n');

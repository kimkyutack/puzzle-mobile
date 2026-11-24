import fs from 'node:fs/promises';
import sharp from 'sharp';
const input='packages/assets/home-refinement-v78/runtime';
const output='packages/assets/home-header-clean-v1';
await fs.mkdir(output+'/runtime',{recursive:true});
const report=[];
for(const name of ['header-coin','header-heart','header-star']){
 const {data,info}=await sharp(`${input}/${name}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,seen=new Uint8Array(w*h),queue=[];
 const background=i=>{
  const [r,g,b,a]=data.subarray(i*4,i*4+4);
  if(a<8)return true;
  const neutral=r>140&&g>140&&b>110&&Math.max(r,g,b)-Math.min(r,g,b)<55;
  const grass=g>r+10&&g>b+18;
  return neutral||grass;
 };
 const seed=i=>{if(!seen[i]&&background(i)){seen[i]=1;queue.push(i);}};
 for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}
 for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
 for(let j=0;j<queue.length;j++){
  const i=queue[j],x=i%w,y=Math.floor(i/w);
  for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)seed(yy*w+xx);}
 }
 let removed=0;
 for(let i=0;i<seen.length;i++)if(seen[i]&&data[i*4+3]){data[i*4+3]=0;removed++;}
 // Keep the icon component; detached remnants cannot become a new line or dot.
 const visited=new Uint8Array(w*h);let main=[];
 for(let i=0;i<w*h;i++){
  if(visited[i]||data[i*4+3]<8)continue;const group=[i];visited[i]=1;
  for(let j=0;j<group.length;j++){const k=group[j],x=k%w,y=Math.floor(k/w);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k2=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!visited[k2]&&data[k2*4+3]>=8){visited[k2]=1;group.push(k2);}}}
  if(group.length>main.length)main=group;
 }
 const keep=new Set(main);
 for(let i=0;i<w*h;i++)if(!keep.has(i)&&data[i*4+3]){data[i*4+3]=0;removed++;}
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(`${output}/runtime/${name}.webp`);
 report.push({name,width:w,height:h,removedBackgroundPixels:removed,method:'Alpha-only correction of border-connected cream backplate and lawn pixels; retain original RGB, canvas size and icon positions. No trim or resize.'});
}
await fs.writeFile(output+'/report.json',JSON.stringify({input,report},null,2)+'\n');
console.log(JSON.stringify(report));

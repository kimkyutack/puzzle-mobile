import fs from 'node:fs/promises';
import sharp from 'sharp';
const root='packages/assets/home-polish-v82';
const source='packages/garden-world/art/home-v78/source/selected-original.png';
await fs.mkdir(root+'/runtime',{recursive:true});
await fs.mkdir(root+'/source',{recursive:true});
const src=await sharp(source).resize(780,1688).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const color=(x,y)=>[...src.data.subarray((Math.round(y)*780+Math.round(x))*4,(Math.round(y)*780+Math.round(x))*4+3)];
const crop=rect=>sharp(src.data,{raw:{width:780,height:1688,channels:4}}).extract({left:rect[0]*2,top:rect[1]*2,width:rect[2]*2,height:rect[3]*2}).raw().toBuffer({resolveWithObject:true});
const records=[];
// Fill the crest from clean material below the flat rim. A global row palette sampled the
// flat rim at y751 and incorrectly drew a second white stripe inside the rise.
{
 const rect=[0,735,390,109],{data,info}=await crop(rect),w=info.width,h=info.height;
 const prior=JSON.parse(await fs.readFile('packages/assets/home-contours-v81/extraction.json','utf8'));
 const edge=prior.records.find(r=>r.name==='footer-panel').ridgeY;
 const materialX=80*2,materialEdge=735*2+edge[materialX];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const at=(y*w+x)*4,d=y-edge[x];
  if(d < -4){data[at+3]=0;continue;}
  if(d>5){const p=color(materialX,Math.min(1687,Math.max(735*2+y,materialEdge+6)));for(let c=0;c<3;c++)data[at+c]=p[c];}
 }
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/footer-panel.webp');
 for(const[name,left,width]of [['footer-left',0,30],['footer-middle',80,1],['footer-crown',150,90],['footer-right',360,30]])
  await sharp(data,{raw:info}).extract({left:left*2,top:0,width:width*2,height:h}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');
 records.push({name:'footer',rect,materialColumn:80,method:'Retain original rim; interior comes from a clean column below the flat rim, without copying the horizontal rim into the raised center.'});
}
// Extract the complete inner pill, including the left cap. Paint every interior
// pixel from clean blue samples so neither white digits nor their shadows remain.
{
 const rect=[326,563,56,20],{data,info}=await crop(rect),w=info.width,h=info.height;
 await sharp(data,{raw:info}).png().toFile(root+'/source/festival-status-original.png');
 const mask=new Uint8Array(w*h),seen=new Uint8Array(w*h);let body=[];
 for(let y=4;y<h-2;y++)for(let x=0;x<w;x++){
  const at=(y*w+x)*4,[r,g,b]=data.subarray(at,at+3);
  mask[y*w+x]=Number(r<40&&g<113&&b<215&&b>100&&b>g+45);
 }
 for(let k=0;k<w*h;k++){
  if(!mask[k]||seen[k])continue;const q=[k];seen[k]=1;
  for(let n=0;n<q.length;n++){const i=q[n],x=i%w,y=Math.floor(i/w);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&mask[j]&&!seen[j]){seen[j]=1;q.push(j);}}}
  if(q.length>body.length)body=q;
 }
 const left=Array(h).fill(w),right=Array(h).fill(-1),palette=[];
 for(const i of body){const x=i%w,y=Math.floor(i/w);left[y]=Math.min(left[y],x);right[y]=Math.max(right[y],x);}
 for(let y=0;y<h;y++){
  const samples=body.filter(i=>Math.floor(i/w)===y).map(i=>[...data.subarray(i*4,i*4+3)]).sort((a,b)=>a[1]-b[1]);
  palette[y]=samples.length?samples[Math.floor((samples.length-1)*.7)]:null;
 }
 const capRight=right.map((r,y)=>{if(r<0)return -1;const neighbors=right.slice(Math.max(0,y-2),Math.min(h,y+3)).filter(v=>v>=0).sort((a,b)=>a-b);return neighbors[Math.floor(neighbors.length/2)];});
 // The chest hides the left cap, and the lower outer frame contaminates the
 // bottom of the crop. Reflect the clean upper-right contour in both axes.
 const first=capRight.findIndex(r=>r>=0),last=h-3,middle=Math.floor((first+last)/2);
 const limit=Math.max(...capRight.slice(first,Math.max(first+1,middle-2)));
 let priorRight=0;const cleanCap=[];
 for(let y=first;y<=middle;y++){priorRight=Math.max(priorRight,Math.min(limit,capRight[y]));cleanCap[y]=priorRight;}
 for(let y=0;y<h;y++){
  if(y<first||y>last){left[y]=w;right[y]=-1;continue;}
  const yy=y<=middle?y:Math.min(middle,first+last-y),r=cleanCap[yy];
  right[y]=r;left[y]=w-1-r;
 }
 const alpha=Buffer.alloc(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const at=(y*w+x)*4;data[at+3]=0;
  if(x<left[y]||x>right[y])continue;
  alpha[y*w+x]=255;
  const p=palette[y];if(p)for(let c=0;c<3;c++)data[at+c]=p[c];
 }
 const softened=await sharp(alpha,{raw:{width:w,height:h,channels:1}}).blur(.3).greyscale().raw().toBuffer();
 for(let i=0;i<w*h;i++){data[i*4+3]=softened[i];if(!alpha[i]&&softened[i]){const p=palette[Math.floor(i/w)]??[12,90,180];for(let c=0;c<3;c++)data[i*4+c]=p[c];}}
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/festival-status.webp');
 records.push({name:'festival-status',rect,method:'Visible source cap reflected to replace the chest-occluded cap; all interior pixels replaced from clean blue samples, alpha-matted edges, no retained digit shadows.'});
}
await fs.writeFile(root+'/extraction.json',JSON.stringify({source,normalizedPixels:[780,1688],records},null,2)+'\n');

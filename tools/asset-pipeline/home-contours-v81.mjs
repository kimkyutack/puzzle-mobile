import fs from 'node:fs/promises';
import sharp from 'sharp';
const root='packages/assets/home-contours-v81',source='packages/garden-world/art/home-v78/source/selected-original.png';
await fs.mkdir(root+'/runtime',{recursive:true});await fs.mkdir(root+'/source',{recursive:true});
const src=await sharp(source).resize(780,1688).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const pixel=(x,y)=>[...src.data.subarray((Math.round(y)*780+Math.round(x))*4,(Math.round(y)*780+Math.round(x))*4+3)];
const crop=async([x,y,w,h])=>sharp(src.data,{raw:{width:780,height:1688,channels:4}}).extract({left:x*2,top:y*2,width:w*2,height:h*2}).raw().toBuffer({resolveWithObject:true});
const records=[];
function largest(mask,w,h){const seen=new Uint8Array(w*h);let best=[];for(let k=0;k<mask.length;k++){if(!mask[k]||seen[k])continue;const q=[k];seen[k]=1;for(let n=0;n<q.length;n++){const i=q[n],x=i%w,y=Math.floor(i/w);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&mask[j]&&!seen[j]){seen[j]=1;q.push(j);}}}if(q.length>best.length)best=q;}return best;}
for(const[name,rect,kind,sampleX]of [['gift-capsule',[3,540,233,50],'gold',45],['festival-capsule',[290,540,98,50],'blue',329],['rainbow-tail',[222,548,70,36],'cream',257],['gift-stage',[119,552,37,25],'cream',123]]){
 const {data,info}=await crop(rect),{width:w,height:h}=info;await sharp(data,{raw:info}).png().toFile(root+'/source/'+name+'-original.png');
 const mask=new Uint8Array(w*h);
 for(let i=0;i<mask.length;i++){const[r,g,b]=data.subarray(i*4,i*4+3);mask[i]=Number(kind==='gold'?r>210&&g>135&&r-b>85&&g-b>55:kind==='blue'?b>r+50&&b>g+20&&b>110:r>245&&g>228&&b>180&&b<236&&r>=g);}
 const body=largest(mask,w,h),top=Array(w).fill(h),bottom=Array(w).fill(-1);
 for(const i of body){const x=i%w,y=Math.floor(i/w);top[x]=Math.min(top[x],y);bottom[x]=Math.max(bottom[x],y);}
 const filled=new Uint8Array(w*h),alpha=new Uint8Array(w*h);
 for(let x=0;x<w;x++)for(let y=top[x];y<=bottom[x];y++)filled[y*w+x]=1;
 for(let x=0;x<w;x++)for(let y=top[x];y<=bottom[x];y++)for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
  const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h||dx*dx+dy*dy>16)continue;const p=(yy*w+xx)*4,[r,g,b]=data.subarray(p,p+3);if(!filled[yy*w+xx]&&g>r+8&&g>b+5)continue;alpha[yy*w+xx]=255;
 }
 const sx=Math.max(0,Math.min(w-1,(sampleX-rect[0])*2)),t=top[sx],b=bottom[sx];
 const blueRows=[];
 if(kind==='blue')for(let y=0;y<h;y++){
  const samples=[];for(let x=0;x<w;x++){const [r,g,b]=data.subarray((y*w+x)*4,(y*w+x)*4+3);if(filled[y*w+x]&&y>top[x]+4&&y<bottom[x]-4&&r<60&&b>150&&b>g+30)samples.push([r,g,b]);}
  samples.sort((a,b)=>a[1]-b[1]);blueRows.push(samples.length?samples[Math.floor((samples.length-1)*.85)]:null);
 }

 for(let x=0;x<w;x++)for(let y=0;y<h;y++){
  const at=(y*w+x)*4;data[at+3]=alpha[y*w+x];
  const rim=name==='gift-stage'?2:4;if(!filled[y*w+x]||y<top[x]+rim||y>bottom[x]-rim||top[x]===h)continue;
  // Keep the actual perimeter. Warp only the clean material column inside its observed outline.
  const sy=rect[1]*2+t+Math.max(0,Math.min(1,(y-top[x])/(bottom[x]-top[x])))*(b-t),color=kind==='blue'&&blueRows[y]?blueRows[y]:pixel(sampleX*2,sy);
  for(let c=0;c<3;c++)data[at+c]=color[c];
 }
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');
 records.push({name,rect,sampleX,top,bottom,method:'Observed color-component column contour; original perimeter retained. Blue material samples exclude the inset dark timer, gold and cream use a clean source column. No CSS clipping.'});
}
// Preserve the timer's own darker capsule; only the editable white digits are removed.
{
 const rect=[330,565,50,17],{data,info}=await crop(rect),w=info.width,h=info.height;
 await sharp(data,{raw:info}).png().toFile(root+'/source/festival-status-original.png');
 const mask=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,[r,g,b]=data.subarray(i,i+3);if(r>170&&g>180&&b>185)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>3&&xx<w-4&&yy>1&&yy<h-2)mask[yy*w+xx]=1;}}
 for(let y=2;y<h-2;y++){
  const samples=[];for(let x=5;x<w-5;x++){const at=(y*w+x)*4,[r,g,b]=data.subarray(at,at+3);if(!mask[y*w+x]&&r<45&&g<130&&b>100)samples.push([r,g,b]);}
  const color=samples.length?[0,1,2].map(c=>samples.map(p=>p[c]).sort((a,b)=>a-b)[Math.floor(samples.length/2)]):pixel(332*2,rect[1]*2+y);
  for(let x=4;x<w-4;x++)if(mask[y*w+x])for(let c=0;c<3;c++)data[(y*w+x)*4+c]=color[c];
 }
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/festival-status.webp');records.push({name:'festival-status',rect,method:'Original inner timer capsule, white digits locally removed.'});
}
// Locate the reference's light ridge in a narrow search window, then retain its native pixels.
{
 const rect=[0,735,390,109],{data,info}=await crop(rect),w=info.width,h=info.height,edge=[];
 await sharp(data,{raw:info}).png().toFile(root+'/source/footer-original.png');
 const clamp=v=>Math.max(0,Math.min(1,v));
 for(let x=0;x<w;x++){
  const xx=x/2,side=Math.min(xx,389-xx),corner=side<30?17*(1-side/30)**2:0,rise=6*clamp((xx-150)/18)*clamp((240-xx)/18),expected=751+corner-rise;
  let best={score:-Infinity,y:Math.round(expected*2)};
  for(let y=Math.floor((expected-4)*2);y<=Math.ceil((expected+4)*2);y++){
   const p=pixel(x,y),before=pixel(x,y-4),d=p.reduce((n,v,c)=>n+(v-before[c])/3,0);
   if(p[0]<230||p[1]<220||p[2]<205)continue;
   const score=d-Math.abs(y-expected*2)*.08;if(score>best.score)best={score,y};
  }
  edge.push(best.y-rect[1]*2);
 }
 const smooth=edge.map((_,x)=>edge.slice(Math.max(0,x-2),Math.min(w,x+3)).sort((a,b)=>a-b)[Math.floor((Math.min(w,x+3)-Math.max(0,x-2))/2)]);
 for(let y=0;y<h;y++){
  const samples=[];for(let x=0;x<w;x++){const[r,g,b]=pixel(x,rect[1]*2+y);if(r>220&&g>210&&b>195&&r-g>=3&&r-g<25&&r-b>=12&&r-b<40)samples.push([r,g,b]);}
  const color=samples.length?[0,1,2].map(c=>samples.map(p=>p[c]).sort((a,b)=>a-b)[Math.floor(samples.length/2)]):[243,234,223];
  for(let x=0;x<w;x++){const at=(y*w+x)*4;if(y<smooth[x]-4){data[at+3]=0;continue;}if(y>smooth[x]+5)for(let c=0;c<3;c++)data[at+c]=color[c];}
 }
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/footer-panel.webp');
 for(const[name,left,width]of [['footer-left',0,30],['footer-middle',80,1],['footer-crown',150,90],['footer-right',360,30]])await sharp(data,{raw:info}).extract({left:left*2,top:0,width:width*2,height:h}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');
 records.push({name:'footer-panel',rect,ridgeY:smooth,method:'Measured native light-ridge pixels; foreground cleared below the ridge. Separate corner, repeat and crown pieces preserve the center rise.'});
}
// Keep the original two-pixel artwork instead of packing to 128px and resampling it again.
for(const [name,rect] of [['shop',[19,758,49,47]],['friends',[95,755,49,51]],['home-nav',[171,754,51,51]],['guild',[249,756,46,49]],['events',[324,755,48,50]],['unlimited',[285,591,39,39]],['rescue',[331,591,44,40]]]) {
 const {data,info}=await crop(rect),w=info.width,h=info.height,rows=[];
 for(let y=0;y<h;y++){const colors=[0,1,w-2,w-1].map(x=>[...data.subarray((y*w+x)*4,(y*w+x)*4+3)]);rows.push([0,1,2].map(c=>colors.map(p=>p[c]).sort((a,b)=>a-b)[1]));}
 const mask=new Uint8Array(w*h),q=[],bg=(x,y)=>Math.hypot(...rows[y].map((v,c)=>data[(y*w+x)*4+c]-v))<(name==='home-nav'?60:18);
 for(let y=0;y<h;y++)for(const x of [0,w-1])if(bg(x,y)){mask[y*w+x]=1;q.push(y*w+x);}
 for(let x=0;x<w;x++)for(const y of [0,h-1])if(bg(x,y)){mask[y*w+x]=1;q.push(y*w+x);}
 for(let k=0;k<q.length;k++){const n=q[k],x=n%w,y=Math.floor(n/w);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,i=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!mask[i]&&bg(xx,yy)){mask[i]=1;q.push(i);}}}
 for(let i=0;i<mask.length;i++)if(mask[i])data[i*4+3]=0;
 const body=largest(Uint8Array.from({length:w*h},(_,i)=>Number(data[i*4+3]>0)),w,h),keep=new Set(body);
 for(let i=0;i<w*h;i++)if(!keep.has(i))data[i*4+3]=0;
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');
 records.push({name,rect,method:'Original 2x crop and source alpha matting, without intermediate packing or resize.'});
}
await fs.writeFile(root+'/extraction.json',JSON.stringify({source,normalizedPixels:[780,1688],records},null,2)+'\n');

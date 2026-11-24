import sharp from 'sharp';
import fs from 'node:fs/promises';
const root='packages/assets/home-refinement-v78',src='output/verification/home-command-dock/selected-target.png';
await fs.mkdir(root+'/runtime',{recursive:true});await fs.mkdir(root+'/source',{recursive:true});
const original='packages/garden-world/art/home-v78/source/selected-original.png';
const image=await sharp(original).resize(780,1688).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const specs={journal:[17,592,54,44],pass:[80,590,51,44],ranking:[144,591,47,45],missions:[205,587,43,48],unlimited:[285,591,39,39],rescue:[331,591,44,40],shop:[19,758,49,47],friends:[95,755,49,51],home:[227,676,43,49],'home-nav':[171,754,51,51],guild:[249,756,46,49],events:[324,755,48,50],settings:[345,24,38,39],avatar:[12,19,46,49],'header-coin':[60,26,33,35],'header-heart':[159,24,35,37],'header-star':[249,26,34,35],mail:[337,471,41,40],gift:[13,546,31,37],festival:[300,548,34,32],play:[153,689,23,26]};
const meta=[];
for(const[name,rect]of Object.entries(specs)){
 const [left,top,width,height]=rect.map(n=>n*2),{data,info}=await sharp(image.data,{raw:{width:780,height:1688,channels:4}}).extract({left,top,width,height}).raw().toBuffer({resolveWithObject:true});
 await sharp(data,{raw:info}).png().toFile(root+'/source/'+name+'-crop.png');
 const rowBackground=[];for(let y=0;y<height;y++){const colors=[];for(const x of [0,1,width-2,width-1])colors.push([...data.subarray((y*width+x)*4,(y*width+x)*4+3)]);rowBackground.push([0,1,2].map(c=>colors.map(p=>p[c]).sort((a,b)=>a-b)[1]));}
 const mask=new Uint8Array(width*height),queue=[];
 const isBackground=(x,y)=>{const i=(y*width+x)*4,bg=rowBackground[y];return Math.hypot(...bg.map((v,c)=>data[i+c]-v))<(name==='home-nav'?60:18);};
 for(let y=0;y<height;y++)for(const x of [0,width-1])if(isBackground(x,y)){mask[y*width+x]=1;queue.push(y*width+x)}
 for(let x=0;x<width;x++)for(const y of [0,height-1])if(isBackground(x,y)){mask[y*width+x]=1;queue.push(y*width+x)}
 for(let j=0;j<queue.length;j++){const n=queue[j],x=n%width,y=Math.floor(n/width);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*width+xx;if(xx>=0&&xx<width&&yy>=0&&yy<height&&!mask[k]&&isBackground(xx,yy)){mask[k]=1;queue.push(k)}}}
 for(let n=0;n<mask.length;n++)if(mask[n])data[n*4+3]=0;
 const visited=new Uint8Array(width*height);let largest=[];for(let k=0;k<visited.length;k++){if(visited[k]||!data[k*4+3])continue;const group=[k];visited[k]=1;for(let n=0;n<group.length;n++){const v=group[n],x=v%width,y=Math.floor(v/width);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*width+xx;if(xx>=0&&xx<width&&yy>=0&&yy<height&&!visited[j]&&data[j*4+3]){visited[j]=1;group.push(j)}}}if(group.length>largest.length)largest=group;}const foreground=new Set(largest);for(let k=0;k<visited.length;k++)if(!foreground.has(k))data[k*4+3]=0;
 const body=await sharp(data,{raw:info}).trim({threshold:1}).png().toBuffer({resolveWithObject:true}),s=Math.min(120/body.info.width,120/body.info.height),w=Math.round(body.info.width*s),h=Math.round(body.info.height*s);
 await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}}).composite([{input:await sharp(body.data).resize(w,h).png().toBuffer(),left:Math.floor((128-w)/2),top:Math.floor((128-h)/2)}]).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');meta.push({name,rect,body:[body.info.width,body.info.height],packed:[w,h]});
}
// Reuse original cap pixels and clean vertical material strips; no source text or item images are retained.
for(const[name,rect,strip,leftCap,rightCap]of [['lime-button',[10,668,193,72],150,27,28],['coral-button',[208,668,174,72],312,17,14],['active-home',[154,751,82,78],164,14,14]]){
 const [x,y,w,h]=rect,raw=sharp(image.data,{raw:{width:780,height:1688,channels:4}});
 if(name==='lime-button'||name==='coral-button'){
  const {data,info}=await raw.clone().extract({left:x*2,top:y*2,width:w*2,height:h*2}).raw().toBuffer({resolveWithObject:true});
  await sharp(data,{raw:info}).png().toFile(root+'/source/'+name+'-original.png');
  const at=(xx,yy)=>(yy*info.width+xx)*4;
  function bridge(yy,a,b,left,right){const l=at(left,yy),r=at(right,yy);for(let xx=a;xx<=b;xx++){const t=(xx-left)/(right-left),i=at(xx,yy);for(let c=0;c<3;c++)data[i+c]=Math.round(data[l+c]*(1-t)+data[r+c]*t);}}
  if(name==='coral-button')for(let yy=20;yy<112;yy++)bridge(yy,34,124,30,130);
  const left=name==='lime-button'?54:128,right=name==='lime-button'?338:328,top=name==='lime-button'?32:38,bottom=name==='lime-button'?116:108;
  const mask=new Uint8Array(info.width*info.height);
  for(let yy=top;yy<bottom;yy++)for(let xx=left;xx<right;xx++){
   const i=at(xx,yy),[r,g,b]=data.subarray(i,i+3);if(r>180&&g>175&&b>100){for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){const u=xx+dx,v=yy+dy;if(u>1&&u<info.width-2&&v>1&&v<info.height-2)mask[v*info.width+u]=1;}}
  }
  for(let yy=1;yy<info.height-1;yy++)for(let xx=1;xx<info.width-1;xx++){
   if(!mask[yy*info.width+xx])continue;let l=xx-1,r=xx+1;while(l>0&&mask[yy*info.width+l])l--;while(r<info.width-1&&mask[yy*info.width+r])r++;if(l>0&&r<info.width-1)bridge(yy,xx,r-1,l,r);xx=r;
  }
  await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');meta.push({name,rect,kind:'original source surface, foreground removed by local row interpolation'});continue;
 }

 const l=await raw.clone().extract({left:x*2,top:y*2,width:leftCap*2,height:h*2}).png().toBuffer(),r=await raw.clone().extract({left:(x+w-rightCap)*2,top:y*2,width:rightCap*2,height:h*2}).png().toBuffer(),middle=await raw.clone().extract({left:strip*2,top:y*2,width:2,height:h*2}).resize((w-leftCap-rightCap)*2,h*2,{kernel:'nearest',fit:'fill'}).png().toBuffer();
 let fill=middle;
 if(name==='active-home'){const rgba=Buffer.alloc((w-leftCap-rightCap)*2*h*2*4);for(let yy=0;yy<h*2;yy++){const sx=(yy<20||yy>108?184:169)*2,si=((y*2+yy)*780+sx)*4;for(let xx=0;xx<(w-leftCap-rightCap)*2;xx++)image.data.copy(rgba,(yy*(w-leftCap-rightCap)*2+xx)*4,si,si+4);}fill=await sharp(rgba,{raw:{width:(w-leftCap-rightCap)*2,height:h*2,channels:4}}).png().toBuffer();}
 await sharp({create:{width:w*2,height:h*2,channels:4,background:'#00000000'}}).composite([{input:l,left:0,top:0},{input:fill,left:leftCap*2,top:0},{input:r,left:(w-rightCap)*2,top:0}]).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');
 meta.push({name,rect,strip,leftCap,rightCap,kind:'source nine-slice surface'});
}
await fs.writeFile(root+'/extraction.json',JSON.stringify({source:original,normalizedPixels:[780,1688],icons:meta},null,2));

// Matte the source control's cream surroundings while keeping the original colored bevel and shadow.
for(const name of ['lime-button','coral-button','active-home']){
 const file=root+'/runtime/'+name+'.webp',{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});const {width:w,height:h}=info;
 const seed=[],seen=new Uint8Array(w*h),bg=[data[0],data[1],data[2]];const matches=n=>Math.hypot(data[n*4]-bg[0],data[n*4+1]-bg[1],data[n*4+2]-bg[2])<24;
 for(let x=0;x<w;x++)for(const y of [0,h-1]){const n=y*w+x;if(matches(n)){seen[n]=1;seed.push(n);}}for(let y=0;y<h;y++)for(const x of [0,w-1]){const n=y*w+x;if(matches(n)){seen[n]=1;seed.push(n);}}
 for(let i=0;i<seed.length;i++){const n=seed[i],x=n%w,y=Math.floor(n/w);data[n*4+3]=0;for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[k]&&matches(k)){seen[k]=1;seed.push(k)}}}
 await sharp(data,{raw:info}).webp({lossless:true}).toFile(file+'.tmp');await fs.rename(file+'.tmp',file);
}

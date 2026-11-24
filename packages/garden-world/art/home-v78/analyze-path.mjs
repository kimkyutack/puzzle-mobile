import sharp from'sharp';
const {data,info}=await sharp('packages/garden-world/art/home-v78/source/selected-original.png').removeAlpha().raw().toBuffer({resolveWithObject:true}),blur=await sharp('packages/garden-world/art/home-v78/source/selected-original.png').blur(2).removeAlpha().raw().toBuffer();
const bins=new Map();
for(let y=620;y<785;y++)for(let x=490;x<730;x++){
 const i=(y*info.width+x)*3,u=x+2*y;if(u<1900||u>2140)continue;
 const stone=data[i]>175&&data[i+1]>145&&data[i+2]>105;
 if(!bins.has(u))bins.set(u,{count:0,stone:0,r:0,g:0,b:0});const a=bins.get(u);a.count++;if(stone)a.stone++;a.r+=data[i];a.g+=data[i+1];a.b+=data[i+2];
}
console.log('u mask');for(let u=1900;u<=2140;u+=5){const a=bins.get(u);if(a)console.log(u,Math.round(a.stone/a.count*100),[a.r,a.g,a.b].map(n=>Math.round(n/a.count)));}
for(const sign of [1,-1]){
 let best=[];for(let period=25;period<=55;period++){
 const sum=new Float64Array(period),count=new Uint32Array(period);
 for(let y=640;y<760;y++)for(let x=500;x<710;x++){
 const i=(y*info.width+x)*3,u=x+2*y;if(u<1970||u>2035||data[i]<175)continue;
 const phase=((x+sign*2*y)%period+period)%period;sum[phase]+=data[i+1]-blur[i+1];count[phase]++;
 }
 for(let phase=0;phase<period;phase++)if(count[phase]>15)best.push({period,phase,score:sum[phase]/count[phase],count:count[phase]});
 }best.sort((a,b)=>a.score-b.score);console.log(sign,best.slice(0,15));
}

import sharp from 'sharp';
const original='/Users/kimkyutack/.codex/generated_images/01a19a0c-6a0f-7292-88a9-af1911f52d1b/exec-ae916851-2232-471b-8997-69fe65fd0dbe.png';
const {data,info}=await sharp(original).removeAlpha().raw().toBuffer({resolveWithObject:true}),blur=await sharp(original).blur(3).removeAlpha().raw().toBuffer();
const roi={left:245,top:151,right:628,bottom:262};
for(const sign of [1,-1]){
 let best=[];
 for(let period=130;period<=142;period++){
  const sum=new Float64Array(period),count=new Uint32Array(period);
  for(let y=roi.top;y<roi.bottom;y++)for(let x=roi.left;x<roi.right;x++){
   const i=(y*info.width+x)*3;if(data[i+1]<data[i]+20||data[i+1]<data[i+2]+50)continue;
   const phase=((x+sign*2*y)%period+period)%period;sum[phase]+=data[i+1]-blur[i+1];count[phase]++;
  }
  for(let phase=0;phase<period;phase++)best.push({period,phase,score:sum[phase]/count[phase],count:count[phase]});
 }
 best.sort((a,b)=>a.score-b.score);console.log({sign,best:best.slice(0,12)});
}
await sharp(original).extract({left:roi.left,top:roi.top,width:roi.right-roi.left,height:roi.bottom-roi.top}).png().toFile('packages/garden-world/art/home-v78/source/reference-lawn-region.png');

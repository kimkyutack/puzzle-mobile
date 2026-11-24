import sharp from'sharp';
const root='packages/garden-world/art/home-v78/',W=512,H=256,DPR=4,factor=1.008;
for(const TW of [32,64]){
 const TH=TW/2,w=Math.round(TW*DPR*factor),h=Math.round(TH*DPR*factor),grass=await sharp(root+'runtime/ground.webp').resize(w,h).png().toBuffer();
 const layers=[];for(let y=-30;y<=30;y++)for(let x=-30;x<=30;x++){const cx=W*DPR/2+(x-y)*TW*DPR/2,cy=H*DPR/2+(x+y)*TH*DPR/2,left=Math.round(cx-w/2),top=Math.round(cy-h/2);if(left<0||top<0||left+w>W*DPR||top+h>H*DPR)continue;layers.push({input:grass,left,top});}
 const base=await sharp({create:{width:W*DPR,height:H*DPR,channels:4,background:'#89af3d'}}).composite(layers).png().toBuffer();
 const outputs={};
 for(const [name,file]of [['opaque','runtime/path.webp'],['paving','runtime/path-paving.webp']]){
  const tile=await sharp(root+file).resize(w,h).png().toBuffer(),rotatedSource=await sharp(root+file).rotate(90).png().toBuffer(),turned=await sharp(rotatedSource).resize(w,h,{fit:'fill'}).png().toBuffer();
  const stones=[];
  for(let x=-4;x<=4;x++){const cx=W*DPR/2+x*TW*DPR/2,cy=H*DPR/2+x*TH*DPR/2;stones.push({input:tile,left:Math.round(cx-w/2),top:Math.round(cy-h/2)});}
  for(let y=-4;y<=4;y++){const cx=W*DPR/2-y*TW*DPR/2,cy=H*DPR/2+y*TH*DPR/2;stones.push({input:turned,left:Math.round(cx-w/2),top:Math.round(cy-h/2)});}
  const rendered=await sharp(base).composite(stones).png().toBuffer(),mobile=await sharp(rendered).resize(W,H).png().toBuffer();outputs[name]=mobile;
  await sharp(mobile).toFile(root+`verification/path-${name}-cross-${TW}.png`);
  await sharp(mobile).extract({left:192,top:96,width:128,height:64}).resize(640,320,{kernel:'nearest'}).png().toFile(root+`verification/path-${name}-cross-detail-${TW}.png`);
 }
 await sharp({create:{width:W*2,height:H,channels:4,background:'#89af3d'}}).composite([{input:outputs.opaque,left:0,top:0},{input:outputs.paving,left:W,top:0}]).png().toFile(root+`verification/path-overlay-comparison-${TW}.png`);
}

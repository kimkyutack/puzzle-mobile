import sharp from'sharp';import{writeFile}from'node:fs/promises';
const root='packages/garden-world/art/home-v78/',DPR=4,W=512,H=256,TW=64,TH=32,factor=1.008;
const w=Math.round(TW*factor*DPR),h=Math.round(TH*factor*DPR),grass=await sharp(root+'runtime/ground.webp').resize(w,h).png().toBuffer(),path=await sharp(root+'runtime/path.webp').resize(w,h).png().toBuffer();
const layers=[];
for(let y=-20;y<=20;y++)for(let x=-20;x<=20;x++){
const cx=W*DPR/2+(x-y)*TW*DPR/2,cy=H*DPR/2+(x+y)*TH*DPR/2,left=Math.round(cx-w/2),top=Math.round(cy-h/2);
if(left<0||top<0||left+w>W*DPR||top+h>H*DPR)continue;
layers.push({input:grass,left,top});}
const base=await sharp({create:{width:W*DPR,height:H*DPR,channels:4,background:'#89af3d'}}).composite(layers).png().toBuffer();
const stones=[];for(let x=-3;x<=3;x++){const cx=W*DPR/2+x*TW*DPR/2,cy=H*DPR/2+x*TH*DPR/2;stones.push({input:path,left:Math.round(cx-w/2),top:Math.round(cy-h/2)});}
const full=await sharp(base).composite(stones).png().toBuffer();
await sharp(full).resize(W,H).png().toFile(root+'verification/path-repeat-64x32.png');
await sharp(full).resize(W,H).extract({left:176,top:88,width:160,height:80}).resize(640,320,{kernel:'nearest'}).png().toFile(root+'verification/path-detail-64x32.png');
const source=await sharp(root+'source/path-patch.png').resize(592,308,{kernel:'nearest'}).png().toBuffer(),runtime=await sharp(root+'runtime/path.webp').flatten({background:'#89af3d'}).resize(592,296,{kernel:'nearest'}).png().toBuffer();
await sharp({create:{width:1184,height:308,channels:4,background:'#89af3d'}}).composite([{input:source,left:0,top:0},{input:runtime,left:592,top:6}]).png().toFile(root+'verification/path-source-vs-tile.png');
await writeFile(root+'verification/path-repeat.json',JSON.stringify({tileWidth:TW,tileHeight:TH,drawFactor:factor,devicePixelRatio:DPR,source:'Exact original weathered two-row paver strip with grass joins/margins, not a fabricated full pavement diamond.',orientation:'Default source strip runs along world +x axis; rotate with existing path rotation for perpendicular direction.',notes:'Ground and path contain original source pixels only; no procedural paving or AI redraw.'},null,2));

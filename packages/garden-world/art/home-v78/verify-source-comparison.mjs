import sharp from 'sharp';
const root='packages/garden-world/art/home-v78/';
const repeated=await sharp(root+'verification/mobile-after-64x32.png').extract({left:166,top:88,width:180,height:80}).resize(540,240,{kernel:'nearest'}).png().toBuffer();
await sharp({create:{width:1080,height:240,channels:4,background:'#ffffff'}}).composite([{input:root+'source/reference-lawn.png',left:0,top:0},{input:repeated,left:540,top:0}]).png().toFile(root+'verification/source-vs-repeat-64.png');

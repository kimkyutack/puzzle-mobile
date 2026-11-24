import sharp from 'sharp';
import fs from 'node:fs/promises';
const root='packages/assets/shop-shelves-v95';
await fs.mkdir(root+'/runtime',{recursive:true});
await sharp(root+'/source/garden-backdrop.png').resize({width:900}).webp({quality:90}).toFile(root+'/runtime/garden-backdrop.webp');
await sharp(root+'/source/hanging-sign.png').trim({threshold:16}).resize({width:640}).webp({quality:94}).toFile(root+'/runtime/hanging-sign.webp');
await sharp(root+'/source/coin-heading.png').trim({threshold:16}).resize({width:768}).webp({quality:94}).toFile(root+'/runtime/coin-heading.webp');
await sharp(root+'/source/tool-card.png').trim({threshold:16}).resize({width:384}).webp({quality:94}).toFile(root+'/runtime/tool-card.webp');
await sharp(root+'/source/coin-card.png').trim({threshold:16}).resize({width:512}).webp({quality:94}).toFile(root+'/runtime/coin-card.webp');
await sharp(root+'/source/shelf-row.png').resize({width:1098}).webp({quality:94}).toFile(root+'/runtime/shelf-row.webp');
// Use the authored shelf's front board as the category rail. No live text,
// products or illustrated UI screenshots are baked into this image.
await sharp(root+'/runtime/shelf-row.webp').extract({left:0,top:333,width:1098,height:63}).webp({quality:94}).toFile(root+'/runtime/category-rail.webp');
for(const coins of [1000,2500,6000,15000,40000,100000]){
 await sharp(root+'/source/coin-'+coins+'.png').resize({width:512,height:384,fit:'inside'}).webp({quality:93}).toFile(root+'/runtime/coin-'+coins+'.webp');
}
await fs.writeFile(root+'/artwork.json',JSON.stringify({reference:'output/design/shop-shelves-coins-v94/scroll-states.png',tool:'built-in image_gen',coins:[1000,2500,6000,15000,40000,100000],rail:{source:'shelf-row.webp',rect:{left:0,top:333,width:1098,height:63}},purpose:'Shop only; existing footer and modal artwork unchanged.'},null,2)+'\n');

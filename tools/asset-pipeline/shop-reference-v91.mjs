import sharp from 'sharp';
import fs from 'node:fs/promises';
const root='packages/assets/shop-reference-v91';
await fs.mkdir(root+'/runtime',{recursive:true});
await sharp(root+'/source/starter-banner.png').resize({width:1200}).webp({quality:93}).toFile(root+'/runtime/starter-banner.webp');
await sharp(root+'/source/tool-card.png').trim({threshold:20}).resize({width:384}).webp({quality:93}).toFile(root+'/runtime/tool-card.webp');
await sharp(root+'/source/category-tab.png').trim({threshold:20}).resize({width:768}).webp({quality:93}).toFile(root+'/runtime/category-tab.webp');
// Sample the unobstructed right gutter of the selected shop panel. Stretch only
// this background strip, never text, icons or the poster illustration.
const reference='output/design/footer-pages-v90/01-sky-surface.png';
await sharp(reference).extract({left:766,top:16,width:3,height:420}).resize(12,844).webp({lossless:true}).toFile(root+'/runtime/sky-backdrop.webp');
await fs.writeFile(root+'/extraction.json',JSON.stringify({reference,background:{left:766,top:16,width:3,height:420},banner:{source:root+'/source/starter-banner.png',tool:'built-in image_gen',purpose:'Inline shop only. Existing package-modal posters retained.'}},null,2)+'\n');

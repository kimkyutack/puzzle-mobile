import sharp from 'sharp';
import {readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Resize approved raster artwork only. No programmatic mascot, icon, or game illustration is drawn.
const icon='packages/assets/source/app_icon.png';
const background='#1645a0';
const root='android/app/src/main/res';
await writeFile(`${root}/values/ic_launcher_background.xml`,`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${background}</color>\n</resources>\n`);
const densities=[['mdpi',1],['hdpi',1.5],['xhdpi',2],['xxhdpi',3],['xxxhdpi',4]];
for(const [density,scale] of densities){
 for(const name of ['ic_launcher','ic_launcher_round'])await sharp(icon).resize(Math.round(48*scale),Math.round(48*scale)).flatten({background}).png().toFile(`${root}/mipmap-${density}/${name}.png`);
 await sharp(icon).resize(Math.round(108*scale),Math.round(108*scale)).flatten({background}).png().toFile(`${root}/mipmap-${density}/ic_launcher_foreground.png`);
}
await sharp(icon).resize(1024,1024).flatten({background}).png().toFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
async function splash(path){
 const {width,height}=await sharp(path).metadata();
 if(!width||!height)throw new Error(`Invalid launch image: ${path}`);
 const size=Math.round(Math.min(width,height)*.38);
 const mark=await sharp(icon).resize(size,size).flatten({background}).png().toBuffer();
 const bytes=await sharp({create:{width,height,channels:3,background}}).composite([{input:mark,gravity:'centre'}]).png().toBuffer();
 await writeFile(path,bytes);
}
for(const directory of await readdir(root)){
 if(!directory.startsWith('drawable'))continue;
 for(const file of await readdir(join(root,directory)))if(file==='splash.png')await splash(join(root,directory,file));
}
for(const file of await readdir('ios/App/App/Assets.xcassets/Splash.imageset'))if(file.endsWith('.png'))await splash(join('ios/App/App/Assets.xcassets/Splash.imageset',file));
console.log('Installed generated app icon and native launch images for Android and iOS.');

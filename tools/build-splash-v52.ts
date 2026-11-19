import {mkdir,readdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';

const root='packages/assets/splash-v52',portrait=root+'/source/garden-build.png',wide=root+'/source/garden-build-wide.png';
const publicDir='apps/client/public/splash';await mkdir(publicDir,{recursive:true});
await sharp(portrait).resize({width:1200,withoutEnlargement:true}).webp({quality:89,effort:5}).toFile(publicDir+'/garden-build-v52.webp');
await sharp(wide).resize({width:1600,withoutEnlargement:true}).webp({quality:89,effort:5}).toFile(publicDir+'/garden-build-wide-v52.webp');
const report:Array<{path:string;width:number;height:number;source:string}>=[];
for(const [scale,name] of [[1,'splash-2732x2732-2.png'],[2,'splash-2732x2732-1.png'],[3,'splash-2732x2732.png']] as const){
 const path='ios/App/App/Assets.xcassets/Splash.imageset/'+name,width=360*scale,height=640*scale;
 await sharp(portrait).resize(width,height,{fit:'cover',position:'centre'}).png({compressionLevel:9}).toFile(path);report.push({path,width,height,source:portrait});
}
const res='android/app/src/main/res';
for(const name of await readdir(res)){
 if(name!=='drawable'&&!name.startsWith('drawable-port-')&&!name.startsWith('drawable-land-'))continue;
 const path=res+'/'+name+'/splash.png';let width:number|undefined,height:number|undefined;
 try{({width,height}=await sharp(path).metadata())}catch{continue}
 if(!width||!height)throw Error('Missing splash dimensions: '+path);
 const source=width>height?wide:portrait;
 await sharp(source).resize(width,height,{fit:'cover',position:'centre'}).png({compressionLevel:9}).toFile(path);report.push({path,width,height,source});
}
await writeFile(root+'/native-assets.json',JSON.stringify(report,null,2)+'\n');
console.log(`Prepared two web posters and ${report.length} native launch images.`);

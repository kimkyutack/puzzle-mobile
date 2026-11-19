import {parseSync} from 'rolldown/utils';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tsImport} from 'tsx/esm/api';
const {copyMessages:catalog,japaneseCopyMessages:japanese}=await tsImport('../apps/client/src/localized-copy.ts',import.meta.url);
const {messages}=await tsImport('../apps/client/src/i18n.ts',import.meta.url);
const japaneseTyped=new Set(Object.values(messages.ko));
const failures=[],stats={files:0,literalCalls:0,entries:Object.keys(catalog).length};
async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(entry=>entry.isDirectory()?entry.name==='locales'?[]:files(join(dir,entry.name)):/\.tsx?$/.test(entry.name)?[join(dir,entry.name)]:[]))).flat();}
for(const file of await files('apps/client/src')){
 if(/\/(i18n|localized-copy|feature-help)\.ts$/.test(file)||file.endsWith('/garden-world/main.tsx'))continue;
 const source=await readFile(file,'utf8'),ast=parseSync(file,source).program;stats.files++;
 function visit(node,parent){if(!node||typeof node!=='object')return;
  if(node.type==='CallExpression'&&node.callee?.name==='tr'&&node.arguments[0]?.type==='Literal'){
   const key=node.arguments[0].value;stats.literalCalls++;if(!Object.hasOwn(catalog,key)&&!japaneseTyped.has(key))failures.push({file,message:'Missing catalog entry',key});
  }
  if(node.type==='JSXText'&&/[가-힣]/.test(node.value)&&!(parent?.type==='JSXElement'&&((parent.openingElement.name.name==='option')||file.endsWith('/LanguageGate.tsx'))))failures.push({file,message:'Untranslated JSX text',text:node.value.trim()});
  for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(v=>visit(v,node)):visit(value,node);
 }visit(ast,null);
}
const marks=v=>[...v.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
for(const [ko,en]of Object.entries(catalog)){
 for(const [language,translation] of [['en',en],['ja',japanese[ko]]]){
  if(typeof translation!=='string'||/[가-힣]/.test(translation))failures.push({message:'Missing or untranslated catalog entry',language,ko});
  else if(marks(ko)!==marks(translation))failures.push({message:'Placeholder mismatch',language,ko});
 }
}
for(const [key,ko] of Object.entries(messages.ko))for(const language of ['en','ja']){
 const value=messages[language][key];
 if(!value||marks(ko)!==marks(value))failures.push({message:'Typed message placeholder mismatch',language,key});
}
console.log(JSON.stringify({...stats,failures},null,2));if(failures.length)process.exitCode=1;

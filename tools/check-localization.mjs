import {parseSync} from 'rolldown/utils';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const catalog=JSON.parse(await readFile('apps/client/src/locales/catalog.en.json','utf8'));
const failures=[],stats={files:0,literalCalls:0,entries:Object.keys(catalog).length};
async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(entry=>entry.isDirectory()?['locales','garden-world'].includes(entry.name)?[]:files(join(dir,entry.name)):/\.tsx?$/.test(entry.name)?[join(dir,entry.name)]:[]))).flat();}
for(const file of await files('apps/client/src')){
 if(/\/(i18n|localized-copy|feature-help)\.ts$/.test(file))continue;
 const source=await readFile(file,'utf8'),ast=parseSync(file,source).program;stats.files++;
 function visit(node,parent){if(!node||typeof node!=='object')return;
  if(node.type==='CallExpression'&&node.callee?.name==='tr'&&node.arguments[0]?.type==='Literal'){
   const key=node.arguments[0].value;stats.literalCalls++;if(!Object.hasOwn(catalog,key))failures.push({file,message:'Missing catalog entry',key});
  }
  if(node.type==='JSXText'&&/[가-힣]/.test(node.value)&&!(parent?.type==='JSXElement'&&((parent.openingElement.name.name==='option')||file.endsWith('/LanguageGate.tsx'))))failures.push({file,message:'Untranslated JSX text',text:node.value.trim()});
  for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(v=>visit(v,node)):visit(value,node);
 }visit(ast,null);
}
for(const [ko,en]of Object.entries(catalog)){if(/[가-힣]/.test(en))failures.push({message:'Korean in English translation',ko});const marks=v=>[...v.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort().join(',');if(marks(ko)!==marks(en))failures.push({message:'Placeholder mismatch',ko});}
console.log(JSON.stringify({...stats,failures},null,2));if(failures.length)process.exitCode=1;

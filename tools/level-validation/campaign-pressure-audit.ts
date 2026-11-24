/** Offline play and publication audit; never touches player accounts or inventory. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ENGINE_VERSION,type Action,type LevelDefinition} from '@garden/contracts';
import {APPROVED_LEVEL_COUNT} from '@garden/content';
import {createGame,replay,stateHash,validateLevel} from '@garden/core';
import {publishedLevel} from '../../apps/api/src/level-content';
import {prepareRunInitial} from '../../apps/api/src/run-initial';
import {startGiftPowers} from '../../packages/contracts/src/start-gift';
import {unsuppliedTileCells} from '../../packages/content/src/refill-corridors';
import {solve} from './validate';

const root='output/verification/campaign-pressure-v90';
await mkdir(root,{recursive:true});
const baselineFile=resolve(root,'baseline-publisher.ts');
try{await readFile(baselineFile);}catch{
 const file=resolve('apps/api/src/level-content.ts');
 const text=(await readFile(file,'utf8'))
  .replace(/^import \{campaignPressureLevel\}[^\n]*\n/m,'')
  .replace(/^  level=campaignPressureLevel\(level\);\n/m,'')
  .replace(/from '([.][^']+)'/g,(_,p:string)=>`from '${resolve('apps/api/src',p)}'`);
 await writeFile(baselineFile,text);
}
const before=(await import(pathToFileURL(baselineFile).href)).publishedLevel as typeof publishedLevel;
const summary=(l:LevelDefinition)=>({id:l.id,moves:l.moves,difficulty:l.difficulty,strategy:l.strategy?.id,
 obstacles:l.obstacles.length,layers:l.obstacles.reduce((n,o)=>n+o.hp+(o.contents?.hp??0)*o.footprint.length,0),
 frost:Object.values(l.frost??{}).reduce((a,b)=>a+b,0),gates:l.gardenStage?.gates.length??0,version:l.version});

if(process.argv.includes('--scan')){
 const records:unknown[]=[],errors:unknown[]=[],bands:Record<string,{count:number;changed:number;moves:number;layers:number;gates:number}>={};
 for(let id=1;id<=APPROVED_LEVEL_COUNT;id++){
  const base=before(id,ENGINE_VERSION),level=publishedLevel(id,ENGINE_VERSION),issues=validateLevel(level);
  const needsSupply=!level.gardenStage&&!level.gardenPuzzle&&!level.devices?.length;
  const oldSupply=needsSupply?new Set(unsuppliedTileCells(base)):new Set<number>();
  if(needsSupply&&unsuppliedTileCells(level).some(at=>!oldSupply.has(at)))issues.push('NEW_REFILL_HOLE');
  try{createGame(level);}catch(e){issues.push(e instanceof Error?e.message:String(e));}
  if(issues.length)errors.push({id,issues});
  const a=summary(base),b=summary(level),key=id<50?'1-49':id<100?'50-99':String(Math.floor(id/100)*100);
  const band=bands[key]??={count:0,changed:0,moves:0,layers:0,gates:0};
  band.count++;band.changed+=Number(a.version!==b.version);band.moves+=b.moves;band.layers+=b.layers;band.gates+=b.gates;
  records.push({before:a,after:b});
  if(id%2000===0)console.log(`Scanned ${id}/${APPROVED_LEVEL_COUNT}`);
 }
 const report={count:records.length,errors,bands,records};
 await writeFile(`${root}/publication.json`,JSON.stringify(report));
 console.log(JSON.stringify({count:records.length,errors:errors.slice(0,30),errorCount:errors.length}));
 if(errors.length)process.exitCode=1;
}else{
 const arg=process.argv.find(v=>v.startsWith('--levels='));
 const ids=arg?arg.slice(9).split(',').map(Number):[50,51,54,58,60,78,98,107,154,198,254,357,458,554,557,558,812,924,1038,1148,1304,1458,1616,1718,1828,2054,4058,6054,12054,19998];
 const seeds=(process.argv.find(v=>v.startsWith('--seeds='))?.slice(8)??'92347').split(',').map(Number);
 const modes=['bare','streak','powered','stocked'] as const;
 const chosen=process.argv.find(v=>v.startsWith('--modes='))?.slice(8).split(',')??[...modes.slice(0,3)];
 const rows:unknown[]=[];
 for(const id of ids)for(const seed of seeds)for(const mode of modes.filter(v=>chosen.includes(v))){
  for(const revision of process.argv.includes('--after-only')?['after']:['before','after']){
   const template=(revision==='after'?publishedLevel:before)(id,ENGINE_VERSION);
   const powerRainbow=id>=200&&(mode==='powered'||mode==='stocked');
   const purchased=mode==='stocked'?['wind-row','bomb','rainbow'] as const:[];
   const powers=mode==='bare'?[]:startGiftPowers(3);
   const prepared=prepareRunInitial({...template,...(powerRainbow?{powerRainbow:true as const}:{})},[...purchased],true,seed,powers);
   const result=solve(prepared.level,'goal',[],[...purchased]);
   const check=replay(prepared.level,result.actions,[...purchased]);
   if(stateHash(check.state)!==result.hash||!check.accepted)throw Error(`PLAY_REPLAY_MISMATCH:${id}/${mode}`);
   const remaining=check.state.goals.reduce((n,g)=>n+g.remaining,0);
   const row={seed,mode,revision,...summary(template),powerRainbow,gifts:prepared.giftPlacements.length,
    purchased:[...purchased],status:result.status,movesLeft:result.movesLeft,used:result.actions.length,
    remaining,shuffles:result.shuffles,hash:result.hash,actions:result.actions as Action[],level:prepared.level};
   rows.push(row);
   console.log(JSON.stringify({...row,level:undefined,actions:undefined}));
  }
 }
 const name=process.argv.find(v=>v.startsWith('--out='))?.slice(6)??'play';
 await writeFile(`${root}/${name}.json`,JSON.stringify({engineVersion:ENGINE_VERSION,
  disclaimer:'Automated full engine games and deterministic replay, not measured human win rates.',rows}));
}

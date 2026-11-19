import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {ENGINE_VERSION,COLORS,type LevelDefinition,type Action} from '@garden/contracts';
import {createGame,replay,validateLevel,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {progressiveLevel} from '../../packages/content/src/progressive';
import {earlyBalancedLevel} from '../../packages/content/src/early-balance';
import {solve,type Solution} from './validate';
const VERSION='garden-2026.11.09-midgame-v51',root='output/verification/normal-v51';await mkdir(root,{recursive:true});
const oldProofs:Record<string,Solution>=JSON.parse(await readFile('packages/content/src/progressive-proofs.json','utf8'));
const reviews:Array<Record<string,unknown>>=[];
const fingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).update(await readFile('packages/game-core/src/index.ts')).update(JSON.stringify(Array.from({length:31},(_,i)=>earlyBalancedLevel(progressiveLevel(getLevel(70+i,ENGINE_VERSION)))))).digest('hex');
const saved=JSON.parse(await readFile(root+'/midgame-checkpoint.json','utf8').catch(()=>'{}'));
const entries:Record<string,{level:LevelDefinition;proof:Solution}>=saved.fingerprint===fingerprint?saved.entries:{};
if(process.argv.includes('--verify')){
 const maps=JSON.parse(await readFile('packages/content/src/midgame-catalogue-v51.json','utf8')),proofs=JSON.parse(await readFile('packages/content/src/midgame-proofs-v51.json','utf8'));
 for(const [id,level]of Object.entries(maps.levels) as Array<[string,LevelDefinition]>){const proof=proofs[id],result=replay(level,proof.actions);if(validateLevel(level).length||!result.accepted||result.state.status!=='won'||stateHash(result.state)!==proof.hash||result.events.some(e=>e.type==='shuffle'))throw Error('INVALID_CERTIFIED_MAP:'+id);}
 console.log('Verified '+Object.keys(maps.levels).length+' certified midgame maps.');process.exit(0);
}
function candidate(base:LevelDefinition,attempt:number,pressure:number){
 const l=structuredClone(base),w=l.width,h=l.height,beat=l.campaign?.beat,rest=beat==='easy',hard=l.difficulty!=='normal',superHard=l.difficulty==='super',physical=(l.initial??[]).flatMap((tile,at)=>tile?.kind==='seed'?[at]:[]);
 const occupied=new Set(l.obstacles.flatMap(o=>o.footprint));
 for(const o of l.obstacles){
  if(o.kind==='cabinet'&&(o.seeds??0)>0&&o.footprint.some(at=>(l.exits??[]).includes(at))){
   for(const at of o.footprint)occupied.delete(at);let shift=3*w;
   while(shift>w&&o.footprint.some(at=>!l.shape[at-shift]||occupied.has(at-shift)))shift-=w;
   if(o.footprint.some(at=>!l.shape[at-shift]||occupied.has(at-shift)))throw Error('NO_DELIVERY_ROOM');
   o.anchor-=shift;o.footprint=o.footprint.map(at=>at-shift);for(const at of o.footprint)occupied.add(at);
   o.hp=o.maxHp=hard?3:2;
   for(const at of o.footprint){const cell=at+2*w;if(l.shape[cell]&&!occupied.has(cell)){occupied.add(cell);l.obstacles.push({id:'delivery-crate-'+cell,kind:'crate',anchor:cell,footprint:[cell],hp:hard?2:1,maxHp:hard?2:1});}}
   l.strategy={id:'seed-delivery-v51',name:'씨앗 저장고',hint:'보따리는 저장함 안에 있어요. 상자를 열고 아래 길을 비워 출구로 내려보내요.'};
  }else if(o.kind==='pot'){o.hp=o.maxHp=Math.max(o.hp,rest?4:hard?7:6);}
 }
 // A gradual workload by beat. Easy/story rounds remain breathing room.
 for(const goal of l.goals){if(COLORS.includes(goal.kind as typeof COLORS[number])){goal.count=Math.max(goal.count,(rest?28:superHard?70:hard?60:50)+pressure);goal.remaining=goal.count;}}
 if(!rest&&!l.goals.some(g=>COLORS.includes(g.kind as typeof COLORS[number]))&&l.goals.length<4){const color=l.colors[l.id%l.colors.length]!,count=(superHard?70:hard?60:50)+pressure;l.goals.push({kind:color,count,remaining:count});}
 // Recompute actual crate count after adding delivery gates.
 for(const kind of new Set(l.obstacles.map(o=>o.kind))){const count=l.obstacles.filter(o=>o.kind===kind).length,goal=l.goals.find(g=>g.kind===kind);if(goal){goal.count=count;goal.remaining=count;}else l.goals.push({kind,count,remaining:count});}
 if(l.frost&&!rest&&hard){for(const cell of Object.keys(l.frost))if(Number(cell)%3===0)l.frost[Number(cell)]=2;const goal=l.goals.find(g=>g.kind==='frost');if(goal)goal.count=goal.remaining=Object.values(l.frost).reduce((n,hp)=>n+hp,0);}
 if(!rest)l.colors=[...COLORS.slice(0,hard?6:5)];
 l.seed=(base.seed+attempt*104729+510007)>>>0;l.moves=80;l.version=VERSION;delete l.tutorial;delete l.initial;
 // Retain physical seed objectives, while rebuilding ordinary pieces around moved obstacles.
 const temporary={...l,goals:l.goals.filter(g=>g.kind!=='seed')};
 if(l.goals.some(g=>g.kind==='seed')){const g=l.goals.find(g=>g.kind==='seed')!;const emitted=l.obstacles.reduce((n,o)=>n+(o.seeds??0),0);if(emitted)temporary.goals=[...temporary.goals,{...g,count:emitted,remaining:emitted}];}
 const initial=createGame(temporary).cells.map(cell=>cell.tile);
 for(const at of physical)initial[at]={id:10000+at,kind:'seed'};
 l.initial=initial;return l;
}
for(let id=70;id<=100;id++){
 const base=earlyBalancedLevel(progressiveLevel(getLevel(id,ENGINE_VERSION)));if(base.gardenStage){reviews.push({id,kept:'story'});continue;}
 const minimum=base.campaign?.beat==='easy'?7:base.difficulty==='super'?18:base.difficulty==='hard'?14:12;
 const prior=oldProofs['early/'+id],instantDelivery=base.obstacles.some(o=>(o.seeds??0)>0&&o.footprint.some(at=>base.exits?.includes(at)));
 if(base.campaign?.beat==='easy'||!instantDelivery&&prior.actions.length>=minimum){delete entries[id];reviews.push({id,kept:'rest-or-sufficient-workload',proofMoves:prior.actions.length,moves:base.moves});continue;}
 if(entries[id]){reviews.push({id,changed:true,oldProofMoves:prior.actions.length,proofMoves:entries[id]!.proof.actions.length,moves:entries[id]!.level.moves});continue;}
 let accepted:typeof entries[string]|undefined;
 for(let attempt=0;attempt<32&&!accepted;attempt++){
  const level=candidate(base,attempt,Math.floor(attempt/12)*4),errors=validateLevel(level);if(errors.length)throw Error(id+':'+errors.join(','));
  let proof=solve(level);if(proof.status!=='won'||proof.shuffles)proof=solve(level,'special');
  if(proof.status!=='won'||proof.shuffles||proof.actions.length<minimum||proof.actions.length>(base.difficulty==='super'?30:base.difficulty==='hard'?24:20))continue;
  const margin=base.difficulty==='super'?7:base.difficulty==='hard'?7:8;
  level.moves=Math.max(base.difficulty==='normal'?24:28,proof.actions.length+margin);
  level.approved=true;const result=replay(level,proof.actions);if(!result.accepted||result.state.status!=='won')throw Error('PROOF_FAILED');
  accepted={level,proof:{...proof,hash:stateHash(result.state),movesLeft:result.state.moves}};
 }
 if(!accepted)throw Error('UNCERTIFIED_LEVEL:'+id);entries[id]=accepted;
 reviews.push({id,changed:true,oldProofMoves:prior.actions.length,proofMoves:accepted.proof.actions.length,moves:accepted.level.moves});await writeFile(root+'/midgame-checkpoint.json',JSON.stringify({fingerprint,entries}));console.log(id+': '+accepted.proof.actions.length+' moves / '+accepted.level.moves);
}
await writeFile('packages/content/src/midgame-catalogue-v51.json',JSON.stringify({version:VERSION,levels:Object.fromEntries(Object.entries(entries).map(([id,e])=>[id,e.level]))})+'\n');
await writeFile('packages/content/src/midgame-proofs-v51.json',JSON.stringify(Object.fromEntries(Object.entries(entries).map(([id,e])=>[id,e.proof])))+'\n');
await writeFile(root+'/balance-report.json',JSON.stringify({version:VERSION,reviewed:31,changed:Object.keys(entries).length,humanPlaytest:false,reviews},null,2));
console.log('Certified '+Object.keys(entries).length+' maps. Bot proofs are not human win rates.');

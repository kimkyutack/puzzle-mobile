import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getLevel,APPROVED_LEVEL_COUNT,campaignPosition} from '@garden/content';
import {COLORS,ENDPOINT_PIPE_ENGINE_VERSION,type LevelDefinition,type Action} from '@garden/contracts';
import {createGame,findMatches,legalActions,replay,stateHash} from '@garden/core';
import {progressiveCandidate} from '../../packages/content/src/progressive-candidates';
import {PROGRESSIVE_CONTENT_VERSION,progressionLayout,progressionMargin} from '../../packages/content/src/progressive-plan';
import {solve,type Solution} from './validate';

const root='output/verification/progression-v39',verify=process.argv.includes('--verify');
await mkdir(root,{recursive:true});
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const baseline=hash(Array.from({length:300},(_,i)=>getLevel(i+1)));
interface Entry {level:LevelDefinition;proof:Solution}
const saved=await readFile(root+'/checkpoint.json','utf8').then(JSON.parse).catch(()=>({entries:{}})) as {fingerprint?:string;entries:Record<string,Entry>};
const fingerprint=hash([await readFile('tools/level-validation/progressive-build.ts','utf8'),await readFile('packages/content/src/progressive-candidates.ts','utf8'),await readFile('packages/content/src/progressive-plan.ts','utf8'),await readFile('packages/game-core/src/index.ts','utf8'),baseline]);
const entries=saved.fingerprint===fingerprint?saved.entries:{};
const checkpoint=async()=>writeFile(root+'/checkpoint.json',JSON.stringify({fingerprint,entries}));
const early:Record<string,LevelDefinition>={},bank:Record<string,LevelDefinition>={};
const previous=JSON.parse(await readFile('packages/content/src/progressive-catalogue.json','utf8')),previousProofs=JSON.parse(await readFile('packages/content/src/progressive-proofs.json','utf8'));
if(!verify)for(const [id,level]of Object.entries(previous.early) as Array<[string,LevelDefinition]>){const retained=structuredClone(level);retained.version=PROGRESSIVE_CONTENT_VERSION;entries['early/'+id]={level:retained,proof:previousProofs['early/'+id]};}
const certify=(level:LevelDefinition,solution:Solution,margin:number)=>{
 level.moves=Math.max(10,solution.actions.length+margin);level.version=PROGRESSIVE_CONTENT_VERSION;level.approved=true;
 const result=replay(level,solution.actions);if(!result.accepted||result.state.status!=='won'||result.events.some(e=>e.type==='shuffle'))throw Error('PROGRESSION_REPLAY_FAILED');
 return {level,proof:{...solution,hash:stateHash(result.state),movesLeft:result.state.moves}};
};
if(verify){
 const catalogue=JSON.parse(await readFile('packages/content/src/progressive-catalogue.json','utf8'));
 const proofs=JSON.parse(await readFile('packages/content/src/progressive-proofs.json','utf8'));
 for(const [id,level]of Object.entries(catalogue.early))entries['early/'+id]={level:level as LevelDefinition,proof:proofs['early/'+id]};
 for(const [key,level]of Object.entries(catalogue.bank))entries[key]={level:level as LevelDefinition,proof:proofs[key]};
}else{
 for(let id=31;id<=100;id++){
  const source=getLevel(id);if(source.gardenStage)continue;const key='early/'+id;if(entries[key])continue;
  const level=structuredClone(source),beat=level.campaign!.beat;level.moves=80;
  // Keep early silhouettes and colours. Add a modest amount of work after the
  // tutorial segment while reducing the former +7/+10 move surplus.
  for(const goal of level.goals)if(COLORS.some(color=>color===goal.kind)){goal.count=Math.ceil(goal.count*(beat==='easy'?1.05:1.12));goal.remaining=goal.count;}
  if(id>=51&&beat!=='easy')for(const o of level.obstacles)if(o.kind==='crate'){o.hp=Math.min(3,o.hp+1);o.maxHp=o.hp;}
  let solution=solve(level);if(solution.status!=='won'||solution.shuffles)solution=solve(level,'special');
  if(solution.status!=='won'||solution.shuffles)throw Error('UNCERTIFIED_EARLY:'+id);
  entries[key]=certify(level,solution,progressionMargin(id,beat));await checkpoint();console.log(key+': '+solution.actions.length+' moves + '+progressionMargin(id,beat));
 }
 const profiles=new Map<string,ReturnType<typeof progressionLayout>>();
 for(let id=101;id<=APPROVED_LEVEL_COUNT;id++){const p=progressionLayout(id,campaignPosition(id).beat);if(p)profiles.set(p.key,p);}
 for(const [key,p]of profiles){if(entries[key])continue;const profile=p!;let accepted:Entry|undefined;
  for(let attempt=0;attempt<48&&!accepted;attempt++){
   const level=progressiveCandidate(profile.band,profile.challenge,profile.variant,attempt);let solution=solve(level);
   if(solution.status!=='won'||solution.shuffles)solution=solve(level,'special');
   const minimum=profile.challenge==='intro'?2:profile.band===1?4:profile.band===2?6:profile.band===3?8:10;
   if(solution.status!=='won'||solution.shuffles||solution.initialChoices<3||solution.actions.length<minimum)continue;
   const beat=profile.challenge==='intro'?'introduction':profile.challenge as 'normal'|'hard'|'super';
   accepted=certify(level,solution,progressionMargin(profile.band===1?150:profile.band===2?300:profile.band===3?550:900,beat));
   if(profile.challenge==='intro'){const opening=solution.actions.find((a):a is Extract<Action,{type:'swap'}>=>a.type==='swap');if(!opening)continue;accepted.level.tutorial={feature:'crate',text:'상자 옆에서 타일을 맞추면 그 상자 칸이 열려요.',from:opening.from,to:opening.to};}
  }
  if(!accepted)throw Error('UNCERTIFIED_LAYOUT:'+key);
  entries[key]=accepted;await checkpoint();console.log(key+': '+accepted.proof.actions.length+' moves');
 }
}
const proofs:Record<string,Solution>={},checks=[];
for(const [key,entry]of Object.entries(entries)){
 const {level,proof}=entry,state=createGame(level),result=replay(level,proof.actions);
 if(findMatches(state).length||legalActions(state).length<3||!result.accepted||result.state.status!=='won'||stateHash(result.state)!==proof.hash||result.events.some(e=>e.type==='shuffle'))throw Error('INVALID_PROGRESSION_PROOF:'+key);
 if(key.startsWith('early/'))early[key.slice(6)]=level;else bank[key]=level;
 proofs[key]=proof;checks.push({key,actions:proof.actions.length,moves:level.moves,margin:result.state.moves,obstacles:level.obstacles.map(o=>({kind:o.kind,cells:o.footprint.length,hp:o.hp}))});
}
if(hash(Array.from({length:300},(_,i)=>getLevel(i+1)))!==baseline)throw Error('BASELINE_MUTATED');
if(!verify){await writeFile('packages/content/src/progressive-catalogue.json',JSON.stringify({version:PROGRESSIVE_CONTENT_VERSION,early,bank}));await writeFile('packages/content/src/progressive-proofs.json',JSON.stringify(proofs));}
await writeFile(root+'/certification.json',JSON.stringify({version:PROGRESSIVE_CONTENT_VERSION,engine:ENDPOINT_PIPE_ENGINE_VERSION,early:Object.keys(early).length,layouts:Object.keys(bank).length,baselineUnchanged:true,humanPlaytest:false,checks},null,2));
console.log(JSON.stringify({early:Object.keys(early).length,layouts:Object.keys(bank).length,verified:checks.length,baselineUnchanged:true}));

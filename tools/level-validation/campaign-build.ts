import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGame,legalActions,findMatches,replay,stateHash,validateLevel} from '@garden/core';
import {CONTENT_VERSION,ENGINE_VERSION,type LevelDefinition,type Action} from '@garden/contracts';
import {campaignPosition,campaignDifficulty,campaignMoveMargin,MAX_CAMPAIGN_LEVEL,CAMPAIGN_PACK_SIZE} from '../../packages/content/src/campaign';
import {campaignCandidate,AUTHORED_CAMPAIGN_LEVEL} from '../../packages/content/src/campaign-candidates';
import {solve,type Solution} from './validate';

const verify=process.argv.includes('--verify'),toArg=process.argv.find(a=>a.startsWith('--to='));
const currentCount=await readFile('packages/content/src/campaign-recipes.json','utf8').then(text=>(JSON.parse(text) as number[][]).length).catch(error=>{if(error.code==='ENOENT')return 250;throw error;});
const end=toArg?Number(toArg.split('=')[1]):Math.max(250,currentCount);
if(end>AUTHORED_CAMPAIGN_LEVEL){await (await import('./bulk-build')).buildBulk();process.exit(0);}
if(!Number.isInteger(end)||end<200||end>MAX_CAMPAIGN_LEVEL||end%CAMPAIGN_PACK_SIZE)throw new Error('EXPECTED_COMPLETE_50_LEVEL_PACKS');
if(!verify&&end>AUTHORED_CAMPAIGN_LEVEL)throw new Error('CAMPAIGN_PACK_NOT_AUTHORED: Register the next pack before publishing it.');
const levels:LevelDefinition[]=[],proofs:Record<string,Solution>={},rejected:Array<{id:number;attempt:number;reason:string}>=[],fingerprints=new Set<string>();
const fingerprint=(level:LevelDefinition)=>createHash('sha256').update(JSON.stringify([level.shape,level.initial,level.obstacles,level.goals,level.colors,level.frost])).digest('hex');
if(verify){
 levels.push(...JSON.parse(await readFile('packages/content/src/campaign-approved.json','utf8')));
 Object.assign(proofs,JSON.parse(await readFile('packages/content/src/campaign-solutions.json','utf8')));
}else{
 const originals=JSON.parse(await readFile('packages/content/src/legacy-approved-v12.json','utf8')) as LevelDefinition[],oldProofs=JSON.parse(await readFile('packages/content/src/legacy-solutions-v12.json','utf8')) as Record<string,Solution>;
 // Pack expansion is append-only. Rebuilding an existing pack requires an
 // explicit authoring flag and must not be used for a published live release.
 if(!process.argv.includes('--rebuild')){
  const existing=await readFile('packages/content/src/campaign-approved.json','utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return [];throw error;}) as LevelDefinition[];
  if(existing.length>end)throw new Error('CANNOT_SHRINK_PUBLISHED_CAMPAIGN');
  if(existing.length){levels.push(...existing);Object.assign(proofs,JSON.parse(await readFile('packages/content/src/campaign-solutions.json','utf8')));for(const level of levels)fingerprints.add(fingerprint(level));}
 }
 for(let id=levels.length+1;id<=end;id++){
  let accepted=false;
  for(let attempt=0;attempt<(id<=200?1:64);attempt++){
   try{
    const level=id<=200?structuredClone(originals[id-1]!):campaignCandidate(id,attempt),campaign=campaignPosition(id);
    level.engineVersion=ENGINE_VERSION;if(id<=200)level.version=CONTENT_VERSION;level.campaign=campaign;level.difficulty=campaignDifficulty(campaign.beat);
    let solution=id<=200?oldProofs[id]!:solve(level);
    if(id>200&&(solution.status!=='won'||solution.shuffles))solution=solve(level,'special');
    if(solution.status!=='won'||solution.shuffles||solution.initialChoices<3)throw new Error(`UNAPPROVED:${solution.status}:shuffles=${solution.shuffles}`);
    if(id>5)level.moves=Math.min(100,Math.max(12,solution.actions.length+campaignMoveMargin(campaign.beat)));
    const result=replay(level,solution.actions);
    if(!result.accepted||result.state.status!=='won'||result.events.some(e=>e.type==='shuffle'))throw new Error('REPLAY_FAILED');
    if(id>200&&['introduction','practice'].includes(campaign.beat)&&solution.actions.length<2)throw new Error('LESSON_TOO_BRIEF');
    if(level.obstacles.some(o=>o.kind==='carousel')&&!result.events.some(e=>e.type==='mechanic'))throw new Error('CAROUSEL_NOT_EXPERIENCED');
    solution={...solution,hash:stateHash(result.state),movesLeft:result.state.moves};
    const key=fingerprint(level);if(fingerprints.has(key))throw new Error('DUPLICATE_BOARD');fingerprints.add(key);
    level.approved=true;levels.push(level);proofs[id]=solution;accepted=true;break;
   }catch(error){rejected.push({id,attempt,reason:String(error)});}
  }
  if(!accepted)throw new Error(`NO_APPROVED_CAMPAIGN_LEVEL:${id}:${JSON.stringify(rejected.slice(-3))}`);
  if(id%10===0)console.log(`Certified ${id}/${end}`);
 }
}
const checks=[],recipes:number[][]=[];fingerprints.clear();
for(const [index,level]of levels.entries()){
 if(level.id!==index+1||!level.approved||validateLevel(level).length)throw new Error(`CATALOGUE_GAP_OR_INVALID:${level.id}`);
 const state=createGame(level),proof=proofs[level.id];
 if(!proof||!proof.actions.every((a:Action)=>a.type==='swap'||a.type==='tap')||findMatches(state).length||legalActions(state).length<3)throw new Error(`INVALID_OPENING:${level.id}`);
 const result=replay(level,proof.actions);
 if(!result.accepted||result.state.status!=='won'||stateHash(result.state)!==proof.hash||result.events.some(e=>e.type==='shuffle'))throw new Error(`INVALID_PROOF:${level.id}`);
 const key=fingerprint(level);if(fingerprints.has(key))throw new Error(`DUPLICATE_BOARD:${level.id}`);fingerprints.add(key);
 const attempt=level.id<=200?0:(level.seed-17_071-level.id*7919)/104729;
 if(!Number.isInteger(attempt)||attempt<0)throw new Error('INVALID_RECIPE');
 if(level.id>200&&fingerprint(campaignCandidate(level.id,attempt))!==key)throw new Error('RECIPE_MISMATCH:'+level.id);
 recipes.push([attempt,level.moves]);
 checks.push({id:level.id,beat:level.campaign?.beat,actions:proof.actions.length,movesLeft:result.state.moves});
}
await mkdir('output/verification',{recursive:true});
if(verify&&JSON.stringify(JSON.parse(await readFile('packages/content/src/campaign-recipes.json','utf8')))!==JSON.stringify(recipes))throw new Error('RECIPE_CATALOGUE_MISMATCH');
const report={engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION,latestContentVersion:levels.at(-1)?.version,planned:MAX_CAMPAIGN_LEVEL,runtimeRecipeBytes:Buffer.byteLength(JSON.stringify(recipes)),published:levels.length,packs:levels.length/CAMPAIGN_PACK_SIZE,uniqueBoards:fingerprints.size,rejected,checks,humanPlaytest:false,interpretation:'Winning replay proofs establish solvability without purchases. Bot margins are authoring targets, not measured human win rates. Unpublished packs are unavailable rather than recycled.'};
if(!verify){
 await writeFile('packages/content/src/campaign-approved.json',JSON.stringify(levels));
 await writeFile('packages/content/src/campaign-solutions.json',JSON.stringify(proofs));
 await writeFile('packages/content/src/campaign-recipes.json',JSON.stringify(recipes));
}
await writeFile('output/verification/campaign-v20.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rejected:rejected.length,checks:checks.length}));

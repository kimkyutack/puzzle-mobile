import {supportsFlowGravity,type LevelDefinition,type StartBoosterGuide} from '@garden/contracts';

import {campaignDeviceGateCells} from '../../contracts/src/campaign-devices';

const TRIAL_LEVEL = 14;
const CHALLENGE_VERSION = 'start-booster-v1';
type GuidedBooster = StartBoosterGuide['item'];
const earlyChallenges: Readonly<Partial<Record<number,{item:GuidedBooster;moves:number}>>> = {
 34:{item:'bomb',moves:17},
 53:{item:'bomb',moves:17},
 58:{item:'bomb',moves:26},
 64:{item:'wind-row',moves:20},
 74:{item:'bomb',moves:32},
 87:{item:'bomb',moves:26},
 88:{item:'wind-row',moves:27},
 94:{item:'bomb',moves:38}
};

function addTrialCrates(level:LevelDefinition):LevelDefinition{
 const row=level.width*(level.height-2);
 const obstacles=[...level.obstacles,...[5,7].map(column=>{
  const cell=row+column;
  return {id:'trial-crate-'+cell,kind:'crate' as const,anchor:cell,footprint:[cell],hp:1,maxHp:1};
 })];
 const goals=level.goals.map(goal=>goal.kind==='crate'?{...goal,count:4,remaining:4}:goal);
 return {...level,obstacles,goals};
}

function openCrateRow(level:LevelDefinition):LevelDefinition{
 const from=level.width*(level.height-1)+4,to=from-level.width;
 const initial=level.initial?.slice();
 if(initial){
  initial[from]=initial[to]??null;
  initial[to]=null;
 }
 const obstacles=level.obstacles.map(crate=>crate.anchor===from?{...crate,anchor:to,footprint:[to]}:crate);
 return {...level,initial,obstacles};
}

function findBoosterGuide(level:LevelDefinition,requested?:GuidedBooster):StartBoosterGuide|undefined{
 const {width,height,shape}=level;
 const occupied=new Set(level.obstacles.flatMap(obstacle=>obstacle.footprint));
 const reserved=new Set([...(level.exits??[]),...(level.protectedCells??[])]);
 const gates=new Set(level.devices?.flatMap(campaignDeviceGateCells));
 const goals=new Set(level.goals.map(goal=>goal.kind));
 const targets=level.obstacles
  .filter(obstacle=>!gates.has(obstacle.anchor)&&!obstacle.cover&&obstacle.rule!=='shutter-closed'&&obstacle.rule!=='match-shell'&&
   (!obstacle.chapter||!['guard','thaw','fusion'].includes(obstacle.chapter.kind))&&
   obstacle.kind!=='windmill'&&obstacle.kind!=='sun-gate'&&(obstacle.kind==='wind-pod'&&goals.has('windmill')||obstacle.kind==='petal-launcher'&&goals.has('sun-gate')||goals.has(obstacle.kind)||(obstacle.contents&&goals.has(obstacle.contents.kind))||(goals.has('seed')&&(obstacle.seeds??0)>0))&&
   !['pot','bud','curtain'].includes(obstacle.kind)&&!(obstacle.kind==='cabinet'&&obstacle.color))
  .map(obstacle=>obstacle.endOnly?[obstacle.footprint[0]!,obstacle.footprint.at(-1)!]:obstacle.footprint);
 if(goals.has('frost')){
  for(const cell of Object.keys(level.frost??{}).map(Number)){
   if(!occupied.has(cell))targets.push([cell]);
  }
 }
 if(targets.length<3)return;

 let best:{guide:StartBoosterGuide;score:number}|undefined;
 for(let cell=0;cell<shape.length;cell++){
  if(!shape[cell]||occupied.has(cell)||reserved.has(cell)||level.frost?.[cell]||
   (level.initial&&level.initial[cell]?.kind!=='normal'))continue;
  const x=cell%width,y=Math.floor(cell/width);
  for(const item of requested?[requested]:['wind-row','bomb'] as const){
   const hits=targets.filter(cells=>cells.some(target=>{
    const dy=Math.abs(Math.floor(target/width)-y);
    return item==='wind-row'?dy===0:dy<=2&&Math.abs(target%width-x)<=2;
   })).length;
   if(hits<(item==='wind-row'?3:4))continue;
   // Break ties toward the board center and favor a rocket when both hit equally hard.
   const score=hits*100+(item==='wind-row'?10:0)-Math.abs(x-(width-1)/2)-Math.abs(y-(height-1)/2);
   if(!best||score>best.score)best={guide:{item,cell},score};
  }
 }
 return best?.guide;
}

export function startBoosterChallenge(level:LevelDefinition,preserveLayout=false):LevelDefinition{
 if(!supportsFlowGravity(level.engineVersion)||level.tutorial||level.gardenStage||level.startBoosterGuide)return level;
 const trial=level.id===TRIAL_LEVEL;
 const adjustment=earlyChallenges[level.id];
 const laterChallenge=level.id>100&&(level.campaign?.beat==='hard'||level.campaign?.beat==='super');
 if(!trial&&!adjustment&&!laterChallenge)return level;

 const board=preserveLayout?level:trial?addTrialCrates(level):level.id===64||level.id===88?openCrateRow(level):level;
 const preferRocket=laterChallenge&&level.campaign?.beat==='hard';
 const guide=(preferRocket?findBoosterGuide(board,'wind-row'):undefined)??findBoosterGuide(board,trial?'wind-row':adjustment?.item);
 if(!guide)return level;
 return {
  ...board,
  moves:preserveLayout?board.moves:adjustment?.moves??board.moves,
  version:board.version+':'+CHALLENGE_VERSION,
  startBoosterGuide:trial?{...guide,trial:true}:guide
 };
}

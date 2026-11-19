import {supportsCampaignExpansion,supportsRisingCampaign,type Color,type GameEvent,type GameState,type LevelDefinition,type Obstacle} from '@garden/contracts';

const directions=['up','right','down','left'] as const;

export function validateObstacleRule(level:LevelDefinition,obstacle:Obstacle):string[]{
 const {kind,rule,pair,lastHitColor,detonateAt,strikeSide}=obstacle;
 if((pair!==undefined&&rule!=='twin')||(strikeSide!==undefined&&rule!=='directional')||lastHitColor!==undefined||detonateAt!==undefined)return ['OBSTACLE_RULE'];
 if(rule===undefined)return [];
 if(!supportsRisingCampaign(level.engineVersion))return ['OBSTACLE_RULE_ENGINE'];
 if(level.gardenStage||obstacle.cover||obstacle.footprint.length!==1)return ['OBSTACLE_RULE'];
 if(rule==='shutter-open'||rule==='shutter-closed')return kind==='urn'?[]:['OBSTACLE_RULE'];
 if(rule==='regrow')return kind==='urn'&&obstacle.maxHp===2?[]:['OBSTACLE_RULE'];
 if(rule==='match-shell'||rule==='power-shell')return kind==='starlight-lantern'?[]:['OBSTACLE_RULE'];
 if(!supportsCampaignExpansion(level.engineVersion))return ['OBSTACLE_RULE_ENGINE'];
 if(rule==='twin')return kind==='flower-seal'&&obstacle.maxHp===1&&Number.isInteger(pair)&&pair!>0?[]:['OBSTACLE_RULE'];
 if(rule==='pigment'||rule==='fuse')return kind==='urn'&&obstacle.hp===2&&obstacle.maxHp===2?[]:['OBSTACLE_RULE'];
 if(rule==='directional')return kind==='flower-seal'&&directions.includes(strikeSide!)?[]:['OBSTACLE_RULE'];
 return ['OBSTACLE_RULE'];
}

export function validateTwinPairs(obstacles:readonly Obstacle[]):string[]{
 const counts=new Map<number,number>();
 for(const obstacle of obstacles)if(obstacle.rule==='twin')counts.set(obstacle.pair!,1+(counts.get(obstacle.pair!)??0));
 return [...counts.values()].some(count=>count!==2)?['OBSTACLE_PAIR']:[];
}

export function canHitObstacleRule(obstacle:Obstacle,source:string):boolean{
 switch(obstacle.rule){
  case 'shutter-closed': return false;
  case 'match-shell': return source==='match';
  case 'power-shell': return source!=='match';
  case 'twin': return source!=='hammer';
  default: return true;
 }
}

export function matchCanHitRule(state:GameState,obstacle:Obstacle,matched:readonly number[],color:Color|undefined):boolean{
 if(obstacle.rule==='pigment')return obstacle.lastHitColor!==color;
 if(obstacle.rule!=='directional')return true;
 return matched.includes(neighborInDirection(state,obstacle.anchor,obstacle.strikeSide!));
}

function neighborInDirection(state:GameState,at:number,direction:typeof directions[number]):number{
 if(direction==='up')return at-state.width;
 if(direction==='down')return at+state.width;
 if(direction==='left')return at%state.width===0?-1:at-1;
 return at%state.width===state.width-1?-1:at+1;
}

export function updateRuleAfterHit(state:GameState,obstacle:Obstacle,source:string,color:Color|undefined):void {
 if(obstacle.hp<=0)return;
 if(obstacle.rule==='match-shell'||obstacle.rule==='power-shell'){
  obstacle.rule=obstacle.rule==='match-shell'?'power-shell':'match-shell';
 }else if(obstacle.rule==='pigment'&&source==='match'&&color){
  obstacle.lastHitColor=color;
 }else if(obstacle.rule==='fuse'){
  obstacle.detonateAt=state.turn+2;
 }else if(obstacle.rule==='directional'){
  const current=directions.indexOf(obstacle.strikeSide!);
  for(let offset=1;offset<directions.length;offset++){
   const next=directions[(current+offset)%directions.length]!;
   const cell=state.cells[neighborInDirection(state,obstacle.anchor,next)];
   if(cell?.exists&&!cell.obstacleId){obstacle.strikeSide=next;break;}
  }
 }
}

export function advanceObstacleRules(state:GameState,events:GameEvent[]):void{
 const hits=new Set(events.flatMap(event=>event.type==='hit'&&event.obstacleId?[event.obstacleId]:[]));
 for(const obstacle of Object.values(state.obstacles)){
  if(obstacle.rule==='shutter-open')obstacle.rule='shutter-closed';
  else if(obstacle.rule==='shutter-closed')obstacle.rule='shutter-open';
  else if(obstacle.rule==='regrow'&&obstacle.hp<obstacle.maxHp&&!hits.has(obstacle.id))obstacle.hp++;
  else continue;
  events.push({type:'mechanic',kind:'obstacle-rule',cells:[obstacle.anchor],obstacleId:obstacle.id,obstacleAfter:{...obstacle}});
 }
}

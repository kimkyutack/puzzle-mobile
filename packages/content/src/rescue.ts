import {ENGINE_VERSION,CONTENT_VERSION,type LevelDefinition,type Player} from '@garden/contracts';
import legacy from './legacy-approved-v1.json';
export const BRIDGE_EPISODE={id:'bridge-v1',title:'토리의 끊어진 구름다리',unlockLevel:8,scene:'rescue_bridge_scene_v1',plank:'rescue_bridge_plank_v1',stages:3} as const;
export const rescueUnlocked=(player:Pick<Player,'level'>)=>player.level>=BRIDGE_EPISODE.unlockLevel;
/** Independent daily rescue board. Daily item rewards are granted by the server only. */
export function bridgeLevel():LevelDefinition {
 const level=structuredClone(legacy[2]) as LevelDefinition;
 return {...level,id:1000001,version:CONTENT_VERSION,engineVersion:ENGINE_VERSION,moves:18,obstacles:level.obstacles.map((o,i)=>({...o,hp:i+1,maxHp:i+1})),goals:[{kind:'crate',count:3,remaining:3}],tutorial:undefined,protectedCells:undefined,approved:true};
}
export const bridgeStage=(goals:LevelDefinition['goals'])=>Math.max(0,Math.min(3,3-(goals.find(g=>g.kind==='crate')?.remaining??3)));

import {supportsObstacleGarden,type LevelDefinition} from '@garden/contracts';
import {campaignDifficulty,campaignMoveMargin,campaignPosition} from './campaign';
import {OBSTACLE_GARDEN_CONTENT_VERSION,obstacleGardenCandidate,obstacleGardenSlot} from './obstacle-garden';
import catalogue from './obstacle-garden-recipes.json';

const recipes:Readonly<Partial<Record<string,readonly number[]>>>=catalogue.recipes;

export function obstacleGardenLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsObstacleGarden(source.engineVersion)||!source.approved||source.gardenStage)return source;
 const slot=obstacleGardenSlot(source.id);
 if(!slot)return source;
 const recipe=catalogue.version===OBSTACLE_GARDEN_CONTENT_VERSION&&recipes[slot.key];
 if(!recipe)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,moves]=recipe;
 return {...obstacleGardenCandidate(slot.key,seed!),id:source.id,engineVersion:source.engineVersion,approved:true,
  moves:Math.max(source.moves,moves!+campaignMoveMargin(slot.beat)),
  difficulty:campaignDifficulty(slot.beat),campaign:{...campaignPosition(source.id),beat:slot.beat}};
}

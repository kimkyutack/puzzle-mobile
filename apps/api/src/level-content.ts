import {midgameBalancedLevel} from '../../../packages/content/src/midgame-balance';
import {earlyBalancedLevel} from '../../../packages/content/src/early-balance';
import {earlyMidBalancedLevel} from '../../../packages/content/src/early-mid-balance';
import {startBoosterChallenge} from '../../../packages/content/src/start-booster-challenges';
import {z} from 'zod';
import {LEGACY_ENGINE_VERSION,LEVEL_SCHEMA_VERSION,SUPPORTED_ENGINE_VERSIONS,commonEngine,type LevelPreview} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {progressiveLevel,replaceFlowerObstacle} from '../../../packages/content/src/progressive';
import {rotatedCampaignLevel} from '../../../packages/content/src/rotation-catalogue';
import {longCampaignLevel} from '../../../packages/content/src/long-campaign-catalogue';
import {breakableCampaignLevel} from '../../../packages/content/src/breakable-catalogue';
import {chainCampaignLevel} from '../../../packages/content/src/chain-campaign';
import {planterGardenLevel} from '../../../packages/content/src/planter-garden';
import {gardenPuzzleLevel} from '../../../packages/content/src/garden-puzzles';
import {obstacleGardenLevel} from '../../../packages/content/src/obstacle-garden-catalogue';
import {greenhouseLevel} from '../../../packages/content/src/garden-greenhouse-catalogue';
import {workshopLevel} from '../../../packages/content/src/garden-workshop-catalogue';
import {splitWindLevel} from '../../../packages/content/src/split-wind-campaign';
import {removeRedundantCabinetSeeds} from '../../../packages/content/src/seed-cabinet-goals';
import {visibleGoalLevel} from '../../../packages/content/src/visible-goals';
import {obstacleFirstLevel} from '../../../packages/content/src/obstacle-first';
import {risingCampaignLevel} from '../../../packages/content/src/rising-campaign';
import {expandedCampaignLevel} from '../../../packages/content/src/campaign-expansion';
import {applyCampaignChapters} from '../../../packages/content/src/campaign-chapters';
import {layeredCampaignLevel} from '../../../packages/content/src/layered-campaign';
import {withRefillCorridors} from '../../../packages/content/src/refill-corridors';
import {digest,ensure,HttpError,readPlayer,type ApiEnv} from './db';

const version=z.string().min(1).max(32);
const capabilities=z.object({engineVersion:version.optional(),supportedEngineVersions:z.array(version).min(1).max(32).optional(),levelHash:z.string().regex(/^[a-f0-9]{64}$/).optional()});
export function engineRequest(body:Record<string,unknown>){
 const input=capabilities.parse(body),supported=input.supportedEngineVersions;
 const requested=input.engineVersion??LEGACY_ENGINE_VERSION;
 const engineVersion=supported
  ?(input.engineVersion&&supported.includes(requested)&&SUPPORTED_ENGINE_VERSIONS.some(v=>v===requested)?requested:commonEngine(supported))
  :commonEngine([requested]);
 ensure(engineVersion,'UPDATE_REQUIRED','지원하는 퍼즐 규칙이 없어요. 앱을 업데이트해 주세요.',409);
 const compatible=supported?SUPPORTED_ENGINE_VERSIONS.filter(v=>supported.includes(v)):SUPPORTED_ENGINE_VERSIONS.slice(SUPPORTED_ENGINE_VERSIONS.findIndex(v=>v===engineVersion));
 return {...input,engineVersion,supportedEngineVersions:compatible};
}
export function publishedLevel(id:number,engineVersion:string){
 let level;
 try{
  const board=progressiveLevel(getLevel(id,engineVersion));
  level=startBoosterChallenge(replaceFlowerObstacle(earlyMidBalancedLevel(midgameBalancedLevel(earlyBalancedLevel(board)))));
  const rotated=longCampaignLevel(rotatedCampaignLevel(level));
  const withBreakables=breakableCampaignLevel(rotated);
  const published=chainCampaignLevel(obstacleGardenLevel(greenhouseLevel(workshopLevel(withBreakables))));
  const gardenBoard=gardenPuzzleLevel(planterGardenLevel(splitWindLevel(published)));
  const finalBoard=applyCampaignChapters(expandedCampaignLevel(risingCampaignLevel(gardenBoard)));
  if(finalBoard!==level)level=finalBoard.gardenPuzzle?finalBoard:startBoosterChallenge(finalBoard);
  const prepared=obstacleFirstLevel(visibleGoalLevel(removeRedundantCabinetSeeds(level)));
  level=layeredCampaignLevel(prepared);
  if(level!==prepared)level=startBoosterChallenge(level,true);
  level=withRefillCorridors(level);
 }catch(error){
  if(error instanceof Error&&error.message==='LEVEL_CONTENT_PENDING')throw new HttpError('CONTENT_NOT_READY','새 퍼즐을 준비 중이에요. 잠시 후 다시 확인해 주세요.',503);
  if(error instanceof Error&&error.message==='INVALID_LEVEL_ID')throw new HttpError('CAMPAIGN_COMPLETE','모든 퍼즐을 완료했어요!',409);
  if(error instanceof Error&&error.message==='LEVEL_ENGINE_REQUIRED')throw new HttpError('CONTENT_NOT_READY','이 규칙의 퍼즐을 준비 중이에요. 잠시 후 다시 확인해 주세요.',503);
  throw error;
 }
 ensure(level.approved,'CONTENT_NOT_READY','검증된 퍼즐을 준비 중이에요. 잠시 후 다시 시도해 주세요.',503);
 ensure(level.engineVersion===engineVersion,'UPDATE_REQUIRED','이 퍼즐의 규칙을 지원하는 앱으로 시작해 주세요.',409);
 return level;
}
/** Read-only: maps are data, and do not create a run or consume resources. */
export async function nextLevel(env:ApiEnv,userId:string,requested:string|null,levelId:string|null=null):Promise<LevelPreview>{
 const player=await readPlayer(env.DB,userId),{engineVersion}=engineRequest({...(requested?{engineVersion:requested}:{})});
 const id=levelId===null?player.level:z.coerce.number().int().min(1).parse(levelId);
 ensure(id===player.level||id===player.level+1,'LEVEL_PREVIEW_LOCKED','다음 퍼즐까지만 미리 볼 수 있어요.',409);
 const level=publishedLevel(id,engineVersion);
 return {schemaVersion:LEVEL_SCHEMA_VERSION,contentVersion:level.version,level,levelHash:await digest(JSON.stringify(level))};
}

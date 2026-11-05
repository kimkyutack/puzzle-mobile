import {z} from 'zod';
import type {GardenStyle,StoryState,Player} from '@garden/contracts';
import {BRIDGE_EPISODE,RESTORATIONS,STORY_SCENES,STORY_VERSION,getUnlockedStories,bridgeDailyWindow,rescueUnlocked} from '@garden/content';
import {ensure,readPlayer,sql,type ApiEnv} from './db';

const seenInput=z.object({sceneIds:z.array(z.string().min(1).max(80)).min(1).max(19)}).strict();
const styleInput=z.object({taskId:z.string().min(1).max(80),style:z.enum(['classic','festival'])}).strict();
const isStyleTask=(id:string)=>RESTORATIONS.some(task=>task.id===id&&['planter','bench','lamp'].includes(task.asset));

/** Read-only projection: legacy restored work unlocks scenes without rewriting Player. */
export async function state(env:ApiEnv,userId:string):Promise<StoryState>{
 return stateForPlayer(env,await readPlayer(env.DB,userId));
}
async function stateForPlayer(env:ApiEnv,player:Player):Promise<StoryState>{
 const userId=player.id,unlocked=getUnlockedStories(player),available=new Set(unlocked);
 const daily=bridgeDailyWindow(Date.now());
 type StoryRow={scene_id:string}|{task_id:string;style:GardenStyle}|{claimed:number};
 const results=await env.DB.batch<StoryRow>([
  sql(env.DB,'SELECT scene_id FROM story_seen WHERE user_id=?',userId),
  sql(env.DB,'SELECT task_id,style FROM garden_styles WHERE user_id=?',userId),
  ...(rescueUnlocked(player)?[sql(env.DB,"SELECT 1 claimed FROM reward_claims WHERE user_id=? AND kind='rescue-daily' AND source_id=?",userId,daily.periodId)]:[])
 ]);
 const seen=new Set(results[0]!.results.flatMap(row=>'scene_id' in row?[row.scene_id]:[]));
 const styles=Object.fromEntries(results[1]!.results.flatMap(row=>'task_id' in row&&isStyleTask(row.task_id)&&player.restored.includes(row.task_id)?[[row.task_id,row.style]]:[]));
 return {...(seen.has('rescue:'+BRIDGE_EPISODE.id)?{completedEpisodes:[BRIDGE_EPISODE.id]}:{}),...(rescueUnlocked(player)?{dailyRescue:{...daily,claimed:!!results[2]?.results.length}}:{}),contentVersion:STORY_VERSION,unlocked,seen:STORY_SCENES.filter(scene=>available.has(scene.id)&&seen.has(scene.id)).map(scene=>scene.id),styles};
}

/** One row per scene makes concurrent acknowledgements a union, including retries. */
export async function acknowledge(env:ApiEnv,userId:string,body:Record<string,unknown>):Promise<StoryState>{
 const {sceneIds}=seenInput.parse(body),player=await readPlayer(env.DB,userId),unlocked=new Set(getUnlockedStories(player)),known=new Set(STORY_SCENES.map(scene=>scene.id));
 for(const id of sceneIds){ensure(known.has(id),'STORY_NOT_FOUND','이야기를 찾을 수 없어요.',404);ensure(unlocked.has(id),'STORY_LOCKED','정원을 가꾸면 이야기가 열려요.',409);}
 const now=Date.now();
 await env.DB.batch([...new Set(sceneIds)].map(id=>sql(env.DB,'INSERT INTO story_seen(user_id,scene_id,seen_at) SELECT id,?,? FROM players WHERE id=? AND deleted_at IS NULL ON CONFLICT(user_id,scene_id) DO NOTHING',id,now,userId)));
 return stateForPlayer(env,player);
}

/** Cosmetic choice has no currency cost and is available only for completed slots. */
export async function chooseStyle(env:ApiEnv,userId:string,body:Record<string,unknown>):Promise<StoryState>{
 const {taskId,style}=styleInput.parse(body),player=await readPlayer(env.DB,userId);
 ensure(isStyleTask(taskId),'INVALID_DECORATION','모습을 바꿀 수 있는 장식이 아니에요.');
 ensure(player.restored.includes(taskId),'RESTORATION_REQUIRED','먼저 이 장식을 복원해 주세요.',409);
 await sql(env.DB,"INSERT INTO garden_styles(user_id,task_id,style,updated_at) SELECT id,?,?,? FROM players WHERE id=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(data,'$.restored') WHERE value=?) ON CONFLICT(user_id,task_id) DO UPDATE SET style=excluded.style,updated_at=excluded.updated_at",taskId,style,Date.now(),userId,taskId).run();
 return state(env,userId);
}

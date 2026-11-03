import {z} from 'zod';
import {replay} from '@garden/core';
import {BRIDGE_EPISODE,bridgeLevel,rescueUnlocked} from '@garden/content';
import {actionSchema} from './validation';
import {ensure,readPlayer,sql,type ApiEnv} from './db';
import {state} from './story';
const input=z.object({actions:z.array(actionSchema.refine(action=>action.type==='swap'||action.type==='tap')).min(1).max(80)}).strict();
/** Completion is proven by replay. No Player write, heart, inventory, rank or reward mutation. */
export async function completeBridge(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const player=await readPlayer(env.DB,userId);ensure(rescueUnlocked(player),'EPISODE_LOCKED','7판을 완료하면 구름길 구조대가 열려요.',409);
 const {actions}=input.parse(body),result=replay(bridgeLevel(),actions);
 ensure(result.accepted&&result.state.status==='won','EPISODE_NOT_COMPLETE','다리를 완성한 기록을 확인할 수 없어요.',409);
 await sql(env.DB,'INSERT INTO story_seen(user_id,scene_id,seen_at) SELECT id,?,? FROM players WHERE id=? ON CONFLICT(user_id,scene_id) DO NOTHING','rescue:'+BRIDGE_EPISODE.id,Date.now(),userId).run();
 return state(env,userId);
}

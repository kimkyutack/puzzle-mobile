import type {RankingEntry,RankingsResponse,RankingScope} from '@garden/contracts';
import {z} from 'zod';
import {ensure,one,rows,type ApiEnv} from './db';

interface RankedRow {id:string;name:string;score:number;rank:number;position:number;ties:number;participants:number;emblem:number|null;members:number|null}
const LIMIT=50;
export async function rankings(env:ApiEnv,userId:string,rawScope:string):Promise<RankingsResponse>{
 const scope:RankingScope=z.enum(['players','guilds','friends']).parse(rawScope);
 const player=await one<{name:string;guild_id:string|null}>(env.DB,"SELECT json_extract(data,'$.nickname') name,guild_id FROM players WHERE id=? AND deleted_at IS NULL",userId);
 ensure(player,'ACCOUNT_NOT_FOUND','계정을 찾을 수 없습니다.',401);
 const myId=scope!=='guilds'?userId:player.guild_id;
 const source=scope==='friends'
  ? `SELECT p.id,json_extract(p.data,'$.nickname') name,COALESCE(s.highest_level,0) score,COALESCE(s.achieved_at,p.created_at) reached,NULL emblem,NULL members
     FROM players p LEFT JOIN ranking_scores s ON s.user_id=p.id WHERE p.deleted_at IS NULL AND (p.id=? OR EXISTS(
      SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.user_low=? AND f.user_high=p.id) OR (f.user_high=? AND f.user_low=p.id))))
     AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.id) OR (b.user_id=p.id AND b.blocked_id=?))`
  : scope==='players'
  ? `SELECT s.user_id id,json_extract(p.data,'$.nickname') name,s.highest_level score,s.achieved_at reached,NULL emblem,NULL members
     FROM ranking_scores s JOIN players p ON p.id=s.user_id WHERE p.deleted_at IS NULL`
  : `SELECT g.id,g.name,SUM(COALESCE(s.highest_level,0)) score,MAX(MAX(COALESCE(s.achieved_at,0),m.joined_at)) reached,g.emblem,COUNT(*) members
     FROM guilds g JOIN guild_members m ON m.guild_id=g.id JOIN players p ON p.id=m.user_id AND p.deleted_at IS NULL
     LEFT JOIN ranking_scores s ON s.user_id=m.user_id GROUP BY g.id HAVING score>0`;
 // Rank is shared for equal scores; position only stabilizes the top-50 display.
 // A single query computes both the top rows and the caller's rank from one snapshot.
 const limit=scope==='friends'?201:LIMIT;
 const data=await rows<RankedRow>(env.DB,`WITH scores AS (${source}), ranked AS (
  SELECT *,RANK() OVER(ORDER BY score DESC) rank,ROW_NUMBER() OVER(ORDER BY score DESC,reached,id) position,
   COUNT(*) OVER(PARTITION BY score) ties,COUNT(*) OVER() participants FROM scores
 ) SELECT * FROM ranked WHERE position<=? OR id=? ORDER BY position`,...(scope==='friends'?[userId,userId,userId,userId,userId]:[]),limit,myId);
 const entry=(row:RankedRow):RankingEntry=>({id:row.id,name:row.name,rank:row.rank,position:row.position,score:row.score,tied:row.ties>1,isMine:row.id===myId,...(row.emblem===null?{}:{emblem:row.emblem}),...(row.members===null?{}:{members:row.members})});
 let me:RankingEntry|null=data.find(row=>row.id===myId)?entry(data.find(row=>row.id===myId)!):null;
 if(!me&&scope!=='guilds')me={id:userId,name:player.name,rank:null,position:null,score:0,tied:false,isMine:true};
 if(!me&&scope==='guilds'&&myId){const guild=await one<{name:string;emblem:number;members:number}>(env.DB,'SELECT g.name,g.emblem,COUNT(m.user_id) members FROM guilds g LEFT JOIN guild_members m ON m.guild_id=g.id WHERE g.id=? GROUP BY g.id',myId);if(guild)me={id:myId,name:guild.name,emblem:guild.emblem,members:guild.members,rank:null,position:null,score:0,tied:false,isMine:true};}
 return {scope,metric:scope!=='guilds'?'highest_clear':'member_highest_sum',entries:data.filter(row=>row.position<=limit).map(entry),me,participants:data[0]?.participants??0,limit,updatedAt:Date.now()};
}

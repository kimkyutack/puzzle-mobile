import {siegeCanHit,siegePriority} from './garden-siege';
import type {GameState,Obstacle} from '@garden/contracts';
import {canHitPuzzleObstacle} from './garden-puzzles';
import {canHitObstacleRule} from './obstacle-rules';
import {chapterCanTarget} from './chapter-obstacles';

/** Color-charge obstacles keep their normal color requirement. Bees cannot bypass it. */
const hittable=(s:GameState,o:Obstacle)=>o.hp>0&&!o.cover&&siegeCanHit(o)&&canHitObstacleRule(o,'bee-flight')&&!['pot','bud','curtain','windmill','sun-gate'].includes(o.kind)&&!(o.kind==='cabinet'&&o.color)&&(!s.gardenPuzzle||canHitPuzzleObstacle(s,o,'bee-flight'));
export interface BeeFocus {obstacleId?:string}
/** Keep attacking the same instance, including pipes whose anchor changes after each hit. */
export function beeObstacle(state:GameState,focus:BeeFocus,excluded?:ReadonlySet<string>,fusion=false):number|undefined{
 const previous=focus.obstacleId?state.obstacles[focus.obstacleId]:undefined;
 if(previous&&!excluded?.has(previous.id)&&chapterCanTarget(state,previous,fusion)&&hittable(state,previous))return previous.anchor;
 const goals=new Set(state.goals.filter(goal=>goal.remaining>0).map(goal=>goal.kind));
 const needed=(o:Obstacle)=>siegePriority(state,o)||(goals.has(o.kind)||(o.contents&&goals.has(o.contents.kind))?1:0);
 const next=Object.values(state.obstacles).filter(o=>!excluded?.has(o.id)&&chapterCanTarget(state,o,fusion)&&hittable(state,o)).sort((a,b)=>needed(b)-needed(a)||b.hp-a.hp||a.anchor-b.anchor||(a.id<b.id?-1:a.id>b.id?1:0))[0];
 focus.obstacleId=next?.id;return next?.anchor;
}

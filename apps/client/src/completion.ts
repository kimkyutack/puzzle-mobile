import {levelClearCoins,type Run} from '@garden/contracts';

/** Local victory is presentable; only a server-closed run can spend its reward. */
export function needsFinish(run:Run|null|undefined):boolean{return !!run&&run.state.status==='won'&&run.status==='active'&&!run.reward;}
export function completionReward(run:Run):NonNullable<Run['reward']>{
 if(run.reward)return run.reward;
 return needsFinish(run)?{coins:levelClearCoins(run.level),stars:1}:{coins:0,stars:0};
}

/** Previewing the next map grants no progress or currency. Actual start still waits for commit. */
export function nextPreviewLevel(playerLevel:number,run:Run|null|undefined){return run?.state.status==='won'?Math.max(playerLevel,run.level.id+1):playerLevel;}

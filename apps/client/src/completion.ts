import type {Run} from '@garden/contracts';

/** Local victory is presentable; only a server-closed run can spend its reward. */
export function needsFinish(run:Run|null|undefined):boolean{return !!run&&run.state.status==='won'&&run.status==='active'&&!run.reward;}
export function completionReward(run:Run):NonNullable<Run['reward']>{
 if(run.reward)return run.reward;
 return needsFinish(run)?{coins:run.level.difficulty==='super'?100:run.level.difficulty==='hard'?75:50,stars:1}:{coins:0,stars:0};
}

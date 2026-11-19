import type {ActivityReward,HiddenPowerMissionState,PowerUseKind} from '@garden/contracts';

export const HIDDEN_MISSION_DURATION=8*60*60*1000;
const MILESTONES:Readonly<Partial<Record<number,PowerUseKind>>>={
 16:'glider',39:'bomb',67:'rocket',97:'rainbow',
};
const TARGETS:Readonly<Record<PowerUseKind,readonly number[]>>={
 glider:[5,8,12],bomb:[4,6,10],rocket:[6,10,14],rainbow:[2,3,5],
};
const REWARDS:readonly ActivityReward[]=[
 {coins:50,items:{'wind-row':1}},
 {coins:100,items:{hammer:1}},
 {coins:200,items:{rainbow:1}},
];

export function hiddenMissionKind(clearedLevel:number){
 return MILESTONES[clearedLevel%100];
}

export function hiddenMissionLimit(kind:PowerUseKind){
 return TARGETS[kind].reduce((total,target)=>total+target,0);
}

export function hiddenMissionStage(mission:HiddenPowerMissionState){
 const index=mission.claimedStages;
 const targets=TARGETS[mission.kind],target=targets[index],reward=REWARDS[index];
 if(target===undefined||!reward)return undefined;
 const previous=targets.slice(0,index).reduce((total,goal)=>total+goal,0);
 const progress=Math.min(target,Math.max(0,mission.uses-previous));
 return {number:index+1,total:targets.length,target,progress,reward,ready:progress===target};
}


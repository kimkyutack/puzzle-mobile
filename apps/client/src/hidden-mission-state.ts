import type {HiddenPowerMissionState,Run} from '@garden/contracts';
import {hiddenMissionStage} from '../../../packages/content/src/hidden-power-missions';

type PowerRun=Pick<Run,'id'|'powerUses'>;

export function visibleHiddenMission(mission:HiddenPowerMissionState|undefined,now:number){
 if(!mission)return;
 const stage=hiddenMissionStage(mission);
 if(stage&&(stage.ready||mission.endsAt===undefined||mission.endsAt>now))return mission;
}

export function hiddenMissionAnnouncement(mission:HiddenPowerMissionState|undefined,now:number){
 const visible=visibleHiddenMission(mission,now);
 if(!visible)return;
 if(visible.endsAt===undefined)return `found:${visible.milestone}`;
 const stage=hiddenMissionStage(visible);
 if(stage?.ready)return `reward:${visible.milestone}:${stage.number}`;
}

export function predictedHiddenMission(mission:HiddenPowerMissionState,run:PowerRun|null,confirmed:PowerRun|null,now:number){
 if(mission.endsAt===undefined||mission.endsAt<=now||!run||run.id!==confirmed?.id)return mission;
 const kind=mission.kind;
 const pending=Math.max(0,(run.powerUses?.[kind]??0)-(confirmed.powerUses?.[kind]??0));
 return pending?{...mission,uses:mission.uses+pending}:mission;
}

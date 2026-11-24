import type {SeasonEventReward} from '@garden/contracts';

/** Selected season reward cards. Shared by the authoritative API and local previews. */
export const SEASON_EVENT_GOALS:Record<'personal'|'guild',{target:number;reward:SeasonEventReward}>={
 personal:{target:10,reward:{coins:200,stars:0,items:{}}},
 guild:{target:30,reward:{coins:0,stars:3,items:{'wind-row':2}}},
};

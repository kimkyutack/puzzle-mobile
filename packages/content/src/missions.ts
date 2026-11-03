import type {MissionDefinition,MissionPeriod,ActivityReward} from '@garden/contracts';
const coins=(amount:number):ActivityReward=>({coins:amount,items:{}});
export const MISSIONS:MissionDefinition[]=[
 {id:'d-clear',period:'daily',title:'새 퍼즐 3판 완성',metric:'clears',target:3,icon:'star',reward:coins(50)},
 {id:'d-tiles',period:'daily',title:'타일 150개 모으기',metric:'tiles',target:150,icon:'tile_ruby_v12',reward:{coins:0,items:{hammer:1}}},
 {id:'d-shield',period:'daily',title:'방패 40개 모으기',metric:'collect-drop',target:40,icon:'tile_shield_v12',reward:coins(50)},
 {id:'d-ruby',period:'daily',title:'루비 40개 모으기',metric:'collect-berry',target:40,icon:'tile_ruby_v12',reward:{coins:0,items:{shuffle:1}}},
 {id:'d-make',period:'daily',title:'특수 타일 5개 만들기',metric:'specials-made',target:5,icon:'wind-row',reward:coins(75)},
 {id:'d-use',period:'daily',title:'특수 타일 6번 터뜨리기',metric:'specials-used',target:6,icon:'bomb',reward:{coins:0,items:{'sweep-row':1}}},
 {id:'d-mini',period:'daily',title:'보물 카드 1번 성공',metric:'minigame-wins',target:1,icon:'chest',reward:{coins:0,items:{'move-hourglass':1}}},
 {id:'w-clear',period:'weekly',title:'새 퍼즐 20판 완성',metric:'clears',target:20,icon:'star',reward:coins(200)},
 {id:'w-hard',period:'weekly',title:'어려운 퍼즐 3판 완성',metric:'hard-clears',target:3,icon:'world-bomb',reward:{coins:100,items:{'cross-firework':1}}},
 {id:'w-tiles',period:'weekly',title:'타일 1,500개 모으기',metric:'tiles',target:1500,icon:'tile_bell_v12',reward:{coins:0,items:{'sweep-border':2}}},
 {id:'w-shield',period:'weekly',title:'방패 300개 모으기',metric:'collect-drop',target:300,icon:'tile_shield_v12',reward:coins(150)},
 {id:'w-ruby',period:'weekly',title:'루비 300개 모으기',metric:'collect-berry',target:300,icon:'tile_ruby_v12',reward:{coins:0,items:{'color-magnet':1}}},
 {id:'w-make',period:'weekly',title:'특수 타일 40개 만들기',metric:'specials-made',target:40,icon:'rainbow',reward:{coins:0,items:{'cross-firework':1}}},
 {id:'w-use',period:'weekly',title:'특수 타일 60번 터뜨리기',metric:'specials-used',target:60,icon:'bomb',reward:coins(200)},
 {id:'w-combo',period:'weekly',title:'특수 타일 조합 10번',metric:'combos',target:10,icon:'glider',reward:{coins:0,items:{'color-magnet':2}}},
 {id:'w-mini',period:'weekly',title:'보물 카드 5번 성공',metric:'minigame-wins',target:5,icon:'chest',reward:{coins:100,items:{'move-hourglass':2}}},
 {id:'w-days',period:'weekly',title:'5일 동안 정원 방문',metric:'active-days',target:5,icon:'home',reward:coins(250)}
];
/** Daily midnight and Monday midnight in Asia/Seoul; always uses server time. */
export function missionPeriod(period:MissionPeriod,now:number){
 const day=86_400_000,offset=9*3_600_000,local=new Date(now+offset),midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-offset;
 const start=period==='daily'?midnight:midnight-((local.getUTCDay()+6)%7)*day;
 return {id:(period==='daily'?'d:':'w:')+new Date(start+offset).toISOString().slice(0,10),start,endsAt:start+(period==='daily'?1:7)*day};
}

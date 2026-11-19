import {COLORS,GARDEN_STAGE_ENGINE_VERSION,supportsImmediateGardenStages,type LevelDefinition,type GardenStageKind,type GardenStageDefinition} from '@garden/contracts';
export const GARDEN_STAGE_VARIANTS=12;
/** Authored floor routes: straight bend, U-shaped walk, and a branching garden. */
export function gardenStageCandidate(kind:GardenStageKind,variant:number,engineVersion:string=GARDEN_STAGE_ENGINE_VERSION):LevelDefinition {
 const width=9,height=9,at=(x:number,y:number)=>y*width+x,channels:number[]=[];
 const shape=variant%3;
 if(shape===0){for(let x=0;x<=7;x++)channels.push(at(x,4));for(let y=5;y<9;y++)channels.push(at(7,y));}
 else if(shape===1){for(let x=0;x<=7;x++)channels.push(at(x,1));for(let y=2;y<=7;y++)channels.push(at(7,y));for(let x=6;x>=1;x--)channels.push(at(x,7));}
 else if(kind==='water'){for(let x=0;x<9;x++)channels.push(at(x,4));for(let y=3;y>=1;y--)channels.push(at(4,y));for(let y=5;y<=7;y++)channels.push(at(4,y));}
 else{for(let x=0;x<=3;x++)channels.push(at(x,2));for(let y=3;y<=6;y++)channels.push(at(3,y));for(let x=4;x<9;x++)channels.push(at(x,6));}
 const destinations=kind==='water'&&shape===2?[at(8,4),at(4,1),at(4,7)]:[channels.at(-1)!];
 const eligible=channels.filter((cell,i)=>i>0&&!destinations.includes(cell));
 const gateCount=Math.min(eligible.length,3+Math.floor(variant/3));
 const gates=[...new Set([eligible[0]!,...Array.from({length:gateCount-1},(_,i)=>eligible[Math.floor((i+1)*(eligible.length-1)/(gateCount-1))]!)])];
 const gardenStage:GardenStageDefinition={kind,source:channels[0]!,channels,gates,destinations};
 return {id:kind==='water'?10:20,version:supportsImmediateGardenStages(engineVersion)?'garden-stage-v3':engineVersion===GARDEN_STAGE_ENGINE_VERSION?'garden-stage-v1':'garden-stage-v2',engineVersion,width,height,
  colors:[...COLORS.slice(0,variant<6?4:5)],moves:36,seed:714_123+variant*7919+(kind==='animal'?104729:0),shape:Array(81).fill(true),obstacles:[],gardenStage,
  goals:[{kind:kind==='water'?'garden-water':'garden-route',count:destinations.length,remaining:destinations.length}],difficulty:variant>=9?'hard':'normal',
  strategy:{id:'garden-'+kind,name:kind==='water'?'물길 정원':'동물 길 안내',hint:kind==='water'?'흙마개 위의 타일을 맞춰 꽃까지 물을 보내세요.':'길을 막은 흙마개 위에서 타일을 맞춰 토끼가 집에 가도록 도와주세요.'}};
}

import type {GardenStageDefinition} from '@garden/contracts';

/** The unrotated corner opens west and south. */
export function gardenFloor(stage:GardenStageDefinition,at:number,width:number,connected:boolean){
 const index=stage.kind==='animal'?stage.channels.indexOf(at):-1;
 const neighbors=stage.kind==='animal'
  ? new Set([stage.channels[index-1],stage.channels[index+1]])
  : new Set(stage.channels);
 const x=at%width,y=Math.floor(at/width);
 const n=y>0&&neighbors.has(at-width),e=x<width-1&&neighbors.has(at+1),s=neighbors.has(at+width),w=x>0&&neighbors.has(at-1);
 const mask=(n?1:0)|(e?2:0)|(s?4:0)|(w?8:0),count=Number(n)+Number(e)+Number(s)+Number(w);
 const corner=count===2&&mask!==5&&mask!==10;
 const shape=count>2?'cross':corner?'corner':'straight';
 const rotation=corner?({12:0,9:90,3:180,6:270} as Record<number,number>)[mask]!:shape==='straight'&&(n||s)?90:0;
 return {id:`stage_${stage.kind==='water'&&connected?'water':'dry'}_${shape}_v33`,rotation};
}

export function animalRouteDirection(at:number,next:number|undefined,width:number){
 if(next===undefined)return 'down';
 const dx=next%width-at%width;
 if(dx!==0)return dx<0?'left':'right';
 return next<at?'up':'down';
}

import {supportsEndpointPipes,type Obstacle} from '@garden/contracts';

export const endpointPipe=(o:Obstacle,engine:string)=>o.kind==='pipe'&&o.endOnly===true&&supportsEndpointPipes(engine);
export const pipeEnd=(o:Obstacle,at:number)=>at===o.footprint[0]||at===o.footprint.at(-1);
/** One effect retracts one cell, from the end it actually reaches. The body
 * never transfers damage to a distant end. Ties keep the authored path order. */
export function struckPipeEnd(o:Obstacle,cells:readonly number[],width:number,adjacent=false):'start'|'end'|undefined{
 const reaches=(end:number)=>cells.some(at=>at===end||adjacent&&Math.abs(at%width-end%width)+Math.abs(Math.floor(at/width)-Math.floor(end/width))===1);
 if(reaches(o.footprint[0]!))return 'start';
 if(reaches(o.footprint.at(-1)!))return 'end';
 return undefined;
}

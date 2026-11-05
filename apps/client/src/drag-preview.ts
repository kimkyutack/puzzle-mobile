import type {GameState} from '@garden/contracts';

export type DragAxis='x'|'y';
export interface DragProjection {axis:DragAxis|null;to:number|null;x:number;y:number;progress:number;canRelease:boolean}
export function draggableCell(state:GameState,index:number):boolean{
 const cell=state.cells[index];return !!cell?.exists&&!!cell.tile&&cell.tile.kind!=='seed'&&!cell.obstacleId;
}
/** Input geometry only. Legal-match decisions remain in the shared engine. */
export function projectDrag(state:GameState,from:number,dx:number,dy:number,size:number,axis:DragAxis|null=null):DragProjection{
 if(!Number.isFinite(size)||size<=0||!draggableCell(state,from))return {axis:null,to:null,x:0,y:0,progress:0,canRelease:false};
 const travel=Math.max(Math.abs(dx),Math.abs(dy));
 if(!axis&&travel<Math.max(4,size*.07))return {axis:null,to:null,x:0,y:0,progress:0,canRelease:false};
 axis??=Math.abs(dx)>=Math.abs(dy)?'x':'y';
 const raw=axis==='x'?dx:dy,sign=Math.sign(raw),candidate=from+sign*(axis==='x'?1:state.width);
 const adjacent=sign!==0&&candidate>=0&&candidate<state.cells.length&&Math.abs(candidate%state.width-from%state.width)+Math.abs(Math.floor(candidate/state.width)-Math.floor(from/state.width))===1;
 const to=adjacent&&draggableCell(state,candidate)?candidate:null;
 const amount=to===null?Math.min(size*.24,Math.abs(raw)*.24):Math.min(size,Math.abs(raw))+Math.min(size*.08,Math.max(0,Math.abs(raw)-size)*.12);
 const offset=amount*sign,progress=to===null?0:Math.min(1,Math.abs(raw)/size);
 return {axis,to,x:axis==='x'?offset:0,y:axis==='y'?offset:0,progress,canRelease:to!==null&&Math.abs(raw)>=size*.28};
}

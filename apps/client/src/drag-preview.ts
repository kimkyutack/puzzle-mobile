import type {GameState} from '@garden/contracts';
import {canPushHarvestCart} from '../../../packages/game-core/src/garden-puzzles';

export type DragAxis='x'|'y';
export interface DragProjection {axis:DragAxis|null;to:number|null;x:number;y:number;progress:number;canRelease:boolean}
/** Small diagonal jitter cannot take the axis. A substantially stronger later
 * movement can correct the initial axis instead of trapping a curved swipe. */
export function dragIntent(state:GameState,from:number,dx:number,dy:number,size:number,axis:DragAxis|null=null){
 if(axis){const primary=axis==='x'?Math.abs(dx):Math.abs(dy),cross=axis==='x'?Math.abs(dy):Math.abs(dx);if(cross>=size*.28&&cross>primary*1.5)axis=axis==='x'?'y':'x';}
 const projection=projectDrag(state,from,dx,dy,size,axis),primary=projection.axis==='x'?Math.abs(dx):Math.abs(dy),cross=projection.axis==='x'?Math.abs(dy):Math.abs(dx);
 return {projection,axis:axis??(projection.canRelease&&primary>=cross*1.25?projection.axis:null)};
}
/** A release without a matching move event must never silently switch the
 * neighbour the player saw. A contradictory release cancels the gesture. */
export function releaseDrag(state:GameState,from:number,dx:number,dy:number,size:number,axis:DragAxis|null,shown:DragProjection){
 const projection=dragIntent(state,from,dx,dy,size,axis).projection;
 if(shown.canRelease&&projection.canRelease&&shown.to!==projection.to)return {projection:shown,observed:projection,cancelled:true,reason:'release-changed-target' as const};
 return {projection,observed:projection,cancelled:false,reason:projection.canRelease?'release' as const:'short-drag' as const};
}
export type CanvasBounds=Pick<DOMRect,'left'|'top'|'width'|'height'>;
export function sameCanvasBounds(a:CanvasBounds,b:CanvasBounds){return [a.width,a.height,b.width,b.height].every(n=>Number.isFinite(n)&&n>0)&&(['left','top','width','height'] as const).every(key=>Math.abs(a[key]-b[key])<=1);}
export function draggableCell(state:GameState,index:number):boolean{
 const cell=state.cells[index];return !!cell?.exists&&(state.obstacles[cell.obstacleId??'']?.kind==='harvest-cart'||!!cell.tile&&cell.tile.kind!=='seed'&&!cell.obstacleId);
}
/** Input geometry only. Legal-match decisions remain in the shared engine. */
export function projectDrag(state:GameState,from:number,dx:number,dy:number,size:number,axis:DragAxis|null=null):DragProjection{
 if(!Number.isFinite(size)||size<=0||!draggableCell(state,from))return {axis:null,to:null,x:0,y:0,progress:0,canRelease:false};
 const travel=Math.max(Math.abs(dx),Math.abs(dy));
 if(!axis&&travel<Math.max(4,size*.07))return {axis:null,to:null,x:0,y:0,progress:0,canRelease:false};
 axis??=Math.abs(dx)>=Math.abs(dy)?'x':'y';
 const raw=axis==='x'?dx:dy,sign=Math.sign(raw),candidate=from+sign*(axis==='x'?1:state.width);
 const adjacent=sign!==0&&candidate>=0&&candidate<state.cells.length&&Math.abs(candidate%state.width-from%state.width)+Math.abs(Math.floor(candidate/state.width)-Math.floor(from/state.width))===1;
 const cart=state.obstacles[state.cells[from]?.obstacleId??'']?.kind==='harvest-cart';
 const to=adjacent&&(cart?canPushHarvestCart(state,from,candidate):draggableCell(state,candidate)&&!state.cells[candidate]?.obstacleId)?candidate:null;
 const amount=to===null?Math.min(size*.24,Math.abs(raw)*.24):Math.min(size,Math.abs(raw))+Math.min(size*.08,Math.max(0,Math.abs(raw)-size)*.12);
 const offset=amount*sign,progress=to===null?0:Math.min(1,Math.abs(raw)/size);
 return {axis,to,x:axis==='x'?offset:0,y:axis==='y'?offset:0,progress,canRelease:to!==null&&Math.abs(raw)>=size*.28};
}

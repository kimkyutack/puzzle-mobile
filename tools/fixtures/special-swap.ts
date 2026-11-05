import {createGame} from '@garden/core';
import {COLORS,ENGINE_VERSION,type GameState,type Special} from '@garden/contracts';

export function specialSwapBoard(kind:Special,matched=[24,25,31,32],destination=17):GameState{
 const state=createGame({id:1,version:'special-swap-regression',engineVersion:ENGINE_VERSION,width:7,height:7,colors:[...COLORS],moves:20,seed:14121,shape:Array(49).fill(true),goals:[{kind:'drop',count:100,remaining:100}],obstacles:[],difficulty:'normal'});
 state.cells.forEach((cell,i)=>{cell.tile={id:i+1,kind:'normal',color:COLORS.filter(c=>c!=='drop')[(i%7+Math.floor(i/7)*2)%5]!};});
 for(const i of [...matched.filter(i=>i!==24),destination])state.cells[i]!.tile={id:i+1,kind:'normal',color:'drop'};
 state.cells[24]!.tile={id:200,kind};state.nextTileId=201;
 return state;
}
export const SPECIAL_SWAP_ACTION={type:'swap',from:24,to:17} as const;
